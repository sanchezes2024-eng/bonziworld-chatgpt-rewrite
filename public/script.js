/* ============================================================
   CHAT CLIENT
   IE7+ compatible JavaScript
   ============================================================ */

var myId = null;
var myName = "";
var currentRoom = "default";

var players = {};
var draggingPlayer = null;
var dragging = false;

var pollTimer = null;
var pollInProgress = false;

var world;
var loginScreen;
var desktop;
var nameInput;
var roomInput;
var submitButton;
var messageInput;
var startButton;
var settingsButton;
var settingsPanel;
var settingsClose;


/* ============================================================
   DOM HELPERS
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}

function addEvent(element, eventName, handler) {
    if (!element) {
        return;
    }

    if (element.addEventListener) {
        element.addEventListener(eventName, handler, false);
    } else if (element.attachEvent) {
        element.attachEvent("on" + eventName, handler);
    } else {
        element["on" + eventName] = handler;
    }
}

function preventDefault(event) {
    event = event || window.event;

    if (event.preventDefault) {
        event.preventDefault();
    } else {
        event.returnValue = false;
    }
}

function stopEvent(event) {
    event = event || window.event;

    if (event.stopPropagation) {
        event.stopPropagation();
    } else {
        event.cancelBubble = true;
    }
}


/* ============================================================
   JSON
   ============================================================ */

function parseJSON(text) {
    if (window.JSON && JSON.parse) {
        return JSON.parse(text);
    }

    return eval("(" + text + ")");
}


/* ============================================================
   XHR
   ============================================================ */

function createXHR() {
    if (window.XMLHttpRequest) {
        return new XMLHttpRequest();
    }

    try {
        return new ActiveXObject("Microsoft.XMLHTTP");
    } catch (e1) {
        try {
            return new ActiveXObject("Msxml2.XMLHTTP");
        } catch (e2) {
            return null;
        }
    }
}


/* ============================================================
   FORM ENCODING
   ============================================================ */

function encodeValue(value) {
    value = String(value);

    return encodeURIComponent(value);
}

function encodeForm(data) {
    var parts = [];
    var key;

    for (key in data) {
        if (data.hasOwnProperty) {
            if (!data.hasOwnProperty(key)) {
                continue;
            }
        }

        parts.push(
            encodeURIComponent(key) +
            "=" +
            encodeValue(data[key])
        );
    }

    return parts.join("&");
}


/* ============================================================
   AJAX
   ============================================================ */

function ajax(method, url, data, callback) {
    var xhr = createXHR();

    if (!xhr) {
        return;
    }

    xhr.open(method, url, true);

    if (method === "POST") {
        xhr.setRequestHeader(
            "Content-Type",
            "application/x-www-form-urlencoded"
        );
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return;
        }

        callback(
            xhr.status,
            xhr.responseText
        );
    };

    if (method === "POST") {
        xhr.send(
            data ? encodeForm(data) : ""
        );
    } else {
        xhr.send(null);
    }
}


/* ============================================================
   JOIN
   ============================================================ */

function joinRoom() {
    var name = nameInput.value;
    var room = roomInput.value;

    if (!name) {
        name = "Anonymous";
    }

    if (!room) {
        room = "default";
    }

    myName = name;
    currentRoom = room;

    submitButton.disabled = true;

    ajax(
        "POST",
        "/api/join",
        {
            name: name,
            room: room
        },
        function (status, response) {
            submitButton.disabled = false;

            if (status !== 200) {
                alert("Could not connect to the server.");
                return;
            }

            var data;

            try {
                data = parseJSON(response);
            } catch (e) {
                alert("The server returned invalid data.");
                return;
            }

            myId = data.id;

            loginScreen.style.display = "none";
            desktop.style.display = "block";

            if (data.player) {
                createPlayer(data.player);
            }

            if (data.events) {
                handleEvents(data.events);
            }

            startPolling();
        }
    );
}


/* ============================================================
   POLLING
   ============================================================ */

function startPolling() {
    if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
    }

    poll();
}

