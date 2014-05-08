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
                    deferred.resolve(results);
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
