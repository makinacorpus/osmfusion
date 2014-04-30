/*global angular:false */
/*global L:false */

'use strict';

L.Icon.Default.imagePath = 'images';
//create all myApp modules
angular.module('myApp', [
    'ngRoute',
    'myApp.services',
    'myApp.controllers',
    'myApp.directives',
    'ui.bootstrap',
    'leaflet-directive',
    'gettext',
    'ui.keypress',
    'base64',
    'ngCookies'
]);

angular.module('myApp.controllers', []);
angular.module('myApp.services', []);
angular.module('myApp.directives', []);


/*jshint strict:false */
/*jshint camelcase:false */
/*global angular:false */

angular.module('myApp.services').factory('geoCodingService',
    ['$http',
    function ($http) {
    //var geocodingResults = [];
    //var geolocked = false;
    var get = function(query){
        if (query){
            var url = 'http://nominatim.openstreetmap.org/search?q=' + query + '&format=json&json_callback=JSON_CALLBACK';
            return $http.jsonp(url);
        }
    };
    return {
        get: get
    };
}]);

angular.module('myApp.controllers').controller(
	'GeoController',
	['$scope', '$routeParams', '$location', '$http', 'messagesService', 'Restangular',
	function($scope, $routeParams, $location, $http, messagesService, Restangular){
		console.log('init GeoController');
        messagesService.hook(Restangular);
        var geoService = Restangular.one('immo', $scope.currentProject.id).all('geo');
        $scope.geocodingResults = [];
		$scope.center = {lat: 47.2383, lng: -1.5603, zoom: 13};
        $scope.geolocked = false;
        $scope.searchIcon = {
            iconUrl: '/embed/images/marker-icon-red.png',
            shadowUrl: '/embed/images/marker-shadow.png',
            iconSize:   [25, 41],
            iconAnchor:  [12, 41],
            popupAnchor: [1, -34],
            shadowSize:  [41, 41]
        };
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
        var getGeoCoding = function(query){
            if (query){
                var url = 'http://nominatim.openstreetmap.org/search?q=' + query + '&format=json&json_callback=JSON_CALLBACK';
                return $http.jsonp(url);
            }
        };
        $scope.remoteGeo = undefined;
        geoService.getList().then(function(data){
            if (data.length > 0){
                $scope.remoteGeo = data[0];
            }
        });
        $scope.updateLocation = function(place){
            $scope.markers.Localisation.lat = parseFloat(place.lat);
            $scope.markers.Localisation.lng = parseFloat(place.lon);
            //delete it from markers:
            delete $scope.markers[place.place_id];
            $scope.reloadMarkers();
        };
        $scope.reloadMarkers = function(){
            for (var i = 0; i < $scope.geocodingResults.length; i++) {
                var place = $scope.geocodingResults[i];
                var icon = {
                    id: place.place_id,
                    lat: parseFloat(place.lat),
                    lng: parseFloat(place.lon),
                    message: place.display_name,
                    focus: false,
                    draggable: false,
                    icon: $scope.searchIcon
                };
                if (icon.lat === $scope.markers.Localisation.lat && icon.lng === $scope.markers.Localisation.lng){
                    continue;
                }
                $scope.markers[place.place_id] = icon;
            }
        };
        $scope.updateAdresse = function($event) {
            if ($event.keyCode !== 13 || $scope.geolocked){
                return;
            }
            $scope.geolocked = true;
            var promise = getGeoCoding($scope.currentProject.adresse);
            if (promise === undefined){
                $scope.geolocked = false;
                return;
            }
            //remove places from old results;
            for (var i = 0; i < $scope.geocodingResults.length; i++) {
                var place = $scope.geocodingResults[i];
                delete $scope.markers[place.place_id];
            }
            $scope.geocodingResults = [];
            promise.then(function(data){
                var places = data.data;
                for (var i = 0; i < places.length; i++) {
                    $scope.geocodingResults.push(places[i]);
                }
                $scope.reloadMarkers();
                $scope.geolocked = false;
            });
        };
        $scope.$watch('remoteGeo',
            function(newValue, oldValue){
                if (newValue === undefined){
                    return;
                }
                if ($scope.markers.Localisation.lat !== newValue.lat){
                    $scope.markers.Localisation.lat = newValue.lat;
                }
                if ($scope.markers.Localisation.lng !== newValue.lng){
                    $scope.markers.Localisation.lng = newValue.lng;
                }
                if (oldValue === undefined){
                    return;
                }
                newValue.put()
                    .then(messagesService.addInfo(
                        'Nouvelle localisation enregistrée',
                        2000
                    ));
            }, true);
        $scope.$watch('markers.Localisation',
            function(newValue, oldValue){
                console.log(JSON.stringify(newValue));
                console.log(JSON.stringify(oldValue));
                if (newValue === undefined){
                    return;
                }
                if (newValue.lat === 47.2383 && newValue.lng === -1.5603){
                    return;
                }
                if ($scope.remoteGeo !== undefined){
                    if (newValue.lat === $scope.remoteGeo.lat && newValue.lng === $scope.remoteGeo.lng) {
                        return;
                    }
                    $scope.remoteGeo.lat = $scope.markers.Localisation.lat;
                    $scope.remoteGeo.lng = $scope.markers.Localisation.lng;
                }else{
                    geoService.post($scope.markers.Localisation).then(function(){
                        //console.log('test');
                    });
                }
            }, true
        );
}]);
angular.module('myApp').run(function (gettextCatalog) {
    gettextCatalog.currentLanguage = 'fr';
    gettextCatalog.debug = true;
});

