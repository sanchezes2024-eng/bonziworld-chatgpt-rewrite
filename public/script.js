var myId = null;
var myName = "";
var currentRoom = "";

var players = {};

var polling = false;
var pollTimer = null;

var dragging = null;

var loginScreen;
var desktop;
var world;
var nameInput;
var roomInput;
var submitButton;
var startButton;
var messageInput;
var settingsButton;
var settingsPanel;
var settingsClose;


/*
============================================================
HELPERS
============================================================
*/

function $(id) {
    return document.getElementById(id);
}

function stopEvent(e) {
    e = e || window.event;

    if (e.preventDefault) {
        e.preventDefault();
    }

    e.returnValue = false;

    return false;
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


/*
============================================================
JSON
============================================================
*/

function parseJSON(text) {
    try {
        if (window.JSON && JSON.parse) {
            return JSON.parse(text);
        }

        return eval("(" + text + ")");
    } catch (e) {
        return null;
    }
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
            "Msxml2.XMLHTTP"
        );
    } catch (e1) {
        try {
            return new ActiveXObject(
                "Microsoft.XMLHTTP"
            );
        } catch (e2) {
            return null;
        }
    }
}

function encodeForm(data) {
    var result = [];
    var key;

    for (key in data) {
        if (!data.hasOwnProperty(key)) {
            continue;
        }

        result.push(
            encodeURIComponent(key) +
            "=" +
            encodeURIComponent(
                data[key] == null
                    ? ""
                    : data[key]
            )
        );
    }

    return result.join("&");
}

function ajax(method, url, body, callback) {
    var xhr = createXHR();

    if (!xhr) {
        if (callback) {
            callback(
                0,
                null
            );
        }

        return;
    }

    var finished = false;

    function done(status, response) {
        if (finished) {
            return;
        }

        finished = true;

        if (callback) {
            callback(
                status,
                response
            );
        }
    }

    try {
        xhr.open(
            method,
            url,
            true
        );

        if (
            method === "POST"
        ) {
            try {
                xhr.setRequestHeader(
                    "Content-Type",
                    "application/x-www-form-urlencoded"
                );
            } catch (e) {}
        }

        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) {
                return;
            }

            var data = null;

            try {
                if (xhr.responseText) {
                    data = parseJSON(
                        xhr.responseText
                    );
                }
            } catch (e) {}

            done(
                xhr.status,
                data
            );
        };

        try {
            xhr.onerror = function() {
                done(0, null);
            };
        } catch (e) {}

        xhr.send(
            body || null
        );
    } catch (e) {
        done(0, null);
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

    name = name.replace(
        /^\s+|\s+$/g,
        ""
    );

    room = room.replace(
        /^\s+|\s+$/g,
        ""
    );

    if (!name) {
        name = "Anonymous";
    }

    if (!room) {
        room = "default";
    }

    submitButton.disabled = true;

    ajax(
        "POST",
        "/api/join",
        encodeForm({
            name: name,
            room: room
        }),
        function(status, data) {
            submitButton.disabled = false;

            if (
                status !== 200 ||
                !data
            ) {
                alert(
                    "Could not connect to the chat server."
                );

                return;
            }

            myId = String(data.id);
            myName = name;
            currentRoom = room;

            loginScreen.style.display = "none";
            desktop.style.display = "block";

            /*
            Create our own player.
            */
            if (data.player) {
                createPlayer(
                    data.player
                );
            }

            /*
            Process players already in room.
            */
            if (data.events) {
                handleEvents(
                    data.events
                );
            }

            startPolling();

            setTimeout(function() {
                try {
                    messageInput.focus();
                } catch (e) {}
            }, 50);
        }
    );
}


/*
============================================================
POLLING
============================================================
*/

function startPolling() {
    if (polling) {
        return;
    }

    polling = true;

    poll();
}

function poll() {
    if (!polling || !myId) {
        return;
    }

    ajax(
        "GET",
        "/api/poll?id=" +
        encodeURIComponent(myId) +
        "&t=" +
        new Date().getTime(),
        null,
        function(status, data) {
            if (!polling) {
                return;
            }

            /*
            Server says this player no longer exists.
            */
            if (
                status === 404
            ) {
                polling = false;
                return;
            }

            if (
                status === 200 &&
                data &&
                data.events
            ) {
                handleEvents(
                    data.events
                );
            }

            /*
            Start another poll.
            */
            pollTimer = setTimeout(
                poll,
                10
            );
        }
    );
}

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


