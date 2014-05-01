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
                var deferred = $q.defer();
                var self = this;
                self.getAuthenticated('/0.6/permissions').then(function(data){
                    deferred.resolve(data.getElementsByTagName('permission').length > 0);
                });
                return deferred.promise;
            },
            setCredentials: function(username, password){
                encoded = $base64.encode(username + ':' + password);
                console.log('set ' + encoded + ' ' + password);
            },
            getAuthorization: function(){
                console.log('get ' + encoded);
                return 'Basic ' + encoded;
            },
            clearCredentials: function () {
                encoded = 'undefined';
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
                    deferred.resolve(self.parseXML(data.data));
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
                $http.post(url, query, {headers: headers}).then(function(data){
                    deferred.resolve(self.parseXML(data.data));
                },function(data) {
                    deferred.reject(data);
                });
                return deferred.promise;
            },
            getNodesInJSON: function(xmlNodes, filter){
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
                var changeset = '<osm><changeset><tag k="created_by" v="OSMFusion"/><tag k="comment" v="';
                changeset += 'Import data from ' + sourceURI + '"/></changeset></osm>';
                this.put('/0.6/changeset/create', changeset).then(function(data){
                    debugger;
                });
            },
            getMap: function(bbox){
                return this.get('/0.6/map?bbox='+bbox);
            }
        };
    }
]);
