const http = require("http");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

var players = {};
var clients = {};
var nextClientId = 1;


/*
============================================================
COLORS
============================================================
*/

var colorPalette = [
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

var namedColors = {
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

function randomColor() {
    return colorPalette[
        Math.floor(Math.random() * colorPalette.length)
    ];
}

function getColor(value) {
    if (!value) {
        return randomColor();
    }

    value = String(value).toLowerCase();

    if (namedColors[value]) {
        return namedColors[value];
    }

    if (/^#[0-9a-f]{6}$/i.test(value)) {
        return value;
    }

    return null;
}


/*
============================================================
VALIDATION
============================================================
*/

function cleanText(value) {
    return String(value || "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function validName(value) {
    value = cleanText(value);

    if (!value) {
        return "Anonymous";
    }

    return value.substring(0, 30);
}

function validRoom(value) {
    value = cleanText(value);

    if (!value) {
        return "default";
    }

    return value.substring(0, 30);
}

function clamp(value, min, max) {
    value = Number(value);

    if (!isFinite(value)) {
        value = min;
    }

    if (value < min) {
        value = min;
    }

    if (value > max) {
        value = max;
    }

    return value;
}


/*
============================================================
HTTP HELPERS
============================================================
*/

function sendJSON(res, status, data) {
    if (!res) {
        return;
    }

    if (res.writableEnded || res.destroyed) {
        return;
    }

    var body;

    try {
        body = JSON.stringify(data);
    } catch (e) {
        body = '{"error":"Server error"}';
        status = 500;
    }

    if (res.writableEnded || res.destroyed) {
        return;
    }

    try {
        res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Content-Length": Buffer.byteLength(body),
            "Connection": "keep-alive"
        });

        res.end(body);
    } catch (e) {
        /*
        The browser may have disconnected between the checks.
        There is nothing else to send in that situation.
        */
    }
}

function parseBody(req, callback) {
    var body = "";
    var finished = false;

    function done(result) {
        if (finished) {
            return;
        }

        finished = true;
        callback(result);
    }

    req.on("data", function(chunk) {
        if (finished) {
            return;
        }

        body += chunk.toString();

        if (body.length > 100000) {
            done(null);

            try {
                req.destroy();
            } catch (e) {}

            return;
        }
    });

    req.on("end", function() {
        if (finished) {
            return;
        }

        try {
            done(querystring.parse(body));
        } catch (e) {
            done(null);
        }
    });

    req.on("error", function() {
        done(null);
    });

    req.on("aborted", function() {
        done(null);
    });
}


/*
============================================================
EVENT SYSTEM
============================================================
*/

function addEvent(client, event) {
    if (!client || client.removed) {
        return;
    }

    client.events.push(event);

    /*
    If this client is currently waiting in /api/poll,
    immediately complete that poll.
    */
    if (client.pollResponse) {
        finishPoll(client);
    }
}

function broadcast(room, event, exceptClientId) {
    var id;

    for (id in clients) {
        if (!clients.hasOwnProperty(id)) {
            continue;
        }

        var client = clients[id];

        if (!client || client.removed) {
            continue;
        }

        if (!client.player) {
            continue;
        }

        if (client.player.room !== room) {
            continue;
        }

        if (
            exceptClientId &&
            client.id === String(exceptClientId)
        ) {
            continue;
        }

        addEvent(client, event);
    }
}


/*
============================================================
POLLING
============================================================
*/

function finishPoll(client) {
    if (!client || client.removed) {
        return;
    }

    var res = client.pollResponse;

    if (!res) {
        return;
    }

    /*
    Detach the response BEFORE doing anything else.
    This prevents an event generated during completion
    from trying to complete the same response twice.
    */
    client.pollResponse = null;

    if (client.pollTimer) {
        clearTimeout(client.pollTimer);
        client.pollTimer = null;
    }

    if (
        res.writableEnded ||
        res.destroyed
    ) {
        return;
    }

    var events = client.events.slice(0);
    client.events = [];

    sendJSON(res, 200, {
        events: events
    });
}

function startPoll(client, req, res) {
    if (!client || client.removed) {
        return;
    }

    /*
    Never allow two active polls for one client.
    */
    if (client.pollResponse) {
        /*
        This should normally never happen because the client
        waits for the previous poll to finish.

        If it does happen, reject the new request instead of
        destroying the existing poll.
        */
        sendJSON(res, 409, {
            error: "Poll already active"
        });

        return;
    }

    client.lastActivity = Date.now();
    client.pollResponse = res;

    /*
    If an event arrived between the initial check and here,
    send it immediately.
    */
    if (client.events.length > 0) {
        finishPoll(client);
        return;
    }

    /*
    20 second long poll.

    The client immediately starts another poll when this
    one finishes, so messages remain responsive while avoiding
    excessive requests.
    */
    client.pollTimer = setTimeout(function() {
        if (!client || client.removed) {
            return;
        }

        finishPoll(client);
    }, 20000);

    /*
    Detect broken browser connections.

    Do NOT blindly remove the player on every request close.
    Only remove it if this exact response is still active.
    */
    function connectionEnded() {
        if (
            client &&
            !client.removed &&
            client.pollResponse === res
        ) {
            removeClient(client.id);
        }
    }

    req.on("aborted", connectionEnded);
    req.on("error", connectionEnded);
    res.on("error", connectionEnded);
}


/*
============================================================
DISCONNECT / REMOVE CLIENT
============================================================
*/

function removeClient(clientId) {
    clientId = String(clientId);

    var client = clients[clientId];

    if (!client) {
        return;
    }

    if (client.removed) {
        return;
    }

    client.removed = true;

    if (client.pollTimer) {
        clearTimeout(client.pollTimer);
        client.pollTimer = null;
    }

    /*
    Detach pending poll before closing it.
    */
    var pendingResponse = client.pollResponse;
    client.pollResponse = null;

    if (pendingResponse) {
        if (
            !pendingResponse.writableEnded &&
            !pendingResponse.destroyed
        ) {
            try {
                pendingResponse.end();
            } catch (e) {}
        }
    }

    var player = client.player;

    if (
        player &&
        players[player.id]
    ) {
        delete players[player.id];

        broadcast(
            player.room,
            {
                type: "playerLeft",
                playerId: player.id
            },
            client.id
        );
    }

    delete clients[clientId];
}


/*
============================================================
JOIN
============================================================
*/

function joinClient(name, room) {
    var clientId = String(nextClientId++);

    var player = {
        id: clientId,
        name: validName(name),
        room: validRoom(room),
        x: Math.random() * 90 + 5,
        y: Math.random() * 75 + 12,
        color: randomColor(),
        character: "bonzi"
    };

    var client = {
        id: clientId,
        player: player,

        events: [],

        pollResponse: null,
        pollTimer: null,

        removed: false,

        lastActivity: Date.now()
    };

    players[player.id] = player;
    clients[client.id] = client;

    /*
    Give the new client all existing players.
    */
    var id;

    for (id in players) {
        if (!players.hasOwnProperty(id)) {
            continue;
        }

        if (id === player.id) {
            continue;
        }

        if (
            players[id].room !==
            player.room
        ) {
            continue;
        }

        client.events.push({
            type: "playerJoined",
            player: {
                id: players[id].id,
                name: players[id].name,
                room: players[id].room,
                x: players[id].x,
                y: players[id].y,
                color: players[id].color,
                character: players[id].character
            }
        });
    }

    /*
    Tell everybody else.
    */
    broadcast(
        player.room,
        {
            type: "playerJoined",
            player: player
        },
        client.id
    );

    return client;
}


/*
============================================================
STATIC FILES
============================================================
*/

function getContentType(filePath) {
    var ext = path.extname(filePath).toLowerCase();

    var types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".ico": "image/x-icon",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg"
    };

    return (
        types[ext] ||
        "application/octet-stream"
    );
}

