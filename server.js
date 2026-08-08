const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    let filePath;

    if (req.url === "/" || req.url === "/index.html") {
        filePath = path.join(__dirname, "public", "index.html");
    } else if (req.url === "/style.css") {
        filePath = path.join(__dirname, "public", "style.css");
    } else if (req.url === "/script.js") {
        filePath = path.join(__dirname, "public", "script.js");
    } else {
        res.writeHead(404);
        res.end("Not Found");
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end("Server Error");
            return;
        }

        const types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript"
        };

        res.writeHead(200, {
            "Content-Type": types[path.extname(filePath)] || "text/plain"
        });

        res.end(data);
    });
});

const io = new Server(server);

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("joinRoom", ({ name, room }) => {
        name = String(name || "Anonymous").trim();
        room = String(room || "default").trim();

        if (!name) name = "Anonymous";
        if (!room) room = "default";

        socket.join(room);

        socket.data.name = name;
        socket.data.room = room;

        // Start everyone near the center.
        socket.data.x = 50;
        socket.data.y = 50;

        socket.emit("joined", {
            id: socket.id,
            name,
            room,
            x: socket.data.x,
            y: socket.data.y
        });

        socket.to(room).emit("playerJoined", {
            id: socket.id,
            name,
            x: socket.data.x,
            y: socket.data.y
        });

        // Send the existing players to the new player.
        const roomSockets = io.sockets.adapter.rooms.get(room);

        if (roomSockets) {
            for (const id of roomSockets) {
                if (id === socket.id) continue;

                const otherSocket = io.sockets.sockets.get(id);

                if (!otherSocket) continue;

                socket.emit("playerJoined", {
                    id,
                    name: otherSocket.data.name,
                    x: otherSocket.data.x ?? 50,
                    y: otherSocket.data.y ?? 50
                });
            }
        }

        console.log(`${name} joined ${room}`);
    });


    /*
     * PLAYER MOVEMENT
     */

    socket.on("move", ({ x, y }) => {
        const room = socket.data.room;

        if (!room) return;

        x = Number(x);
        y = Number(y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }

        // Keep the player inside the desktop.
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        socket.data.x = x;
        socket.data.y = y;

        socket.to(room).emit("playerMoved", {
            id: socket.id,
            x,
            y
        });
    });


    /*
     * CHAT MESSAGE
     */

    socket.on("message", (message) => {
        const name = socket.data.name;
        const room = socket.data.room;

        if (!name || !room) return;

        message = String(message || "").trim();

        if (!message) return;

        if (message.length > 300) {
            message = message.substring(0, 300);
        }

        io.to(room).emit("message", {
            id: socket.id,
            name,
            text: message
        });
    });


    /*
     * DISCONNECT
     */

    socket.on("disconnect", () => {
        const room = socket.data.room;

        if (room) {
            socket.to(room).emit("playerLeft", {
                id: socket.id
            });
        }

        console.log("Disconnected:", socket.id);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
