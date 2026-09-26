var myId = null;
var myName = "";
var currentRoom = "";

var players = {};

var draggingPlayer = null;
var dragging = false;

var pollTimer = null;
var pollInProgress = false;

var loginScreen;
var desktop;
var nameInput;
var roomInput;
var submitButton;
var world;
var messageInput;
var startButton;
var settingsButton;
var settingsPanel;
var closeSettings;


/*
============================================================
DOM HELPERS
============================================================
*/

function $(id) {
    return document.getElementById(id);
}

function addEvent(element, name, handler) {
    if (!element) {
        return;
    }

    if (element.attachEvent) {
        element.attachEvent("on" + name, handler);
    } else if (element.addEventListener) {
        element.addEventListener(name, handler, false);
    }
}

function preventDefault(event) {
    event = event || window.event;

    if (event.preventDefault) {
        event.preventDefault();
    }

    event.returnValue = false;
}

function stopEvent(event) {
    event = event || window.event;

    if (event.stopPropagation) {
        event.stopPropagation();
    }

    event.cancelBubble = true;
}


/*
============================================================
JSON

IE7 does not have native JSON.parse().
============================================================
*/

function parseJSON(text) {
    if (window.JSON && typeof JSON.parse === "function") {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    try {
        return eval("(" + text + ")");
    } catch (e2) {
        return null;
    }
}


/*
============================================================
AJAX / HTTP POLLING
============================================================
*/

function createXHR() {
    var xhr = null;

    try {
        xhr = new XMLHttpRequest();
    } catch (e) {
        try {
            xhr = new ActiveXObject("Microsoft.XMLHTTP");
        } catch (e2) {
            try {
                xhr = new ActiveXObject("Msxml2.XMLHTTP");
            } catch (e3) {
                xhr = null;
            }
        }
    }

    return xhr;
}

function encodeForm(data) {
    var result = "";
    var key;

    if (!data) {
        return result;
    }

    for (key in data) {
        if (!data.hasOwnProperty(key)) {
            continue;
        }

        if (result !== "") {
            result += "&";
        }

        result += encodeURIComponent(key);
        result += "=";
        result += encodeURIComponent(data[key]);
    }

    return result;
}

function ajax(method, url, data, callback) {
    var xhr;
    var body;
    var finished = false;

    xhr = createXHR();

    if (!xhr) {
        if (callback) {
            callback(null);
        }

        return;
    }

    body = encodeForm(data);

    try {
        xhr.open(method, url, true);
    } catch (e) {
        if (callback) {
            callback(null);
        }

        return;
    }

    if (method === "POST") {
        try {
            xhr.setRequestHeader(
                "Content-Type",
                "application/x-www-form-urlencoded"
            );
        } catch (e2) {}
    }

    xhr.onreadystatechange = function () {
        var result;

        if (xhr.readyState !== 4) {
            return;
        }

        if (finished) {
            return;
        }

        finished = true;

        if (
            xhr.status >= 200 &&
            xhr.status < 300
        ) {
            result = parseJSON(xhr.responseText);

            if (callback) {
                callback(result);
            }
        } else {
            if (callback) {
                callback(null);
            }
        }
    };

    try {
        xhr.send(
            method === "POST"
                ? body
                : null
        );
    } catch (e3) {
        if (!finished) {
            finished = true;

            if (callback) {
                callback(null);
            }
        }
    }
}


/*
============================================================
LOGIN
============================================================
*/

function joinRoom() {
    var name;
    var room;

    name = nameInput.value;
    room = roomInput.value;

    name = trim(name);
    room = trim(room);

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
        function (result) {
            var i;

            submitButton.disabled = false;

            if (
                !result ||
                !result.id ||
                !result.player
            ) {
                alert(
                    "Could not connect to the chat server."
                );

                return;
            }

            myId = String(result.id);

            currentRoom =
                result.player.room;

            loginScreen.style.display =
                "none";

            desktop.style.display =
                "block";

            createPlayer(
                result.player
            );

            if (
                result.events &&
                result.events.length
            ) {
                for (
                    i = 0;
                    i < result.events.length;
                    i++
                ) {
                    handleEvent(
                        result.events[i]
                    );
                }
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
        window.clearTimeout(pollTimer);
        pollTimer = null;
    }

    poll();
}

function poll() {
    var requestUrl;

    if (!myId) {
        return;
    }

    if (pollInProgress) {
        return;
    }

    pollInProgress = true;

    requestUrl =
        "/api/poll?id=" +
        encodeURIComponent(myId) +
        "&t=" +
        new Date().getTime();

    ajax(
        "GET",
        requestUrl,
        null,
        function (result) {
            var i;

            pollInProgress = false;

            if (
                result &&
                result.events
            ) {
                for (
                    i = 0;
                    i < result.events.length;
                    i++
                ) {
                    handleEvent(
                        result.events[i]
                    );
                }
            }

            pollTimer =
                window.setTimeout(
                    poll,
                    10
                );
        }
    );
}


/*
============================================================
EVENT HANDLER
============================================================
*/

function handleEvent(event) {
    if (!event) {
        return;
    }

    if (
        event.event ===
        "playerJoined"
    ) {
        createPlayer(event.data);
        return;
    }

    if (
        event.event ===
        "playerMoved"
    ) {
        movePlayer(
            event.data.id,
            event.data.x,
            event.data.y
        );

        return;
    }

    if (
        event.event ===
        "playerColorChanged"
    ) {
        changePlayerColor(
            event.data.id,
            event.data.color
        );

        return;
    }

    if (
        event.event ===
        "playerCharacterChanged"
    ) {
        changePlayerCharacter(
            event.data.id,
            event.data.character
        );

        return;
    }

    if (
        event.event ===
        "playerLeft"
    ) {
        removePlayer(
            event.data.id
        );

        return;
    }

    if (
        event.event ===
        "message"
    ) {
        showMessage(
            event.data.id,
            event.data.text
        );

        return;
    }

    if (
        event.event ===
        "systemMessage"
    ) {
        showSystemMessage(
            event.data.text
        );
    }
}


/*
============================================================
PLAYER CREATION
============================================================
*/

function createPlayer(data) {
    var id;
    var player;
    var element;
    var nameElement;
    var characterElement;

    if (!data || !data.id) {
        return;
    }

    id = String(data.id);

    if (players[id]) {
        return;
    }

    player = {
        id: id,

        name:
            data.name ||
            "Anonymous",

        room:
            data.room ||
            currentRoom,

        x:
            parseFloat(data.x),

        y:
            parseFloat(data.y),

        color:
            data.color ||
            "#8800ff",

        character:
            data.character ||
            "bonzi",

        element: null,

        bubble: null,

        bubbleTimer: null
    };

    if (isNaN(player.x)) {
        player.x = 50;
    }

    if (isNaN(player.y)) {
        player.y = 50;
    }

    element =
        document.createElement("div");

    if (
        player.character ===
        "bonzi"
    ) {
        element.className =
            "player bonziPlayer";
    } else {
        element.className =
            "player squareCharacter";
    }

    nameElement =
        document.createElement("div");

    nameElement.className =
        "playerName";

    nameElement.appendChild(
        document.createTextNode(
            player.name
        )
    );

    element.appendChild(
        nameElement
    );

    if (
        player.character ===
        "bonzi"
    ) {
        characterElement =
            document.createElement("img");

        characterElement.className =
            "bonziCharacter";

        characterElement.src =
            "/bonzi.png";

        characterElement.alt = "";

        element.appendChild(
            characterElement
        );
    }

    player.element = element;

    players[id] = player;

    world.appendChild(element);

    updatePlayerPosition(player);

    updatePlayerColor(player);

    setupDragging(player);
}


/*
============================================================
PLAYER POSITION
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

function movePlayer(id, x, y) {
    var player;

    player =
        players[String(id)];

    if (!player) {
        return;
    }

    player.x = parseFloat(x);
    player.y = parseFloat(y);

    if (isNaN(player.x)) {
        player.x = 50;
    }

    if (isNaN(player.y)) {
        player.y = 50;
    }

    updatePlayerPosition(player);
}


/*
============================================================
DRAGGING

Everyone can drag everyone.

The server receives both:

senderId = the person doing the dragging

playerId = the character being dragged
============================================================
*/

function setupDragging(player) {
    var element;

    element = player.element;

    addEvent(
        element,
        "mousedown",
        function (event) {
            beginDrag(
                player,
                event
            );
        }
    );

    addEvent(
        element,
        "touchstart",
        function (event) {
            beginDrag(
                player,
                event
            );
        }
    );

    addEvent(
        element,
        "pointerdown",
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

function beginDrag(player, event) {
    if (!player) {
        return;
    }

    draggingPlayer = player;
    dragging = true;

    preventDefault(event);
    stopEvent(event);
}

function dragMove(event) {
    var pointer;
    var rect;
    var x;
    var y;

    if (
        !dragging ||
        !draggingPlayer
    ) {
        return;
    }

    pointer =
        getPointerPosition(event);

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
        (
            pointer.x -
            rect.left
        ) /
        rect.width *
        100;

    y =
        (
            pointer.y -
            rect.top
        ) /
        rect.height *
        100;

    x = Math.max(
        2,
        Math.min(
            98,
            x
        )
    );

    y = Math.max(
        2,
        Math.min(
            98,
            y
        )
    );

    draggingPlayer.x = x;
    draggingPlayer.y = y;

    updatePlayerPosition(
        draggingPlayer
    );

    if (myId) {
        ajax(
            "POST",
            "/api/move",
            {
                senderId:
                    myId,

                playerId:
                    draggingPlayer.id,

                x:
                    x,

                y:
                    y
            },
            null
        );
    }

    preventDefault(event);
}

function endDrag(event) {
    if (!dragging) {
        return;
    }

    dragging = false;
    draggingPlayer = null;

    preventDefault(event);
}


/*
============================================================
COLOR HANDLING
============================================================
*/

function changePlayerColor(
    id,
    color
) {
    var player;

    player =
        players[String(id)];

    if (!player) {
        return;
    }

    player.color = color;

    updatePlayerColor(player);
}

function colorToHue(color) {
    var r;
    var g;
    var b;
    var max;
    var min;
    var h;

    color =
        String(color)
            .toLowerCase();

    if (color === "red") {
        return 0;
    }

    if (color === "orange") {
        return 30;
    }

    if (color === "yellow") {
        return 60;
    }

    if (color === "green") {
        return 120;
    }

    if (color === "cyan") {
        return 180;
    }

    if (color === "blue") {
        return 240;
    }

    if (color === "purple") {
        return 270;
    }

    if (color === "magenta") {
        return 300;
    }

    if (color === "pink") {
        return 330;
    }

    if (
        color.charAt(0) !== "#" ||
        color.length !== 7
    ) {
        return 270;
    }

    r =
        parseInt(
            color.substring(1, 3),
            16
        ) / 255;

    g =
        parseInt(
            color.substring(3, 5),
            16
        ) / 255;

    b =
        parseInt(
            color.substring(5, 7),
            16
        ) / 255;

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

    if (max === min) {
        return 0;
    }

    if (max === r) {
        h =
            (
                (g - b) /
                (max - min)
            ) % 6;
    } else if (max === g) {
        h =
            (
                (b - r) /
                (max - min)
            ) + 2;
    } else {
        h =
            (
                (r - g) /
                (max - min)
            ) + 4;
    }

    h *= 60;

    if (h < 0) {
        h += 360;
    }

    return h;
}

function updatePlayerColor(player) {
    var hue;
    var shift;

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

    hue =
        colorToHue(
            player.color
        );

    shift =
        hue - 270;

    /*
     * CSS variable is used by the
     * stylesheet:
     *
     * filter:
     *     hue-rotate(
     *         var(--bonzi-hue, 0deg)
     *     );
     */

    try {
        player.element.style.setProperty(
            "--bonzi-hue",
            shift + "deg"
        );
    } catch (e) {
        /*
         * Older IE does not support
         * CSS custom properties.
         *
         * Fall back to directly
         * applying the filter.
         */

        try {
            player.element.style.filter =
                "hue-rotate(" +
                shift +
                "deg)";

            player.element.style.msFilter =
                "hue-rotate(" +
                shift +
                "deg)";
        } catch (e2) {}
    }
}


/*
============================================================
CHARACTER
============================================================
*/

function changePlayerCharacter(
    id,
    character
) {
    var player;
    var nameElement;
    var image;

    player =
        players[String(id)];

    if (!player) {
        return;
    }

    character =
        character === "square"
            ? "square"
            : "bonzi";

    player.character =
        character;

    while (
        player.element.firstChild
    ) {
        player.element.removeChild(
            player.element.firstChild
        );
    }

    if (
        character ===
        "bonzi"
    ) {
        player.element.className =
            "player bonziPlayer";

        nameElement =
            document.createElement(
                "div"
            );

        nameElement.className =
            "playerName";

        nameElement.appendChild(
            document.createTextNode(
                player.name
            )
        );

        player.element.appendChild(
            nameElement
        );

        image =
            document.createElement(
                "img"
            );

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt = "";

        player.element.appendChild(
            image
        );
    } else {
        player.element.className =
            "player squareCharacter";

        nameElement =
            document.createElement(
                "div"
            );

        nameElement.className =
            "playerName";

        nameElement.appendChild(
            document.createTextNode(
                player.name
            )
        );

        player.element.appendChild(
            nameElement
        );
    }

    updatePlayerPosition(player);
    updatePlayerColor(player);

    setupDragging(player);
}


/*
============================================================
REMOVE PLAYER
============================================================
*/

function removePlayer(id) {
    var player;

    player =
        players[String(id)];

    if (!player) {
        return;
    }

    if (player.bubbleTimer) {
        window.clearTimeout(
            player.bubbleTimer
        );

        player.bubbleTimer = null;
    }

    if (
        player.bubble &&
        player.bubble.parentNode
    ) {
        player.bubble.parentNode.removeChild(
            player.bubble
        );
    }

    if (
        player.element &&
        player.element.parentNode
    ) {
        player.element.parentNode.removeChild(
            player.element
        );
    }

    delete players[
        String(id)
    ];
}


/*
============================================================
MESSAGES
============================================================
*/

function showMessage(id, text) {
    var player;

    player =
        players[String(id)];

    if (!player) {
        return;
    }

    showSpeechBubble(
        player,
        text
    );

    /*
     * Don't speak commands.
     */

    if (
        String(text).charAt(0) ===
        "/"
    ) {
        return;
    }

    speakText(text);
}


/*
============================================================
SPEECH BUBBLE
============================================================
*/

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

    if (player.bubbleTimer) {
        window.clearTimeout(
            player.bubbleTimer
        );

        player.bubbleTimer = null;
    }

    if (
        player.bubble &&
        player.bubble.parentNode
    ) {
        player.bubble.parentNode.removeChild(
            player.bubble
        );
    }

    bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "speechBubble";

    bubble.appendChild(
        document.createTextNode(
            text
        )
    );

    player.element.appendChild(
        bubble
    );

    player.bubble =
        bubble;

    player.bubbleTimer =
        window.setTimeout(
            function () {
                if (
                    player.bubble ===
                    bubble
                ) {
                    if (
                        bubble.parentNode
                    ) {
                        bubble.parentNode.removeChild(
                            bubble
                        );
                    }

                    player.bubble =
                        null;
                }

                player.bubbleTimer =
                    null;
            },
            5000
        );
}


/*
============================================================
eSPEAK

Uses speakClient.js /
speakGenerator.js /
speakWorker.js.

No server-side TTS.
============================================================
*/

function speakText(text) {
    var safeText;

    safeText =
        String(text);

    if (!safeText) {
        return;
    }

    /*
     * Standard speakClient.js API.
     */

    if (
        typeof window.speak ===
        "function"
    ) {
        try {
            window.speak(
                safeText
            );
        } catch (e) {
            if (window.console) {
                try {
                    window.console.log(
                        "eSpeak error:",
                        e
                    );
                } catch (e2) {}
            }
        }

        return;
    }

    /*
     * Alternate generator API.
     */

    if (
        typeof window.speakGenerator ===
        "function"
    ) {
        try {
            window.speakGenerator(
                safeText
            );
        } catch (e3) {}
    }
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
        trim(
            messageInput.value
        );

    if (!text) {
        return;
    }

    messageInput.value =
        "";

    ajax(
        "POST",
        "/api/send",
        {
            id:
                myId,

            message:
                text
        },
        null
    );
}


/*
============================================================
SYSTEM MESSAGE
============================================================
*/

function showSystemMessage(text) {
    if (window.console) {
        try {
            window.console.log(
                text
            );
        } catch (e) {}
    }
}


/*
============================================================
TRIM
============================================================
*/

function trim(text) {
    return String(text)
        .replace(
            /^\s+|\s+$/g,
            ""
        );
}


/*
============================================================
SETTINGS
============================================================
*/

function initialize() {
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

    world =
        $("world");

    messageInput =
        $("messageInput");

    startButton =
        $("startButton");

    settingsButton =
        $("settingsButton");

    settingsPanel =
        $("settingsPanel");

    closeSettings =
        $("closeSettings");


    /*
     * Login
     */

    addEvent(
        submitButton,
        "click",
        joinRoom
    );


    addEvent(
        nameInput,
        "keydown",
        function (event) {
            event =
                event ||
                window.event;

            if (
                event.keyCode ===
                13
            ) {
                joinRoom();
            }
        }
    );


    addEvent(
        roomInput,
        "keydown",
        function (event) {
            event =
                event ||
                window.event;

            if (
                event.keyCode ===
                13
            ) {
                joinRoom();
            }
        }
    );


    /*
     * Chat
     */

    addEvent(
        startButton,
        "click",
        sendMessage
    );


    addEvent(
        messageInput,
        "keydown",
        function (event) {
            event =
                event ||
                window.event;

            if (
                event.keyCode ===
                13
            ) {
                sendMessage();
            }
        }
    );


    /*
     * Settings
     */

    addEvent(
        settingsButton,
        "click",
        function (event) {
            settingsPanel.style.display =
                "block";

            preventDefault(event);
            stopEvent(event);
        }
    );


    addEvent(
        closeSettings,
        "click",
        function (event) {
            settingsPanel.style.display =
                "none";

            preventDefault(event);
            stopEvent(event);
        }
    );


    /*
     * Mouse dragging
     */

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


    /*
     * Touch dragging
     */

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


    /*
     * Pointer events
     */

    addEvent(
        document,
        "pointermove",
        dragMove
    );

    addEvent(
        document,
        "pointerup",
        endDrag
    );

    addEvent(
        document,
        "pointercancel",
        endDrag
    );
}


/*
============================================================
INITIALIZE
============================================================
*/

if (
    document.readyState ===
    "complete"
) {
    initialize();
} else {
    addEvent(
        window,
        "load",
        initialize
    );
}


/*
============================================================
LEAVE CHAT
============================================================
*/

addEvent(
    window,
    "beforeunload",
    function () {
        if (!myId) {
            return;
        }

        ajax(
            "POST",
            "/api/leave",
            {
                id:
                    myId
            },
            null
        );
    }
);
