/*jshint strict:false */
/*global angular:false */
/*global L:false */
angular.module('myApp').config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/', {
        controller: 'OpendataController',
        templateUrl: 'partials/osmfusion.html'
    });
}]);
angular.module('myApp.controllers').controller(
    'OpendataController',
    ['$scope', '$http', '$timeout', 'messagesService', 'osmService', 'leafletData', '$localStorage',
    function($scope, $http, $timeout, messagesService, osmService, leafletData, $localStorage){

        //configuration
        $scope.currentMap = {lat: 47.2383, lng: -1.5603, zoom: 11};
        $scope.markers = {
            Localisation: {
                id: undefined,
                lat: 47.2383,
                lng: -1.5603,
                message: 'Déplacer ce marker sur la localisation souhaitée.',
                focus: true,
                draggable: true
            }
        };
        $scope.nodes = [];
        $scope.mypassword = '';

        //those configuration that should be stored in localStorage
        $scope.changeset = {
            created_by: 'OSMFusion',
            comment: ''
        };

        $scope.settings = $localStorage.$default({
            geojsonURI: 'https://raw.githubusercontent.com/toutpt/opendata-nantes-geojson/master/static/geojson/culture-bibliotheque.geo.json',
            settingjsonURI: 'https://raw.githubusercontent.com/toutpt/opendata-nantes-geojson/master/static/geojson/culture-bibliotheque-osmfusion.json',
            featureName: 'properties.geo.name',
            featureID: 'properties._IDOBJ',
            username: '',
            changesetID: '',
            osmtags: {
                name: 'currentFeature.properties.geo.name',
                amenity: "'library'",
                'addr:city': 'capitalize(currentFeature.properties.COMMUNE)',
                'addr:postcode': 'currentFeature.properties.CODE_POSTAL',
                phone: 'i18nPhone(currentFeature.properties.TELEPHONE)'
            }
        });
        $scope.capitalize = function(string) {
            return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
        };
        var phoneRegExp = new RegExp('^[0-9]{1}');
        $scope.i18nPhone = function(string){
            if (string.indexOf('+33') !== 0){
                return string.replace(phoneRegExp, '+33 ');
            }
            return string;
        };
        $scope.loading = {
            geojson: undefined,
            geojsonerror: undefined,
            geojsonsuccess: undefined
        };
        $scope.setLoadingStatus = function(item, status, delay){
            $scope.loading[item + status] = true;
            if (delay !== undefined){
                $timeout(function(){
                    $scope.loading[item + status] = undefined;
                }, delay);
            }
        };

        $scope.traverse = function(obj, path){
            var succeed = true;
            if (typeof path !== 'object'){
                path = [path];
            }
            for (var j = 0; j < path.length; j++) {
                var splited = path[j].split('.');
                var traversed = obj;
                for (var i = 0; i < splited.length; i++) {
                    if (traversed.hasOwnProperty(splited[i])){
                        traversed = traversed[splited[i]];
                        succeed = true;
                    }else{
                        succeed = false;
                        break;
                    }
                }
                if (succeed){
                    if (traversed){
                        return traversed;
                    }
                }
            }
        };
        $scope.getFeatureID = function(feature){
            if (!feature){
                return;
            }
            return $scope.traverse(feature, $scope.settings.featureID);
        };
        $scope.getFeatureName = function(feature){
            if (!feature){
                return;
            }
            var name = $scope.traverse(feature, $scope.settings.featureName);
            if (!name){
                //try OSM:
                return feature.properties.name;
            }
            return name;
        };
        $scope.reloadFeatures = function(){
            $scope.loading.geojson = true;
            var url, config;
            if ($scope.settings.geojsonURI.indexOf('http') === 0){
                config = {
                    params: {
                        q: "select * from json where url='" + $scope.settings.geojsonURI + "';",
                        format: 'json'
                    }
                };
                url = 'http://query.yahooapis.com/v1/public/yql';
            }else{
                url = $scope.settings.geojsonURI;
            }
            $http.get(url, config).then(
                function(data){
                    $scope.loading.geojson = undefined;
                    if (config !== undefined){
                        if (data.data.query.results === null){
                            $scope.features = [];
                            return;
                        }
                        $scope.features = data.data.query.results.json.features;
                    }else{
                        $scope.features = data.data.features;
                    }
                    $scope.setLoadingStatus('geojson' , 'success');
                }, function(){
                    $scope.loading.geojson = undefined;
                    $scope.setLoadingStatus('geojson', 'error');
                });
        };
        $scope.setCurrentFeature = function(feature){
            leafletData.getMap().then(function(map){
                $scope.currentFeature = feature;
                //purge cache of search
                $scope.currentNode = undefined;
                $scope.nodes = [];
                var lng = parseFloat(feature.geometry.coordinates[0]);
                var lat = parseFloat(feature.geometry.coordinates[1]);
                $scope.markers.Localisation.lng = lng;
                $scope.markers.Localisation.lat = lat;
                $scope.markers.Localisation.message = $scope.getFeatureName(feature);
                map.setView(L.latLng(lat, lng), 17);
                $scope.currentAddress = $scope.$eval($scope.featureAddressExp);
                var b = map.getBounds();
                $scope.loading.osmfeatures = true;
                var bbox = '' + b.getWest() + ',' + b.getSouth() + ',' + b.getEast() + ',' + b.getNorth();
                osmService.getMap(bbox).then(function(map){
                    $scope.nodes = osmService.getNodesInJSON(map, {lat:lat, lng:lng, amenity: 'library'});
                    if ($scope.nodes.length > 0){
                        $scope.setLoadingStatus('osmfeatures', 'success');
                    }else{
                        $scope.setLoadingStatus('osmfeatures', 'error');
                    }
                    if ($scope.nodes.length === 1){
                        $scope.setCurrentNode($scope.nodes[0]);
                    }
                    $scope.loading.osmfeatures = false;
                });
                $scope.currentFeature.osm = {};
                for (var property in $scope.settings.osmtags) {
                    if ($scope.settings.osmtags.hasOwnProperty(property)) {
                        $scope.currentFeature.osm[property] = $scope.getCurrentNodeValueFromFeature(property);
                    }
                }
            });
        };
        $scope.$watch('settings', function(newValue, oldValue){
            if (newValue.geojsonURI !== oldValue.geojsonURI){
                $scope.reloadFeatures();
            }
            if (newValue.featureID !== oldValue.featureID){
                $scope.reloadFeatures();
            }
        }, true);
        $scope.login = function(){
            osmService.setCredentials($scope.settings.username, $scope.mypassword);
            osmService.validateCredentials().then(function(loggedin){
                $scope.loggedin = loggedin;
                if (!loggedin){
                    messagesService.addError('login failed');
                }else{
                    //persist credentials
                    $scope.settings.credentials = osmService.getCredentials();
                    messagesService.addInfo('login success', 2000);
                }
            });
        };
        $scope.logout = function(){
            osmService.clearCredentials();
            $scope.loggedin = false;
        };
        $scope.setCurrentNode = function(node){
            $scope.currentNode = node;
            $scope.updatedNode = angular.copy(node);
            for (var property in $scope.settings.osmtags) {
                if ($scope.settings.osmtags.hasOwnProperty(property)) {
                    $scope.updatedNode.properties[property] = $scope.getCurrentNodeValueFromFeature(property);
                }
            }
        };
        $scope.addOSMTag = function(){
            $scope.settings.osmtags[$scope.newOSMKey] = $scope.newOSMValueExpr;
            $scope.newOSMKey = '';
            $scope.newOSMValueExpr = '';
        };
        $scope.getCurrentNodeValueFromFeature = function(key){
            if ($scope.settings.osmtags[key] !== undefined){
                return $scope.$eval($scope.settings.osmtags[key]);
            }
        };
        $scope.deleteOSMTag = function(index){
            delete $scope.settings.osmtags[index];
        };
        $scope.getTableRowClass = function(key, value){
            if (key === 'id'){
                return 'hidden';
            }
            if (value === '' || value === undefined){
                if ($scope.currentNode.properties[key] === value){
                    return;
                }
                return 'danger';
            }
            if ($scope.currentNode.properties[key] === undefined){
                return 'success';
            }
            if ($scope.currentNode.properties[key] !== value){
                return 'warning';
            }
        };
        $scope.reloadFeatures();

        $scope.createChangeset = function(){
            osmService.createChangeset($scope.settings.geojsonURI);
        };
        $scope.getLastOpenedChangesetId = function(){
            osmService.getLastOpenedChangesetId().then(function(data){
                $scope.settings.changesetID = data;
            });
        };
        $scope.closeChangeset = function(){
            osmService.closeChangeset().then(
                function(){
                    $scope.settings.changesetID = undefined;
                }
            );

        };
        $scope.updateOSM = function(){
            $scope.loading.updateosm = true;
            osmService.updateNode($scope.currentNode, $scope.updatedNode).then(
                function(){
                    $scope.setLoadingStatus('updateosm', 'success');
                },function(){
                    $scope.setLoadingStatus('updateosm', 'error');
                }
            );
        };
        //update services from peristent settings
        if ($scope.settings.credentials && $scope.settings.username){
            //validate credentials
            osmService._credentials = $scope.settings.credentials;
            osmService._login = $scope.settings.username;
            osmService.validateCredentials().then(function(loggedin){
                $scope.loggedin = loggedin;
                if ($scope.settings.changesetID !== ''){
                    $scope.getLastOpenedChangesetId();
                }
            });
        }

    }]
);