/*
============================================================
EVENTS
============================================================
*/

function handleEvent(event) {
    if (!event || !event.type) {
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
                event.playerId,
                event.x,
                event.y
            );
            break;


        case "playerColorChanged":
            updatePlayerColor(
                event.playerId,
                event.color
            );
            break;


        case "playerCharacterChanged":
            updatePlayerCharacter(
                event.playerId,
                event.character
            );
            break;


        case "playerLeft":
            removePlayer(
                event.playerId
            );
            break;


        case "message":
            showSpeechBubble(
                event.playerId,
                event.text
            );

            speakText(
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
CREATE PLAYER
============================================================
*/

function createPlayer(player) {
    if (!player || !player.id) {
        return;
    }

    var id = String(
        player.id
    );

    /*
    If the player already exists,
    update it instead.
    */
    if (players[id]) {
        updatePlayerPosition(
            players[id],
            player.x,
            player.y
        );

        updatePlayerColor(
            id,
            player.color
        );

        updatePlayerCharacter(
            id,
            player.character
        );

        return;
    }

    var element =
        document.createElement("div");

    element.id =
        "player_" + id;

    element.className =
        "player";

    element.setAttribute(
        "data-player-id",
        id
    );

    var character =
        player.character || "bonzi";

    if (
        character === "square"
    ) {
        element.className +=
            " squareCharacter";
    } else {
        element.className +=
            " bonziPlayer";
    }

    /*
    Name.
    */
    var name =
        document.createElement("div");

    name.className =
        "playerName";

    name.innerHTML =
        escapeHTML(
            player.name || "Anonymous"
        );

    element.appendChild(
        name
    );

    /*
    Bonzi image.
    */
    if (
        character !== "square"
    ) {
        var image =
            document.createElement("img");

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt = "";

        image.setAttribute(
            "draggable",
            "false"
        );

        element.appendChild(
            image
        );
    }

    world.appendChild(
        element
    );

    var record = {
        id: id,
        name: player.name || "Anonymous",
        room: player.room || currentRoom,
        x: Number(player.x),
        y: Number(player.y),
        color: player.color || "#8800ff",
        character: character,
        element: element
    };

    players[id] = record;

    updatePlayerPosition(
        record,
        record.x,
        record.y
    );

    updatePlayerColor(
        id,
        record.color
    );

    installDragHandlers(
        record
    );
}


/*
============================================================
ESCAPE HTML
============================================================
*/

function escapeHTML(text) {
    text = String(
        text == null
            ? ""
            : text
    );

    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/*
============================================================
POSITION
============================================================
*/

function updatePlayerPosition(
    player,
    x,
    y
) {
    if (!player) {
        return;
    }

    x = Number(x);
    y = Number(y);

    if (isNaN(x)) {
        x = 50;
    }

    if (isNaN(y)) {
        y = 50;
    }

    player.x = x;
    player.y = y;

    if (player.element) {
        player.element.style.left =
            x + "%";

        player.element.style.top =
            y + "%";
    }
}

function movePlayerFromServer(
    id,
    x,
    y
) {
    id = String(id);

    if (!players[id]) {
        return;
    }

    updatePlayerPosition(
        players[id],
        x,
        y
    );
}


/*
============================================================
COLOR
============================================================
*/

function getHue(color) {
    if (!color) {
        return 270;
    }

    color = String(
        color
    ).toLowerCase();

    var colors = {
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

    if (
        colors.hasOwnProperty(color)
    ) {
        return colors[color];
    }

    var hex = color;

    if (
        hex.charAt(0) === "#"
    ) {
        hex = hex.substring(1);
    }

    if (
        /^[0-9a-f]{6}$/i.test(hex)
    ) {
        var r = parseInt(
            hex.substring(0, 2),
            16
        );

        var g = parseInt(
            hex.substring(2, 4),
            16
        );

        var b = parseInt(
            hex.substring(4, 6),
            16
        );

        var max =
            Math.max(r, g, b);

        var min =
            Math.min(r, g, b);

        var d =
            max - min;

        if (d === 0) {
            return 270;
        }

        var h;

        if (max === r) {
            h =
                60 *
                (((g - b) / d) % 6);
        } else if (max === g) {
            h =
                60 *
                (((b - r) / d) + 2);
        } else {
            h =
                60 *
                (((r - g) / d) + 4);
        }

        if (h < 0) {
            h += 360;
        }

        return h;
    }

    return 270;
}

function updatePlayerColor(
    id,
    color
) {
    id = String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    player.color = color;

    if (!player.element) {
        return;
    }

    if (
        player.character === "square"
    ) {
        player.element.style.background =
            color;
        return;
    }

    var hue =
        getHue(color);

    var adjustment =
        hue - 270;

    var image =
        player.element.getElementsByTagName(
            "img"
        )[0];

    if (image) {
        image.style.filter =
            "hue-rotate(" +
            adjustment +
            "deg)";

        image.style.msFilter =
            "hue-rotate(" +
            adjustment +
            "deg)";
    }

    try {
        player.element.style.setProperty(
            "--bonzi-hue",
            adjustment + "deg"
        );
    } catch (e) {}
}


/*
============================================================
CHARACTER
============================================================
*/

function updatePlayerCharacter(
    id,
    character
) {
    id = String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    if (
        character !== "square" &&
        character !== "bonzi"
    ) {
        character = "bonzi";
    }

    player.character =
        character;

    var oldElement =
        player.element;

    if (!oldElement) {
        return;
    }

    var newElement =
        document.createElement("div");

    newElement.id =
        oldElement.id;

    newElement.className =
        "player";

    newElement.setAttribute(
        "data-player-id",
        id
    );

    if (
        character === "square"
    ) {
        newElement.className +=
            " squareCharacter";
    } else {
        newElement.className +=
            " bonziPlayer";
    }

    var name =
        document.createElement("div");

    name.className =
        "playerName";

    name.innerHTML =
        escapeHTML(
            player.name
        );

    newElement.appendChild(
        name
    );

    if (
        character === "bonzi"
    ) {
        var image =
            document.createElement("img");

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt = "";

        image.setAttribute(
            "draggable",
            "false"
        );

        newElement.appendChild(
            image
        );
    }

    if (
        oldElement.parentNode
    ) {
        oldElement.parentNode.replaceChild(
            newElement,
            oldElement
        );
    }

    player.element =
        newElement;

    updatePlayerPosition(
        player,
        player.x,
        player.y
    );

    updatePlayerColor(
        id,
        player.color
    );

    installDragHandlers(
        player
    );
}


/*
============================================================
DRAGGING
============================================================
*/

function installDragHandlers(
    player
) {
    var element =
        player.element;

    if (!element) {
        return;
    }

    /*
    Mouse.
    */
    addEvent(
        element,
        "mousedown",
        function(e) {
            startDrag(
                e,
                player
            );
        }
    );

    /*
    Touch.
    */
    addEvent(
        element,
        "touchstart",
        function(e) {
            startDrag(
                e,
                player
            );

            stopEvent(e);
        }
    );
}

function startDrag(
    e,
    player
) {
    e = e || window.event;

    if (!player) {
        return;
    }

    var pointX;
    var pointY;

    if (
        e.touches &&
        e.touches.length
    ) {
        pointX =
            e.touches[0].clientX;

        pointY =
            e.touches[0].clientY;
    } else {
        pointX =
            e.clientX;

        pointY =
            e.clientY;
    }

    var rect =
        world.getBoundingClientRect();

    var worldWidth =
        rect.right - rect.left;

    var worldHeight =
        rect.bottom - rect.top;

    if (
        worldWidth <= 0 ||
        worldHeight <= 0
    ) {
        return;
    }

    dragging = {
        player: player,
        offsetX:
            pointX -
            (
                rect.left +
                (
                    player.x / 100
                ) *
                worldWidth
            ),
        offsetY:
            pointY -
            (
                rect.top +
                (
                    player.y / 100
                ) *
                worldHeight
            )
    };

    stopEvent(e);
}

function dragMove(e) {
    if (!dragging) {
        return;
    }

    e = e || window.event;

    var pointX;
    var pointY;

    if (
        e.touches &&
        e.touches.length
    ) {
        pointX =
            e.touches[0].clientX;

        pointY =
            e.touches[0].clientY;
    } else {
        pointX =
            e.clientX;

        pointY =
            e.clientY;
    }

    var rect =
        world.getBoundingClientRect();

    var width =
        rect.right - rect.left;

    var height =
        rect.bottom - rect.top;

    if (
        width <= 0 ||
        height <= 0
    ) {
        return;
    }

    var x =
        (
            (
                pointX -
                dragging.offsetX -
                rect.left
            ) /
            width
        ) * 100;

    var y =
        (
            (
                pointY -
                dragging.offsetY -
                rect.top
            ) /
            height
        ) * 100;

    /*
    Keep characters inside the world.
    */
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

    updatePlayerPosition(
        dragging.player,
        x,
        y
    );

    /*
    Tell server.
    */
    sendPlayerMove(
        dragging.player.id,
        x,
        y
    );

    stopEvent(e);
}

function stopDrag(e) {
    if (!dragging) {
        return;
    }

    dragging = null;

    if (e) {
        stopEvent(e);
    }
}

function sendPlayerMove(
    playerId,
    x,
    y
) {
    if (!myId) {
        return;
    }

    ajax(
        "POST",
        "/api/move",
        encodeForm({
            senderId: myId,
            playerId: playerId,
            x: x,
            y: y
        }),
        function() {}
    );
}


/*
============================================================
REMOVE PLAYER
============================================================
*/

function removePlayer(id) {
    id = String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    /*
    Remove speech bubble.
    */
    if (player.element) {
        var bubbles =
            player.element.getElementsByClassName
                ? player.element.getElementsByClassName(
                    "speechBubble"
                )
                : [];

        var i;

        for (
            i = bubbles.length - 1;
            i >= 0;
            i--
        ) {
            if (
                bubbles[i].parentNode
            ) {
                bubbles[i].parentNode.removeChild(
                    bubbles[i]
                );
            }
        }

        if (
            player.element.parentNode
        ) {
            player.element.parentNode.removeChild(
                player.element
            );
        }
    }

    delete players[id];
}


/*
============================================================
SPEECH BUBBLES
============================================================
*/

function showSpeechBubble(
    id,
    text
) {
    id = String(id);

    var player =
        players[id];

    if (!player ||
        !player.element) {
        return;
    }

    /*
    Remove old bubble.
    */
    var oldBubble =
        player.element.getElementsByClassName
            ? player.element.getElementsByClassName(
                "speechBubble"
            )
            : [];

    var i;

    for (
        i = oldBubble.length - 1;
        i >= 0;
        i--
    ) {
        if (
            oldBubble[i].parentNode
        ) {
            oldBubble[i].parentNode.removeChild(
                oldBubble[i]
            );
        }
    }

    var bubble =
        document.createElement("div");

    bubble.className =
        "speechBubble";

    bubble.innerHTML =
        escapeHTML(text);

    player.element.appendChild(
        bubble
    );

    setTimeout(function() {
        if (
            bubble &&
            bubble.parentNode
        ) {
            bubble.parentNode.removeChild(
                bubble
            );
        }
    }, 5000);
}


/*
============================================================
TEXT TO SPEECH
============================================================
*/

function speakText(text) {
    if (!text) {
        return;
    }

    /*
    Don't speak commands.
    */
    if (
        text.charAt(0) === "/"
    ) {
        return;
    }

    /*
    speakClient.js supplies window.speak().
    */
    if (
        typeof window.speak !== "function"
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
        TTS failure should never break chat.
        */
    }
}


/*
============================================================
SYSTEM MESSAGE
============================================================
*/

function showSystemMessage(
    text
) {
    if (!text) {
        return;
    }

    /*
    Display it in the taskbar area.
    */
    var old =
        document.getElementById(
            "systemMessage"
        );

    if (old &&
        old.parentNode) {
        old.parentNode.removeChild(
            old
        );
    }

    var message =
        document.createElement("div");

    message.id =
        "systemMessage";

    message.innerHTML =
        escapeHTML(text);

    message.style.position =
        "fixed";

    message.style.left =
        "50%";

    message.style.bottom =
        "55px";

    message.style.transform =
        "translateX(-50%)";

    message.style.background =
        "#ffffcc";

    message.style.border =
        "1px solid #000000";

    message.style.padding =
        "5px 10px";

    message.style.zIndex =
        "9999";

    document.body.appendChild(
        message
    );

    setTimeout(function() {
        if (
            message &&
            message.parentNode
        ) {
            message.parentNode.removeChild(
                message
            );
        }
    }, 3000);
}


/*
============================================================
SEND MESSAGE
============================================================
*/

function sendMessage() {
    if (!myId) {
        return;
    }

    var text =
        messageInput.value;

    text = text.replace(
        /^\s+|\s+$/g,
        ""
    );

    if (!text) {
        return;
    }

    messageInput.value = "";

    ajax(
        "POST",
        "/api/send",
        encodeForm({
            id: myId,
            text: text
        }),
        function(status) {
            if (status !== 200) {
                /*
                Put message back if sending failed.
                */
                messageInput.value =
                    text;

                showSystemMessage(
                    "Message could not be sent."
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
    settingsPanel.style.display =
        "block";
}

function closeSettings() {
    settingsPanel.style.display =
        "none";
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

    /*
    Stop polling immediately.
    */
    polling = false;

    if (pollTimer) {
        clearTimeout(
            pollTimer
        );

        pollTimer = null;
    }

    /*
    Tell server.
    */
    ajax(
        "POST",
        "/api/leave",
        encodeForm({
            id: myId
        }),
        function() {}
    );
}


/*
============================================================
GLOBAL DRAG EVENTS
============================================================
*/

addEvent(
    document,
    "mousemove",
    function(e) {
        dragMove(e);
    }
);

addEvent(
    document,
    "mouseup",
    function(e) {
        stopDrag(e);
    }
);

addEvent(
    document,
    "touchmove",
    function(e) {
        dragMove(e);
    }
);

addEvent(
    document,
    "touchend",
    function(e) {
        stopDrag(e);
    }
);

addEvent(
    document,
    "touchcancel",
    function(e) {
        stopDrag(e);
    }
);


/*
============================================================
INITIALIZE
============================================================
*/

function initialize() {
    loginScreen =
        $("loginScreen");

    desktop =
        $("desktop");

    world =
        $("world");

    nameInput =
        $("nameInput");

    roomInput =
        $("roomInput");

    submitButton =
        $("submitButton");

    startButton =
        $("startButton");

    messageInput =
        $("messageInput");

    settingsButton =
        $("settingsButton");

    settingsPanel =
        $("settingsPanel");

    settingsClose =
        $("settingsClose");


    /*
    Login.
    */
    addEvent(
        submitButton,
        "click",
        function(e) {
            stopEvent(e);
            joinRoom();
        }
    );

    addEvent(
        nameInput,
        "keypress",
        function(e) {
            e = e || window.event;

            if (
                e.keyCode === 13
            ) {
                joinRoom();
                stopEvent(e);
            }
        }
    );

    addEvent(
        roomInput,
        "keypress",
        function(e) {
            e = e || window.event;

            if (
                e.keyCode === 13
            ) {
                joinRoom();
                stopEvent(e);
            }
        }
    );


    /*
    Start button.
    */
    addEvent(
        startButton,
        "click",
        function(e) {
            stopEvent(e);
            sendMessage();
        }
    );


    /*
    Message Enter key.
    */
    addEvent(
        messageInput,
        "keypress",
        function(e) {
            e = e || window.event;

            if (
                e.keyCode === 13
            ) {
                sendMessage();
                stopEvent(e);
            }
        }
    );


    /*
    Settings.
    */
    addEvent(
        settingsButton,
        "click",
        function(e) {
            stopEvent(e);
            openSettings();
        }
    );

    addEvent(
        settingsClose,
        "click",
        function(e) {
            stopEvent(e);
            closeSettings();
        }
    );


    /*
    Focus name field.
    */
    try {
        nameInput.focus();
    } catch (e) {}
}


/*
============================================================
BROWSER CLOSE
============================================================

This is a backup.

The server's poll connection "close" event is what
actually detects a closed tab reliably.
============================================================
*/

addEvent(
    window,
    "beforeunload",
    function() {
        if (!myId) {
            return;
        }

        /*
        Attempt to notify server.
        */
        try {
            ajax(
                "POST",
                "/api/leave",
                encodeForm({
                    id: myId
                }),
                function() {}
            );
        } catch (e) {}
    }
);


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
