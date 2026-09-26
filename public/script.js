var myId = null;
var myName = "";
var currentRoom = "";

var players = {};

var polling = false;
var pollTimer = null;
var pollInProgress = false;

var dragging = null;

var movePending = null;
var moveTimer = null;
var moveRequestActive = false;

var heartbeatTimer = null;

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
        element["on" + eventName] =
            handler;
    }
}


/*
============================================================
JSON
============================================================
*/

function parseJSON(text) {
    try {
        if (
            window.JSON &&
            JSON.parse
        ) {
            return JSON.parse(text);
        }

        return eval(
            "(" + text + ")"
        );
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
        try {
            return new XMLHttpRequest();
        } catch (e) {}
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

function ajax(
    method,
    url,
    body,
    callback
) {
    var xhr =
        createXHR();

    if (!xhr) {
        if (callback) {
            callback(
                0,
                null
            );
        }

        return null;
    }

    var finished = false;

    function done(
        status,
        response
    ) {
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

        /*
        Cache-busting for old IE.
        */
        if (
            url.indexOf("?") === -1
        ) {
            url +=
                "?_=" +
                new Date().getTime();
        } else {
            url +=
                "&_=" +
                new Date().getTime();
        }

        xhr.open(
            method,
            url,
            true
        );

        try {
            xhr.setRequestHeader(
                "Cache-Control",
                "no-cache"
            );
        } catch (e) {}

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

        xhr.onreadystatechange =
            function() {

                if (
                    xhr.readyState !== 4
                ) {
                    return;
                }

                var data = null;

                try {
                    if (
                        xhr.responseText
                    ) {
                        data =
                            parseJSON(
                                xhr.responseText
                            );
                    }
                } catch (e) {}

                var status =
                    xhr.status;

                /*
                IE sometimes reports strange
                status values when connections die.
                */
                if (
                    !status &&
                    xhr.responseText
                ) {
                    status = 200;
                }

                done(
                    status,
                    data
                );
            };

        try {
            xhr.onerror =
                function() {
                    done(
                        0,
                        null
                    );
                };
        } catch (e) {}

        try {
            xhr.ontimeout =
                function() {
                    done(
                        0,
                        null
                    );
                };
        } catch (e) {}

        xhr.send(
            body || null
        );

    } catch (e) {

        done(
            0,
            null
        );
    }

    return xhr;
}


/*
============================================================
JOIN
============================================================
*/

function joinRoom() {
    if (
        myId ||
        submitButton.disabled
    ) {
        return;
    }

    var name =
        nameInput.value;

    var room =
        roomInput.value;

    name =
        name.replace(
            /^\s+|\s+$/g,
            ""
        );

    room =
        room.replace(
            /^\s+|\s+$/g,
            ""
        );

    if (!name) {
        name = "Anonymous";
    }

    if (!room) {
        room = "default";
    }

    submitButton.disabled =
        true;

    ajax(
        "POST",
        "/api/join",
        encodeForm({
            name: name,
            room: room
        }),
        function(
            status,
            data
        ) {

            submitButton.disabled =
                false;

            if (
                status !== 200 ||
                !data ||
                !data.id
            ) {
                alert(
                    "Could not connect to the chat server."
                );

                return;
            }

            myId =
                String(
                    data.id
                );

            myName =
                name;

            currentRoom =
                room;

            loginScreen.style.display =
                "none";

            desktop.style.display =
                "block";

            if (data.player) {
                createPlayer(
                    data.player
                );
            }

            if (
                data.events
            ) {
                handleEvents(
                    data.events
                );
            }

            startPolling();
            startHeartbeat();

            setTimeout(
                function() {
                    try {
                        messageInput.focus();
                    } catch (e) {}
                },
                50
            );
        }
    );
}


/*
============================================================
POLLING
============================================================
*/

function startPolling() {
    if (
        polling
    ) {
        return;
    }

    polling = true;
    pollInProgress = false;

    poll();
}

function poll() {
    if (
        !polling ||
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
        ),
        null,
        function(
            status,
            data
        ) {

            pollInProgress =
                false;

            if (!polling) {
                return;
            }

            /*
            Server removed us.
            */
            if (
                status === 404
            ) {
                polling = false;

                stopHeartbeat();

                return;
            }

            /*
            A duplicate poll means the
            client should simply retry.
            */
            if (
                status === 409
            ) {
                schedulePoll(
                    100
                );

                return;
            }

            /*
            Normal poll response.
            */
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
            Network failure:
            retry quickly instead of silently
            stopping the chat.
            */
            if (
                status === 0 ||
                status >= 500
            ) {
                schedulePoll(
                    500
                );

                return;
            }

            /*
            Continue polling.
            */
            schedulePoll(
                10
            );
        }
    );
}

function schedulePoll(delay) {
    if (!polling) {
        return;
    }

    if (pollTimer) {
        clearTimeout(
            pollTimer
        );
    }

    pollTimer =
        setTimeout(
            function() {
                pollTimer = null;
                poll();
            },
            delay
        );
}

function handleEvents(events) {
    if (!events) {
        return;
    }

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
    if (
        !event ||
        !event.type
    ) {
        return;
    }

    switch (
        event.type
    ) {

        case "playerJoined":

            if (
                event.player
            ) {
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
    if (
        !player ||
        player.id == null
    ) {
        return;
    }

    var id =
        String(
            player.id
        );

    /*
    Existing player:
    update instead of duplicating it.
    */
    if (
        players[id]
    ) {
        players[id].name =
            player.name ||
            players[id].name;

        players[id].room =
            player.room ||
            players[id].room;

        updatePlayerPosition(
            players[id],
            player.x,
            player.y
        );

        updatePlayerColor(
            id,
            player.color
        );

        if (
            player.character
        ) {
            updatePlayerCharacter(
                id,
                player.character
            );
        }

        return;
    }

    var element =
        document.createElement(
            "div"
        );

    element.id =
        "player_" + id;

    element.className =
        "player";

    element.setAttribute(
        "data-player-id",
        id
    );

    var character =
        player.character ||
        "bonzi";

    if (
        character !== "square" &&
        character !== "bonzi"
    ) {
        character = "bonzi";
    }

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
        document.createElement(
            "div"
        );

    name.className =
        "playerName";

    name.innerHTML =
        escapeHTML(
            player.name ||
            "Anonymous"
        );

    element.appendChild(
        name
    );


    /*
    Bonzi.
    */
    if (
        character === "bonzi"
    ) {
        var image =
            document.createElement(
                "img"
            );

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt = "";

        image.setAttribute(
            "draggable",
            "false"
        );

        /*
        Prevent old IE from treating the image
        as a draggable document object.
        */
        image.ondragstart =
            function() {
                return false;
            };

        element.appendChild(
            image
        );
    }


    world.appendChild(
        element
    );

    var record = {
        id: id,

        name:
            player.name ||
            "Anonymous",

        room:
            player.room ||
            currentRoom,

        x:
            Number(player.x),

        y:
            Number(player.y),

        color:
            player.color ||
            "#8800ff",

        character:
            character,

        element:
            element,

        bubbleTimer:
            null
    };

    players[id] =
        record;

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
    text =
        String(
            text == null
                ? ""
                : text
        );

    return text
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#39;"
        );
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

    if (
        isNaN(x)
    ) {
        x = 50;
    }

    if (
        isNaN(y)
    ) {
        y = 50;
    }

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

    player.x =
        x;

    player.y =
        y;

    if (
        player.element
    ) {
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
    id =
        String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    /*
    Don't overwrite our locally dragged position
    with an older network update.
    */
    if (
        dragging &&
        dragging.player === player
    ) {
        return;
    }

    updatePlayerPosition(
        player,
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

    color =
        String(
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
        colors.hasOwnProperty(
            color
        )
    ) {
        return colors[color];
    }

    var hex =
        color;

    if (
        hex.charAt(0) === "#"
    ) {
        hex =
            hex.substring(1);
    }

    if (
        !/^[0-9a-f]{6}$/i.test(
            hex
        )
    ) {
        return 270;
    }

    var r =
        parseInt(
            hex.substring(0, 2),
            16
        );

    var g =
        parseInt(
            hex.substring(2, 4),
            16
        );

    var b =
        parseInt(
            hex.substring(4, 6),
            16
        );

    var max =
        Math.max(
            r,
            g,
            b
        );

    var min =
        Math.min(
            r,
            g,
            b
        );

    var d =
        max - min;

    if (
        d === 0
    ) {
        return 270;
    }

    var h;

    if (
        max === r
    ) {
        h =
            60 *
            (
                (
                    (g - b) /
                    d
                ) % 6
            );
    } else if (
        max === g
    ) {
        h =
            60 *
            (
                (
                    (b - r) /
                    d
                ) + 2
            );
    } else {
        h =
            60 *
            (
                (
                    (r - g) /
                    d
                ) + 4
            );
    }

    if (
        h < 0
    ) {
        h += 360;
    }

    return h;
}

function updatePlayerColor(
    id,
    color
) {
    id =
        String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    if (!color) {
        color =
            "#8800ff";
    }

    player.color =
        color;

    if (
        !player.element
    ) {
        return;
    }

    if (
        player.character ===
        "square"
    ) {
        player.element.style.background =
            color;

        return;
    }

    var hue =
        getHue(
            color
        );

    var adjustment =
        hue - 270;

    var images =
        player.element.getElementsByTagName(
            "img"
        );

    var image =
        images.length
            ? images[0]
            : null;

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
            adjustment +
            "deg"
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
    id =
        String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    if (
        character !== "square" &&
        character !== "bonzi"
    ) {
        character =
            "bonzi";
    }

    if (
        player.character ===
        character
    ) {
        return;
    }

    player.character =
        character;

    var oldElement =
        player.element;

    if (!oldElement) {
        return;
    }

    var newElement =
        document.createElement(
            "div"
        );

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


    /*
    Name.
    */
    var name =
        document.createElement(
            "div"
        );

    name.className =
        "playerName";

    name.innerHTML =
        escapeHTML(
            player.name
        );

    newElement.appendChild(
        name
    );


    /*
    Bonzi.
    */
    if (
        character === "bonzi"
    ) {
        var image =
            document.createElement(
                "img"
            );

        image.className =
            "bonziCharacter";

        image.src =
            "/bonzi.png";

        image.alt = "";

        image.setAttribute(
            "draggable",
            "false"
        );

        image.ondragstart =
            function() {
                return false;
            };

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

function getPointerPosition(e) {
    e =
        e ||
        window.event;

    var pointX = 0;
    var pointY = 0;

    if (
        e.touches &&
        e.touches.length
    ) {
        pointX =
            e.touches[0].clientX;

        pointY =
            e.touches[0].clientY;
    } else if (
        e.changedTouches &&
        e.changedTouches.length
    ) {
        pointX =
            e.changedTouches[0].clientX;

        pointY =
            e.changedTouches[0].clientY;
    } else {
        pointX =
            e.clientX;

        pointY =
            e.clientY;
    }

    return {
        x: pointX,
        y: pointY
    };
}

function startDrag(
    e,
    player
) {
    e =
        e ||
        window.event;

    if (
        !player ||
        !player.element
    ) {
        return;
    }

    var point =
        getPointerPosition(e);

    var rect =
        world.getBoundingClientRect();

    var width =
        rect.right -
        rect.left;

    var height =
        rect.bottom -
        rect.top;

    if (
        width <= 0 ||
        height <= 0
    ) {
        return;
    }

    dragging = {
        player: player,

        offsetX:
            point.x -
            (
                rect.left +
                (
                    player.x /
                    100
                ) *
                width
            ),

        offsetY:
            point.y -
            (
                rect.top +
                (
                    player.y /
                    100
                ) *
                height
            )
    };

    stopEvent(e);
}

function dragMove(e) {
    if (
        !dragging
    ) {
        return;
    }

    e =
        e ||
        window.event;

    var point =
        getPointerPosition(e);

    var rect =
        world.getBoundingClientRect();

    var width =
        rect.right -
        rect.left;

    var height =
        rect.bottom -
        rect.top;

    if (
        width <= 0 ||
        height <= 0
    ) {
        return;
    }

    var x =
        (
            (
                point.x -
                dragging.offsetX -
                rect.left
            ) /
            width
        ) *
        100;

    var y =
        (
            (
                point.y -
                dragging.offsetY -
                rect.top
            ) /
            height
        ) *
        100;

    if (
        x < 2
    ) {
        x = 2;
    }

    if (
        x > 98
    ) {
        x = 98;
    }

    if (
        y < 2
    ) {
        y = 2;
    }

    if (
        y > 98
    ) {
        y = 98;
    }

    updatePlayerPosition(
        dragging.player,
        x,
        y
    );

    /*
    Queue the newest position instead of
    creating a request for every movement.
    */
    queuePlayerMove(
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

    /*
    Send the final position immediately.
    */
    if (
        dragging.player
    ) {
        queuePlayerMove(
            dragging.player.id,
            dragging.player.x,
            dragging.player.y,
            true
        );
    }

    dragging =
        null;

    if (e) {
        stopEvent(e);
    }
}


/*
============================================================
THROTTLED MOVEMENT
============================================================
*/

function queuePlayerMove(
    playerId,
    x,
    y,
    immediate
) {
    if (!myId) {
        return;
    }

    movePending = {
        playerId:
            String(playerId),

        x: x,
        y: y
    };

    if (
        immediate
    ) {
        sendQueuedMove();

        return;
    }

    if (
        moveTimer ||
        moveRequestActive
    ) {
        return;
    }

    moveTimer =
        setTimeout(
            function() {
                moveTimer = null;
                sendQueuedMove();
            },
            60
        );
}

function sendQueuedMove() {
    if (
        !myId ||
        !movePending ||
        moveRequestActive
    ) {
        return;
    }

    var move =
        movePending;

    movePending =
        null;

    moveRequestActive =
        true;

    ajax(
        "POST",
        "/api/move",
        encodeForm({
            senderId:
                myId,

            playerId:
                move.playerId,

            x:
                move.x,

            y:
                move.y
        }),
        function() {

            moveRequestActive =
                false;

            /*
            If another position was generated
            while this request was running,
            send the newest one.
            */
            if (
                movePending
            ) {
                sendQueuedMove();
            }
        }
    );
}


/*
============================================================
REMOVE PLAYER
============================================================
*/

function removePlayer(id) {
    id =
        String(id);

    var player =
        players[id];

    if (!player) {
        return;
    }

    if (
        player.bubbleTimer
    ) {
        clearTimeout(
            player.bubbleTimer
        );

        player.bubbleTimer =
            null;
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

    /*
    If the player being removed is currently being dragged,
    cancel the drag.
    */
    if (
        dragging &&
        dragging.player &&
        dragging.player.id === id
    ) {
        dragging =
            null;
    }
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
    id =
        String(id);

    var player =
        players[id];

    if (
        !player ||
        !player.element
    ) {
        return;
    }

    var oldBubbles =
        player.element.getElementsByClassName
            ? player.element.getElementsByClassName(
                "speechBubble"
            )
            : [];

    var i;

    for (
        i = oldBubbles.length - 1;
        i >= 0;
        i--
    ) {
        if (
            oldBubbles[i].parentNode
        ) {
            oldBubbles[i].parentNode.removeChild(
                oldBubbles[i]
            );
        }
    }

    if (
        player.bubbleTimer
    ) {
        clearTimeout(
            player.bubbleTimer
        );

        player.bubbleTimer =
            null;
    }

    var bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "speechBubble";

    bubble.innerHTML =
        escapeHTML(text);

    player.element.appendChild(
        bubble
    );

    player.bubbleTimer =
        setTimeout(
            function() {

                if (
                    bubble &&
                    bubble.parentNode
                ) {
                    bubble.parentNode.removeChild(
                        bubble
                    );
                }

                player.bubbleTimer =
                    null;
            },
            5000
        );
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

    if (
        text.charAt(0) === "/"
    ) {
        return;
    }

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
    } catch (e) {}
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

    var old =
        document.getElementById(
            "systemMessage"
        );

    if (
        old &&
        old.parentNode
    ) {
        old.parentNode.removeChild(
            old
        );
    }

    var message =
        document.createElement(
            "div"
        );

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

    message.style.marginLeft =
        "-100px";

    message.style.background =
        "#ffffcc";

    message.style.color =
        "#000000";

    message.style.border =
        "1px solid #000000";

    message.style.padding =
        "5px 10px";

    message.style.zIndex =
        "9999";

    document.body.appendChild(
        message
    );

    setTimeout(
        function() {
            if (
                message &&
                message.parentNode
            ) {
                message.parentNode.removeChild(
                    message
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
    if (!myId) {
        return;
    }

    var text =
        messageInput.value;

    text =
        text.replace(
            /^\s+|\s+$/g,
            ""
        );

    if (!text) {
        return;
    }

    messageInput.value =
        "";

    ajax(
        "POST",
        "/api/send",
        encodeForm({
            id:
                myId,

            text:
                text
        }),
        function(
            status
        ) {

            if (
                status !== 200
            ) {
                /*
                Only restore the text if the
                request actually failed.
                */
                if (
                    !messageInput.value
                ) {
                    messageInput.value =
                        text;
                }

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
HEARTBEAT
============================================================
*/

function startHeartbeat() {
    stopHeartbeat();

    heartbeatTimer =
        setInterval(
            function() {

                if (!myId) {
                    return;
                }

                ajax(
                    "GET",
                    "/api/heartbeat?id=" +
                    encodeURIComponent(
                        myId
                    ),
                    null,
                    function(
                        status
                    ) {

                        if (
                            status === 404
                        ) {
                            polling =
                                false;

                            stopHeartbeat();

                            showSystemMessage(
                                "Disconnected from server."
                            );
                        }
                    }
                );
            },
            15000
        );
}

function stopHeartbeat() {
    if (
        heartbeatTimer
    ) {
        clearInterval(
            heartbeatTimer
        );

        heartbeatTimer =
            null;
    }
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

    var leavingId =
        myId;

    myId =
        null;

    polling =
        false;

    pollInProgress =
        false;

    stopHeartbeat();

    if (
        pollTimer
    ) {
        clearTimeout(
            pollTimer
        );

        pollTimer =
            null;
    }

    if (
        moveTimer
    ) {
        clearTimeout(
            moveTimer
        );

        moveTimer =
            null;
    }

    movePending =
        null;

    /*
    Best-effort leave request.
    The server's poll/heartbeat cleanup is
    the actual fallback.
    */
    try {
        ajax(
            "POST",
            "/api/leave",
            encodeForm({
                id:
                    leavingId
            }),
            function() {}
        );
    } catch (e) {}
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

            e =
                e ||
                window.event;

            if (
                e.keyCode === 13
            ) {
                stopEvent(e);
                joinRoom();
            }
        }
    );


    addEvent(
        roomInput,
        "keypress",
        function(e) {

            e =
                e ||
                window.event;

            if (
                e.keyCode === 13
            ) {
                stopEvent(e);
                joinRoom();
            }
        }
    );


    /*
    Start.
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
    Message Enter.
    */
    addEvent(
        messageInput,
        "keypress",
        function(e) {

            e =
                e ||
                window.event;

            if (
                e.keyCode === 13
            ) {
                stopEvent(e);
                sendMessage();
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


    try {
        nameInput.focus();
    } catch (e) {}
}


/*
============================================================
BROWSER CLOSE
============================================================
*/

addEvent(
    window,
    "beforeunload",
    function() {
        /*
        This is intentionally only best-effort.
        Mobile browsers are allowed to kill the page
        before an asynchronous XHR completes.

        The server detects the lost polling connection
        and the heartbeat timeout provides another fallback.
        */
        if (!myId) {
            return;
        }

        try {
            leaveChat();
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
