Coldstorm.factory("Connection", function()
{
    var connection = new Websock();
    
    var openHandlers = [];
    var messageHandlers = [];
    var closeHandlers = [];
    
    connection.on("open", function()
    {
        for (handlerIndex in openHandlers)
        {
            var handler = openHandlers[handlerIndex];
            
            handler();
        }
    });
    
    connection.on("message", function()
    {
        var messages = connection.rQshiftStr().split("\r\n");
        
        for (messageIndex in messages)
        {
            var message = messages[messageIndex];
            
            for (handlerIndex in messageHandlers)
            {
                var handler = messageHandlers[handlerIndex];
                
                handler(message);
            }
        }
    });
    
    connection.on("close", function()
    {
        for (handlerIndex in closeHandlers)
        {
            var handler = closeHandlers[handlerIndex];
            
            handler();
        }
    });
    
    return {
        connect: function(uri)
        {
            connection.open(uri);
        },
        onOpen: function(handler)
        {
            openHandlers.push(handler);
        },
        onMessage: function(handler)
        {
            messageHandlers.push(handler);
        },
        onClose: function(handler)
        {
            closeHandlers.push(handler);
        }
    };
});