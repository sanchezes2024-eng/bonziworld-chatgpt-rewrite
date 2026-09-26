var http = require("http");
var fs = require("fs");
var path = require("path");
var querystring = require("querystring");

var PORT = process.env.PORT || 3000;
var PUBLIC = path.join(__dirname, "public");

var players = {};
var clients = {};

var nextClientId = 1;

var COLORS = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
    "#ff8800",
    "#8800ff",
    "#00aa88",
    "#ff66aa",
    "#6666ff",
    "#66cc66",
    "#ffffff"
];

var COLOR_NAMES = {
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    orange: "#ff8800",
    purple: "#8800ff",
    pink: "#ff66aa",
    cyan: "#00ffff",
    white: "#ffffff",
    black: "#000000",
    gray: "#808080",
    grey: "#808080",
    lime: "#00ff00",
    magenta: "#ff00ff",
    aqua: "#00ffff",
    navy: "#000080",
    teal: "#008080",
    silver: "#c0c0c0"
};


/*
============================================================
HELPERS
============================================================
*/

function randomColor() {
    return COLORS[
        Math.floor(
            Math.random() *
            COLORS.length
        )
    ];
}

function cleanText(
    value,
    max
) {
    value =
        value === undefined ||
        value === null
            ? ""
            : String(value);

    value =
        value.replace(
            /[\x00-\x1f\x7f]/g,
            ""
        );

    return value.substring(
        0,
        max
    );
}

function validRoom(room) {
    return /^[A-Za-z0-9_\- ]{1,40}$/
        .test(room);
}

function validName(name) {
    return /^[^<>]{1,24}$/
        .test(name);
}

function validHex(color) {
    return /^#[0-9a-fA-F]{6}$/
        .test(color);
}

function getColor(value) {
    var lower;

    value =
        cleanText(
            value,
            30
        );

    lower =
        value.toLowerCase();

    if (
        COLOR_NAMES[lower]
    ) {
        return COLOR_NAMES[lower];
    }

    if (
        validHex(value)
    ) {
        return value;
    }

    return null;
}


/*
============================================================
JSON
============================================================
*/

function sendJSON(
    res,
    object,
    status
) {
    var body;

    if (
        res.writableEnded ||
        res.headersSent
    ) {
        return;
    }

    body =
        JSON.stringify(
            object
        );

    res.writeHead(
        status || 200,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Content-Length":
                Buffer.byteLength(
                    body
                ),

            "Cache-Control":
                "no-cache, no-store, must-revalidate",

            "Pragma":
                "no-cache",

            "Expires":
                "0",

            "Access-Control-Allow-Origin":
                "*"
        }
    );

    res.end(body);
}


/*
============================================================
BODY PARSER
============================================================
*/

function parseBody(
    req,
    callback
) {
    var data = "";
    var finished = false;

    function finish(result) {
        if (finished) {
            return;
        }

        finished = true;

        callback(result);
    }

    req.on(
        "data",
        function (chunk) {
            data += chunk;

            if (
                data.length >
                100000
            ) {
                try {
                    req.destroy();
                } catch (e) {}

                finish({});

                return;
            }
        }
    );

    req.on(
        "end",
        function () {
            finish(
                querystring.parse(
                    data
                )
            );
        }
    );

    req.on(
        "error",
        function () {
            finish({});
        }
    );
}


/*
============================================================
POLL EVENTS
============================================================
*/

function addEvent(
    client,
    event,
    data
) {
    if (!client) {
        return;
    }

    client.events.push({
        event: event,
        data: data
    });

    if (client.res) {
        finishPoll(
            client
        );
    }
}

function broadcast(
    room,
    event,
    data
) {
    var id;
    var client;

    for (id in clients) {
        if (
            !clients.hasOwnProperty(id)
        ) {
            continue;
        }

        client =
            clients[id];

        if (
            client.room ===
            room
        ) {
            addEvent(
                client,
                event,
                data
            );
        }
    }
}

function finishPoll(
    client
) {
    var res;
    var events;

    if (
        !client ||
        !client.res
    ) {
        return;
    }

    res =
        client.res;

    client.res =
        null;

    if (
        client.pollTimer
    ) {
        clearTimeout(
            client.pollTimer
        );

        client.pollTimer =
            null;
    }

    events =
        client.events;

    client.events =
        [];

    if (
        res.writableEnded ||
        res.headersSent
    ) {
        return;
    }

    sendJSON(
        res,
        {
            events: events
        }
    );
}

