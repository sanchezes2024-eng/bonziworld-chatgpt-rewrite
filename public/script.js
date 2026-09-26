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


/*
============================================================
DOM
============================================================
*/

function $(id) {
    return document.getElementById(id);
}

function addEvent(element, eventName, handler) {
    if (!element) {
        return;
    }

    if (element.addEventListener) {
        element.addEventListener(
            eventName,
            handler,
            false
        );
    } else if (element.attachEvent) {
        element.attachEvent(
            "on" + eventName,
            handler
        );
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


/*
============================================================
JSON
============================================================
*/

function parseJSON(text) {
    if (
        window.JSON &&
        typeof JSON.parse === "function"
    ) {
        return JSON.parse(text);
    }

    return eval("(" + text + ")");
}


/*
============================================================
XHR
============================================================
*/

function createXHR() {
    if (window.XMLHttpRequest) {
        return new XMLHttpRequest();
    }

    try {
        return new ActiveXObject(
            "Microsoft.XMLHTTP"
        );
    } catch (e1) {
        try {
            return new ActiveXObject(
                "Msxml2.XMLHTTP"
            );
        } catch (e2) {
            return null;
        }
    }
}


/*
============================================================
FORM ENCODING
============================================================
*/

function encodeForm(data) {
    var parts = [];
    var key;

    for (key in data) {
        if (
            Object.prototype.hasOwnProperty.call(
                data,
                key
            )
        ) {
            parts.push(
                encodeURIComponent(key) +
                "=" +
                encodeURIComponent(
                    String(data[key])
                )
            );
        }
    }

    return parts.join("&");
}


/*
============================================================
AJAX
============================================================
*/

function ajax(method, url, data, callback) {
    var xhr = createXHR();

    if (!xhr) {
        if (callback) {
            callback(
                0,
                ""
            );
        }

        return;
    }

    xhr.open(
        method,
        url,
        true
    );

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

        if (callback) {
            callback(
                xhr.status,
                xhr.responseText
            );
        }
    };

    try {
        if (method === "POST") {
            xhr.send(
                data ?
                    encodeForm(data) :
                    ""
            );
        } else {
            xhr.send(null);
        }
    } catch (e) {
        if (callback) {
            callback(
                0,
                ""
            );
        }
    }
}


/*
============================================================
JOIN
============================================================
*/

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
                alert(
                    "Could not connect to the server."
                );

                return;
            }

            var data;

            try {
                data = parseJSON(response);
            } catch (e) {
                alert(
                    "The server returned invalid data."
                );

                return;
            }

            if (!data.id) {
                alert(
                    "The server did not give us a player ID."
                );

                return;
            }

            myId = data.id;

            loginScreen.style.display =
                "none";

            desktop.style.display =
                "block";

            if (data.player) {
                createPlayer(
                    data.player
                );
            }

            if (data.events) {
                handleEvents(
                    data.events
                );
            }

            startPolling();
        }
    );
}


/*
============================================================
POLLING
============================================================
*/

function startPolling() {
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }

    poll();
}

function poll() {
    var xhr;

    if (
        !myId ||
        pollInProgress
    ) {
        return;
    }

    pollInProgress = true;

    xhr = createXHR();

    if (!xhr) {
        pollInProgress = false;

        pollTimer = setTimeout(
            poll,
            1000
        );

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
                var data =
                    parseJSON(
                        xhr.responseText
                    );

                if (data.events) {
                    handleEvents(
                        data.events
                    );
                }
            } catch (e) {
            }
        }

        pollTimer = setTimeout(
            poll,
            10
        );
    };

    try {
        xhr.send(null);
    } catch (e) {
        pollInProgress = false;

        pollTimer = setTimeout(
            poll,
            1000
        );
    }
}


/*
============================================================
EVENTS
============================================================
*/

function handleEvents(events) {
    var i;

    for (
        i = 0;
        i < events.length;
        i++
    ) {
        handleEvent(
            events[i]
        );
    }
}

