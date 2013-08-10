Controllers.controller("TabsCtrl", ["$scope", function ($scope)
{
    $scope.$on("channel.message", function (evt, message)
    {
        // Don't set the channel to active if it is the current channel

        if ($scope.channel !== undefined && $scope.channel == message.channel)
        {
            return;
        }

        $scope.$apply(function ()
        {
            message.channel.active = true;
        })
    });

    $scope.channelEquals = function (first, second)
    {
        if (first === undefined || second === undefined)
        {
            return false;
        }
        
        return first.name == second.name;
    };
}]);
