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
    } else if (req.url === "/background.png") {
        filePath = path.join(__dirname, "public", "background.png");
     } else if (req.url === "/speakClient.js") {
        filePath = path.join(__dirname, "public",  "speakClient.js");
     } else if (req.url === "/speakWorker.js") {
        filePath = path.join(__dirname, "public",  "speakWorker.js");
     } else if (req.url === "/speakGenerator.js") {
        filePath = path.join(__dirname, "public",  "speakGenerator.js");
    } else {
        res.writeHead(404);
        res.end("Not Found");
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(err);

            res.writeHead(500);
            res.end("Server Error");

            return;
        }

        const contentTypes = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".wav": "audio/wav"
        };

        const contentType =
            contentTypes[path.extname(filePath)] ||
            "text/plain";

        res.writeHead(200, {
            "Content-Type": contentType
        });

        res.end(data);
    });
});


const io = new Server(server);


/*
============================================================
SOCKET.IO
============================================================
*/

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);


    /*
    ========================================================
    JOIN ROOM
    ========================================================
    */

    socket.on("joinRoom", (data) => {
        let name = String(data?.name || "").trim();
        let room = String(data?.room || "").trim();

        if (!name) {
            name = "Anonymous";
        }

        if (!room) {
            room = "default";
        }


        socket.join(room);

        socket.data.name = name;
        socket.data.room = room;


        /*
        ----------------------------------------------------
        RANDOM STARTING POSITION
        ----------------------------------------------------
        */

        socket.data.x =
            Math.random() * 90 + 5;

        socket.data.y =
            Math.random() * 90 + 5;


        /*
        ----------------------------------------------------
        TELL THE NEW USER WHO THEY ARE
        ----------------------------------------------------
        */

        socket.emit("joined", {
            id: socket.id,
            name: name,
            room: room,
            x: socket.data.x,
            y: socket.data.y
        });


        /*
        ----------------------------------------------------
        TELL EVERYONE ELSE ABOUT THE NEW USER
        ----------------------------------------------------
        */

        socket.to(room).emit("playerJoined", {
            id: socket.id,
            name: name,
            x: socket.data.x,
            y: socket.data.y
        });


        /*
        ----------------------------------------------------
        SEND EXISTING USERS TO THE NEW USER
        ----------------------------------------------------
        */

        const roomSockets =
            io.sockets.adapter.rooms.get(room);

        if (roomSockets) {
            for (const id of roomSockets) {

                if (id === socket.id) {
                    continue;
                }

                const otherSocket =
                    io.sockets.sockets.get(id);

                if (!otherSocket) {
                    continue;
                }

                socket.emit("playerJoined", {
                    id: id,
                    name: otherSocket.data.name,
                    x: otherSocket.data.x,
                    y: otherSocket.data.y
                });
            }
        }


        console.log(
            `${name} joined room "${room}"`
        );
    });


    /*
    ========================================================
    PLAYER MOVEMENT
    ========================================================
    */

    socket.on("move", (data) => {

        const room = socket.data.room;

        /*
        No room means the player has not joined yet.
        */

        if (!room) {
            return;
        }


        let x = Number(data?.x);
        let y = Number(data?.y);


        /*
        Reject invalid coordinates.
        */

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return;
        }


        /*
        Keep players inside the world.
        */

        x = Math.max(
            5,
            Math.min(95, x)
        );

        y = Math.max(
            5,
            Math.min(95, y)
        );


        /*
        Save the position on the server.
        */

        socket.data.x = x;
        socket.data.y = y;


        /*
        Send the movement to everyone else
        in this room.
        */

        socket.to(room).emit(
            "playerMoved",
            {
                id: socket.id,
                x: x,
                y: y
            }
        );
    });


    /*
    ========================================================
    CHAT MESSAGE
    ========================================================
    */

    socket.on("message", (message) => {

        const room = socket.data.room;
        const name = socket.data.name;


        if (!room || !name) {
            return;
        }


        message =
            String(message || "").trim();


        if (!message) {
            return;
        }


        /*
        Limit messages to 300 characters.
        */

        if (message.length > 300) {
            message =
                message.substring(0, 300);
        }


        /*
        Send the message to everyone in
        the same room, including sender.
        */

        io.to(room).emit(
            "message",
            {
                id: socket.id,
                name: name,
                text: message
            }
        );
    });


    /*
    ========================================================
    DISCONNECT
    ========================================================
    */

    socket.on("disconnect", () => {

        const room =
            socket.data.room;


        if (room) {

            socket.to(room).emit(
                "playerLeft",
                {
                    id: socket.id
                }
            );
        }


        console.log(
            "Disconnected:",
            socket.id
        );
    });
});


/*
============================================================
START SERVER
============================================================
*/

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Server running on port ${PORT}`
        );
    }
);