function pollClient(
    client,
    res
) {
    var events;

    if (!client) {
        sendJSON(
            res,
            {
                error:
                    "invalid client"
            },
            400
        );

        return;
    }

    client.lastSeen =
        Date.now();

    if (client.res) {
        try {
            if (
                !client.res.writableEnded
            ) {
                client.res.end();
            }
        } catch (e) {}

        client.res =
            null;
    }

    if (
        client.events.length >
        0
    ) {
        events =
            client.events;

        client.events =
            [];

        sendJSON(
            res,
            {
                events: events
            }
        );

        return;
    }

    client.res =
        res;

    client.pollTimer =
        setTimeout(
            function () {
                if (
                    client.res !==
                    res
                ) {
                    return;
                }

                client.res =
                    null;

                client.pollTimer =
                    null;

                if (
                    !res.writableEnded &&
                    !res.headersSent
                ) {
                    sendJSON(
                        res,
                        {
                            events: []
                        }
                    );
                }
            },
            25000
        );
}


/*
============================================================
REMOVE CLIENT
============================================================
*/

function removeClient(
    client
) {
    var player;

    if (!client) {
        return;
    }

    player =
        players[client.id];

    if (player) {
        broadcast(
            player.room,
            "playerLeft",
            {
                id:
                    player.id
            }
        );

        delete players[
            client.id
        ];
    }

    if (
        client.pollTimer
    ) {
        clearTimeout(
            client.pollTimer
        );

        client.pollTimer =
            null;
    }

    if (client.res) {
        try {
            if (
                !client.res.writableEnded
            ) {
                client.res.end();
            }
        } catch (e) {}

        client.res =
            null;
    }

    delete clients[
        client.id
    ];
}


/*
============================================================
JOIN
============================================================
*/

function joinClient(
    name,
    room
) {
    var id;

    id =
        String(
            nextClientId++
        );

    name =
        cleanText(
            name,
            24
        );

    room =
        cleanText(
            room,
            40
        );

    if (
        !name ||
        !validName(name)
    ) {
        name =
            "Anonymous";
    }

    if (
        !room ||
        !validRoom(room)
    ) {
        room =
            "default";
    }

    clients[id] = {
        id: id,
        room: room,
        events: [],
        res: null,
        pollTimer: null,
        lastSeen:
            Date.now()
    };

    players[id] = {
        id: id,

        name: name,

        room: room,

        x:
            Math.random() *
            90 +
            5,

        y:
            Math.random() *
            80 +
            10,

        color:
            randomColor(),

        character:
            "bonzi"
    };

    return players[id];
}


/*
============================================================
STATIC FILES
============================================================
*/

function serveStatic(
    req,
    res,
    pathname
) {
    var file;
    var ext;
    var types;

    if (
        pathname === "/"
    ) {
        pathname =
            "/index.html";
    }

    try {
        pathname =
            decodeURIComponent(
                pathname
            );
    } catch (e) {
        res.writeHead(400);
        res.end(
            "Bad Request"
        );

        return;
    }

    if (
        pathname.indexOf(
            ".."
        ) !== -1
    ) {
        res.writeHead(403);
        res.end(
            "Forbidden"
        );

        return;
    }

    file =
        path.join(
            PUBLIC,
            pathname
        );

    ext =
        path.extname(
            file
        ).toLowerCase();

    types = {
        ".html":
            "text/html; charset=utf-8",

        ".css":
            "text/css; charset=utf-8",

        ".js":
            "application/javascript; charset=utf-8",

        ".png":
            "image/png",

        ".jpg":
            "image/jpeg",

        ".jpeg":
            "image/jpeg",

        ".gif":
            "image/gif",

        ".wav":
            "audio/wav",

        ".mp3":
            "audio/mpeg",

        ".ico":
            "image/x-icon"
    };

    fs.readFile(
        file,
        function (
            err,
            data
        ) {
            if (err) {
                if (
                    !res.writableEnded &&
                    !res.headersSent
                ) {
                    res.writeHead(
                        404
                    );

                    res.end(
                        "Not Found"
                    );
                }

                return;
            }

            if (
                res.writableEnded ||
                res.headersSent
            ) {
                return;
            }

            res.writeHead(
                200,
                {
                    "Content-Type":
                        types[ext] ||
                        "application/octet-stream",

                    "Content-Length":
                        data.length,

                    "Cache-Control":
                        "no-cache"
                }
            );

            res.end(data);
        }
    );
}


