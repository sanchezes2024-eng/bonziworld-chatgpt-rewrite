const socket = io();


/*
============================================================
ELEMENTS
============================================================
*/

const loginScreen =
    document.getElementById("loginScreen");

const desktop =
    document.getElementById("desktop");

const world =
    document.getElementById("world");

const nameInput =
    document.getElementById("nameInput");

const roomInput =
    document.getElementById("roomInput");

const submitButton =
    document.getElementById("submitButton");

const messageInput =
    document.getElementById("messageInput");

const startButton =
    document.getElementById("startButton");


/*
============================================================
CURRENT USER
============================================================
*/

let myId = null;

let myName = null;

let myRoom = null;


/*
============================================================
PLAYERS
============================================================
*/

const players = {};


/*
============================================================
DRAG STATE
============================================================
*/

let dragging = false;

let dragPointerId = null;


/*
============================================================
LOGIN
============================================================
*/

submitButton.addEventListener(
    "click",
    join
);


nameInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            join();
        }

    }
);


roomInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            join();
        }

    }
);


function join() {

    const name =
        nameInput.value.trim();

    let room =
        roomInput.value.trim();


    if (!name) {

        nameInput.focus();

        return;
    }


    if (!room) {

        room = "default";

        roomInput.value =
            "default";
    }


    socket.emit(
        "joinRoom",
        {
            name: name,
            room: room
        }
    );
}


/*
============================================================
JOINED
============================================================
*/

socket.on(
    "joined",
    (data) => {

        myId =
            data.id;

        myName =
            data.name;

        myRoom =
            data.room;


        loginScreen.style.display =
            "none";


        desktop.style.display =
            "block";


        createPlayer(
            data.id,
            data.name,
            data.x,
            data.y,
            true
        );


        messageInput.focus();
    }
);


/*
============================================================
NEW PLAYER
============================================================
*/

socket.on(
    "playerJoined",
    (data) => {

        /*
        Never create ourselves
        as another player.
        */

        if (data.id === myId) {
            return;
        }


        createPlayer(
            data.id,
            data.name,
            data.x,
            data.y,
            false
        );
    }
);


/*
============================================================
CREATE PLAYER
============================================================
*/

function createPlayer(
    id,
    name,
    x,
    y,
    isMe
) {

    /*
    Already exists.
    */

    if (players[id]) {
        return;
    }


    /*
    Create square.
    */

    const element =
        document.createElement(
            "div"
        );


    element.className =
        "player";


    /*
    Give the element its owner's
    Socket.IO ID.
    */

    element.dataset.playerId =
        id;


    /*
    ONLY OUR PLAYER receives
    the myPlayer class.
    */

    if (isMe) {

        element.classList.add(
            "myPlayer"
        );
    }


    /*
    Name label.
    */

    const nameElement =
        document.createElement(
            "div"
        );


    nameElement.className =
        "playerName";


    nameElement.textContent =
        name;


    element.appendChild(
        nameElement
    );


    /*
    Add player to world.
    */

    world.appendChild(
        element
    );


    /*
    Store player.
    */

    const player = {

        element: element,

        name: name,

        x: Number(x) || 50,

        y: Number(y) || 50,

        isMe: isMe
    };


    players[id] =
        player;


    /*
    Set position.
    */

    updatePlayerPosition(
        player
    );


    /*
    ========================================================
    IMPORTANT:
    ONLY OUR CHARACTER GETS A DRAG HANDLER.
    ========================================================
    */

    if (isMe) {

        element.addEventListener(
            "pointerdown",
            startDragging
        );

    } else {

        /*
        Other players cannot receive
        pointer interaction.
        */

        element.style.pointerEvents =
            "none";
    }
}


/*
============================================================
POSITION
============================================================
*/

function updatePlayerPosition(
    player
) {

    player.element.style.left =
        `${player.x}%`;

    player.element.style.top =
        `${player.y}%`;
}


/*
============================================================
START DRAGGING
============================================================
*/

function startDragging(event) {

    event.preventDefault();

    event.stopPropagation();


    /*
    Get the element that was clicked.
    */

    const element =
        event.currentTarget;


    /*
    Read its owner ID.
    */

    const ownerId =
        element.dataset.playerId;


    /*
    HARD SECURITY CHECK:
    It must belong to us.
    */

    if (ownerId !== myId) {

        return;
    }


    /*
    Make sure our player exists.
    */

    const player =
        players[myId];


    if (!player) {

        return;
    }


    /*
    Extra check.
    */

    if (!player.isMe) {

        return;
    }


    /*
    Start dragging.
    */

    dragging = true;

    dragPointerId =
        event.pointerId;


    /*
    Capture the pointer.
    */

    element.setPointerCapture(
        event.pointerId
    );


    element.style.cursor =
        "grabbing";
}


