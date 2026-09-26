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

function ajax(method, address, data, callback) {
    var xhr = new XMLHttpRequest();
    var body = "";
    var key;

    if (data) {
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                if (body !== "") {
                    body += "&";
                }

                body += encodeURIComponent(key);
                body += "=";
                body += encodeURIComponent(data[key]);
            }
        }
    }

    xhr.open(method, address, true);

    if (method === "POST") {
        xhr.setRequestHeader(
            "Content-Type",
            "application/x-www-form-urlencoded"
        );
    }

    xhr.onreadystatechange = function () {
        var result;

        if (xhr.readyState !== 4) {
            return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                result = JSON.parse(xhr.responseText);
            } catch (e) {
                result = null;
            }

            if (callback) {
                callback(result);
            }
        } else {
            if (callback) {
                callback(null);
            }
        }
    };

    xhr.send(body);
}

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
        function (result) {
            var i;

            submitButton.disabled = false;

            if (!result || !result.id) {
                alert("Could not connect to the chat server.");
                return;
            }

            myId = String(result.id);

            loginScreen.style.display = "none";
            desktop.style.display = "block";

            createPlayer(result.player);

            if (result.player) {
                currentRoom = result.player.room;
            }

            startPolling();

            for (i = 0; i < result.events.length; i++) {
                handleEvent(result.events[i]);
            }
        }
    );
}

function startPolling() {
    if (pollTimer) {
        window.clearTimeout(pollTimer);
    }

    poll();
}

function poll() {
    if (!myId || pollInProgress) {
        return;
    }

    pollInProgress = true;

    ajax(
        "GET",
        "/api/poll?id=" + encodeURIComponent(myId) + "&t=" + new Date().getTime(),
        null,
        function (result) {
            var i;

            pollInProgress = false;

            if (result && result.events) {
                for (i = 0; i < result.events.length; i++) {
                    handleEvent(result.events[i]);
                }
            }

            pollTimer = window.setTimeout(poll, 20);
        }
    );
}

function handleEvent(event) {
    if (!event) {
        return;
    }

    if (event.event === "playerJoined") {
        createPlayer(event.data);
        return;
    }

    if (event.event === "playerMoved") {
        movePlayer(
            event.data.id,
            event.data.x,
            event.data.y
        );

        return;
    }

    if (event.event === "playerColorChanged") {
        changePlayerColor(
            event.data.id,
            event.data.color
        );

        return;
    }

    if (event.event === "playerCharacterChanged") {
        changePlayerCharacter(
            event.data.id,
            event.data.character
        );

        return;
    }

    if (event.event === "playerLeft") {
        removePlayer(event.data.id);
        return;
    }

    if (event.event === "message") {
        showMessage(
            event.data.id,
            event.data.text
        );

        return;
    }

    if (event.event === "systemMessage") {
        showSystemMessage(event.data.text);
    }
}

function createPlayer(data) {
    var player;
    var element;
    var name;
    var character;

    if (!data || !data.id) {
        return;
    }

    if (players[String(data.id)]) {
        return;
    }

    player = {
        id: String(data.id),
        name: data.name || "Anonymous",
        room: data.room || currentRoom,
        x: parseFloat(data.x),
        y: parseFloat(data.y),
        color: data.color || "#8800ff",
        character: data.character || "bonzi",
        element: null,
        bubble: null,
        audio: null
    };

    element = document.createElement("div");
    element.className = "player";

    if (player.character === "bonzi") {
        element.className += " bonziPlayer";
    }

    name = document.createElement("div");
    name.className = "playerName";
    name.appendChild(
        document.createTextNode(player.name)
    );

    element.appendChild(name);

    if (player.character === "bonzi") {
        character = document.createElement("img");

        character.className = "bonziCharacter";
        character.src = "/bonzi.png";
        character.alt = "";

        element.appendChild(character);
    } else {
        character = document.createElement("div");
        character.className = "squareCharacter";

        element.appendChild(character);
    }

    player.element = element;

    world.appendChild(element);

    players[player.id] = player;

    updatePlayerPosition(player);
    updatePlayerColor(player);
    setupDragging(player);
}

function updatePlayerPosition(player) {
    if (!player || !player.element) {
        return;
    }

    player.element.style.left = player.x + "%";
    player.element.style.top = player.y + "%";
}

function movePlayer(id, x, y) {
    var player;

    id = String(id);

    player = players[id];

    if (!player) {
        return;
    }

    player.x = parseFloat(x);
    player.y = parseFloat(y);

    updatePlayerPosition(player);
}

function setupDragging(player) {
    var element = player.element;

    addEvent(element, "mousedown", function (event) {
        beginDrag(player, event);
    });

    addEvent(element, "touchstart", function (event) {
        beginDrag(player, event);
    });

    addEvent(element, "pointerdown", function (event) {
        beginDrag(player, event);
    });
}