function poll() {
    var xhr;

    if (!myId || pollInProgress) {
        return;
    }

    pollInProgress = true;

    xhr = createXHR();

    if (!xhr) {
        pollInProgress = false;
        return;
    }

    xhr.open(
        "GET",
        "/api/poll?id=" +
        encodeURIComponent(myId) +
        "&t=" +
        new Date().getTime(),
        true
    );

    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return;
        }

        pollInProgress = false;

        if (xhr.status === 200) {
            try {
                var data = parseJSON(xhr.responseText);

                if (data.events) {
                    handleEvents(data.events);
                }
            } catch (e) {
            }
        }

        pollTimer = window.setTimeout(
            poll,
            10
        );
    };

    xhr.send(null);
}


/* ============================================================
   EVENTS
   ============================================================ */

function handleEvents(events) {
    var i;

    for (i = 0; i < events.length; i++) {
        handleEvent(events[i]);
    }
}

function handleEvent(event) {
    if (!event || !event.type) {
        return;
    }

    switch (event.type) {

        case "playerJoined":
            createPlayer(event.player);
            break;

        case "playerMoved":
            movePlayerFromServer(event);
            break;

        case "playerColorChanged":
            if (players[event.playerId]) {
                players[event.playerId].color =
                    event.color;

                updatePlayerColor(
                    players[event.playerId]
                );
            }
            break;

        case "playerCharacterChanged":
            if (players[event.playerId]) {
                changePlayerCharacter(
                    players[event.playerId],
                    event.character
                );
            }
            break;

        case "playerLeft":
            removePlayer(event.playerId);
            break;

        case "message":
            showMessage(
                event.playerId,
                event.name,
                event.text
            );
            break;

        case "systemMessage":
            showSystemMessage(event.text);
            break;
    }
}


/* ============================================================
   PLAYER CREATION
   ============================================================ */

function createPlayer(data) {
    var existing;
    var player;
    var name;

    if (!data || !data.id) {
        return;
    }

    existing = players[data.id];

    if (existing) {
        return existing;
    }

    player = {
        id: data.id,
        name: data.name || "Anonymous",
        room: data.room || currentRoom,
        x: data.x || 50,
        y: data.y || 50,
        color: data.color || "#800080",
        character: data.character || "bonzi",
        element: null,
        nameElement: null,
        imageElement: null,
        bubbleElement: null
    };

    players[player.id] = player;

    player.element =
        document.createElement("div");

    player.element.className =
        "player";

    if (player.character === "bonzi") {
        player.element.className +=
            " bonziPlayer";
    } else {
        player.element.className +=
            " squareCharacter";
    }

    name =
        document.createElement("div");

    name.className =
        "playerName";

    name.innerHTML =
        escapeHTML(player.name);

    player.nameElement = name;

    player.element.appendChild(name);

    if (player.character === "bonzi") {
        player.imageElement =
            document.createElement("img");

        player.imageElement.className =
            "bonziCharacter";

        player.imageElement.src =
            "/bonzi.png";

        player.imageElement.alt =
            "";

        player.element.appendChild(
            player.imageElement
        );
    }

    world.appendChild(
        player.element
    );

    updatePlayerPosition(player);
    updatePlayerColor(player);
    setupDragging(player);

    return player;
}


/* ============================================================
   HTML ESCAPING
   ============================================================ */

