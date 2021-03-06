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
    ['$scope', '$http', '$timeout', '$location', 'messagesService', 'osmService', 'leafletData', '$localStorage',
    function($scope, $http, $timeout, $location, messagesService, osmService, leafletData, $localStorage){

        //configuration
        $scope.search = $location.search();
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
        $scope.layers = {
            baselayers: {
                osm: {
                    name: 'OpenStreetMap',
                    url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    type: 'xyz',
                    visible: true,
                    layerParams: {
                        maxZoom: 20
                    }
                }
            }
        };
        $scope.leafletGeojson = {};
        var hiddenLeafletGeojson;
        var idIcon = L.icon({
            iconUrl: 'images/id-icon.png',
            shadowUrl: 'images/marker-shadow.png',
            iconSize:     [15, 21], // size of the icon
            shadowSize:   [20, 30], // size of the shadow
            iconAnchor:   [15, 21], // point of the icon which will correspond to marker's location
            shadowAnchor: [4, 30],  // the same for the shadow
            popupAnchor:  [-3, -20] // point from which the popup should open relative to the iconAnchor
        });
        var pointToLayer = function (feature, latlng) {
            return L.marker(latlng, {icon: idIcon});
        };
        $scope.queryFeature = '';
        $scope.nodes = undefined;
        $scope.mypassword = '';

        //those configuration that should be stored in localStorage
        $scope.changeset = {
            created_by: 'OSMFusion',
            comment: ''
        };

        $scope.settings = $localStorage.$default({
            featuresURL: '',
            settingsURL: '',
            featureName: '',
            featureID: '',
            username: '',
            changesetID: '',
            osmtags: {},
            osmfilter: [],
            preferAdding: false
        });
        $scope.newOSMKey = '';
        $scope.newOSMValueExpr = '';

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
            config = {
                params: {
                    q: "select * from json where url='" + $scope.settings.featuresURL + "';",
                    format: 'json'
                }
            };
            url = 'http://query.yahooapis.com/v1/public/yql';
            $http.get(url, config).then(
                function(data){
                    $scope.loading.geojson = undefined;
                    if (data.data.query.results === null){
                        $scope.features = [];
                        return;
                    }
                    $scope.features = data.data.query.results.json.features;
                    $scope.setLoadingStatus('geojson' , 'success');
                }, function(){
                    $scope.loading.geojson = undefined;
                    $scope.setLoadingStatus('geojson', 'error');
                });
        };
        $scope.reloadSettings = function(){
            $scope.loading.jsonSettings = true;
            var url, config;
            config = {
                params: {
                    q: "select * from json where url='" + $scope.settings.settingsURL + "';",
                    format: 'json'
                }
            };
            url = 'http://query.yahooapis.com/v1/public/yql';
            $http.get(url, config).then(
                function(data){
                    $scope.loading.jsonsettings = undefined;
                    if (data.data.query.results === null){
                        $scope.setLoadingStatus('jsonsettings', 'error');
                        return;
                    }
                    var newSettings = data.data.query.results.settings;
                    if (newSettings === undefined){
                        $scope.setLoadingStatus('jsonsettings', 'error');
                        return;
                    }
                    $scope.settings.featureName = newSettings.featureName;
                    $scope.settings.featureID = newSettings.featureID;
                    $scope.settings.osmtags = newSettings.osmtags;
                    $scope.settings.osmfilter = newSettings.osmfilter;
                    $scope.settings.preferAdding = newSettings.preferAdding;
                    $scope.setLoadingStatus('jsonsettings' , 'success');
                }, function(){
                    $scope.loading.jsonSettings = undefined;
                    $scope.setLoadingStatus('jsonsettings', 'error');
                });
        };
        var onEachFeature = function(feature, layer){
            //change icon ?
        };
        var style = function(feature) {
            var tags = feature.properties.tags;
            if (tags === undefined){
                return;
            }
            if (tags.building !== undefined){
                return {
                    fillColor: "red",
                    weight: 2,
                    opacity: 1,
                    color: 'red',
                    fillOpacity: 0.4
                };
            }
            if (tags.amenity !== undefined){
                if (tags.amenity === 'parking'){
                    return {
                        fillColor: "blue",
                        weight: 2,
                        opacity: 1,
                        color: 'blue',
                        fillOpacity: 0.4
                    };
                }
            }
        };
        $scope.setCurrentFeature = function(feature){
            $scope.queryFeature = $scope.getFeatureName(feature);
            $scope.currentFeature = feature;
            $scope.currentNode = undefined;
            $scope.nodes = undefined;
            var lng = parseFloat(feature.geometry.coordinates[0]);
            var lat = parseFloat(feature.geometry.coordinates[1]);
            $scope.markers.Localisation.lng = lng;
            $scope.markers.Localisation.lat = lat;
            $scope.markers.Localisation.message = $scope.getFeatureName(feature);
            $scope.currentAddress = $scope.$eval($scope.featureAddressExp);
            $scope.loading.osmfeatures = true;
            leafletData.getMap().then(function(map){
                $scope.currentMap = {lat: lat, lng: lng, zoom: 19};
                map.setView(L.latLng(lat, lng), 19);
                var b = map.getBounds();
                var bbox = '' + b.getWest() + ',' + b.getSouth() + ',' + b.getEast() + ',' + b.getNorth();
                osmService.getMap(bbox).then(function(nodes){
                    $scope.nodes = osmService.getNodesInJSON(nodes);
                    if ($scope.nodes.features.length > 0){
                        $scope.setLoadingStatus('osmfeatures', 'success');
                    }else{
                        $scope.setLoadingStatus('osmfeatures', 'error');
                    }
                    $scope.loading.osmfeatures = false;
                    //filter nodes
                    var feature, result, newFeatures = [];
                    for (var i = 0; i < $scope.nodes.features.length; i++) {
                        feature = $scope.nodes.features[i];
                        result = false; //do not filter by default
                        for (var j = 0; j < $scope.settings.osmfilter.length; j++) {
                            result = result || $scope.$eval(
                                $scope.settings.osmfilter[j],
                                {feature: feature}
                            );
                            if (result){
                                continue;
                            }
                        }
                        if (!result){
                            newFeatures.push(feature);
                        }
                    }
                    $scope.nodes.features = newFeatures;
                    //display them on the map
                    $scope.leafletGeojson = {
                        data: $scope.nodes,
                        pointToLayer: pointToLayer,
                        style: style
                    };
                });
                $scope.currentFeature.osm = {};
                for (var property in $scope.settings.osmtags) {
                    if ($scope.settings.osmtags.hasOwnProperty(property)) {
                        $scope.currentFeature.osm[property] = $scope.getCurrentNodeValueFromFeature(property);
                    }
                }
            });
        };
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
            $scope.loading.updateosm = undefined;
            $scope.currentNode = node;
            $scope.updatedNode = angular.copy(node);
            for (var property in $scope.settings.osmtags) {
                if ($scope.settings.osmtags.hasOwnProperty(property)) {
                    $scope.updatedNode.properties.tags[property] = $scope.getCurrentNodeValueFromFeature(property);
                }
            }
        };
        $scope.addOSMTag = function(key, value){
            $scope.settings.osmtags[key] = value;
        };
        $scope.addOSMFilter = function(filter){
            $scope.settings.osmfilter.push(filter);
        };
        $scope.deleteOSMFilter = function(filter){
            for (var i = 0; i < $scope.settings.osmfilter.length; i++) {
                if (filter === $scope.settings.osmfilter[i]){
                    $scope.settings.osmfilter.splice(i, 1);
                }
            }
        };
        $scope.getCurrentNodeValueFromFeature = function(key){
            if ($scope.settings.osmtags[key] !== undefined){
                var value = $scope.$eval($scope.settings.osmtags[key]);
                //bug reported to yql: null become 'null' string
                //https://developer.yahoo.com/forum/General-Discussion-at-YDN/null-value-transformed-as-a-string/1400156534299-3287e8a9-b810-4bd2-93a2-18724566bf94?msg=1
                if (value !== null && value !== 'null'){
                    return value;
                }
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
                if ($scope.currentNode.properties.tags[key] === value){
                    return;
                }
                return 'danger';
            }
            if ($scope.currentNode.properties.tags[key] === undefined){
                return 'success';
            }
            if ($scope.currentNode.properties.tags[key] !== value){
                return 'warning';
            }
        };

        $scope.createChangeset = function(){
            osmService.createChangeset($scope.settings.featuresURL).then(
                function(data){
                    $scope.settings.changesetID = data;
                }
            );
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
                    $scope.setLoadingStatus('updateosm', 'success', 1000);
                    $scope.loading.updateosm = false;
                    //update node properties (because it's a copy from the server)
                    for (var property in $scope.currentNode.properties.tags) {
                        if ($scope.currentNode.properties.tags.hasOwnProperty(property)) {
                            if ($scope.updatedNode.properties.tags[property] === undefined){
                                delete $scope.currentNode.properties.tags[property];
                            }else{
                                $scope.currentNode.properties.tags[property] = $scope.updatedNode.properties.tags[property];
                            }
                        }
                    }
                },function(){
                    $scope.setLoadingStatus('updateosm', 'error', 1000);
                    $scope.loading.updateosm = false;
                }
            );
        };
        $scope.selectNextFeature = function(){
            $scope.setCurrentFeature(
                $scope.features[
                    $scope.features.indexOf($scope.currentFeature) + 1
                ]
            );
        };
        $scope.selectPreviousFeature = function(){
            $scope.setCurrentFeature(
                $scope.features[
                    $scope.features.indexOf($scope.currentFeature) - 1
                ]
            );
        };
        $scope.addToOSM = function(){
            $scope.loading.addosm = true;
            osmService.addNode($scope.currentFeature).then(
                function(data){
                    $scope.loading.addosm = false;
                    $scope.setLoadingStatus('addosm', 'success', 4000);
                    messagesService.addInfo('Point added', 3000);
                }, function(){
                    $scope.loading.addosm = false;
                    $scope.setLoadingStatus('addosm', 'error', 4000);
                    messagesService.addError('Can t add this point', 10000);
                }
            );
        };
        $scope.displayAllFeatures = function(){
            $scope.queryFeature = '';
        };
        $scope.toggleOSMGeoJSON = function(){
            var old = $scope.leafletGeojson;
            $scope.leafletGeojson = $scope.hiddenLeafletGeojson;
            $scope.hiddenLeafletGeojson = old;
        };
        $scope.$on("leafletDirectiveMap.geojsonClick", function(ev, featureSelected) {
            console.log('click');
            $scope.setCurrentNode(featureSelected);
        });
        $scope.$watch('settings', function(newValue, oldValue){
            if (newValue.geojsonURI !== oldValue.geojsonURI){
                $scope.reloadFeatures();
            }
            if (newValue.featureID !== oldValue.featureID){
                $scope.reloadFeatures();
            }
        }, true);
        //set url settings from search
        if ($scope.search.features !== undefined){
            $scope.settings.featuresURL = $scope.search.features;
        }
        if ($scope.search.settings !== undefined){
            $scope.settings.settingsURL = $scope.search.settings;
        }
        $scope.reloadFeatures();
        $scope.reloadSettings();
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