function getPointerPosition(event) {
    var x;
    var y;
    var touch;

    event = event || window.event;

    if (event.touches && event.touches.length) {
        touch = event.touches[0];

        return {
            x: touch.clientX,
            y: touch.clientY
        };
    }

    if (event.changedTouches && event.changedTouches.length) {
        touch = event.changedTouches[0];

        return {
            x: touch.clientX,
            y: touch.clientY
        };
    }

    x = event.clientX;
    y = event.clientY;

    return {
        x: x,
        y: y
    };
}

function beginDrag(player, event) {
    if (!player) {
        return;
    }

    event = event || window.event;

    draggingPlayer = player;
    dragging = true;

    preventDefault(event);
    stopEvent(event);
}

function dragMove(event) {
    var worldRect;
    var pointer;
    var x;
    var y;

    if (!dragging || !draggingPlayer) {
        return;
    }

    event = event || window.event;

    pointer = getPointerPosition(event);

    worldRect = {
        left: world.offsetLeft,
        top: world.offsetTop,
        width: world.clientWidth,
        height: world.clientHeight
    };

    x = ((pointer.x - worldRect.left) / worldRect.width) * 100;
    y = ((pointer.y - worldRect.top) / worldRect.height) * 100;

    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));

    draggingPlayer.x = x;
    draggingPlayer.y = y;

    updatePlayerPosition(draggingPlayer);

    ajax(
        "POST",
        "/api/move",
        {
            senderId: myId,
            playerId: draggingPlayer.id,
            x: x,
            y: y
        },
        null
    );

    preventDefault(event);
}

function endDrag(event) {
    if (!dragging) {
        return;
    }

    dragging = false;
    draggingPlayer = null;

    event = event || window.event;

    preventDefault(event);
}

function changePlayerColor(id, color) {
    var player;

    player = players[String(id)];

    if (!player) {
        return;
    }

    player.color = color;

    updatePlayerColor(player);
}

function colorToHue(color) {
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
    var h;
    var parts;

    color = String(color).toLowerCase();

    if (named[color] !== undefined) {
        return named[color];
    }

    if (color.charAt(0) !== "#" || color.length !== 7) {
        return 270;
    }

    r = parseInt(color.substring(1, 3), 16) / 255;
    g = parseInt(color.substring(3, 5), 16) / 255;
    b = parseInt(color.substring(5, 7), 16) / 255;

    max = Math.max(r, g, b);
    min = Math.min(r, g, b);

    if (max === min) {
        return 0;
    }

    if (max === r) {
        h = ((g - b) / (max - min)) % 6;
    } else if (max === g) {
        h = ((b - r) / (max - min)) + 2;
    } else {
        h = ((r - g) / (max - min)) + 4;
    }

    h *= 60;

    if (h < 0) {
        h += 360;
    }

    return h;
}

function updatePlayerColor(player) {
    var elements;
    var i;
    var hue;
    var shift;

    if (!player || !player.element) {
        return;
    }

    elements = player.element.getElementsByTagName("div");

    hue = colorToHue(player.color);

    shift = hue - 270;

    for (i = 0; i < elements.length; i++) {
        if (elements[i].className === "squareCharacter") {
            elements[i].style.backgroundColor = player.color;
        }
    }

    /*
     * IE7-IE11 do not support CSS variables.
     * The Bonzi image therefore uses an IE-compatible
     * filter when available.
     */

    var images = player.element.getElementsByTagName("img");

    for (i = 0; i < images.length; i++) {
        if (images[i].className === "bonziCharacter") {
            if (images[i].style.filter !== undefined) {
                images[i].style.filter =
                    "hue-rotate(" + shift + "deg)";
            }

            if (images[i].style.msFilter !== undefined) {
                images[i].style.msFilter =
                    "hue-rotate(" + shift + "deg)";
            }
        }
    }
}

function changePlayerCharacter(id, character) {
    var player;
    var oldImages;
    var oldSquares;
    var name;
    var image;
    var square;

    player = players[String(id)];

    if (!player) {
        return;
    }

    player.character = character;

    while (player.element.childNodes.length > 0) {
        player.element.removeChild(
            player.element.childNodes[
                player.element.childNodes.length - 1
            ]
        );
    }

    name = document.createElement("div");
    name.className = "playerName";
    name.appendChild(
        document.createTextNode(player.name)
    );

    player.element.appendChild(name);

    if (character === "bonzi") {
        player.element.className = "player bonziPlayer";

        image = document.createElement("img");
        image.className = "bonziCharacter";
        image.src = "/bonzi.png";
        image.alt = "";

        player.element.appendChild(image);
    } else {
        player.element.className = "player";

        square = document.createElement("div");
        square.className = "squareCharacter";

        player.element.appendChild(square);
    }

    updatePlayerPosition(player);
    updatePlayerColor(player);
}

function removePlayer(id) {
    var player;

    player = players[String(id)];

    if (!player) {
        return;
    }

    if (player.audio) {
        try {
            player.audio.pause();
        } catch (e) {}

        player.audio = null;
    }

    if (player.bubble && player.bubble.parentNode) {
        player.bubble.parentNode.removeChild(player.bubble);
    }

    if (player.element && player.element.parentNode) {
        player.element.parentNode.removeChild(player.element);
    }

    delete players[String(id)];
}