/*
============================================================
SERVER
============================================================
*/

var server =
    http.createServer(
        function (
            req,
            res
        ) {
            var requestUrl;
            var pathname;
            var id;
            var client;

            try {
                requestUrl =
                    new URL(
                        req.url,
                        "http://" +
                        (
                            req.headers.host ||
                            "localhost"
                        )
                    );
            } catch (e) {
                res.writeHead(
                    400
                );

                res.end(
                    "Bad Request"
                );

                return;
            }

            pathname =
                requestUrl.pathname;


            /*
             * JOIN
             */

            if (
                pathname ===
                "/api/join" &&
                req.method ===
                "POST"
            ) {
                parseBody(
                    req,
                    function (
                        body
                    ) {
                        var player;
                        var otherId;
                        var existing;

                        player =
                            joinClient(
                                body.name,
                                body.room
                            );

                        for (
                            otherId in
                            players
                        ) {
                            if (
                                !players
                                    .hasOwnProperty(
                                        otherId
                                    )
                            ) {
                                continue;
                            }

                            existing =
                                players[
                                    otherId
                                ];

                            if (
                                otherId !==
                                player.id &&
                                existing.room ===
                                player.room
                            ) {
                                clients[
                                    player.id
                                ].events.push({
                                    event:
                                        "playerJoined",

                                    data:
                                        existing
                                });
                            }
                        }

                        sendJSON(
                            res,
                            {
                                id:
                                    player.id,

                                player:
                                    player,

                                events:
                                    clients[
                                        player.id
                                    ].events
                            }
                        );

                        clients[
                            player.id
                        ].events =
                            [];

                        broadcast(
                            player.room,
                            "playerJoined",
                            player
                        );
                    }
                );

                return;
            }


            /*
             * POLL
             */

            if (
                pathname ===
                "/api/poll" &&
                req.method ===
                "GET"
            ) {
                id =
                    requestUrl
                        .searchParams
                        .get("id");

                client =
                    clients[id];

                pollClient(
                    client,
                    res
                );

                return;
            }


            /*
             * SEND
             */

            if (
                pathname ===
                "/api/send" &&
                req.method ===
                "POST"
            ) {
                parseBody(
                    req,
                    function (
                        body
                    ) {
                        var message;
                        var color;

                        client =
                            clients[
                                String(
                                    body.id
                                )
                            ];

                        if (
                            !client ||
                            !players[
                                client.id
                            ]
                        ) {
                            sendJSON(
                                res,
                                {
                                    error:
                                        "invalid client"
                                },
                                400
                            );

                            return;
                        }

                        client.lastSeen =
                            Date.now();

                        message =
                            cleanText(
                                body.message,
                                500
                            );

                        if (!message) {
                            sendJSON(
                                res,
                                {
                                    ok: true
                                }
                            );

                            return;
                        }


                        /*
                         * /color
                         */

                        if (
                            message.indexOf(
                                "/color "
                            ) === 0
                        ) {
                            color =
                                getColor(
                                    message.substring(
                                        7
                                    )
                                );

                            if (!color) {
                                broadcast(
                                    client.room,
                                    "systemMessage",
                                    {
                                        text:
                                            "Invalid color."
                                    }
                                );
                            } else {
                                players[
                                    client.id
                                ].color =
                                    color;

                                broadcast(
                                    client.room,
                                    "playerColorChanged",
                                    {
                                        id:
                                            client.id,

                                        color:
                                            color
                                    }
                                );
                            }

                            sendJSON(
                                res,
                                {
                                    ok: true
                                }
                            );

                            return;
                        }


                        /*
                         * Random color
                         */

                        if (
                            message ===
                            "/color"
                        ) {
                            players[
                                client.id
                            ].color =
                                randomColor();

                            broadcast(
                                client.room,
                                "playerColorChanged",
                                {
                                    id:
                                        client.id,

                                    color:
                                        players[
                                            client.id
                                        ].color
                                }
                            );

                            sendJSON(
                                res,
                                {
                                    ok: true
                                }
                            );

                            return;
                        }


                        /*
                         * Character
                         */

                        if (
                            message ===
                            "/char bonzi" ||
                            message ===
                            "/char square"
                        ) {
                            players[
                                client.id
                            ].character =
                                message.substring(
                                    6
                                ) ===
                                "square"
                                    ? "square"
                                    : "bonzi";

                            broadcast(
                                client.room,
                                "playerCharacterChanged",
                                {
                                    id:
                                        client.id,

                                    character:
                                        players[
                                            client.id
                                        ].character
                                }
                            );

                            sendJSON(
                                res,
                                {
                                    ok: true
                                }
                            );

                            return;
                        }


                        /*
                         * Toggle
                         */

                        if (
                            message ===
                            "/char"
                        ) {
                            players[
                                client.id
                            ].character =
                                players[
                                    client.id
                                ].character ===
                                "bonzi"
                                    ? "square"
                                    : "bonzi";

                            broadcast(
                                client.room,
                                "playerCharacterChanged",
                                {
                                    id:
                                        client.id,

                                    character:
                                        players[
                                            client.id
                                        ].character
                                }
                            );

                            sendJSON(
                                res,
                                {
                                    ok: true
                                }
                            );

                            return;
                        }


                        /*
                         * Normal message
                         */

                        broadcast(
                            client.room,
                            "message",
                            {
                                id:
                                    client.id,

                                text:
                                    message
                            }
                        );

                        sendJSON(
                            res,
                            {
                                ok: true
                            }
                        );
                    }
                );

                return;
            }


            /*
             * MOVE
             */

            if (
                pathname ===
                "/api/move" &&
                req.method ===
                "POST"
            ) {
                parseBody(
                    req,
                    function (
                        body
                    ) {
                        var sender;
                        var target;
                        var x;
                        var y;

                        sender =
                            clients[
                                String(
                                    body.senderId
                                )
                            ];

                        if (!sender) {
                            sendJSON(
                                res,
                                {
                                    error:
                                        "invalid sender"
                                },
                                400
                            );

                            return;
                        }

                        sender.lastSeen =
                            Date.now();

                        target =
                            players[
                                String(
                                    body.playerId
                                )
                            ];

                        if (
                            !target ||
                            target.room !==
                            sender.room
                        ) {
                            sendJSON(
                                res,
                                {
                                    error:
                                        "invalid target"
                                },
                                400
                            );

                            return;
                        }

                        x =
                            parseFloat(
                                body.x
                            );

                        y =
                            parseFloat(
                                body.y
                            );

                        if (
                            isNaN(x) ||
                            isNaN(y)
                        ) {
                            sendJSON(
                                res,
                                {
                                    error:
                                        "invalid position"
                                },
                                400
                            );

                            return;
                        }

                        x =
                            Math.max(
                                2,
                                Math.min(
                                    98,
                                    x
                                )
                            );

                        y =
                            Math.max(
                                2,
                                Math.min(
                                    98,
                                    y
                                )
                            );

                        target.x =
                            x;

                        target.y =
                            y;

                        broadcast(
                            target.room,
                            "playerMoved",
                            {
                                id:
                                    target.id,

                                x:
                                    x,

                                y:
                                    y
                            }
                        );

                        sendJSON(
                            res,
                            {
                                ok: true
                            }
                        );
                    }
                );

                return;
            }


            /*
             * LEAVE
             */

            if (
                pathname ===
                "/api/leave" &&
                req.method ===
                "POST"
            ) {
                parseBody(
                    req,
                    function (
                        body
                    ) {
                        client =
                            clients[
                                String(
                                    body.id
                                )
                            ];

                        if (client) {
                            removeClient(
                                client
                            );
                        }

                        sendJSON(
                            res,
                            {
                                ok: true
                            }
                        );
                    }
                );

                return;
            }


            /*
             * STATIC
             */

            serveStatic(
                req,
                res,
                pathname
            );
        }
    );


/*
============================================================
CLEANUP
============================================================
*/

setInterval(
    function () {
        var id;
        var client;
        var now;

        now =
            Date.now();

        for (
            id in clients
        ) {
            if (
                !clients.hasOwnProperty(
                    id
                )
            ) {
                continue;
            }

            client =
                clients[id];

            if (
                client.lastSeen &&
                now -
                    client.lastSeen >
                    120000
            ) {
                removeClient(
                    client
                );
            }
        }
    },
    30000
);


/*
============================================================
START
============================================================
*/

server.listen(
    PORT,
    "0.0.0.0",
    function () {
        console.log(
            "Legacy chat server listening on port " +
            PORT
        );
    }
);
