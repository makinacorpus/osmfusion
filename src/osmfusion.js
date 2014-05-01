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
            featureName: 'properties.geo.name',
            featureID: 'properties._IDOBJ',
            username: '',
            overpassquery: '(\
              node\
                ["amenity"="library"]\
                ($bbox);\
              way\
                ["amenity"="library"]\
                ($bbox);\
              rel\
                ["amenity"="library"]\
                ($bbox);\
            );\
            (._;>;);\
            out;',
            osmtags: {
                amenity: "'library'",
                'addr:city': 'capitalize(currentFeature.properties.COMMUNE)',
                phone: 'i18nPhone(currentFeature.properties.TELEPHONE)',
                postal_code: 'currentFeature.properties.CODE_POSTAL',
                name: 'currentFeature.properties.geo.name'
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
        $scope.setLoadingStatus = function(item, status, delay){
            $scope.loading[item + status] = true;
            $timeout(function(){
                $scope.loading[item + status] = undefined;
            }, 3000);
        };
        $scope.setCurrentFeature = function(feature){
            leafletData.getMap().then(function(map){
                $scope.currentFeature = feature;
                //purge cache of search
                $scope.currentNode = undefined;
                $scope.nodes = [];

                $scope.markers.Localisation.lng = parseFloat(feature.geometry.coordinates[0]);
                $scope.markers.Localisation.lat = parseFloat(feature.geometry.coordinates[1]);
                $scope.markers.Localisation.message = $scope.getFeatureName(feature);
                map.setView(
                    L.latLng(
                        feature.geometry.coordinates[1],
                        feature.geometry.coordinates[0]
                    ),
                    17
                );
                $scope.currentAddress = $scope.$eval($scope.featureAddressExp);
                var b = map.getBounds();
                var obox = '' + b.getSouth() + ',' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast();
                var query = $scope.settings.overpassquery.replace(/\$bbox/g, obox);
                osmService.overpass(query).then(function(nodes){
                    $scope.nodes = osmService.getNodesInJSON(nodes);
                    if ($scope.nodes.length === 1){
                        $scope.setCurrentNode($scope.nodes[0]);
                    }
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
            osmService.setCredentials($scope.username, $scope.mypassword);
            osmService.validateCredentials().then(function(loggedin){
                $scope.loggedin = loggedin;
                if (!loggedin){
                    messagesService.addError('login failed');
                }else{
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
    }]
);