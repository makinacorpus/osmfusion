angular.module("gettext").run(['$http', 'gettextCatalog',
	function ($http, gettextCatalog) {
	$http.get('translations/fr.json').then(function(translations){
		gettextCatalog.setStrings('fr', translations.data.fr);
	});
}]);