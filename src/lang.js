angular.module('myApp').run(function (gettextCatalog) {
    gettextCatalog.currentLanguage = 'fr';
    gettextCatalog.debug = true;
});
