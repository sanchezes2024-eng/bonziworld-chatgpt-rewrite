var http = require("http");
var fs = require("fs");
var path = require("path");
var url = require("url");
var querystring = require("querystring");
var crypto = require("crypto");
var child_process = require("child_process");

var PORT = process.env.PORT || 3000;
var PUBLIC = path.join(__dirname, "public");

var players = {};
var rooms = {};
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

function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function makeId() {
    return String(nextClientId++);
}

function cleanText(value, max) {
    value = value === undefined || value === null ? "" : String(value);
    value = value.replace(/[\x00-\x1f\x7f]/g, "");
    return value.substring(0, max);
}

function validRoom(room) {
    return /^[A-Za-z0-9_\- ]{1,40}$/.test(room);
}

function validName(name) {
    return /^[^<>]{1,24}$/.test(name);
}

function validHex(color) {
    return /^#[0-9a-fA-F]{6}$/.test(color);
}

function getColor(value) {
    value = cleanText(value, 30).toLowerCase();

    if (COLOR_NAMES[value]) {
        return COLOR_NAMES[value];
    }

    if (validHex(value)) {
        return value;
    }

    return null;
}

function sendJSON(res, object, status) {
    var body = JSON.stringify(object);

    res.writeHead(status || 200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(body);
}

function parseBody(req, callback) {
    var data = "";

    req.on("data", function (chunk) {
        data += chunk;

        if (data.length > 100000) {
            req.destroy();
        }
    });

    req.on("end", function () {
        callback(querystring.parse(data));
    });
}

function broadcast(room, event, data) {
    var id;
    var client;

    for (id in clients) {
        if (!clients.hasOwnProperty(id)) {
            continue;
        }

        client = clients[id];

        if (client.room === room) {
            client.events.push({
                event: event,
                data: data
            });

            if (client.res) {
                finishPoll(client);
            }
        }
    }
}

function finishPoll(client) {
    var response;
    var res;

    if (!client.res) {
        return;
    }

    response = {
        events: client.events
    };

    res = client.res;

    client.res = null;
    client.events = [];

    sendJSON(res, response);
}

function pollClient(client, res) {
    if (!client) {
        sendJSON(res, {
            error: "invalid client"
        }, 400);

        return;
    }

    if (client.events.length) {
        client.res = res;
        finishPoll(client);
        return;
    }

    client.res = res;

    client.pollTimer = setTimeout(function () {
        if (client.res === res) {
            client.res = null;

            sendJSON(res, {
                events: []
            });
        }
    }, 25000);
}

function removeClient(client) {
    var player;

    if (!client) {
        return;
    }

    player = players[client.id];

    if (player) {
        broadcast(player.room, "playerLeft", {
            id: player.id
        });

        delete players[client.id];
    }

    if (client.res) {
        try {
            client.res.end(JSON.stringify({
                events: []
            }));
        } catch (e) {}

        client.res = null;
    }

    delete clients[client.id];
}

function joinClient(name, room) {
    var id = makeId();

    name = cleanText(name, 24);
    room = cleanText(room, 40);

    if (!name || !validName(name)) {
        name = "Anonymous";
    }

    if (!room || !validRoom(room)) {
        room = "default";
    }

    clients[id] = {
        id: id,
        room: room,
        events: [],
        res: null,
        pollTimer: null
    };

    players[id] = {
        id: id,
        name: name,
        room: room,
        x: Math.random() * 90 + 5,
        y: Math.random() * 80 + 10,
        color: randomColor(),
        character: "bonzi"
    };

    return players[id];
}

function serveStatic(req, res, pathname) {
    var file;
    var ext;
    var types;

    if (pathname === "/") {
        pathname = "/index.html";
    }

    pathname = decodeURIComponent(pathname);

    if (pathname.indexOf("..") !== -1) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    file = path.join(PUBLIC, pathname);
    ext = path.extname(file).toLowerCase();

    types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg"
    };

    fs.readFile(file, function (err, data) {
        if (err) {
            res.writeHead(404);
            res.end("Not Found");
            return;
        }

        res.writeHead(200, {
            "Content-Type": types[ext] || "application/octet-stream",
            "Cache-Control": "no-cache"
        });

        res.end(data);
    });
}

function generateTTS(text, callback) {
    var filename;
    var output;
    var safeText;
    var espeak;

    safeText = cleanText(text, 500);

    if (!safeText) {
        callback(null);
        return;
    }

    filename = "tts_" + crypto.randomBytes(8).toString("hex") + ".wav";
    output = path.join("/tmp", filename);

    espeak = child_process.spawn("espeak", [
        "-w",
        output,
        "-a",
        "100",
        "-p",
        "50",
        "-s",
        "175",
        "-v",
        "en-us",
        safeText
    ]);

    espeak.on("error", function () {
        callback(null);
    });

    espeak.on("close", function (code) {
        if (code !== 0) {
            callback(null);
            return;
        }

        callback("/tts/" + filename);
    });
}