/*
============================================================
DRAG PLAYER
============================================================
*/

document.addEventListener(
    "pointermove",
    (event) => {

        /*
        Not dragging.
        */

        if (!dragging) {

            return;
        }


        /*
        Only process the pointer
        that started the drag.
        */

        if (
            event.pointerId !==
            dragPointerId
        ) {

            return;
        }


        /*
        Get OUR player.
        */

        const player =
            players[myId];


        if (!player) {

            dragging = false;

            return;
        }


        /*
        Extra ownership check.
        */

        if (
            player.element.dataset.playerId !==
            myId
        ) {

            dragging = false;

            return;
        }


        /*
        Get world dimensions.
        */

        const worldRect =
            world.getBoundingClientRect();


        /*
        Convert mouse coordinates
        to percentages.
        */

        let x =
            (
                event.clientX -
                worldRect.left
            )
            /
            worldRect.width
            *
            100;


        let y =
            (
                event.clientY -
                worldRect.top
            )
            /
            worldRect.height
            *
            100;


        /*
        Keep the player inside
        the world.
        */

        x =
            Math.max(
                5,
                Math.min(95, x)
            );


        y =
            Math.max(
                5,
                Math.min(95, y)
            );


        /*
        Update our local position.
        */

        player.x = x;

        player.y = y;


        updatePlayerPosition(
            player
        );


        /*
        Send movement to server.
        */

        socket.emit(
            "move",
            {
                x: x,
                y: y
            }
        );
    }
);


/*
============================================================
STOP DRAGGING
============================================================
*/

document.addEventListener(
    "pointerup",
    (event) => {

        if (!dragging) {
            return;
        }


        if (
            event.pointerId !==
            dragPointerId
        ) {

            return;
        }


        dragging = false;

        dragPointerId = null;


        const player =
            players[myId];


        if (player) {

            player.element.style.cursor =
                "grab";
        }
    }
);


/*
============================================================
PLAYER MOVEMENT FROM SERVER
============================================================
*/

socket.on(
    "playerMoved",
    (data) => {

        /*
        Ignore our own movement.
        */

        if (data.id === myId) {

            return;
        }


        /*
        Find the other player.
        */

        const player =
            players[data.id];


        /*
        Player isn't loaded yet.
        */

        if (!player) {

            return;
        }


        /*
        Update position.
        */

        player.x =
            Number(data.x);

        player.y =
            Number(data.y);


        updatePlayerPosition(
            player
        );
    }
);


/*
============================================================
PLAYER LEFT
============================================================
*/

socket.on(
    "playerLeft",
    (data) => {

        const player =
            players[data.id];


        if (!player) {

            return;
        }


        player.element.remove();


        delete players[
            data.id
        ];
    }
);


/*
============================================================
SEND MESSAGE
============================================================
*/

startButton.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            event.preventDefault();

            sendMessage();
        }
    }
);


function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) {

        return;
    }


    socket.emit(
        "message",
        text
    );


    messageInput.value =
        "";


    messageInput.focus();
}


/*
============================================================
RECEIVE MESSAGE
============================================================
*/

socket.on(
    "message",
    (data) => {

        const player =
            players[data.id];


        if (!player) {

            return;
        }


        showSpeechBubble(
            player,
            data.text
        );
    }
);


/*
============================================================
SPEECH BUBBLE
============================================================
*/

function showSpeechBubble(player, text) {
    const oldBubble =
        player.element.querySelector(".speechBubble");

    if (oldBubble) {
        oldBubble.remove();
    }

    const bubble = document.createElement("div");

    bubble.className = "speechBubble";
    bubble.textContent = text;

    player.element.appendChild(bubble);

    /*
     * Make speak.js generate and play the speech.
     */

    if (typeof speak === "function") {
        speak(text, {
            amplitude: 100,
            pitch: 50,
            speed: 175,
            voice: "en/en-us"
        });
    } else {
        console.error(
            "speak.js was not loaded."
        );

        return;
    }

    /*
     * speak.js doesn't document an onended
     * callback, so watch its generated audio.
     */

    const waitForAudio = setInterval(() => {
        const audio =
            document.querySelector("#audio audio");

        if (!audio) {
            return;
        }

        clearInterval(waitForAudio);

        audio.onended = () => {
            if (bubble.parentNode) {
                bubble.remove();
            }
        };
    }, 50);

    /*
     * Safety cleanup in case audio fails.
     */

    setTimeout(() => {
        clearInterval(waitForAudio);

        if (
            bubble.parentNode &&
            (!document.querySelector("#audio audio") ||
             document.querySelector("#audio audio").ended)
        ) {
            bubble.remove();
        }
    }, Math.max(10000, text.length * 200));
}
