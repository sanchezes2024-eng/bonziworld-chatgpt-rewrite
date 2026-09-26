const http = require("http");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const players = {};
const clients = {};

let nextClientId = 1;


/*
============================================================
COLORS
============================================================
*/

const colorPalette = [
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

const namedColors = {
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
        return null;
    }

    value = String(value)
        .toLowerCase()
        .replace(/^\s+|\s+$/g, "");

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
    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^\s+|\s+$/g, "")
        .substring(0, 500);
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
        return min;
    }

    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}


/*
============================================================
JSON RESPONSE
============================================================
*/

function sendJSON(res, status, data) {
    if (res.writableEnded || res.headersSent) {
        return;
    }

    const output = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(output);
}


/*
============================================================
POST BODY
============================================================
*/

function parseBody(req, callback) {
    let body = "";
    let finished = false;

    function finish() {
        if (finished) {
            return;
        }

        finished = true;

        try {
            callback(querystring.parse(body));
        } catch (e) {
            callback({});
        }
    }

    req.on("data", function (chunk) {
        if (finished) {
            return;
        }

        body += chunk.toString();

        if (body.length > 100000) {
            finished = true;
            req.destroy();
        }
    });

    req.on("end", finish);

    req.on("error", function () {
        finish();
    });
}


/*
============================================================
EVENT QUEUES
============================================================
*/

function addEvent(clientId, event) {
    const client = clients[clientId];

    if (!client) {
        return;
    }

    client.events.push(event);

    if (client.pendingResponse) {
        finishPoll(client);
    }
}

function broadcast(room, event, exceptClientId) {
    let id;

    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id)) {
            continue;
        }

        const client = clients[id];

        if (
            client.room === room &&
            id !== exceptClientId
        ) {
            addEvent(id, event);
        }
    }
}

function finishPoll(client) {
    if (!client.pendingResponse) {
        return;
    }

    const response = client.pendingResponse;

    client.pendingResponse = null;

    if (client.pollTimer) {
        clearTimeout(client.pollTimer);
        client.pollTimer = null;
    }

    if (
        response.writableEnded ||
        response.headersSent
    ) {
        return;
    }

    const events = client.events.splice(
        0,
        client.events.length
    );

    sendJSON(response, 200, {
        events: events
    });
}


/*
============================================================
REMOVE CLIENT
============================================================
*/

function removeClient(clientId) {
    const client = clients[clientId];

    if (!client) {
        return;
    }

    if (client.pollTimer) {
        clearTimeout(client.pollTimer);
        client.pollTimer = null;
    }

    if (client.pendingResponse) {
        const response = client.pendingResponse;

        client.pendingResponse = null;

        if (!response.writableEnded) {
            response.end(
                JSON.stringify({
                    events: []
                })
            );
        }
    }

    const player = players[client.playerId];

    if (player) {
        broadcast(
            player.room,
            {
                type: "playerLeft",
                playerId: player.id
            },
            clientId
        );

        delete players[player.id];
    }

    delete clients[clientId];
}


/*
============================================================
JOIN
============================================================
*/

function joinClient(name, room) {
    const id = String(nextClientId++);

    const player = {
        id: id,
        name: validName(name),
        room: validRoom(room),
        x: Math.random() * 90 + 5,
        y: Math.random() * 80 + 10,
        color: randomColor(),
        character: "bonzi"
    };

    const client = {
        id: id,
        playerId: id,
        room: player.room,
        events: [],
        pendingResponse: null,
        pollTimer: null,
        lastSeen: Date.now()
    };

    players[id] = player;
    clients[id] = client;

    return {
        client: client,
        player: player
    };
}


/*
============================================================
STATIC FILES
============================================================
*/

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ico": "image/x-icon"
};

