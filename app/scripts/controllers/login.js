Controllers.controller("LoginCtrl",
    ["$log", "$scope", "$http", "$rootScope", "$location", "$timeout", "$filter",
    "Connection", "User", "Channel", "YouTube", "Parser", "Settings",
    function ($log, $scope, $http, $rootScope, $location, $timeout, $filter,
    Connection, User, Channel, YouTube, Parser, Settings)
    {
        var mustKill = false;
        $scope.user = User.get("~");
        $scope.user.nickName = $.cookie("nickName");
        if ($.cookie("color"))
        {
            $scope.user.color = $.cookie("color");
        }

        $location.hash("");

        $http.jsonp("http://geoip.yonom.org/index.php?callback=JSON_CALLBACK")
        .success(function (data)
        {
            $scope.user.country = data.geoplugin_countryName;
            $scope.user.flag = data.geoplugin_countryCode;
        });

        $rootScope.$on("err_nicknameinuse", function (evt)
        {
            if ($scope.user.password)
            {
                Connection.send("NICK " + $scope.user.nickName + "_");

                mustKill = true;

                return;
            }

            Connection.close();

            $rootScope.$apply(function ()
            {
                $scope.error = "Nickname is in use";
            });
        });

        $rootScope.$on("channel.joined", function (evt, channel)
        {
            $scope.connecting = false;
            $scope.error = "";
        });

        $rootScope.$on("disconnecting", function (evt)
        {
            if ($scope.connected) // Don't change the channels array unless we were really connected
            {
                if ($rootScope.settings.PRESERVE_CHANNELS)
                {
                    $rootScope.settings.CHANNELS = [];
                    for (var i = 0; i < User.get("~").channels.length; i++)
                    {
                        // Only store the channel name
                        $rootScope.settings.CHANNELS[i] = User.get("~").channels[i].name;
                    }
                    $log.log($rootScope.settings.CHANNELS);

                    Settings.save($rootScope.settings);
                }
            }
        });

        $scope.reset = function ()
        {
            $scope.connecting = false;
            $scope.connected = false;

            if (VERSION === "local")
            {
                $scope.port = 81;
            } else
            {
                $scope.port = 80 + (Math.floor(Math.random() * (5 - 2 + 1) + 2));
            }
            $scope.error = "";
        }

        $scope.login = function ()
        {
            // jQuery trim the nickname to prevent whitespace names
            $.trim($scope.user.nickName);

            $scope.reset();

            try
            {
                User.register($scope.user.nickName);
                User.alias("~", $scope.user.nickName);
            }

            catch (e)
            {
                $scope.error = e;
                return;
            }

            $http.jsonp("http://kaslai.us/coldstorm/fixip2.php?nick=" +
                encodeURI($scope.user.nickName) + "&random=" +
                Math.floor(Math.random() * 10000000) +
		        "&callback=JSON_CALLBACK").success(function (data)
		        {
		            $scope.hostToken = data.tag;
		        });

            $.cookie("nickName", $scope.user.nickName, { expires: new Date(2017, 00, 01) });
            $.cookie("color", $scope.user.color, { expires: new Date(2017, 00, 01) });

            $scope.connect();
        };

        $scope.connect = function ()
        {
            if ($scope.connecting === false)
            {
                $scope.connecting = true;

                // Attempt to connect
                $log.log("connecting to ws://frogbox.es:" + $scope.port)
                Connection.connect("ws://frogbox.es:" + $scope.port);

                $timeout(function ()
                {
                    if ($scope.connecting)
                    {
                        Connection.close();
                    }
                }, 30000)

                Connection.onOpen(function ()
                {
                    // Connection successfully opened
                    $scope.reset();
                    $scope.connected = true;

                    $location.path("/server");

                    // Capability negotiation
                    Connection.send("CAP REQ :away-notify")
                    Connection.send("CAP END")

                    // Registration process
                    Connection.send("NICK " + $scope.user.nickName);
                    Connection.send("USER " +
                        $scope.user.color.substring(1).toUpperCase() +
                        $scope.user.flag + " - - :New coldstormer");

                    Connection.onWelcome(function ()
                    {
                        if (mustKill)
                        {
                            Connection.send("PRIVMSG NickServ :GHOST " +
                                $scope.user.nickName + " " +
                                $scope.user.password);
                        }

                        if ($scope.user.password)
                        {
                            Connection.send("PRIVMSG NickServ :identify " +
                                $scope.user.password);
                        }

                        if ($scope.hostToken)
                        {
                            Connection.send("PRIVMSG Jessica :~fixmyip " +
                                $scope.hostToken);
                        }
                    });
                });

                Connection.onMessage(function (message)
                {
                    if (message.indexOf("NOTICE " + $scope.user.nickName +
                        " :Tada") > -1)
                    {
                        if ($rootScope.settings.PRESERVE_CHANNELS &&
                            $rootScope.settings.CHANNELS &&
                            $rootScope.settings.CHANNELS.length > 0)
                        {
                            var channels = [];

                            for (var i = 0; i < $rootScope.settings.CHANNELS.length; i++) {
                                channels[i] = Channel.register($rootScope.settings.CHANNELS[i]);
                                channels[i].join();
                            };

                            if (channels.length > 0)
                            {
                                $location.path("/channels/" + channels[0].name);
                            }
                        } else if (VERSION == "local") {
                            var test = Channel.register("#test");

                            test.join();

                            $location.path("/channels/#test");
                        } else {
                            var cs = Channel.register("#Coldstorm");
                            var two = Channel.register("#2");

                            cs.join();
                            two.join();

                            $location.path("/channels/#Coldstorm");
                        }
                    }

                    if (message.indexOf("NOTICE " + $scope.user.nickName +
                        "_ :Ghost with your nick has been killed.") > -1 &&
                        mustKill)
                    {
                        Connection.send("NICK " + $scope.user.nickName);
                        Connection.send("PRIVMSG NickServ :IDENTIFY " +
                            $scope.user.password);

                        mustKill = false;

                        if ($scope.hostToken)
                        {
                            Connection.send("PRIVMSG Jessica :~fixmyip " +
                                $scope.hostToken);
                        }
                    }

                    Parser.parse(message);
                });

                Connection.onClose(function ()
                {
                    $scope.connecting = false;
                    if ($scope.connected)
                    {
                        // We were already connected and on the chat view, go back to login
                        $location.path("/login");
                        $scope.reset();
                    }

                    else
                    {
                        if ($scope.port < 85)
                        {
                            $scope.port++;
                            $scope.connect();
                        } else
                        {
                            $rootScope.$apply(function ()
                            {
                                $scope.error = "Couldn't connect to the server";
                            })
                        }
                    }
                });
            }
        };
    }]);