function serveTTS(req, res, pathname) {
    var filename;
    var file;

    filename = pathname.substring("/tts/".length);

    if (!/^tts_[a-f0-9]+\.wav$/.test(filename)) {
        res.writeHead(404);
        res.end();
        return;
    }

    file = path.join("/tmp", filename);

    fs.readFile(file, function (err, data) {
        if (err) {
            res.writeHead(404);
            res.end();
            return;
        }

        res.writeHead(200, {
            "Content-Type": "audio/wav",
            "Content-Length": data.length,
            "Cache-Control": "public, max-age=3600"
        });

        res.end(data);

        setTimeout(function () {
            fs.unlink(file, function () {});
        }, 60000);
    });
}

var server = http.createServer(function (req, res) {
    var parsed;
    var pathname;
    var client;
    var id;

    parsed = url.parse(req.url, true);
    pathname = parsed.pathname;

    if (pathname === "/api/join" && req.method === "POST") {
        parseBody(req, function (body) {
            var player;
            var id2;
            var other;

            player = joinClient(body.name, body.room);

            id2 = player.id;

            for (other in players) {
                if (
                    players.hasOwnProperty(other) &&
                    other !== id2 &&
                    players[other].room === player.room
                ) {
                    clients[id2].events.push({
                        event: "playerJoined",
                        data: players[other]
                    });
                }
            }

            sendJSON(res, {
                id: id2,
                player: player
            });

            broadcast(player.room, "playerJoined", player);
        });

        return;
    }

    if (pathname === "/api/poll") {
        id = parsed.query.id;
        client = clients[id];

        pollClient(client, res);
        return;
    }

    if (pathname === "/api/send" && req.method === "POST") {
        parseBody(req, function (body) {
            client = clients[body.id];

            if (!client || !players[body.id]) {
                sendJSON(res, {
                    error: "invalid client"
                }, 400);

                return;
            }

            var message = cleanText(body.message, 500);

            if (!message) {
                sendJSON(res, {
                    ok: true
                });

                return;
            }

            if (message.indexOf("/color ") === 0) {
                var requestedColor = message.substring(7);
                var color = getColor(requestedColor);

                if (!color) {
                    broadcast(client.room, "systemMessage", {
                        text: "Invalid color."
                    });
                } else {
                    players[client.id].color = color;

                    broadcast(client.room, "playerColorChanged", {
                        id: client.id,
                        color: color
                    });
                }

                sendJSON(res, { ok: true });
                return;
            }

            if (message === "/color") {
                players[client.id].color = randomColor();

                broadcast(client.room, "playerColorChanged", {
                    id: client.id,
                    color: players[client.id].color
                });

                sendJSON(res, { ok: true });
                return;
            }

            if (message === "/char bonzi" || message === "/char square") {
                players[client.id].character =
                    message.substring(6) === "square" ? "square" : "bonzi";

                broadcast(client.room, "playerCharacterChanged", {
                    id: client.id,
                    character: players[client.id].character
                });

                sendJSON(res, { ok: true });
                return;
            }

            if (message === "/char") {
                players[client.id].character =
                    players[client.id].character === "bonzi"
                        ? "square"
                        : "bonzi";

                broadcast(client.room, "playerCharacterChanged", {
                    id: client.id,
                    character: players[client.id].character
                });

                sendJSON(res, { ok: true });
                return;
            }

            broadcast(client.room, "message", {
                id: client.id,
                text: message
            });

            sendJSON(res, { ok: true });
        });

        return;
    }

    if (pathname === "/api/move" && req.method === "POST") {
        parseBody(req, function (body) {
            var sender;
            var target;
            var x;
            var y;

            sender = clients[body.senderId];

            if (!sender) {
                sendJSON(res, {
                    error: "invalid sender"
                }, 400);

                return;
            }

            target = players[String(body.playerId)];

            if (!target || target.room !== sender.room) {
                sendJSON(res, {
                    error: "invalid target"
                }, 400);

                return;
            }

            x = parseFloat(body.x);
            y = parseFloat(body.y);

            if (isNaN(x) || isNaN(y)) {
                sendJSON(res, {
                    error: "invalid position"
                }, 400);

                return;
            }

            x = Math.max(2, Math.min(98, x));
            y = Math.max(2, Math.min(98, y));

            target.x = x;
            target.y = y;

            broadcast(target.room, "playerMoved", {
                id: target.id,
                x: x,
                y: y
            });

            sendJSON(res, {
                ok: true
            });
        });

        return;
    }

    if (pathname === "/api/leave" && req.method === "POST") {
        parseBody(req, function (body) {
            client = clients[body.id];

            if (client) {
                removeClient(client);
            }

            sendJSON(res, {
                ok: true
            });
        });

        return;
    }

    if (pathname.indexOf("/tts/") === 0) {
        serveTTS(req, res, pathname);
        return;
    }

    if (pathname === "/api/tts" && req.method === "GET") {
        generateTTS(parsed.query.text || "", function (result) {
            if (!result) {
                sendJSON(res, {
                    error: "TTS unavailable"
                }, 503);

                return;
            }

            sendJSON(res, {
                url: result
            });
        });

        return;
    }

    serveStatic(req, res, pathname);
});

setInterval(function () {
    var id;
    var now = Date.now();

    for (id in clients) {
        if (
            clients.hasOwnProperty(id) &&
            clients[id].lastSeen &&
            now - clients[id].lastSeen > 120000
        ) {
            removeClient(clients[id]);
        }
    }
}, 30000);

server.listen(PORT, "0.0.0.0", function () {
    console.log("Legacy chat server listening on port " + PORT);
});