angular.module('myApp.services').factory('messagesService',
    ['$timeout', function($timeout, $modal){
    var messages = [];
    return {
        intervalID: undefined,
        hook: function(Restangular){
            var self = this;
            var onError = function(error){
                self.parseError(error);
                throw error;
            };
            //https://github.com/mgonto/restangular/blob/master/README.md#seterrorinterceptor
            Restangular.setErrorInterceptor(function(response, promise){
                if (response.data.error){
                    onError(response.data.error);
                    return false;
                }
            });
        },
        addInfo: function(msg, delay){
            this.addMessage('info', msg, delay);
        },
        addError: function(msg, delay){
            this.addMessage('danger', msg, delay);
        },
        addWarning: function(msg, delay){
            this.addMessage('warning', msg, delay);
        },
        addMessage: function(type, msg, delay){
            var self = this;
            if (msg.length > 0){
                for (var i = 0; i < messages.length; i++) {
                    if (msg === messages[i].text){
                        return;
                    }
                }
                var message = {type: type, text: msg, delay: delay};
                messages.push(message);
                if (delay !== undefined){
                    $timeout(function(){
                        self.closeMessage(message);
                    }, delay);
                }
            }
        },
        getMessages: function(){
            return messages;
        },
        clearMessages: function(){
            for (var i = 0; i < messages.length; i++) {
                if (messages[i].type === 'danger'){
                    continue;
                }else{
                    messages.splice(i, 1);
                }
            }
        },
        closeMessage: function(msg){
            if (typeof msg === 'number'){
                messages.splice(msg, 1);
            }else{
                for (var i = 0; i < messages.length; i++) {
                    if (msg.text === messages[i].text){
                        messages.splice(i, 1);
                    }
                }
            }
        },
        parseError: function(error){
            var msg;
            if (typeof error === 'object'){
                msg = JSON.stringify(error);
            }else if (typeof error === 'string'){
                msg = error;
            }
            if (msg){
                this.addError(msg);
            }
        }
    };
}]);

angular.module('myApp.controllers').controller(
    'UserMessagesController',
    ['$scope', 'messagesService',
    function($scope, messagesService){
        $scope.messages = messagesService.getMessages();
        $scope.closeAlert = function(index){
            messagesService.closeMessage(index);
        };
        $scope.error = [];
        $scope.info = [];
        var updateMsgs = function(){
            for (var i = 0; i < $scope.messages.length; i++) {
                var msg = $scope.messages[i];
                if (msg.type === 'info'){
                    $scope.info.push(msg);
                }else{
                    $scope.error.push(msg);
                }
            }
        };
        $scope.$watch('messages', function(){
            updateMsgs();
        }, true);
    }]
);