function serveStatic(req, res) {
    var requestPath =
        req.url.split("?")[0];

    if (requestPath === "/") {
        requestPath = "/index.html";
    }

    try {
        requestPath =
            decodeURIComponent(
                requestPath
            );
    } catch (e) {
        sendJSON(res, 400, {
            error: "Bad URL"
        });

        return;
    }

    /*
    Normalize the path.
    */
    requestPath =
        requestPath.replace(
            /\/+/g,
            "/"
        );

    /*
    Security.
    */
    if (
        requestPath.indexOf("..") !== -1 ||
        requestPath.indexOf("\\") !== -1
    ) {
        sendJSON(res, 403, {
            error: "Forbidden"
        });

        return;
    }

    var relativePath =
        requestPath.replace(
            /^\/+/,
            ""
        );

    var filePath =
        path.join(
            PUBLIC_DIR,
            relativePath
        );

    if (
        filePath !== PUBLIC_DIR &&
        filePath.indexOf(
            PUBLIC_DIR + path.sep
        ) !== 0
    ) {
        sendJSON(res, 403, {
            error: "Forbidden"
        });

        return;
    }

    fs.stat(
        filePath,
        function(err, stat) {
            if (
                err ||
                !stat ||
                !stat.isFile()
            ) {
                sendJSON(res, 404, {
                    error: "Not found"
                });

                return;
            }

            fs.readFile(
                filePath,
                function(readErr, data) {
                    if (readErr) {
                        sendJSON(res, 500, {
                            error: "Could not read file"
                        });

                        return;
                    }

                    if (
                        res.writableEnded ||
                        res.destroyed
                    ) {
                        return;
                    }

                    try {
                        res.writeHead(200, {
                            "Content-Type":
                                getContentType(filePath),

                            "Cache-Control":
                                "no-cache, no-store, must-revalidate",

                            "Pragma": "no-cache",
                            "Expires": "0",

                            "Content-Length":
                                data.length
                        });

                        res.end(data);
                    } catch (e) {}
                }
            );
        }
    );
}


