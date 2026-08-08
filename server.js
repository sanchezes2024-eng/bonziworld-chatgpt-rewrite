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

        const ext = path.extname(filePath);

        const types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript"
        };

        res.writeHead(200, {
            "Content-Type": types[ext] || "text/plain"
        });

        res.end(data);
    });
});

const io = new Server(server);

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("joinRoom", ({ name, room }) => {
        name = String(name || "Anonymous").trim();
        room = String(room || "default").trim();

        if (!name) name = "Anonymous";
        if (!room) room = "default";

        socket.join(room);

        socket.data.name = name;
        socket.data.room = room;

        // Tell everyone in the room that a new player joined
        io.to(room).emit("playerJoined", {
            id: socket.id,
            name
        });

        // Give the new client their own player data
        socket.emit("joined", {
            id: socket.id,
            name,
            room
        });

        console.log(`${name} joined room ${room}`);
    });

    socket.on("message", (message) => {
        const name = socket.data.name;
        const room = socket.data.room;

        if (!name || !room) return;

        message = String(message || "").trim();

        if (!message) return;

        // Limit messages to 300 characters
        if (message.length > 300) {
            message = message.substring(0, 300);
        }

        io.to(room).emit("message", {
            id: socket.id,
            name,
            text: message
        });
    });

    socket.on("disconnect", () => {
        const name = socket.data.name;
        const room = socket.data.room;

        if (name && room) {
            io.to(room).emit("playerLeft", {
                id: socket.id
            });

            console.log(`${name} left room ${room}`);
        }

        console.log("Client disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