function handleEvent(event) {
    if (
        !event ||
        !event.type
    ) {
        return;
    }

    switch (event.type) {

        case "playerJoined":
            if (event.player) {
                createPlayer(
                    event.player
                );
            }
            break;

        case "playerMoved":
            movePlayerFromServer(
                event
            );
            break;

        case "playerColorChanged":
            if (
                players[event.playerId]
            ) {
                players[event.playerId].color =
                    event.color;

                updatePlayerColor(
                    players[event.playerId]
                );
            }
            break;

        case "playerCharacterChanged":
            if (
                players[event.playerId]
            ) {
                changePlayerCharacter(
                    players[event.playerId],
                    event.character
                );
            }
            break;

        case "playerLeft":
            removePlayer(
                event.playerId
            );
            break;

        case "message":
            showMessage(
                event.playerId,
                event.name,
                event.text
            );
            break;

        case "systemMessage":
            showSystemMessage(
                event.text
            );
            break;
    }
}


/*
============================================================
PLAYER CREATION
============================================================
*/

function createPlayer(data) {
    var player;
    var nameElement;
    var image;

    if (
        !data ||
        !data.id
    ) {
        return null;
    }

    if (
        players[data.id]
    ) {
        return players[data.id];
    }

    player = {
        id: data.id,
        name: data.name || "Anonymous",
        room: data.room || currentRoom,
        x: Number(data.x) || 50,
        y: Number(data.y) || 50,
        color: data.color || "#8800ff",
        character:
            data.character === "square"
                ? "square"
                : "bonzi",
        element: null,
        nameElement: null,
        imageElement: null,
        bubbleElement: null
    };

    players[player.id] =
        player;

    player.element =
        document.createElement(
            "div"
        );

    player.element.className =
        "player";

    if (
        player.character === "bonzi"
    ) {
        player.element.className +=
            " bonziPlayer";
    } else {
        player.element.className +=
            " squareCharacter";
    }

    nameElement =
        document.createElement(
            "div"
        );

    nameElement.className =
        "playerName";

    nameElement.innerHTML =
        escapeHTML(
            player.name
        );

    player.nameElement =
        nameElement;

    player.element.appendChild(
        nameElement
    );

    if (
        player.character === "bonzi"
    ) {
        image =
            document.createElement(
                "img"
            );

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt =
            "";

        player.imageElement =
            image;

        player.element.appendChild(
            image
        );
    }

    world.appendChild(
        player.element
    );

    updatePlayerPosition(
        player
    );

    updatePlayerColor(
        player
    );

    setupDragging(
        player
    );

    return player;
}


/*
============================================================
ESCAPE HTML
============================================================
*/

function escapeHTML(text) {
    var div;

    text = String(text);

    div =
        document.createElement(
            "div"
        );

    div.appendChild(
        document.createTextNode(
            text
        )
    );

    return div.innerHTML;
}


/*
============================================================
POSITION
============================================================
*/

function updatePlayerPosition(player) {
    if (
        !player ||
        !player.element
    ) {
        return;
    }

    player.element.style.left =
        player.x + "%";

    player.element.style.top =
        player.y + "%";
}

function movePlayerFromServer(event) {
    var player;

    player =
        players[event.playerId];

    if (!player) {
        return;
    }

    player.x =
        Number(event.x);

    player.y =
        Number(event.y);

    updatePlayerPosition(
        player
    );
}


/*
============================================================
DRAGGING
============================================================
*/

