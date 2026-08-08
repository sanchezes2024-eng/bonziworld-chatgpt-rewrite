const socket = io();

const loginScreen = document.getElementById("loginScreen");
const desktop = document.getElementById("desktop");
const world = document.getElementById("world");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const submitButton = document.getElementById("submitButton");

const messageInput = document.getElementById("messageInput");
const startButton = document.getElementById("startButton");

let myId = null;
let myName = null;
let myRoom = null;

const players = {};

let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;


/*
 * LOGIN
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
 * JOINED
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
        data.x,
        data.y,
        true
    );

    messageInput.focus();
});


/*
 * NEW PLAYER
 */

socket.on("playerJoined", (data) => {
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
});


/*
 * CREATE PLAYER
 */

function createPlayer(id, name, x, y, isMe) {
    if (players[id]) {
        return;
    }

    const element = document.createElement("div");

    element.className = "player";

    const nameElement = document.createElement("div");

    nameElement.className = "playerName";
    nameElement.textContent = name;

    element.appendChild(nameElement);

    world.appendChild(element);

    const player = {
        element,
        name,
        x: x ?? 50,
        y: y ?? 50,
        isMe
    };

    players[id] = player;

    updatePlayerPosition(player);

    if (isMe) {
        setupDragging(element);
    }
}


/*
 * UPDATE POSITION
 */

function updatePlayerPosition(player) {
    player.element.style.left = `${player.x}%`;
    player.element.style.top = `${player.y}%`;
}


/*
 * DRAGGING
 */

function setupDragging(element) {
    element.addEventListener("pointerdown", startDragging);

    element.addEventListener("dragstart", (event) => {
        event.preventDefault();
    });
}

function startDragging(event) {
    if (event.button !== 0) {
        return;
    }

    dragging = true;

    const player = players[myId];

    const rect = event.currentTarget.getBoundingClientRect();

    dragOffsetX = event.clientX - rect.left - rect.width / 2;
    dragOffsetY = event.clientY - rect.top - rect.height / 2;

    event.currentTarget.setPointerCapture(event.pointerId);

    event.currentTarget.style.cursor = "grabbing";

    event.preventDefault();
}

document.addEventListener("pointermove", (event) => {
    if (!dragging) {
        return;
    }

    const player = players[myId];

    if (!player) {
        return;
    }

    const worldRect = world.getBoundingClientRect();

    const playerX =
        event.clientX -
        worldRect.left -
        dragOffsetX;

    const playerY =
        event.clientY -
        worldRect.top -
        dragOffsetY;

    let x = (playerX / worldRect.width) * 100;
    let y = (playerY / worldRect.height) * 100;

    // Keep the square inside the desktop.
    x = Math.max(2.5, Math.min(97.5, x));
    y = Math.max(2.5, Math.min(97.5, y));

    player.x = x;
    player.y = y;

    updatePlayerPosition(player);

    /*
     * Tell the server.
     */

    socket.emit("move", {
        x,
        y
    });
});

document.addEventListener("pointerup", () => {
    if (!dragging) {
        return;
    }

    dragging = false;

    const player = players[myId];

    if (player) {
        player.element.style.cursor = "grab";
    }
});


/*
 * RECEIVE OTHER PLAYER MOVEMENT
 */

socket.on("playerMoved", (data) => {
    const player = players[data.id];

    if (!player) {
        return;
    }

    player.x = data.x;
    player.y = data.y;

    updatePlayerPosition(player);
});


/*
 * PLAYER LEFT
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
 * SEND MESSAGE
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
 * RECEIVE MESSAGE
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
 * SPEECH BUBBLE
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

    setTimeout(() => {
        if (bubble.parentNode) {
            bubble.remove();
        }
    }, 5000);
}