/*
============================================================
SERVER
============================================================
*/

var server = http.createServer(
    function(req, res) {

        var parsed;

        try {
            parsed = new URL(
                req.url,
                "http://" +
                (
                    req.headers.host ||
                    "localhost"
                )
            );
        } catch (e) {
            sendJSON(res, 400, {
                error: "Bad request"
            });

            return;
        }


        /*
        --------------------------------------------------------
        JOIN
        --------------------------------------------------------
        */

        if (
            req.method === "POST" &&
            parsed.pathname === "/api/join"
        ) {
            parseBody(
                req,
                function(body) {

                    if (!body) {
                        sendJSON(res, 400, {
                            error: "Invalid request"
                        });

                        return;
                    }

                    var client =
                        joinClient(
                            body.name,
                            body.room
                        );

                    sendJSON(res, 200, {
                        id: client.id,
                        player: client.player,
                        events: client.events
                    });

                    /*
                    Important: clear the initial events only
                    after they have been included in the response.
                    */
                    client.events = [];
                }
            );

            return;
        }


        /*
        --------------------------------------------------------
        POLL
        --------------------------------------------------------
        */

        if (
            req.method === "GET" &&
            parsed.pathname === "/api/poll"
        ) {
            var pollId =
                String(
                    parsed.searchParams.get("id") ||
                    ""
                );

            var pollClient =
                clients[pollId];

            if (
                !pollClient ||
                pollClient.removed
            ) {
                sendJSON(res, 404, {
                    error: "Client not found"
                });

                return;
            }

            startPoll(
                pollClient,
                req,
                res
            );

            return;
        }


        /*
        --------------------------------------------------------
        HEARTBEAT
        --------------------------------------------------------
        */

        if (
            req.method === "GET" &&
            parsed.pathname === "/api/heartbeat"
        ) {
            var heartbeatId =
                String(
                    parsed.searchParams.get("id") ||
                    ""
                );

            var heartbeatClient =
                clients[heartbeatId];

            if (
                !heartbeatClient ||
                heartbeatClient.removed
            ) {
                sendJSON(res, 404, {
                    error: "Client not found"
                });

                return;
            }

            heartbeatClient.lastActivity =
                Date.now();

            sendJSON(res, 200, {
                ok: true
            });

            return;
        }


        /*
        --------------------------------------------------------
        SEND MESSAGE / COMMAND
        --------------------------------------------------------
        */

        if (
            req.method === "POST" &&
            parsed.pathname === "/api/send"
        ) {
            parseBody(
                req,
                function(body) {

                    if (!body) {
                        sendJSON(res, 400, {
                            error: "Invalid request"
                        });

                        return;
                    }

                    var client =
                        clients[
                            String(body.id)
                        ];

                    if (
                        !client ||
                        client.removed ||
                        !client.player
                    ) {
                        sendJSON(res, 404, {
                            error: "Client not found"
                        });

                        return;
                    }

                    client.lastActivity =
                        Date.now();

                    var text =
                        cleanText(
                            body.text
                        );

                    if (!text) {
                        sendJSON(res, 200, {
                            ok: true
                        });

                        return;
                    }


                    /*
                    /color
                    */

                    if (text === "/color") {

                        var newRandomColor =
                            randomColor();

                        client.player.color =
                            newRandomColor;

                        broadcast(
                            client.player.room,
                            {
                                type:
                                    "playerColorChanged",

                                playerId:
                                    client.player.id,

                                color:
                                    newRandomColor
                            }
                        );

                        sendJSON(res, 200, {
                            ok: true
                        });

                        return;
                    }


                    /*
                    /color VALUE
                    */

                    if (
                        text.indexOf(
                            "/color "
                        ) === 0
                    ) {
                        var colorValue =
                            cleanText(
                                text.substring(7)
                            );

                        var newColor =
                            getColor(
                                colorValue
                            );

                        if (!newColor) {
                            addEvent(
                                client,
                                {
                                    type:
                                        "systemMessage",

                                    text:
                                        "Invalid color."
                                }
                            );

                            sendJSON(res, 200, {
                                ok: true
                            });

                            return;
                        }

                        client.player.color =
                            newColor;

                        broadcast(
                            client.player.room,
                            {
                                type:
                                    "playerColorChanged",

                                playerId:
                                    client.player.id,

                                color:
                                    newColor
                            }
                        );

                        sendJSON(res, 200, {
                            ok: true
                        });

                        return;
                    }


                    /*
                    /char
                    */

                    if (text === "/char") {

                        var newCharacter =
                            client.player.character ===
                            "bonzi"
                                ? "square"
                                : "bonzi";

                        client.player.character =
                            newCharacter;

                        broadcast(
                            client.player.room,
                            {
                                type:
                                    "playerCharacterChanged",

                                playerId:
                                    client.player.id,

                                character:
                                    newCharacter
                            }
                        );

                        sendJSON(res, 200, {
                            ok: true
                        });

                        return;
                    }


                    /*
                    /char bonzi
                    */

                    if (
                        text ===
                        "/char bonzi"
                    ) {
                        client.player.character =
                            "bonzi";

                        broadcast(
                            client.player.room,
                            {
                                type:
                                    "playerCharacterChanged",

                                playerId:
                                    client.player.id,

                                character:
                                    "bonzi"
                            }
                        );

                        sendJSON(res, 200, {
                            ok: true
                        });

                        return;
                    }


                    /*
                    /char square
                    */

                    if (
                        text ===
                        "/char square"
                    ) {
                        client.player.character =
                            "square";

                        broadcast(
                            client.player.room,
                            {
                                type:
                                    "playerCharacterChanged",

                                playerId:
                                    client.player.id,

                                character:
                                    "square"
                            }
                        );

                        sendJSON(res, 200, {
                            ok: true
                        });

                        return;
                    }


                    /*
                    NORMAL MESSAGE
                    */

                    broadcast(
                        client.player.room,
                        {
                            type: "message",

                            playerId:
                                client.player.id,

                            name:
                                client.player.name,

                            text: text
                        }
                    );

                    sendJSON(res, 200, {
                        ok: true
                    });
                }
            );

            return;
        }


        /*
        --------------------------------------------------------
        MOVE
        --------------------------------------------------------
        */

        if (
            req.method === "POST" &&
            parsed.pathname === "/api/move"
        ) {
            parseBody(
                req,
                function(body) {

                    if (!body) {
                        sendJSON(res, 400, {
                            error: "Invalid request"
                        });

                        return;
                    }

                    var sender =
                        clients[
                            String(body.senderId)
                        ];

                    if (
                        !sender ||
                        sender.removed ||
                        !sender.player
                    ) {
                        sendJSON(res, 404, {
                            error:
                                "Client not found"
                        });

                        return;
                    }

                    sender.lastActivity =
                        Date.now();

                    var target =
                        players[
                            String(body.playerId)
                        ];

                    if (!target) {
                        sendJSON(res, 404, {
                            error:
                                "Player not found"
                        });

                        return;
                    }

                    if (
                        target.room !==
                        sender.player.room
                    ) {
                        sendJSON(res, 403, {
                            error:
                                "Wrong room"
                        });

                        return;
                    }

                    target.x =
                        clamp(
                            body.x,
                            2,
                            98
                        );

                    target.y =
                        clamp(
                            body.y,
                            2,
                            98
                        );

                    broadcast(
                        target.room,
                        {
                            type:
                                "playerMoved",

                            playerId:
                                target.id,

                            x:
                                target.x,

                            y:
                                target.y
                        }
                    );

                    sendJSON(res, 200, {
                        ok: true
                    });
                }
            );

            return;
        }


        /*
        --------------------------------------------------------
        LEAVE
        --------------------------------------------------------
        */

        if (
            req.method === "POST" &&
            parsed.pathname === "/api/leave"
        ) {
            parseBody(
                req,
                function(body) {

                    if (!body) {
                        sendJSON(res, 400, {
                            error:
                                "Invalid request"
                        });

                        return;
                    }

                    var clientId =
                        String(
                            body.id || ""
                        );

                    if (
                        clients[clientId]
                    ) {
                        removeClient(
                            clientId
                        );
                    }

                    sendJSON(res, 200, {
                        ok: true
                    });
                }
            );

            return;
        }


        /*
        --------------------------------------------------------
        STATIC
        --------------------------------------------------------
        */

        serveStatic(
            req,
            res
        );
    }
);


/*
============================================================
BACKUP CLEANUP
============================================================

Normal polling disconnects are detected quickly.

This timer catches cases where the browser/network dies
without giving Node a useful disconnect event.
============================================================
*/

setInterval(
    function() {

        var now =
            Date.now();

        var id;

        for (id in clients) {

            if (!clients.hasOwnProperty(id)) {
                continue;
            }

            var client =
                clients[id];

            if (
                !client ||
                client.removed
            ) {
                continue;
            }

            /*
            60 seconds without ANY activity means the
            client is probably gone.

            The client sends heartbeat requests while active.
            */
            if (
                now -
                client.lastActivity >
                60000
            ) {
                removeClient(id);
            }
        }
    },
    15000
);


/*
============================================================
START
============================================================
*/

server.listen(
    PORT,
    "0.0.0.0",
    function() {
        console.log(
            "Chat server running on port " +
            PORT
        );
    }
);
