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
