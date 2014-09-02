/*global angular:false */
/*global L:false */

'use strict';

L.Icon.Default.imagePath = 'images';
//create all myApp modules
angular.module('myApp', [
    'base64',
    'myApp.services',
    'myApp.controllers',
    'myApp.directives',
    'gettext',
    'leaflet-directive',
    'ui.bootstrap',
    'ui.keypress',
    'ngCookies',
    'ngRoute',
    'ngStorage'
]);

angular.module('myApp.controllers', []);
angular.module('myApp.services', []);
angular.module('myApp.directives', []);

