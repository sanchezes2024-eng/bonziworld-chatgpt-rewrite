var myId = null;
var myName = "";
var currentRoom = "";

var players = {};

var draggingPlayer = null;
var dragging = false;

var pollTimer = null;
var pollInProgress = false;

var loginScreen = null;
var desktop = null;
var nameInput = null;
var roomInput = null;
var submitButton = null;
var world = null;
var messageInput = null;
var startButton = null;
var settingsButton = null;
var settingsPanel = null;
var closeSettings = null;


/*
============================================================
DOM
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
        element.attachEvent(
            "on" + name,
            handler
        );
    } else if (element.addEventListener) {
        element.addEventListener(
            name,
            handler,
            false
        );
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
JSON COMPATIBILITY
============================================================
*/

function parseJSON(text) {
    if (
        window.JSON &&
        JSON.parse
    ) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    /*
     * IE7 fallback.
     *
     * The server only sends JSON that it
     * generated itself.
     */

    try {
        return eval(
            "(" + text + ")"
        );
    } catch (e2) {
        return null;
    }
}


/*
============================================================
AJAX
============================================================
*/

function ajax(
    method,
    address,
    data,
    callback
) {
    var xhr;
    var body;
    var key;
    var completed = false;

    xhr =
        new XMLHttpRequest();

    body = "";

    if (data) {
        for (key in data) {
            if (
                !data.hasOwnProperty(
                    key
                )
            ) {
                continue;
            }

            if (body !== "") {
                body += "&";
            }

            body +=
                encodeURIComponent(
                    key
                );

            body += "=";

            body +=
                encodeURIComponent(
                    data[key]
                );
        }
    }

    try {
        xhr.open(
            method,
            address,
            true
        );
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

    xhr.onreadystatechange =
        function () {
            var result;

            if (
                xhr.readyState !== 4
            ) {
                return;
            }

            if (completed) {
                return;
            }

            completed = true;

            if (
                xhr.status >= 200 &&
                xhr.status < 300
            ) {
                result =
                    parseJSON(
                        xhr.responseText
                    );

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
        if (!completed) {
            completed = true;

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

    name =
        nameInput.value;

    room =
        roomInput.value;

    if (!name) {
        name = "Anonymous";
    }

    if (!room) {
        room = "default";
    }

    myName = name;
    currentRoom = room;

    submitButton.disabled =
        true;

    ajax(
        "POST",
        "/api/join",
        {
            name: name,
            room: room
        },
        function (result) {
            var i;

            submitButton.disabled =
                false;

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

            myId =
                String(
                    result.id
                );

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
                    i <
                    result.events.length;
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
        window.clearTimeout(
            pollTimer
        );
    }

    poll();
}

function poll() {
    if (
        !myId ||
        pollInProgress
    ) {
        return;
    }

    pollInProgress =
        true;

    ajax(
        "GET",
        "/api/poll?id=" +
        encodeURIComponent(
            myId
        ) +
        "&t=" +
        new Date().getTime(),
        null,
        function (result) {
            var i;

            pollInProgress =
                false;

            if (
                result &&
                result.events
            ) {
                for (
                    i = 0;
                    i <
                    result.events.length;
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
                    20
                );
        }
    );
}


/*
============================================================
EVENTS
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
        createPlayer(
            event.data
        );

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
PLAYERS
============================================================
*/

function createPlayer(data) {
    var player;
    var element;
    var name;
    var character;

    if (
        !data ||
        !data.id
    ) {
        return;
    }

    if (
        players[
            String(data.id)
        ]
    ) {
        return;
    }

    player = {
        id:
            String(data.id),

        name:
            data.name ||
            "Anonymous",

        room:
            data.room ||
            currentRoom,

        x:
            parseFloat(
                data.x
            ),

        y:
            parseFloat(
                data.y
            ),

        color:
            data.color ||
            "#8800ff",

        character:
            data.character ||
            "bonzi",

        element: null,
        bubble: null
    };

    if (isNaN(player.x)) {
        player.x = 50;
    }

    if (isNaN(player.y)) {
        player.y = 50;
    }

    element =
        document.createElement(
            "div"
        );

    element.className =
        "player";

    if (
        player.character ===
        "bonzi"
    ) {
        element.className +=
            " bonziPlayer";
    }

    name =
        document.createElement(
            "div"
        );

    name.className =
        "playerName";

    name.appendChild(
        document.createTextNode(
            player.name
        )
    );

    element.appendChild(
        name
    );

    if (
        player.character ===
        "bonzi"
    ) {
        character =
            document.createElement(
                "img"
            );

        character.className =
            "bonziCharacter";

        character.src =
            "/bonzi.png";

        character.alt = "";

        element.appendChild(
            character
        );
    } else {
        character =
            document.createElement(
                "div"
            );

        character.className =
            "squareCharacter";

        element.appendChild(
            character
        );
    }

    player.element =
        element;

    world.appendChild(
        element
    );

    players[player.id] =
        player;

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

function updatePlayerPosition(
    player
) {
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

function movePlayer(
    id,
    x,
    y
) {
    var player;

    player =
        players[
            String(id)
        ];

    if (!player) {
        return;
    }

    player.x =
        parseFloat(x);

    player.y =
        parseFloat(y);

    updatePlayerPosition(
        player
    );
}


/*
============================================================
DRAGGING
============================================================
*/

function setupDragging(
    player
) {
    var element;

    element =
        player.element;

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

function getPointerPosition(
    event
) {
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

    draggingPlayer =
        player;

    dragging =
        true;

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
        getPointerPosition(
            event
        );

    rect =
        world.getBoundingClientRect();

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

    draggingPlayer.x =
        x;

    draggingPlayer.y =
        y;

    updatePlayerPosition(
        draggingPlayer
    );

    ajax(
        "POST",
        "/api/move",
        {
            senderId: myId,
            playerId:
                draggingPlayer.id,
            x: x,
            y: y
        },
        null
    );

    preventDefault(
        event
    );
}

function endDrag(event) {
    if (!dragging) {
        return;
    }

    dragging =
        false;

    draggingPlayer =
        null;

    preventDefault(
        event
    );
}


/*
============================================================
COLORS
============================================================
*/

function changePlayerColor(
    id,
    color
) {
    var player;

    player =
        players[
            String(id)
        ];

    if (!player) {
        return;
    }

    player.color =
        color;

    updatePlayerColor(
        player
    );
}

function colorToHue(
    color
) {
    var r;
    var g;
    var b;
    var max;
    var min;
    var h;

    color =
        String(color)
            .toLowerCase();

    if (
        color === "red"
    ) {
        return 0;
    }

    if (
        color === "orange"
    ) {
        return 30;
    }

    if (
        color === "yellow"
    ) {
        return 60;
    }

    if (
        color === "green"
    ) {
        return 120;
    }

    if (
        color === "cyan"
    ) {
        return 180;
    }

    if (
        color === "blue"
    ) {
        return 240;
    }

    if (
        color === "purple"
    ) {
        return 270;
    }

    if (
        color === "magenta"
    ) {
        return 300;
    }

    if (
        color === "pink"
    ) {
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

function updatePlayerColor(
    player
) {
    var elements;
    var images;
    var i;
    var hue;
    var shift;

    if (
        !player ||
        !player.element
    ) {
        return;
    }

    elements =
        player.element
            .getElementsByTagName(
                "div"
            );

    for (
        i = 0;
        i < elements.length;
        i++
    ) {
        if (
            elements[i].className ===
            "squareCharacter"
        ) {
            elements[i].style
                .backgroundColor =
                player.color;
        }
    }

    images =
        player.element
            .getElementsByTagName(
                "img"
            );

    hue =
        colorToHue(
            player.color
        );

    shift =
        hue - 270;

    for (
        i = 0;
        i < images.length;
        i++
    ) {
        if (
            images[i].className ===
            "bonziCharacter"
        ) {
            images[i].style.filter =
                "hue-rotate(" +
                shift +
                "deg)";

            images[i].style.msFilter =
                "hue-rotate(" +
                shift +
                "deg)";
        }
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
    var name;
    var image;
    var square;

    player =
        players[
            String(id)
        ];

    if (!player) {
        return;
    }

    player.character =
        character;

    while (
        player.element.childNodes.length
    ) {
        player.element.removeChild(
            player.element
                .childNodes[0]
        );
    }

    name =
        document.createElement(
            "div"
        );

    name.className =
        "playerName";

    name.appendChild(
        document.createTextNode(
            player.name
        )
    );

    player.element.appendChild(
        name
    );

    if (
        character ===
        "bonzi"
    ) {
        player.element.className =
            "player bonziPlayer";

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
            "player";

        square =
            document.createElement(
                "div"
            );

        square.className =
            "squareCharacter";

        player.element.appendChild(
            square
        );
    }

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

function removePlayer(
    id
) {
    var player;

    player =
        players[
            String(id)
        ];

    if (!player) {
        return;
    }

    if (
        player.bubble &&
        player.bubble.parentNode
    ) {
        player.bubble.parentNode
            .removeChild(
                player.bubble
            );
    }

    if (
        player.element &&
        player.element.parentNode
    ) {
        player.element.parentNode
            .removeChild(
                player.element
            );
    }

    delete players[
        String(id)
    ];
}


/*
============================================================
MESSAGE
============================================================
*/

function showMessage(
    id,
    text
) {
    var player;

    player =
        players[
            String(id)
        ];

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
    var arrow;
    var inner;

    if (
        player.bubble &&
        player.bubble.parentNode
    ) {
        player.bubble.parentNode
            .removeChild(
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

    arrow =
        document.createElement(
            "div"
        );

    arrow.className =
        "speechBubbleArrow";

    inner =
        document.createElement(
            "div"
        );

    inner.className =
        "speechBubbleArrowInner";

    arrow.appendChild(
        inner
    );

    bubble.appendChild(
        arrow
    );

    player.element.appendChild(
        bubble
    );

    player.bubble =
        bubble;

    window.setTimeout(
        function () {
            if (
                player.bubble ===
                bubble &&
                bubble.parentNode
            ) {
                bubble.parentNode
                    .removeChild(
                        bubble
                    );

                player.bubble =
                    null;
            }
        },
        5000
    );
}


/*
============================================================
eSPEAK JAVASCRIPT
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
     * speakClient.js normally exposes
     * the global speak() function.
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
     * Some versions expose the
     * generator differently.
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
SEND
============================================================
*/

function sendMessage() {
    var text;

    if (!myId) {
        return;
    }

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
            message: text
        },
        null
    );
}


/*
============================================================
SYSTEM MESSAGE
============================================================
*/

function showSystemMessage(
    text
) {
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
        function () {
            settingsPanel.style.display =
                "none";
        }
    );


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
START
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
LEAVE
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
                id: myId
            },
            null
        );
    }
);