function serveFile(req, res, pathname) {
    if (pathname === "/") {
        pathname = "/index.html";
    }

    if (
        pathname.indexOf("..") !== -1 ||
        pathname.indexOf("\\") !== -1
    ) {
        sendJSON(res, 403, {
            error: "Forbidden"
        });

        return;
    }

    const filePath = path.join(
        PUBLIC_DIR,
        pathname.substring(1)
    );

    if (
        filePath.indexOf(PUBLIC_DIR) !== 0
    ) {
        sendJSON(res, 403, {
            error: "Forbidden"
        });

        return;
    }

    fs.readFile(
        filePath,
        function (error, data) {
            if (error) {
                sendJSON(res, 404, {
                    error: "Not found"
                });

                return;
            }

            if (
                res.writableEnded ||
                res.headersSent
            ) {
                return;
            }

            const ext = path.extname(filePath).toLowerCase();

            res.writeHead(200, {
                "Content-Type":
                    mimeTypes[ext] ||
                    "application/octet-stream",

                "Cache-Control": "no-cache"
            });

            res.end(data);
        }
    );
}


/*
============================================================
HTTP SERVER
============================================================
*/

const server = http.createServer(function (req, res) {
    let parsed;

    try {
        parsed = new URL(
            req.url,
            "http://" +
            (req.headers.host || "localhost")
        );
    } catch (e) {
        sendJSON(res, 400, {
            error: "Bad request"
        });

        return;
    }

    const pathname = parsed.pathname;


    /*
    ========================================================
    JOIN
    ========================================================
    */

    if (
        pathname === "/api/join" &&
        req.method === "POST"
    ) {
        parseBody(req, function (body) {
            const result = joinClient(
                body.name,
                body.room
            );

            const client = result.client;
            const player = result.player;

            let id;

            for (id in players) {
                if (!Object.prototype.hasOwnProperty.call(players, id)) {
                    continue;
                }

                if (id === player.id) {
                    continue;
                }

                if (
                    players[id].room ===
                    player.room
                ) {
                    client.events.push({
                        type: "playerJoined",
                        player: players[id]
                    });
                }
            }

            broadcast(
                player.room,
                {
                    type: "playerJoined",
                    player: player
                },
                client.id
            );

            sendJSON(res, 200, {
                id: client.id,
                player: player,
                events: client.events.splice(
                    0,
                    client.events.length
                )
            });
        });

        return;
    }


    /*
    ========================================================
    POLL
    ========================================================
    */

    if (
        pathname === "/api/poll" &&
        req.method === "GET"
    ) {
        const id = parsed.searchParams.get("id");
        const client = clients[id];

        if (!client) {
            sendJSON(res, 400, {
                error: "Invalid client"
            });

            return;
        }

        client.lastSeen = Date.now();

        if (client.pendingResponse) {
            const oldResponse = client.pendingResponse;

            client.pendingResponse = null;

            if (client.pollTimer) {
                clearTimeout(client.pollTimer);
                client.pollTimer = null;
            }

            if (!oldResponse.writableEnded) {
                oldResponse.end(
                    JSON.stringify({
                        events: []
                    })
                );
            }
        }

        if (client.events.length > 0) {
            sendJSON(res, 200, {
                events: client.events.splice(
                    0,
                    client.events.length
                )
            });

            return;
        }

        client.pendingResponse = res;

        client.pollTimer = setTimeout(
            function () {
                if (
                    client.pendingResponse ===
                    res
                ) {
                    client.pendingResponse = null;
                    client.pollTimer = null;

                    if (
                        !res.writableEnded &&
                        !res.headersSent
                    ) {
                        sendJSON(res, 200, {
                            events: []
                        });
                    }
                }
            },
            25000
        );

        return;
    }


    /*
    ========================================================
    SEND MESSAGE
    ========================================================
    */

    if (
        pathname === "/api/send" &&
        req.method === "POST"
    ) {
        parseBody(req, function (body) {
            const client = clients[body.id];

            if (!client) {
                sendJSON(res, 400, {
                    error: "Invalid client"
                });

                return;
            }

            client.lastSeen = Date.now();

            const player = players[client.playerId];

            if (!player) {
                sendJSON(res, 400, {
                    error: "Player not found"
                });

                return;
            }

            const text = cleanText(body.text);

            if (!text) {
                sendJSON(res, 400, {
                    error: "Empty message"
                });

                return;
            }


            /*
            ------------------------------------------------
            /color
            ------------------------------------------------
            */

            if (
                text.toLowerCase() === "/color"
            ) {
                const color = randomColor();

                player.color = color;

                broadcast(
                    player.room,
                    {
                        type:
                            "playerColorChanged",
                        playerId:
                            player.id,
                        color:
                            color
                    }
                );

                sendJSON(res, 200, {
                    ok: true
                });

                return;
            }


            /*
            ------------------------------------------------
            /color NAME
            ------------------------------------------------
            */

            if (
                text.toLowerCase()
                    .indexOf("/color ") === 0
            ) {
                const color = getColor(
                    text.substring(7)
                );

                if (!color) {
                    addEvent(
                        client.id,
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

                player.color = color;

                broadcast(
                    player.room,
                    {
                        type:
                            "playerColorChanged",
                        playerId:
                            player.id,
                        color:
                            color
                    }
                );

                sendJSON(res, 200, {
                    ok: true
                });

                return;
            }


            /*
            ------------------------------------------------
            /char
            ------------------------------------------------
            */

            if (
                text.toLowerCase() === "/char"
            ) {
                player.character =
                    player.character === "bonzi"
                        ? "square"
                        : "bonzi";

                broadcast(
                    player.room,
                    {
                        type:
                            "playerCharacterChanged",
                        playerId:
                            player.id,
                        character:
                            player.character
                    }
                );

                sendJSON(res, 200, {
                    ok: true
                });

                return;
            }


            /*
            ------------------------------------------------
            /char bonzi
            ------------------------------------------------
            */

            if (
                text.toLowerCase() ===
                "/char bonzi"
            ) {
                player.character = "bonzi";

                broadcast(
                    player.room,
                    {
                        type:
                            "playerCharacterChanged",
                        playerId:
                            player.id,
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
            ------------------------------------------------
            /char square
            ------------------------------------------------
            */

            if (
                text.toLowerCase() ===
                "/char square"
            ) {
                player.character = "square";

                broadcast(
                    player.room,
                    {
                        type:
                            "playerCharacterChanged",
                        playerId:
                            player.id,
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
            ------------------------------------------------
            NORMAL MESSAGE
            ------------------------------------------------
            */

            broadcast(
                player.room,
                {
                    type: "message",
                    playerId: player.id,
                    name: player.name,
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
    ========================================================
    MOVE
    ========================================================
    */

    if (
        pathname === "/api/move" &&
        req.method === "POST"
    ) {
        parseBody(req, function (body) {
            const sender = clients[body.senderId];

            if (!sender) {
                sendJSON(res, 400, {
                    error: "Invalid sender"
                });

                return;
            }

            sender.lastSeen = Date.now();

            const player = players[body.playerId];

            if (!player) {
                sendJSON(res, 400, {
                    error: "Player not found"
                });

                return;
            }

            if (
                player.room !==
                sender.room
            ) {
                sendJSON(res, 403, {
                    error: "Different room"
                });

                return;
            }

            player.x = clamp(body.x, 2, 98);
            player.y = clamp(body.y, 2, 98);

            broadcast(
                player.room,
                {
                    type: "playerMoved",
                    playerId: player.id,
                    x: player.x,
                    y: player.y
                }
            );

            sendJSON(res, 200, {
                ok: true
            });
        });

        return;
    }


    /*
    ========================================================
    LEAVE
    ========================================================
    */

    if (
        pathname === "/api/leave" &&
        req.method === "POST"
    ) {
        parseBody(req, function (body) {
            if (clients[body.id]) {
                removeClient(body.id);
            }

            sendJSON(res, 200, {
                ok: true
            });
        });

        return;
    }


    /*
    ========================================================
    STATIC FILE
    ========================================================
    */

    if (req.method === "GET") {
        serveFile(
            req,
            res,
            pathname
        );

        return;
    }

    sendJSON(res, 404, {
        error: "Not found"
    });
});


/*
============================================================
DISCONNECT / TIMEOUT CLEANUP
============================================================
*/

setInterval(function () {
    const now = Date.now();
    let id;

    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id)) {
            continue;
        }

        if (
            now -
            clients[id].lastSeen >
            120000
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

server.listen(
    PORT,
    "0.0.0.0",
    function () {
        console.log(
            "Chat server running on port " +
            PORT
        );
    }
);
