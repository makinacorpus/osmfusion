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

