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

    if (isNaN(value)) {
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
    if (res.writableEnded || res.headersSent) {
        return;
    }

    var body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Length": Buffer.byteLength(body)
    });

    res.end(body);
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
}


/*
============================================================
EVENT SYSTEM
============================================================
*/

function addEvent(client, event) {
    if (!client) {
        return;
    }

    client.events.push(event);

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

        if (!client.player) {
            continue;
        }

        if (client.player.room !== room) {
            continue;
        }

        if (exceptClientId && client.id === exceptClientId) {
            continue;
        }

        addEvent(client, event);
    }
}


/*
============================================================
LONG POLLING
============================================================
*/

function finishPoll(client) {
    if (!client) {
        return;
    }

    var res = client.pollResponse;

    if (!res) {
        return;
    }

    client.pollResponse = null;

    if (client.pollTimer) {
        clearTimeout(client.pollTimer);
        client.pollTimer = null;
    }

    if (res.writableEnded || res.destroyed) {
        return;
    }

    var events = client.events.slice(0);
    client.events = [];

    sendJSON(res, 200, {
        events: events
    });
}


/*
============================================================
DISCONNECT / REMOVE CLIENT
============================================================
*/

function removeClient(clientId) {
    var client = clients[clientId];

    if (!client) {
        return;
    }

    /*
    Prevent this from running twice.
    */
    if (client.removed) {
        return;
    }

    client.removed = true;

    if (client.pollTimer) {
        clearTimeout(client.pollTimer);
        client.pollTimer = null;
    }

    /*
    Close any pending long-poll request.
    */
    if (client.pollResponse) {
        var oldResponse = client.pollResponse;
        client.pollResponse = null;

        if (!oldResponse.writableEnded) {
            try {
                oldResponse.end();
            } catch (e) {}
        }
    }

    var player = client.player;

    /*
    IMPORTANT:
    Delete the player BEFORE broadcasting so it can no longer
    be considered an active player.
    */
    if (player && players[player.id]) {
        delete players[player.id];

        /*
        Tell every remaining player in the room that this
        character has disappeared.
        */
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
        y: Math.random() * 80 + 10,
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
    Send all existing players in this room to the new client.
    */
    var id;

    for (id in players) {
        if (!players.hasOwnProperty(id)) {
            continue;
        }

        if (id === player.id) {
            continue;
        }

        if (players[id].room !== player.room) {
            continue;
        }

        client.events.push({
            type: "playerJoined",
            player: players[id]
        });
    }

    /*
    Tell everyone else about the new player.
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

    return types[ext] || "application/octet-stream";
}

function serveStatic(req, res) {
    var requestPath = req.url.split("?")[0];

    if (requestPath === "/") {
        requestPath = "/index.html";
    }

    try {
        requestPath = decodeURIComponent(requestPath);
    } catch (e) {
        sendJSON(res, 400, {
            error: "Bad URL"
        });
        return;
    }

    /*
    Security: never allow paths outside public/.
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

    var filePath = path.join(
        PUBLIC_DIR,
        requestPath
    );

    if (
        filePath !== PUBLIC_DIR &&
        filePath.indexOf(PUBLIC_DIR + path.sep) !== 0
    ) {
        sendJSON(res, 403, {
            error: "Forbidden"
        });
        return;
    }

    fs.stat(filePath, function(err, stat) {
        if (err || !stat.isFile()) {
            sendJSON(res, 404, {
                error: "Not found"
            });
            return;
        }

        fs.readFile(filePath, function(readErr, data) {
            if (readErr) {
                sendJSON(res, 500, {
                    error: "Could not read file"
                });
                return;
            }

            if (res.writableEnded || res.headersSent) {
                return;
            }

            res.writeHead(200, {
                "Content-Type": getContentType(filePath),
                "Cache-Control": "no-cache"
            });

            res.end(data);
        });
    });
}


/*
============================================================
SERVER
============================================================
*/

var server = http.createServer(function(req, res) {
    var parsed;

    try {
        parsed = new URL(
            req.url,
            "http://" + (req.headers.host || "localhost")
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
        parseBody(req, function(body) {
            if (!body) {
                sendJSON(res, 400, {
                    error: "Invalid request"
                });
                return;
            }

            var client = joinClient(
                body.name,
                body.room
            );

            client.lastActivity = Date.now();

            sendJSON(res, 200, {
                id: client.id,
                player: client.player,
                events: client.events
            });

            client.events = [];
        });

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
        var pollId = parsed.searchParams.get("id");
        var pollClient = clients[pollId];

        if (!pollClient || pollClient.removed) {
            sendJSON(res, 404, {
                error: "Client not found"
            });
            return;
        }

        pollClient.lastActivity = Date.now();

        /*
        If events are already waiting, send immediately.
        */
        if (pollClient.events.length > 0) {
            finishPoll(pollClient);
            return;
        }

        /*
        If the client somehow has an old poll still open,
        close it first.
        */
        if (pollClient.pollResponse) {
            try {
                pollClient.pollResponse.end();
            } catch (e) {}

            pollClient.pollResponse = null;
        }

        pollClient.pollResponse = res;

        /*
        Long poll timeout.
        */
        pollClient.pollTimer = setTimeout(function() {
            if (!pollClient || pollClient.removed) {
                return;
            }

            finishPoll(pollClient);
        }, 25000);

        /*
        VERY IMPORTANT:
        If the browser closes its tab, the HTTP request
        eventually emits "close". Remove the player
        immediately instead of waiting for the 120-second
        cleanup timer.
        */
        req.on("close", function() {
            /*
            Only remove the client if this request is still
            the client's active poll request.

            This prevents an old poll request from removing
            a client after it has already started another one.
            */
            if (
                pollClient &&
                pollClient.pollResponse === res
            ) {
                removeClient(pollClient.id);
            }
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
        parseBody(req, function(body) {
            if (!body) {
                sendJSON(res, 400, {
                    error: "Invalid request"
                });
                return;
            }

            var client = clients[String(body.id)];

            if (!client || client.removed || !client.player) {
                sendJSON(res, 404, {
                    error: "Client not found"
                });
                return;
            }

            client.lastActivity = Date.now();

            var text = cleanText(body.text);

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
                var newRandomColor = randomColor();

                client.player.color = newRandomColor;

                broadcast(
                    client.player.room,
                    {
                        type: "playerColorChanged",
                        playerId: client.player.id,
                        color: newRandomColor
                    }
                );

                sendJSON(res, 200, {
                    ok: true
                });

                return;
            }

            /*
            /color red
            /color #ff0000
            */
            if (text.indexOf("/color ") === 0) {
                var colorValue = cleanText(
                    text.substring(7)
                );

                var newColor = getColor(colorValue);

                if (!newColor) {
                    addEvent(client, {
                        type: "systemMessage",
                        text: "Invalid color."
                    });

                    sendJSON(res, 200, {
                        ok: true
                    });

                    return;
                }

                client.player.color = newColor;

                broadcast(
                    client.player.room,
                    {
                        type: "playerColorChanged",
                        playerId: client.player.id,
                        color: newColor
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
                    client.player.character === "bonzi"
                        ? "square"
                        : "bonzi";

                client.player.character = newCharacter;

                broadcast(
                    client.player.room,
                    {
                        type: "playerCharacterChanged",
                        playerId: client.player.id,
                        character: newCharacter
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
            if (text === "/char bonzi") {
                client.player.character = "bonzi";

                broadcast(
                    client.player.room,
                    {
                        type: "playerCharacterChanged",
                        playerId: client.player.id,
                        character: "bonzi"
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
            if (text === "/char square") {
                client.player.character = "square";

                broadcast(
                    client.player.room,
                    {
                        type: "playerCharacterChanged",
                        playerId: client.player.id,
                        character: "square"
                    }
                );

                sendJSON(res, 200, {
                    ok: true
                });

                return;
            }

            /*
            Normal chat message.
            */
            broadcast(
                client.player.room,
                {
                    type: "message",
                    playerId: client.player.id,
                    name: client.player.name,
                    text: text
                }
            );

            sendJSON(res, 200, {
                ok: true
            });

        });

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
        parseBody(req, function(body) {
            if (!body) {
                sendJSON(res, 400, {
                    error: "Invalid request"
                });
                return;
            }

            var sender = clients[String(body.senderId)];

            if (
                !sender ||
                sender.removed ||
                !sender.player
            ) {
                sendJSON(res, 404, {
                    error: "Client not found"
                });
                return;
            }

            sender.lastActivity = Date.now();

            var target = players[String(body.playerId)];

            if (!target) {
                sendJSON(res, 404, {
                    error: "Player not found"
                });
                return;
            }

            /*
            Only allow dragging someone in the same room.
            */
            if (target.room !== sender.player.room) {
                sendJSON(res, 403, {
                    error: "Wrong room"
                });
                return;
            }

            target.x = clamp(body.x, 2, 98);
            target.y = clamp(body.y, 2, 98);

            broadcast(
                target.room,
                {
                    type: "playerMoved",
                    playerId: target.id,
                    x: target.x,
                    y: target.y
                }
            );

            sendJSON(res, 200, {
                ok: true
            });

        });

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
        parseBody(req, function(body) {
            if (!body) {
                sendJSON(res, 400, {
                    error: "Invalid request"
                });
                return;
            }

            var clientId = String(body.id);

            if (clients[clientId]) {
                removeClient(clientId);
            }

            sendJSON(res, 200, {
                ok: true
            });
        });

        return;
    }


    /*
    --------------------------------------------------------
    STATIC FILES
    --------------------------------------------------------
    */

    serveStatic(req, res);
});


/*
============================================================
BACKUP CLEANUP
============================================================

The close event handles normal tab/browser disconnections.

This cleanup is only a backup for cases where a connection
dies without producing the expected close event.
*/

setInterval(function() {
    var now = Date.now();
    var id;

    for (id in clients) {
        if (!clients.hasOwnProperty(id)) {
            continue;
        }

        var client = clients[id];

        if (
            !client.removed &&
            now - client.lastActivity > 120000
        ) {
            removeClient(id);
        }
    }
}, 30000);


/*
============================================================
START
============================================================
*/

server.listen(PORT, "0.0.0.0", function() {
    console.log(
        "Chat server running on port " + PORT
    );
});