function showMessage(id, text) {
    var player;

    player = players[String(id)];

    if (!player) {
        return;
    }

    showSpeechBubble(player, text);
    generateSpeech(player, text);
}

function showSpeechBubble(player, text) {
    var bubble;
    var arrow;
    var inner;

    if (player.bubble && player.bubble.parentNode) {
        player.bubble.parentNode.removeChild(
            player.bubble
        );
    }

    bubble = document.createElement("div");
    bubble.className = "speechBubble";

    bubble.appendChild(
        document.createTextNode(text)
    );

    arrow = document.createElement("div");
    arrow.className = "speechBubbleArrow";

    inner = document.createElement("div");
    inner.className = "speechBubbleArrowInner";

    arrow.appendChild(inner);
    bubble.appendChild(arrow);

    player.element.appendChild(bubble);

    player.bubble = bubble;

    window.setTimeout(function () {
        if (
            player.bubble === bubble &&
            bubble.parentNode
        ) {
            bubble.parentNode.removeChild(bubble);
            player.bubble = null;
        }
    }, 5000);
}

function generateSpeech(player, text) {
    var xhr;
    var audio;
    var result;

    /*
     * HTML5 audio is intentionally used here.
     *
     * IE7 and IE8 do not have HTML5 audio, so those
     * browsers simply receive the chat message without
     * spoken playback.
     */

    if (!document.createElement("audio").canPlayType) {
        return;
    }

    xhr = new XMLHttpRequest();

    xhr.open(
        "GET",
        "/api/tts?text=" + encodeURIComponent(text),
        true
    );

    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
            return;
        }

        try {
            result = JSON.parse(xhr.responseText);
        } catch (e) {
            return;
        }

        if (!result || !result.url) {
            return;
        }

        audio = document.createElement("audio");

        audio.className = "ttsAudio";
        audio.setAttribute("preload", "auto");

        audio.src = result.url;

        /*
         * Do not cancel other people's audio.
         * Every message gets its own HTML5 audio element.
         */

        document.body.appendChild(audio);

        player.audio = audio;

        try {
            audio.play();
        } catch (e) {}

        addEvent(audio, "ended", function () {
            if (audio.parentNode) {
                audio.parentNode.removeChild(audio);
            }

            if (player.audio === audio) {
                player.audio = null;
            }
        });
    };

    xhr.send(null);
}

function sendMessage() {
    var text;

    text = messageInput.value;

    if (!text) {
        return;
    }

    messageInput.value = "";

    ajax(
        "POST",
        "/api/send",
        {
            id: myId,
            message: text
        },
        null
    );
}

function showSystemMessage(text) {
    if (window.console) {
        try {
            console.log(text);
        } catch (e) {}
    }
}

function initialize() {
    loginScreen = $("loginScreen");
    desktop = $("desktop");

    nameInput = $("nameInput");
    roomInput = $("roomInput");
    submitButton = $("submitButton");

    world = $("world");

    messageInput = $("messageInput");
    startButton = $("startButton");

    settingsButton = $("settingsButton");
    settingsPanel = $("settingsPanel");
    closeSettings = $("closeSettings");

    addEvent(submitButton, "click", joinRoom);

    addEvent(nameInput, "keydown", function (event) {
        event = event || window.event;

        if (event.keyCode === 13) {
            joinRoom();
        }
    });

    addEvent(roomInput, "keydown", function (event) {
        event = event || window.event;

        if (event.keyCode === 13) {
            joinRoom();
        }
    });

    addEvent(startButton, "click", sendMessage);

    addEvent(messageInput, "keydown", function (event) {
        event = event || window.event;

        if (event.keyCode === 13) {
            sendMessage();
        }
    });

    addEvent(settingsButton, "click", function (event) {
        settingsPanel.style.display = "block";

        preventDefault(event);
        stopEvent(event);
    });

    addEvent(closeSettings, "click", function () {
        settingsPanel.style.display = "none";
    });

    /*
     * Mouse dragging.
     */

    addEvent(document, "mousemove", dragMove);
    addEvent(document, "mouseup", endDrag);

    /*
     * Touch dragging for Windows Phone IE.
     */

    addEvent(document, "touchmove", dragMove);
    addEvent(document, "touchend", endDrag);
    addEvent(document, "touchcancel", endDrag);

    /*
     * Pointer Events if available.
     */

    addEvent(document, "pointermove", dragMove);
    addEvent(document, "pointerup", endDrag);
    addEvent(document, "pointercancel", endDrag);
}

if (document.readyState === "complete") {
    initialize();
} else {
    addEvent(window, "load", initialize);
}

addEvent(window, "beforeunload", function () {
    if (myId) {
        ajax(
            "POST",
            "/api/leave",
            {
                id: myId
            },
            null
        );
    }
});