function escapeHTML(text) {
    var div;

    text = String(text);

    if (document.createElement) {
        div = document.createElement("div");
        div.appendChild(
            document.createTextNode(text)
        );

        return div.innerHTML;
    }

    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


/* ============================================================
   PLAYER POSITION
   ============================================================ */

function updatePlayerPosition(player) {
    if (!player || !player.element) {
        return;
    }

    player.element.style.left =
        player.x + "%";

    player.element.style.top =
        player.y + "%";
}

function movePlayerFromServer(event) {
    var player;

    if (!event) {
        return;
    }

    player = players[event.playerId];

    if (!player) {
        return;
    }

    player.x = event.x;
    player.y = event.y;

    updatePlayerPosition(player);
}


/* ============================================================
   DRAGGING
   ============================================================ */

function setupDragging(player) {
    if (!player || !player.element) {
        return;
    }

    addEvent(
        player.element,
        "mousedown",
        function (event) {
            beginDrag(
                player,
                event
            );
        }
    );

    addEvent(
        player.element,
        "touchstart",
        function (event) {
            beginDrag(
                player,
                event
            );
        }
    );
}

function getPointerPosition(event) {
    var touch;

    event = event || window.event;

    if (
        event.touches &&
        event.touches.length
    ) {
        touch = event.touches[0];

        return {
            x: touch.clientX,
            y: touch.clientY
        };
    }

    if (
        event.changedTouches &&
        event.changedTouches.length
    ) {
        touch = event.changedTouches[0];

        return {
            x: touch.clientX,
            y: touch.clientY
        };
    }

    return {
        x: event.clientX,
        y: event.clientY
    };
}

function beginDrag(player, event) {
    var pointer;

    if (!player) {
        return;
    }

    event = event || window.event;

    pointer =
        getPointerPosition(event);

    draggingPlayer = player;
    dragging = true;

    draggingPlayer.dragOffsetX =
        pointer.x;

    draggingPlayer.dragOffsetY =
        pointer.y;

    if (
        player.element.setCapture
    ) {
        try {
            player.element.setCapture();
        } catch (e) {
        }
    }

    preventDefault(event);
    stopEvent(event);
}

function dragMove(event) {
    var rect;
    var pointer;
    var x;
    var y;

    if (!dragging || !draggingPlayer) {
        return;
    }

    event = event || window.event;

    pointer =
        getPointerPosition(event);

    rect =
        world.getBoundingClientRect();

    if (!rect.width) {
        return;
    }

    x =
        ((pointer.x - rect.left) /
        rect.width) * 100;

    y =
        ((pointer.y - rect.top) /
        rect.height) * 100;

    if (x < 2) {
        x = 2;
    }

    if (x > 98) {
        x = 98;
    }

    if (y < 2) {
        y = 2;
    }

    if (y > 98) {
        y = 98;
    }

    draggingPlayer.x = x;
    draggingPlayer.y = y;

    updatePlayerPosition(
        draggingPlayer
    );

    preventDefault(event);
}

function endDrag(event) {
    if (!dragging || !draggingPlayer) {
        return;
    }

    event = event || window.event;

    sendPlayerMove(
        draggingPlayer
    );

    if (
        draggingPlayer.element.releaseCapture
    ) {
        try {
            draggingPlayer.element.releaseCapture();
        } catch (e) {
        }
    }

    dragging = false;
    draggingPlayer = null;

    preventDefault(event);
}

function sendPlayerMove(player) {
    if (!player || !myId) {
        return;
    }

    ajax(
        "POST",
        "/api/move",
        {
            senderId: myId,
            playerId: player.id,
            x: player.x,
            y: player.y
        },
        function () {
        }
    );
}


/* ============================================================
   COLOR
   ============================================================ */

function getHue(color) {
    var hues = {
        red: 0,
        orange: 30,
        yellow: 60,
        green: 120,
        cyan: 180,
        blue: 240,
        purple: 270,
        magenta: 300,
        pink: 330
    };

    var r;
    var g;
    var b;
    var max;
    var min;
    var h;
    var delta;

    color = String(color).toLowerCase();

    if (hues[color] !== undefined) {
        return hues[color];
    }

    if (
        color.charAt(0) === "#" &&
        color.length === 7
    ) {
        r = parseInt(
            color.substr(1, 2),
            16
        );

        g = parseInt(
            color.substr(3, 2),
            16
        );

        b = parseInt(
            color.substr(5, 2),
            16
        );

        max = Math.max(r, g, b);
        min = Math.min(r, g, b);
        delta = max - min;

        if (delta === 0) {
            return 0;
        }

        if (max === r) {
            h =
                60 *
                (((g - b) / delta) % 6);
        } else if (max === g) {
            h =
                60 *
                (((b - r) / delta) + 2);
        } else {
            h =
                60 *
                (((r - g) / delta) + 4);
        }

        if (h < 0) {
            h += 360;
        }

        return h;
    }

    return 270;
}

function updatePlayerColor(player) {
    var hue;
    var filter;

    if (!player || !player.element) {
        return;
    }

    if (
        player.character === "square"
    ) {
        player.element.style.backgroundColor =
            player.color;

        return;
    }

    if (
        player.character !== "bonzi" ||
        !player.imageElement
    ) {
        return;
    }

    hue = getHue(player.color);

    /*
     * Original Bonzi image is purple,
     * approximately 270 degrees.
     */
    filter =
        "hue-rotate(" +
        (hue - 270) +
        "deg)";

    /*
     * Modern browsers.
     */
    player.imageElement.style.filter =
        filter;

    /*
     * Older IE.
     */
    player.imageElement.style.msFilter =
        filter;

    /*
     * CSS custom property for the
     * stylesheet.
     */
    try {
        player.imageElement.style.setProperty(
            "--bonzi-hue",
            (hue - 270) + "deg"
        );
    } catch (e) {
    }
}


/* ============================================================
   CHARACTER
   ============================================================ */

function changePlayerCharacter(
    player,
    character
) {
    var oldElement;
    var nameElement;
    var image;

    if (!player) {
        return;
    }

    character =
        character === "square"
            ? "square"
            : "bonzi";

    player.character =
        character;

    oldElement =
        player.element;

    nameElement =
        player.nameElement;

    player.element =
        document.createElement("div");

    player.element.className =
        "player";

    if (character === "bonzi") {
        player.element.className +=
            " bonziPlayer";

        image =
            document.createElement("img");

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt =
            "";

        player.imageElement =
            image;

        player.element.appendChild(
            nameElement
        );

        player.element.appendChild(
            image
        );
    } else {
        player.element.className +=
            " squareCharacter";

        player.imageElement =
            null;

        player.element.appendChild(
            nameElement
        );
    }

    world.replaceChild(
        player.element,
        oldElement
    );

    updatePlayerPosition(player);
    updatePlayerColor(player);
    setupDragging(player);
}


/* ============================================================
   REMOVE PLAYER
   ============================================================ */

function removePlayer(id) {
    var player;

    player = players[id];

    if (!player) {
        return;
    }

    if (player.element) {
        if (player.element.parentNode) {
            player.element.parentNode.removeChild(
                player.element
            );
        }
    }

    delete players[id];
}


/* ============================================================
   SPEECH BUBBLE
   ============================================================ */

function showMessage(
    playerId,
    name,
    text
) {
    var player;

    player =
        players[playerId];

    if (!player) {
        return;
    }

    showSpeechBubble(
        player,
        text
    );

    speakText(text);
}

function showSpeechBubble(
    player,
    text
) {
    var bubble;

    if (!player || !player.element) {
        return;
    }

    if (player.bubbleElement) {
        if (
            player.bubbleElement.parentNode
        ) {
            player.bubbleElement.parentNode
                .removeChild(
                    player.bubbleElement
                );
        }
    }

    bubble =
        document.createElement("div");

    bubble.className =
        "speechBubble";

    bubble.innerHTML =
        escapeHTML(text);

    player.element.appendChild(
        bubble
    );

    player.bubbleElement =
        bubble;

    window.setTimeout(
        function () {
            if (
                player.bubbleElement ===
                bubble
            ) {
                if (bubble.parentNode) {
                    bubble.parentNode
                        .removeChild(
                            bubble
                        );
                }

                player.bubbleElement =
                    null;
            }
        },
        5000
    );
}


/* ============================================================
   SPEAK.JS TTS
   ============================================================ */

/*
 * speakClient.js creates the global speak() function.
 *
 * speak.js then:
 *
 * speakClient.js
 *      |
 *      v
 * speakWorker.js
 *      |
 *      v
 * speakGenerator.js
 *      |
 *      v
 * WAV
 *      |
 *      v
 * #audio
 *
 * We only call speak().
 */

function speakText(text) {
    var options;

    if (!text) {
        return;
    }

    /*
     * Commands should never be spoken.
     * The server normally doesn't broadcast
     * commands as normal messages anyway.
     */
    if (
        text.charAt(0) === "/"
    ) {
        return;
    }

    /*
     * speakClient.js from the original
     * speak.js project exposes speak().
     */
    if (
        typeof window.speak !==
        "function"
    ) {
        return;
    }

    options = {
        amplitude: 100,
        pitch: 50,
        speed: 175,
        wordgap: 0
    };

    try {
        window.speak(
            String(text),
            options
        );
    } catch (e) {
        /*
         * If the worker cannot be started,
         * don't break the chat application.
         */
    }
}


/* ============================================================
   SYSTEM MESSAGE
   ============================================================ */

function showSystemMessage(text) {
    var bubble;

    bubble =
        document.createElement("div");

    bubble.style.position =
        "fixed";

    bubble.style.left =
        "50%";

    bubble.style.top =
        "10px";

    bubble.style.padding =
        "6px 10px";

    bubble.style.background =
        "#ffffcc";

    bubble.style.border =
        "1px solid #000000";

    bubble.style.zIndex =
        "1000";

    bubble.style.fontFamily =
        "Tahoma, Arial, sans-serif";

    bubble.style.fontSize =
        "12px";

    bubble.innerHTML =
        escapeHTML(text);

    desktop.appendChild(
        bubble
    );

    window.setTimeout(
        function () {
            if (bubble.parentNode) {
                bubble.parentNode
                    .removeChild(
                        bubble
                    );
            }
        },
        3000
    );
}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

function sendMessage() {
    var text;

    text =
        messageInput.value;

    if (!text) {
        return;
    }

    messageInput.value =
        "";

    ajax(
        "POST",
        "/api/send",
        {
            id: myId,
            text: text
        },
        function () {
        }
    );
}


/* ============================================================
   SETTINGS
   ============================================================ */

function openSettings() {
    if (!settingsPanel) {
        return;
    }

    settingsPanel.style.display =
        "block";
}

function closeSettings() {
    if (!settingsPanel) {
        return;
    }

    settingsPanel.style.display =
        "none";
}


/* ============================================================
   GLOBAL DRAG EVENTS
   ============================================================ */

function setupGlobalDragging() {
    addEvent(
        document,
        "mousemove",
        dragMove
    );

    addEvent(
        document,
        "mouseup",
        endDrag
    );

    addEvent(
        document,
        "touchmove",
        dragMove
    );

    addEvent(
        document,
        "touchend",
        endDrag
    );

    addEvent(
        document,
        "touchcancel",
        endDrag
    );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

function initialize() {
    world =
        $("world");

    loginScreen =
        $("loginScreen");

    desktop =
        $("desktop");

    nameInput =
        $("nameInput");

    roomInput =
        $("roomInput");

    submitButton =
        $("submitButton");

    messageInput =
        $("messageInput");

    startButton =
        $("startButton");

    settingsButton =
        $("settingsButton");

    settingsPanel =
        $("settingsPanel");

    settingsClose =
        $("settingsClose");

    addEvent(
        submitButton,
        "click",
        function (event) {
            preventDefault(event);
            joinRoom();
        }
    );

    addEvent(
        nameInput,
        "keypress",
        function (event) {
            event =
                event || window.event;

            if (event.keyCode === 13) {
                joinRoom();
            }
        }
    );

    addEvent(
        roomInput,
        "keypress",
        function (event) {
            event =
                event || window.event;

            if (event.keyCode === 13) {
                joinRoom();
            }
        }
    );

    addEvent(
        startButton,
        "click",
        function (event) {
            preventDefault(event);
            sendMessage();
        }
    );

    addEvent(
        messageInput,
        "keypress",
        function (event) {
            event =
                event || window.event;

            if (event.keyCode === 13) {
                sendMessage();
            }
        }
    );

    addEvent(
        settingsButton,
        "click",
        function (event) {
            preventDefault(event);
            openSettings();
        }
    );

    addEvent(
        settingsClose,
        "click",
        function (event) {
            preventDefault(event);
            closeSettings();
        }
    );

    setupGlobalDragging();
}


/* ============================================================
   LEAVE
   ============================================================ */

function leaveChat() {
    if (!myId) {
        return;
    }

    try {
        ajax(
            "POST",
            "/api/leave",
            {
                id: myId
            },
            function () {
            }
        );
    } catch (e) {
    }
}


/* ============================================================
   START
   ============================================================ */

addEvent(
    window,
    "load",
    initialize
);

addEvent(
    window,
    "beforeunload",
    leaveChat
);
