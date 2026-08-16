const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;


/*
============================================================
RANDOM COLORS
============================================================
*/

function randomColor() {

    const colors = [
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

    return colors[
        Math.floor(Math.random() * colors.length)
    ];
}


/*
============================================================
HTTP SERVER
============================================================
*/

const server = http.createServer((req, res) => {

    let filePath;

    const url =
        req.url.split("?")[0];


    if (
        url === "/" ||
        url === "/index.html"
    ) {

        filePath =
            path.join(
                __dirname,
                "public",
                "index.html"
            );

    } else if (url === "/readme.html") {

        filePath =
            path.join(
                __dirname,
                "public",
                "readme.html"
            );

    } else if (url === "/readme.css") {

        filePath =
            path.join(
                __dirname,
                "public",
                "readme.css"
            );

    } else if (url === "/style.css") {

        filePath =
            path.join(
                __dirname,
                "public",
                "style.css"
            );

    } else if (url === "/script.js") {

        filePath =
            path.join(
                __dirname,
                "public",
                "script.js"
            );

    } else if (url === "/background.png") {

        filePath =
            path.join(
                __dirname,
                "public",
                "background.png"
            );

    } else if (url === "/bonzi.png") {

        filePath =
            path.join(
                __dirname,
                "public",
                "bonzi.png"
            );

    } else if (url === "/speakClient.js") {

        filePath =
            path.join(
                __dirname,
                "public",
                "speakClient.js"
            );

    } else if (url === "/speakWorker.js") {

        filePath =
            path.join(
                __dirname,
                "public",
                "speakWorker.js"
            );

    } else if (url === "/speakGenerator.js") {

        filePath =
            path.join(
                __dirname,
                "public",
                "speakGenerator.js"
            );

    } else {

        res.writeHead(404);
        res.end("Not Found");

        return;
    }


    const extension =
        path.extname(filePath);


    const contentTypes = {

        ".html":
            "text/html; charset=utf-8",

        ".css":
            "text/css; charset=utf-8",

        ".js":
            "application/javascript; charset=utf-8",

        ".png":
            "image/png",

        ".wav":
            "audio/wav"
    };


    const contentType =
        contentTypes[extension] ||
        "application/octet-stream";


    fs.readFile(
        filePath,
        (error, data) => {

            if (error) {

                console.error(
                    "File error:",
                    error
                );

                res.writeHead(500);

                res.end(
                    "Server Error"
                );

                return;
            }


            res.writeHead(
                200,
                {
                    "Content-Type":
                        contentType
                }
            );


            res.end(data);
        }
    );
});


/*
============================================================
SOCKET.IO
============================================================
*/

const io =
    new Server(server);


/*
============================================================
PLAYER CONNECTION
============================================================
*/

io.on(
    "connection",
    (socket) => {

        console.log(
            "Connected:",
            socket.id
        );


        /*
        ====================================================
        JOIN ROOM
        ====================================================
        */

        socket.on(
            "joinRoom",
            (data) => {

                let name =
                    String(
                        data?.name || ""
                    ).trim();


                let room =
                    String(
                        data?.room || ""
                    ).trim();


                if (!name) {
                    name = "Anonymous";
                }


                if (!room) {
                    room = "default";
                }


                socket.data.name =
                    name;

                socket.data.room =
                    room;


                /*
                Random starting position.
                */

                socket.data.x =
                    Math.random() * 90 + 5;

                socket.data.y =
                    Math.random() * 80 + 10;


                /*
                Random starting color.
                */

                socket.data.color =
                    randomColor();


                /*
                Everyone starts as Bonzi.
                */

                socket.data.character =
                    "bonzi";


                socket.join(room);


                /*
                =================================================
                TELL NEW PLAYER ABOUT THEMSELVES
                =================================================
                */

                socket.emit(
                    "joined",
                    {
                        id:
                            socket.id,

                        name:
                            name,

                        room:
                            room,

                        x:
                            socket.data.x,

                        y:
                            socket.data.y,

                        color:
                            socket.data.color,

                        character:
                            socket.data.character
                    }
                );


                /*
                =================================================
                TELL EVERYONE ELSE ABOUT NEW PLAYER
                =================================================
                */

                socket.to(room).emit(
                    "playerJoined",
                    {
                        id:
                            socket.id,

                        name:
                            name,

                        x:
                            socket.data.x,

                        y:
                            socket.data.y,

                        color:
                            socket.data.color,

                        character:
                            socket.data.character
                    }
                );


                /*
                =================================================
                SEND EXISTING PLAYERS TO NEW PLAYER
                =================================================
                */

                const roomSockets =
                    io.sockets.adapter.rooms.get(
                        room
                    );


                if (roomSockets) {

                    for (
                        const id of roomSockets
                    ) {

                        if (
                            id === socket.id
                        ) {
                            continue;
                        }


                        const otherSocket =
                            io.sockets.sockets.get(
                                id
                            );


                        if (!otherSocket) {
                            continue;
                        }


                        socket.emit(
                            "playerJoined",
                            {
                                id:
                                    id,

                                name:
                                    otherSocket.data.name,

                                x:
                                    otherSocket.data.x,

                                y:
                                    otherSocket.data.y,

                                color:
                                    otherSocket.data.color,

                                character:
                                    otherSocket.data.character
                            }
                        );
                    }
                }


                console.log(
                    `${name} joined room "${room}"`
                );
            }
        );


        /*
        ====================================================
        MOVEMENT
        ====================================================
        */

        socket.on(
            "move",
            (data) => {

                const room =
                    socket.data.room;


                if (!room) {
                    return;
                }


                let x =
                    Number(data?.x);

                let y =
                    Number(data?.y);


                if (
                    !Number.isFinite(x) ||
                    !Number.isFinite(y)
                ) {
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


                socket.data.x =
                    x;

                socket.data.y =
                    y;


                socket.to(room).emit(
                    "playerMoved",
                    {
                        id:
                            socket.id,

                        x:
                            x,

                        y:
                            y
                    }
                );
            }
        );


        /*
        ====================================================
        CHAT / COMMANDS
        ====================================================
        */

        socket.on(
            "message",
            (rawMessage) => {

                const room =
                    socket.data.room;

                const name =
                    socket.data.name;


                if (
                    !room ||
                    !name
                ) {
                    return;
                }


                let message =
                    String(
                        rawMessage || ""
                    ).trim();


                if (!message) {
                    return;
                }


                if (
                    message.length > 300
                ) {

                    message =
                        message.substring(
                            0,
                            300
                        );
                }


                /*
                =================================================
                /color
                =================================================
                */

                if (
                    message
                        .toLowerCase()
                        .startsWith("/color")
                ) {

                    const parts =
                        message
                            .trim()
                            .split(/\s+/);


                    let color =
                        parts[1];


                    if (!color) {

                        color =
                            randomColor();

                    } else {

                        color =
                            color.toLowerCase();


                        const isHex =
                            /^#[0-9a-f]{6}$/i
                                .test(color);


                        const allowedColors = [
                            "red",
                            "green",
                            "blue",
                            "yellow",
                            "orange",
                            "purple",
                            "pink",
                            "cyan",
                            "white",
                            "black",
                            "gray",
                            "grey",
                            "lime",
                            "magenta",
                            "aqua",
                            "navy",
                            "teal",
                            "silver"
                        ];


                        const isNamed =
                            allowedColors.includes(
                                color
                            );


                        if (
                            !isHex &&
                            !isNamed
                        ) {

                            socket.emit(
                                "systemMessage",
                                {
                                    text:
                                        "Invalid color. Use a color name, #RRGGBB, or /color."
                                }
                            );

                            return;
                        }
                    }


                    socket.data.color =
                        color;


                    io.to(room).emit(
                        "playerColorChanged",
                        {
                            id:
                                socket.id,

                            color:
                                color
                        }
                    );


                    return;
                }


                /*
                =================================================
                /char
                =================================================
                */

                if (
                    message
                        .toLowerCase()
                        .startsWith("/char")
                ) {

                    const parts =
                        message
                            .trim()
                            .split(/\s+/);


                    let character =
                        parts[1]?.toLowerCase();


                    /*
                    /char toggles.
                    */

                    if (!character) {

                        character =
                            socket.data.character === "bonzi"
                                ? "square"
                                : "bonzi";
                    }


                    if (
                        character !== "bonzi" &&
                        character !== "square"
                    ) {

                        socket.emit(
                            "systemMessage",
                            {
                                text:
                                    "Invalid character. Use /char bonzi, /char square, or /char."
                            }
                        );

                        return;
                    }


                    socket.data.character =
                        character;


                    /*
                    Tell everyone.
                    */

                    io.to(room).emit(
                        "playerCharacterChanged",
                        {
                            id:
                                socket.id,

                            character:
                                character
                        }
                    );


                    return;
                }


                /*
                =================================================
                NORMAL MESSAGE
                =================================================
                */

                io.to(room).emit(
                    "message",
                    {
                        id:
                            socket.id,

                        name:
                            name,

                        text:
                            message
                    }
                );
            }
        );


        /*
        ====================================================
        DISCONNECT
        ====================================================
        */

        socket.on(
            "disconnect",
            () => {

                const room =
                    socket.data.room;


                if (room) {

                    socket.to(room).emit(
                        "playerLeft",
                        {
                            id:
                                socket.id
                        }
                    );
                }


                console.log(
                    "Disconnected:",
                    socket.id
                );
            }
        );
    }
);


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
