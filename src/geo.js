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