/*jshint strict:false */
/*global angular:false */
angular.module('myApp.services').factory('osmService',
    ['$base64', '$cookieStore', '$http', '$q',
    function ($base64, $cookieStore, $http, $q) {
        var API = 'http://api.openstreetmap.org/api';
        // initialize to whatever is in the cookie, if anything
        //$http.defaults.headers.common['Authorization'] = 'Basic ' + $cookieStore.get('authdata');
        var parseXml;
        var encoded;

        if (typeof window.DOMParser !== 'undefined') {
            parseXml = function(xmlStr) {
                return ( new window.DOMParser() ).parseFromString(xmlStr, 'text/xml');
            };
        } else if (typeof window.ActiveXObject !== 'undefined' &&
               new window.ActiveXObject('Microsoft.XMLDOM')) {
            parseXml = function(xmlStr) {
                var xmlDoc = new window.ActiveXObject('Microsoft.XMLDOM');
                xmlDoc.async = 'false';
                xmlDoc.loadXML(xmlStr);
                return xmlDoc;
            };
        } else {
            throw new Error('No XML parser found');
        }

        return {
            validateCredentials: function(){
                debugger;
                var config = {}
                this.get('permissions' ).then(function(){
                    debugger;
                });
            },
            setCredentials: function(username, password){
                encoded = $base64.encode(username + ':' + password);
            },
            getAuthorization: function(){
                return 'Basic ' + encoded;
            },
            clearCredentials: function () {
                encoded = undefined;
            },
            parseXML: function(data){
                return parseXml(data);
            },
            get: function(method, config){
                var deferred = $q.defer();
                var self = this;

                $http.get(API + method, config).then(function(data){
                    deferred.resolve(self.parseXML(data.data));
                },function(data) {
                    deferred.reject(data);
                });
                return deferred.promise;
            },
            overpass: function(query){
                var url = 'http://overpass-api.de/api/interpreter';
                var deferred = $q.defer();
                var self = this;
                var headers = {'Content-Type': 'application/x-www-form-urlencoded'};
                console.log('overpass query start');
                $http.post(url, query, {headers: headers}).then(function(data){
                    console.log('overpass query succeed');
                    deferred.resolve(self.parseXML(data.data));
                },function(data) {
                    console.log('overpass query failed');
                    deferred.reject(data);
                });
                return deferred.promise;
            },
            getNodesInJSON: function(xmlNodes){
                var nodesHTML = xmlNodes.documentElement.getElementsByTagName('node');
                var nodes = [];
                var node, tags, tag, i, j;
                for (i = 0; i < nodesHTML.length; i++) {
                    node = {
                        type: 'Feature',
                        properties: {id: nodesHTML[i].id},
                        geometry: {
                            type: 'Point',
                            coordinates: [
                                parseFloat(nodesHTML[i].getAttribute('lon')),
                                parseFloat(nodesHTML[i].getAttribute('lat'))
                            ]
                        }
                    };
                    tags = nodesHTML[i].getElementsByTagName('tag');
                    for (j = 0; j < tags.length; j++) {
                        tag = tags[j];
                        node.properties[tag.getAttribute('k')] = tag.getAttribute('v');
                    }
                    nodes.push(node);
                }
                return nodes;
            }
        };
    }
]);

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
    ['$scope', '$http', '$timeout', 'messagesService', 'osmService', 'leafletData',
    function($scope, $http, $timeout, messagesService, osmService, leafletData){

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
        $scope.password = '';

        //those configuration that should be stored in localstorage
        $scope.geojsonURI = 'https://raw.githubusercontent.com/toutpt/opendata-nantes-geojson/master/static/geojson/culture-bibliotheque.geo.json';
        $scope.featureName = 'properties.geo.name';
        $scope.featureID = 'properties._IDOBJ';
        $scope.username = '';
        $scope.overpassquery = '[amenity=library]';
        $scope.osmtags = {
            amenity: "'library'",
            'addr:city': 'capitalize(currentFeature.properties.COMMUNE)',
            phone: 'i18nPhone(currentFeature.properties.TELEPHONE)',
            postal_code: 'currentFeature.properties.CODE_POSTAL',
            name: 'currentFeature.properties.geo.name'
        };



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
            return $scope.traverse(feature, $scope.featureID);
        };
        $scope.getFeatureName = function(feature){
            if (!feature){
                return;
            }
            var name = $scope.traverse(feature, $scope.featureName);
            if (!name){
                //try OSM:
                return feature.properties.name;
            }
            return name;
        };
        $scope.reloadFeatures = function(){
            $scope.loading.geojson = true;
            var url, config;
            if ($scope.geojsonURI.indexOf('http') === 0){
                config = {
                    params: {
                        q: "select * from json where url='" + $scope.geojsonURI + "';",
                        format: 'json'
                    }
                };
                url = 'http://query.yahooapis.com/v1/public/yql';
            }else{
                url = $scope.geojsonURI;
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
                    $scope.setLoadingStatus('geojson' , 'success', 3000);
                }, function(){
                    $scope.loading.geojson = undefined;
                    $scope.setLoadingStatus('geojson', 'error');
                });
        };
        $scope.setLoadingStatus = function(item, status, delay){
            $scope.loading[item + status] = true;
            $timeout(function(){
                console.log('reset');
                $scope.loading[item + status] = undefined;
            }, 3000);
        };
        $scope.setCurrentFeature = function(feature){
            leafletData.getMap().then(function(map){
                $scope.currentFeature = feature;
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
                var query = 'node('+ obox+')' + $scope.overpassquery + ';out;';

                osmService.overpass(query).then(function(nodes){
                    $scope.nodes = osmService.getNodesInJSON(nodes);
                    if ($scope.nodes.length === 1){
                        $scope.setCurrentNode($scope.nodes[0]);
                    }
                });
                $scope.currentFeature.osm = {};
                for (var property in $scope.osmtags) {
                    if ($scope.osmtags.hasOwnProperty(property)) {
                        $scope.currentFeature.osm[property] = $scope.getCurrentNodeValueFromFeature(property);
                    }
                }
            });
        };
        $scope.$watch('geojson', function(){
            $scope.reloadFeatures();
        });
        $scope.$watch('featureID', function(){
            $scope.reloadFeatures();
        });

        $scope.login = function(){
            debugger;
            osmService.setCredentials($scope.username, $scope.password);
            osmService.get('/capabilities').then(function(capabilities){
                $scope.capabilities = capabilities;
            });
        };
        $scope.logout = function(){
            osmService.clearCredentials();
        };
        $scope.setCurrentNode = function(node){
            $scope.currentNode = node;
            $scope.updatedNode = angular.copy(node);
            for (var property in $scope.osmtags) {
                if ($scope.osmtags.hasOwnProperty(property)) {
                    $scope.updatedNode.properties[property] = $scope.getCurrentNodeValueFromFeature(property);
                }
            }
        };
        $scope.addOSMTag = function(){
            $scope.osmtags[$scope.newOSMKey] = $scope.newOSMValueExpr;
            $scope.newOSMKey = '';
            $scope.newOSMValueExpr = '';
        };
        $scope.getCurrentNodeValueFromFeature = function(key){
            if ($scope.osmtags[key] !== undefined){
                return $scope.$eval($scope.osmtags[key]);
            }
        };
        $scope.deleteOSMTag = function(index){
            delete $scope.osmtags[index];
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

    }]
);
angular.module("gettext").run(['$http', 'gettextCatalog',
	function ($http, gettextCatalog) {
	$http.get('translations/fr.json').then(function(translations){
		gettextCatalog.setStrings('fr', translations.data.fr);
	});
}]);