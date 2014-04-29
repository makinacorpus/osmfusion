/*jshint strict:false */
/*global angular:false */
angular.module('myApp.services').factory('osmService',
    ['$base64', '$cookieStore', '$http', '$q',
    function ($base64, $cookieStore, $http, $q) {
        var API = 'http://api.openstreetmap.org';
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

        return {
/*
            setCredentials: function (username, password) {
                console.log('setCrendentials');
                var encoded = $base64.encode(username + ':' + password);
                $http.defaults.headers.common.Authorization = 'Basic ' + encoded;
                $cookieStore.put('authdata', encoded);
            },
            getAuthorization: function(username, password){
                var encoded = $base64.encode(username + ':' + password);
                return 'Basic ' + encoded;
            },
            clearCredentials: function () {
                console.log('clear credentials');
                document.execCommand('ClearAuthenticationCache');
                $cookieStore.remove('authdata');
                delete $http.defaults.headers.common.Authorization;
            },
            */
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
                var data = {data:query};
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
