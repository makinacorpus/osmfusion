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
    'ngCookies',
    'ngStorage'
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
//        var API = 'http://api06.dev.openstreetmap.org/api';
        // initialize to whatever is in the cookie, if anything
        //$http.defaults.headers.common['Authorization'] = 'Basic ' + $cookieStore.get('authdata');
        var parseXml;

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

        var service = {
            _credentials: '',
            _userId: '',
            _login: '',
            _nodes: [],
            _changeset: '',

            validateCredentials: function(){
                var deferred = $q.defer();
                var self = this;
                self.getUserDetails().then(function(data){
                    var users = data.getElementsByTagName('user');
                    if (users.length > 0){
                        self._userId = users[0].id;
                    }
                    deferred.resolve(users.length > 0);
                });
                return deferred.promise;
            },
            setCredentials: function(username, password){
                this._login = username;
                this._credentials = $base64.encode(username + ':' + password);
                return this._credentials;
            },
            getCredentials: function(){
                return this._credentials;
            },
            getAuthorization: function(){
                return 'Basic ' + this._credentials;
            },
            clearCredentials: function () {
                this._credentials = '';
            },
            parseXML: function(data){
                return parseXml(data);
            },
            getAuthenticated: function(method, config){
                if (config === undefined){
                    config = {};
                }
                config.headers = {Authorization: this.getAuthorization()};
                return this.get(method, config);
            },
            get: function(method, config){
                var deferred = $q.defer();
                var self = this;

                $http.get(API + method, config).then(function(data){
                    var contentType = data.headers()['content-type'];
                    var results;
                    if (contentType.indexOf("application/xml;") === 0){
                        results = self.parseXML(data.data);
                    }else if (contentType.indexOf("text/xml;") === 0){
                        results = self.parseXML(data.data);
                    }else{
                        results = data.data;
                    }
                    deferred.resolve(results);
                },function(data) {
                    deferred.reject(data);
                });
                return deferred.promise;
            },
            put: function(method, content, config){
                var deferred = $q.defer();
                var self = this;

                if (config === undefined){
                    config = {};
                }
                config.headers = {Authorization: this.getAuthorization()};
                $http.put(API + method, content, config).then(function(data){
                    var contentType = data.headers()['content-type'];
                    var results;
                    if (contentType.indexOf("application/xml;") === 0){
                        results = self.parseXML(data.data);
                    }else if (contentType.indexOf("text/xml;") === 0){
                        results = self.parseXML(data.data);
                    }else{
                        results = data.data;
                    }
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
                $http.post(url, query, {headers: headers}).then(function(data){
                    deferred.resolve(self.parseXML(data.data));
                },function(data) {
                    deferred.reject(data);
                });
                return deferred.promise;
            },
            getNodesInJSON: function(xmlNodes, filter){
                this._nodes = xmlNodes;
                var nodesHTML = xmlNodes.documentElement.getElementsByTagName('node');
                var nodes = [];
                var node, tags, tag, i, j;
                for (i = 0; i < nodesHTML.length; i++) {
                    var nlng = parseFloat(nodesHTML[i].getAttribute('lon'));
                    var nlat = parseFloat(nodesHTML[i].getAttribute('lat'));
                    if (filter !== undefined){
                        if (filter.lat !== undefined && filter.lng !== undefined){
                            var dlat = Math.abs(filter.lat - nlat);
                            var dlng = Math.abs(filter.lng - nlng);
                            if (dlat > 0.0005 || dlng > 0.0005){
                                continue;
                            }
                        }
                    }
                    node = {
                        type: 'Feature',
                        properties: {id: nodesHTML[i].id},
                        geometry: {
                            type: 'Point',
                            coordinates: [nlng, nlat]
                        }
                    };
                    tags = nodesHTML[i].getElementsByTagName('tag');
                    for (j = 0; j < tags.length; j++) {
                        tag = tags[j];
                        node.properties[tag.getAttribute('k')] = tag.getAttribute('v');
                    }
                    if (filter.name){
                        if (node.properties.name === undefined){
                            continue;
                        }
                    }
                    if (filter.amenity !== undefined){
                        if (node.properties.amenity !== filter.amenity){
                            continue;
                        }
                    }
                    nodes.push(node);
                }
                return nodes;
            },
//OSM API: https://wiki.openstreetmap.org/wiki/API_v0.6

            /*
            https://wiki.openstreetmap.org/wiki/API_v0.6#Create:_PUT_.2Fapi.2F0.6.2Fchangeset.2Fcreate
             */
            createChangeset: function(sourceURI){
                var deferred = $q.defer();
                var changeset = '<osm><changeset><tag k="created_by" v="OSMFusion"/><tag k="comment" v="';
                changeset += 'Import data from ' + sourceURI + '"/></changeset></osm>';
                this.put('/0.6/changeset/create', changeset).then(function(data){
                    debugger;
                });
                return deferred.promise;
            },
            getLastOpenedChangesetId: function(){
                var deferred = $q.defer();
                var self = this;
                this.get('/0.6/changesets', {params:{user: this._userId, open: true}}).then(function(data){
                    var changesets = data.getElementsByTagName('changeset');
                    if (changesets.length > 0){
                        self._changeset = changesets[0].id;
                        deferred.resolve(changesets[0].id);
                    }else{
                        deferred.resolve();
                    }
                });
                return deferred.promise;
            },
            closeChangeset: function(){
                var self = this;
                var results = this.put('/0.6/changeset/'+ self._changeset +'/close');
                self._changeset = undefined;
                return results;
            },
            getUserDetails: function(){
                return this.getAuthenticated('/0.6/user/details');
            },
            getMap: function(bbox){
                return this.get('/0.6/map?bbox='+bbox);
            },
            updateNode: function(currentNode, updatedNode){
                //we need to do the diff and build the xml
                //first try to find the node by id
                var node = this._nodes.getElementById(currentNode.properties.id);
                var tag;
                //incremenet version number
//                node.setAttribute('version', parseInt(node.getAttribute('version')) + 1);
                node.setAttribute('changeset', this._changeset);
                node.setAttribute('user', this._login);
                while (node.firstChild) node.removeChild(node.firstChild);
                var osm = document.createElement('osm');
                osm.appendChild(node);
                for (var property in updatedNode.properties) {
                    if (updatedNode.properties.hasOwnProperty(property)) {
                        tag = document.createElement('tag');
                        tag.setAttribute('k', property);
                        tag.setAttribute('v', updatedNode.properties[property]);
                        node.appendChild(tag);
                    }
                }
                //put request !!
                return this.put('/0.6/node/' + currentNode.properties.id, osm.outerHTML);
            }
        };
        return service;
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
angular.module("gettext").run(['$http', 'gettextCatalog',
	function ($http, gettextCatalog) {
	$http.get('translations/fr.json').then(function(translations){
		gettextCatalog.setStrings('fr', translations.data.fr);
	});
}]);