const socket = io();

const loginScreen = document.getElementById("loginScreen");
const desktop = document.getElementById("desktop");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

const submitButton = document.getElementById("submitButton");

const world = document.getElementById("world");

const messageInput = document.getElementById("messageInput");
const startButton = document.getElementById("startButton");

let myId = null;
let myName = null;
let myRoom = null;

const players = {};


/*
    LOGIN
*/

submitButton.addEventListener("click", join);

nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        join();
    }
});

roomInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        join();
    }
});

function join() {
    const name = nameInput.value.trim();

    let room = roomInput.value.trim();

    if (!name) {
        nameInput.focus();
        return;
    }

    if (!room) {
        room = "default";
        roomInput.value = "default";
    }

    socket.emit("joinRoom", {
        name,
        room
    });
}


/*
    SUCCESSFULLY JOINED
*/

socket.on("joined", (data) => {
    myId = data.id;
    myName = data.name;
    myRoom = data.room;

    loginScreen.style.display = "none";
    desktop.style.display = "block";

    createPlayer(
        myId,
        myName,
        true
    );

    messageInput.focus();
});


/*
    NEW PLAYER
*/

socket.on("playerJoined", (data) => {
    if (data.id === myId) {
        return;
    }

    createPlayer(
        data.id,
        data.name,
        false
    );
});


/*
    PLAYER LEFT
*/

socket.on("playerLeft", (data) => {
    const player = players[data.id];

    if (!player) {
        return;
    }

    player.element.remove();

    delete players[data.id];
});


/*
    CREATE PLAYER
*/

function createPlayer(id, name, isMe) {
    if (players[id]) {
        return;
    }

    const element = document.createElement("div");

    element.className = "player";

    const nameElement = document.createElement("div");

    nameElement.className = "playerName";

    nameElement.textContent = name;

    element.appendChild(nameElement);

    /*
        Put players at different starting positions.
        The server does not currently synchronize movement,
        so these are just placeholders.
    */

    let x;
    let y;

    if (isMe) {
        x = world.clientWidth / 2;
        y = world.clientHeight / 2;
    } else {
        const count = Object.keys(players).length;

        x = 100 + ((count * 100) % Math.max(200, world.clientWidth - 100));

        y = 100 + ((count * 70) % Math.max(150, world.clientHeight - 100));
    }

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    world.appendChild(element);

    players[id] = {
        element,
        name,
        x,
        y,
        isMe
    };
}


/*
    SEND MESSAGE
*/

startButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    socket.emit("message", text);

    messageInput.value = "";

    messageInput.focus();
}


/*
    RECEIVE MESSAGE
*/

socket.on("message", (data) => {
    const player = players[data.id];

    if (!player) {
        return;
    }

    showSpeechBubble(
        player,
        data.text
    );
});


/*
    SPEECH BUBBLE
*/

function showSpeechBubble(player, text) {
    // Remove an existing bubble
    const oldBubble = player.element.querySelector(".speechBubble");

    if (oldBubble) {
        oldBubble.remove();
    }

    const bubble = document.createElement("div");

    bubble.className = "speechBubble";

    bubble.textContent = text;

    player.element.appendChild(bubble);

    /*
        Keep the bubble visible for 5 seconds.
    */

    setTimeout(() => {
        if (bubble.parentNode) {
            bubble.remove();
        }
    }, 5000);
}