function setupDragging(player) {
    if (
        !player ||
        !player.element
    ) {
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

    event =
        event ||
        window.event;

    if (
        event.touches &&
        event.touches.length
    ) {
        touch =
            event.touches[0];

        return {
            x: touch.clientX,
            y: touch.clientY
        };
    }

    if (
        event.changedTouches &&
        event.changedTouches.length
    ) {
        touch =
            event.changedTouches[0];

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

function beginDrag(
    player,
    event
) {
    if (!player) {
        return;
    }

    event =
        event ||
        window.event;

    draggingPlayer =
        player;

    dragging =
        true;

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

    if (
        !dragging ||
        !draggingPlayer
    ) {
        return;
    }

    event =
        event ||
        window.event;

    pointer =
        getPointerPosition(
            event
        );

    rect =
        world.getBoundingClientRect();

    if (
        !rect ||
        !rect.width ||
        !rect.height
    ) {
        return;
    }

    x =
        ((pointer.x - rect.left) /
        rect.width) *
        100;

    y =
        ((pointer.y - rect.top) /
        rect.height) *
        100;

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

    draggingPlayer.x =
        x;

    draggingPlayer.y =
        y;

    updatePlayerPosition(
        draggingPlayer
    );

    /*
     * Send continuously so everyone
     * sees the player moving.
     */
    sendPlayerMove(
        draggingPlayer
    );

    preventDefault(event);
}

function endDrag(event) {
    if (
        !dragging ||
        !draggingPlayer
    ) {
        return;
    }

    event =
        event ||
        window.event;

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

    dragging =
        false;

    draggingPlayer =
        null;

    preventDefault(event);
}

function sendPlayerMove(player) {
    if (
        !player ||
        !myId
    ) {
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


/*
============================================================
COLOR
============================================================
*/

function getHue(color) {
    var named = {
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
    var delta;
    var h;

    color =
        String(color)
            .toLowerCase();

    if (
        named[color] !== undefined
    ) {
        return named[color];
    }

    if (
        color.charAt(0) === "#" &&
        color.length === 7
    ) {
        r =
            parseInt(
                color.substring(1, 3),
                16
            );

        g =
            parseInt(
                color.substring(3, 5),
                16
            );

        b =
            parseInt(
                color.substring(5, 7),
                16
            );

        max =
            Math.max(
                r,
                g,
                b
            );

        min =
            Math.min(
                r,
                g,
                b
            );

        delta =
            max - min;

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

    if (
        !player ||
        !player.element
    ) {
        return;
    }

    if (
        player.character ===
        "square"
    ) {
        player.element.style.backgroundColor =
            player.color;

        return;
    }

    if (
        !player.imageElement
    ) {
        return;
    }

    hue =
        getHue(
            player.color
        );

    filter =
        "hue-rotate(" +
        (hue - 270) +
        "deg)";

    player.imageElement.style.filter =
        filter;

    player.imageElement.style.msFilter =
        filter;

    try {
        player.imageElement.style.setProperty(
            "--bonzi-hue",
            (hue - 270) + "deg"
        );
    } catch (e) {
    }
}


/*
============================================================
CHARACTER
============================================================
*/

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
        document.createElement(
            "div"
        );

    player.element.className =
        "player";

    if (
        character === "bonzi"
    ) {
        player.element.className +=
            " bonziPlayer";

        image =
            document.createElement(
                "img"
            );

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

    updatePlayerPosition(
        player
    );

    updatePlayerColor(
        player
    );

    setupDragging(
        player
    );
}


/*
============================================================
REMOVE PLAYER
============================================================
*/

function removePlayer(id) {
    var player =
        players[id];

    if (!player) {
        return;
    }

    if (
        player.element &&
        player.element.parentNode
    ) {
        player.element.parentNode.removeChild(
            player.element
        );
    }

    delete players[id];
}


/*
============================================================
MESSAGES
============================================================
*/

function showMessage(
    playerId,
    name,
    text
) {
    var player =
        players[playerId];

    if (!player) {
        return;
    }

    showSpeechBubble(
        player,
        text
    );

    speakText(
        text
    );
}

function showSpeechBubble(
    player,
    text
) {
    var bubble;

    if (
        !player ||
        !player.element
    ) {
        return;
    }

    if (
        player.bubbleElement &&
        player.bubbleElement.parentNode
    ) {
        player.bubbleElement.parentNode.removeChild(
            player.bubbleElement
        );
    }

    bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "speechBubble";

    bubble.innerHTML =
        escapeHTML(
            text
        );

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
                if (
                    bubble.parentNode
                ) {
                    bubble.parentNode.removeChild(
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


/*
============================================================
SPEAK.JS
============================================================
*/

function speakText(text) {
    if (!text) {
        return;
    }

    text =
        String(text);

    if (
        text.charAt(0) === "/"
    ) {
        return;
    }

    /*
     * speakClient.js from speak.js
     * creates the global speak()
     * function.
     */
    if (
        typeof window.speak !==
        "function"
    ) {
        return;
    }

    try {
        window.speak(
            text,
            {
                amplitude: 100,
                pitch: 50,
                speed: 175,
                wordgap: 0
            }
        );
    } catch (e) {
        /*
         * TTS failure must not break chat.
         */
    }
}


/*
============================================================
SYSTEM MESSAGE
============================================================
*/

function showSystemMessage(text) {
    var bubble;

    bubble =
        document.createElement(
            "div"
        );

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
        escapeHTML(
            text
        );

    desktop.appendChild(
        bubble
    );

    setTimeout(
        function () {
            if (
                bubble.parentNode
            ) {
                bubble.parentNode.removeChild(
                    bubble
                );
            }
        },
        3000
    );
}


/*
============================================================
SEND MESSAGE
============================================================
*/

function sendMessage() {
    var text;

    if (!myId) {
        return;
    }

    text =
        messageInput.value;

    text =
        String(text)
            .replace(/^\s+|\s+$/g, "");

    if (!text) {
        return;
    }

    /*
     * Clear the input immediately.
     */
    messageInput.value = "";

    ajax(
        "POST",
        "/api/send",
        {
            id: myId,
            text: text
        },
        function (status, response) {
            if (status !== 200) {
                /*
                 * Put the message back if
                 * the server rejected it.
                 */
                messageInput.value =
                    text;

                showSystemMessage(
                    "Message failed to send (" +
                    status +
                    ")."
                );
            }
        }
    );
}


/*
============================================================
SETTINGS
============================================================
*/

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


/*
============================================================
GLOBAL DRAG EVENTS
============================================================
*/

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


/*
============================================================
INITIALIZATION
============================================================
*/

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


    /*
    --------------------------------------------------------
    LOGIN
    --------------------------------------------------------
    */

    addEvent(
        submitButton,
        "click",
        function (event) {
            preventDefault(event);
            joinRoom();

            return false;
        }
    );

    addEvent(
        nameInput,
        "keypress",
        function (event) {
            event =
                event ||
                window.event;

            if (
                event.keyCode === 13
            ) {
                preventDefault(event);
                joinRoom();

                return false;
            }
        }
    );

    addEvent(
        roomInput,
        "keypress",
        function (event) {
            event =
                event ||
                window.event;

            if (
                event.keyCode === 13
            ) {
                preventDefault(event);
                joinRoom();

                return false;
            }
        }
    );


    /*
    --------------------------------------------------------
    MESSAGE BUTTON
    --------------------------------------------------------
    */

    addEvent(
        startButton,
        "click",
        function (event) {
            preventDefault(event);
            sendMessage();

            return false;
        }
    );


    /*
    --------------------------------------------------------
    MESSAGE ENTER
    --------------------------------------------------------
    */

    addEvent(
        messageInput,
        "keypress",
        function (event) {
            event =
                event ||
                window.event;

            if (
                event.keyCode === 13
            ) {
                preventDefault(event);
                sendMessage();

                return false;
            }
        }
    );


    /*
    --------------------------------------------------------
    SETTINGS
    --------------------------------------------------------
    */

    addEvent(
        settingsButton,
        "click",
        function (event) {
            preventDefault(event);
            openSettings();

            return false;
        }
    );

    addEvent(
        settingsClose,
        "click",
        function (event) {
            preventDefault(event);
            closeSettings();

            return false;
        }
    );


    /*
    --------------------------------------------------------
    DRAGGING
    --------------------------------------------------------
    */

    setupGlobalDragging();
}


/*
============================================================
LEAVE
============================================================
*/

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


/*
============================================================
START
============================================================
*/

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
