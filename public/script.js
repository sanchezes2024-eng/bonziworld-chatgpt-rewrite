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

const nameInput =
    document.getElementById("nameInput");

const roomInput =
    document.getElementById("roomInput");

const submitButton =
    document.getElementById("submitButton");

const world =
    document.getElementById("world");

const messageInput =
    document.getElementById("messageInput");

const startButton =
    document.getElementById("startButton");


/*
============================================================
SETTINGS
============================================================
*/

const settingsButton =
    document.getElementById("settingsButton");

const settingsPanel =
    document.getElementById("settingsPanel");

const closeSettings =
    document.getElementById("closeSettings");

const ttsOptions =
    document.querySelectorAll(
        'input[name="ttsMode"]'
    );


let ttsMode =
    localStorage.getItem("ttsMode") ||
    "browser";


/*
============================================================
PLAYER DATA
============================================================
*/

const players = {};

let myId = null;

let myName = "";

let currentRoom = "default";


/*
============================================================
DEFAULT ROOM
============================================================
*/

if (roomInput) {
    roomInput.value = "default";
}


/*
============================================================
SETTINGS BUTTON
============================================================
*/

if (settingsButton) {

    settingsButton.addEventListener(
        "click",
        () => {

            if (
                settingsPanel.style.display ===
                "block"
            ) {

                settingsPanel.style.display =
                    "none";

            } else {

                settingsPanel.style.display =
                    "block";
            }
        }
    );
}


if (closeSettings) {

    closeSettings.addEventListener(
        "click",
        () => {

            settingsPanel.style.display =
                "none";
        }
    );
}


ttsOptions.forEach(
    (option) => {

        option.checked =
            option.value ===
            ttsMode;


        option.addEventListener(
            "change",
            () => {

                if (!option.checked) {
                    return;
                }


                ttsMode =
                    option.value;


                localStorage.setItem(
                    "ttsMode",
                    ttsMode
                );


                if (
                    window.speechSynthesis
                ) {

                    window.speechSynthesis.cancel();
                }
            }
        );
    }
);


/*
============================================================
COLOR → HUE
============================================================
*/

/*
Bonzi.png is assumed to be purple,
approximately hue 270 degrees.
*/

function colorToHue(color) {

    const namedColors = {

        red: 0,
        orange: 30,
        yellow: 60,
        green: 120,
        cyan: 180,
        blue: 240,
        purple: 270,
        magenta: 300,
        pink: 330,
        lime: 90,
        aqua: 180,
        teal: 180,
        navy: 240,
        white: 0,
        black: 0,
        gray: 0,
        grey: 0,
        silver: 0

    };


    color =
        String(color)
            .toLowerCase();


    /*
    Named color.
    */

    if (
        namedColors[color] !==
        undefined
    ) {

        return namedColors[color];
    }


    /*
    Hex color.
    */

    if (
        /^#[0-9a-f]{6}$/i.test(color)
    ) {

        const r =
            parseInt(
                color.substring(1, 3),
                16
            ) / 255;

        const g =
            parseInt(
                color.substring(3, 5),
                16
            ) / 255;

        const b =
            parseInt(
                color.substring(5, 7),
                16
            ) / 255;


        const max =
            Math.max(r, g, b);

        const min =
            Math.min(r, g, b);

        const difference =
            max - min;


        if (difference === 0) {
            return 270;
        }


        let hue;


        if (max === r) {

            hue =
                60 *
                (
                    ((g - b) / difference) %
                    6
                );

        } else if (max === g) {

            hue =
                60 *
                (
                    ((b - r) / difference) +
                    2
                );

        } else {

            hue =
                60 *
                (
                    ((r - g) / difference) +
                    4
                );
        }


        if (hue < 0) {
            hue += 360;
        }


        return hue;
    }


    return 270;
}


/*
============================================================
UPDATE PLAYER COLOR
============================================================
*/

function updatePlayerColor(
    player,
    color
) {

    player.color =
        color;


    const bonzi =
        player.element.querySelector(
            ".bonziCharacter"
        );


    /*
    Bonzi uses hue rotation.
    */

    if (bonzi) {

        const hue =
            colorToHue(color);


        /*
        Original Bonzi is purple (~270).
        */

        bonzi.style.setProperty(
            "--bonzi-hue",
            `${hue - 270}deg`
        );
    }


    /*
    Square uses normal background color.
    */

    if (
        player.character ===
        "square"
    ) {

        player.element.style.backgroundColor =
            color;
    }
}


/*
============================================================
CREATE BONZI IMAGE
============================================================
*/

function createBonziImage(
    player,
    color
) {

    const image =
        document.createElement("img");


    image.src =
        "/bonzi.png";


    image.className =
        "bonziCharacter";


    image.draggable =
        false;


    image.alt =
        "";


    const hue =
        colorToHue(color);


    image.style.setProperty(
        "--bonzi-hue",
        `${hue - 270}deg`
    );


    return image;
}


/*
============================================================
CREATE PLAYER
============================================================
*/

function createPlayer(data) {

    /*
    Don't create duplicates.
    */

    if (
        players[data.id]
    ) {

        return players[data.id];
    }


    const element =
        document.createElement("div");


    element.className =
        "player";


    element.dataset.id =
        data.id;


    /*
    IMPORTANT:
    Add myPlayer to YOUR player.
    This fixes the hand cursor and dragging.
    */

    if (
        data.id === myId
    ) {

        element.classList.add(
            "myPlayer"
        );
    }


    /*
    Player data.
    */

    const player = {

        id:
            data.id,

        name:
            data.name,

        x:
            Number(data.x),

        y:
            Number(data.y),

        color:
            data.color ||
            "#8000ff",

        character:
            data.character ||
            "bonzi",

        element:
            element
    };


    /*
    Position.
    */

    element.style.left =
        `${player.x}%`;

    element.style.top =
        `${player.y}%`;


    /*
    Player name.
    */

    const nameLabel =
        document.createElement("div");


    nameLabel.className =
        "playerName";


    nameLabel.textContent =
        player.name;


    element.appendChild(
        nameLabel
    );


    /*
    Character.
    */

    if (
        player.character ===
        "bonzi"
    ) {

        const image =
            createBonziImage(
                player,
                player.color
            );


        element.appendChild(
            image
        );

    } else {

        element.classList.add(
            "squareCharacter"
        );


        element.style.backgroundColor =
            player.color;
    }


    world.appendChild(
        element
    );


    players[player.id] =
        player;


    /*
    Only YOUR player gets dragging.
    */

    if (
        player.id === myId
    ) {

        setupDragging(
            player
        );
    }


    return player;
}


/*
============================================================
UPDATE PLAYER CHARACTER
============================================================
*/

function updatePlayerCharacter(
    player,
    character
) {

    if (!player) {
        return;
    }


    player.character =
        character;


    /*
    Remove existing Bonzi image.
    */

    const oldBonzi =
        player.element.querySelector(
            ".bonziCharacter"
        );


    if (oldBonzi) {
        oldBonzi.remove();
    }


    /*
    Remove square styling.
    */

    player.element.classList.remove(
        "squareCharacter"
    );


    /*
    BONZI
    */

    if (
        character ===
        "bonzi"
    ) {

        player.element.style.backgroundColor =
            "transparent";


        const image =
            createBonziImage(
                player,
                player.color
            );


        player.element.appendChild(
            image
        );


        /*
        Make sure Bonzi doesn't interfere
        with dragging.
        */

        image.draggable =
            false;


        return;
    }


    /*
    SQUARE
    */

    if (
        character ===
        "square"
    ) {

        player.element.classList.add(
            "squareCharacter"
        );


        player.element.style.backgroundColor =
            player.color;
    }
}


/*
============================================================
DRAGGING
============================================================
*/

function setupDragging(player) {

    let dragging =
        false;


    /*
    Make the cursor a hand.
    */

    player.element.style.cursor =
        "grab";


    player.element.style.touchAction =
        "none";


    player.element.style.userSelect =
        "none";


    player.element.addEventListener(
        "pointerdown",
        (event) => {

            /*
            Absolutely prevent dragging
            another player.
            */

            if (
                player.id !== myId
            ) {

                return;
            }


            dragging =
                true;


            player.element.style.cursor =
                "grabbing";


            try {

                player.element.setPointerCapture(
                    event.pointerId
                );

            } catch (error) {

                console.log(
                    "Pointer capture unavailable."
                );
            }


            event.preventDefault();
            event.stopPropagation();
        }
    );


    player.element.addEventListener(
        "pointermove",
        (event) => {

            if (!dragging) {
                return;
            }


            const rect =
                world.getBoundingClientRect();


            let x =
                (
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width
                ) * 100;


            let y =
                (
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height
                ) * 100;


            x =
                Math.max(
                    2,
                    Math.min(98, x)
                );


            y =
                Math.max(
                    2,
                    Math.min(95, y)
                );


            player.x =
                x;

            player.y =
                y;


            player.element.style.left =
                `${x}%`;

            player.element.style.top =
                `${y}%`;


            socket.emit(
                "move",
                {
                    x:
                        x,

                    y:
                        y
                }
            );


            event.preventDefault();
        }
    );


    function stopDragging(event) {

        if (!dragging) {
            return;
        }


        dragging =
            false;


        player.element.style.cursor =
            "grab";


        try {

            player.element.releasePointerCapture(
                event.pointerId
            );

        } catch (error) {
            // Already released.
        }
    }


    player.element.addEventListener(
        "pointerup",
        stopDragging
    );


    player.element.addEventListener(
        "pointercancel",
        stopDragging
    );


    player.element.addEventListener(
        "lostpointercapture",
        () => {

            dragging =
                false;


            player.element.style.cursor =
                "grab";
        }
    );
}


/*
============================================================
LOGIN
============================================================
*/

function joinRoom() {

    let name =
        nameInput.value.trim();


    let room =
        roomInput.value.trim();


    if (!name) {
        name = "Anonymous";
    }


    if (!room) {
        room = "default";
    }


    myName =
        name;


    currentRoom =
        room;


    socket.emit(
        "joinRoom",
        {
            name:
                name,

            room:
                room
        }
    );
}


submitButton.addEventListener(
    "click",
    joinRoom
);


nameInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Enter"
        ) {

            joinRoom();
        }
    }
);


roomInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Enter"
        ) {

            joinRoom();
        }
    }
);


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


        loginScreen.style.display =
            "none";


        desktop.style.display =
            "block";


        createPlayer(
            data
        );
    }
);


/*
============================================================
PLAYER JOINED
============================================================
*/

socket.on(
    "playerJoined",
    (data) => {

        createPlayer(
            data
        );
    }
);


/*
============================================================
PLAYER MOVED
============================================================
*/

socket.on(
    "playerMoved",
    (data) => {

        const player =
            players[data.id];


        if (!player) {
            return;
        }


        player.x =
            data.x;

        player.y =
            data.y;


        player.element.style.left =
            `${data.x}%`;

        player.element.style.top =
            `${data.y}%`;
    }
);


/*
============================================================
PLAYER COLOR CHANGED
============================================================
*/

socket.on(
    "playerColorChanged",
    (data) => {

        const player =
            players[data.id];


        if (!player) {
            return;
        }


        updatePlayerColor(
            player,
            data.color
        );
    }
);


/*
============================================================
PLAYER CHARACTER CHANGED
============================================================
*/

socket.on(
    "playerCharacterChanged",
    (data) => {

        const player =
            players[data.id];


        if (!player) {
            return;
        }


        updatePlayerCharacter(
            player,
            data.character
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


        delete players[data.id];
    }
);


/*
============================================================
CHAT MESSAGE
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
SYSTEM MESSAGE
============================================================
*/

socket.on(
    "systemMessage",
    (data) => {

        console.log(
            "System:",
            data.text
        );
    }
);


/*
============================================================
SPEECH BUBBLE
============================================================
*/

function showSpeechBubble(
    player,
    text
) {

    const oldBubble =
        player.element.querySelector(
            ".speechBubble"
        );


    if (oldBubble) {
        oldBubble.remove();
    }


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "speechBubble";


    bubble.textContent =
        text;


    player.element.appendChild(
        bubble
    );


    /*
    ========================================================
    BROWSER TTS
    ========================================================
    */

    if (
        ttsMode ===
        "browser"
    ) {

        if (
            !window.speechSynthesis
        ) {

            setTimeout(
                () => {

                    if (
                        bubble.parentNode
                    ) {

                        bubble.remove();
                    }

                },
                5000
            );

            return;
        }


        const utterance =
            new SpeechSynthesisUtterance(
                text
            );


        utterance.rate =
            1;

        utterance.pitch =
            1;

        utterance.volume =
            1;


        utterance.onend =
            () => {

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }
            };


        utterance.onerror =
            () => {

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }
            };


        window.speechSynthesis.cancel();


        window.speechSynthesis.speak(
            utterance
        );


        return;
    }


    /*
    ========================================================
    ESPEAK
    ========================================================
    */

    if (
        ttsMode ===
        "espeak"
    ) {

        if (
            typeof speak !==
            "function"
        ) {

            setTimeout(
                () => {

                    if (
                        bubble.parentNode
                    ) {

                        bubble.remove();
                    }

                },
                5000
            );

            return;
        }


        const audioContainer =
            document.getElementById(
                "audio"
            );


        if (audioContainer) {

            audioContainer.innerHTML =
                "";
        }


        speak(
            text,
            {
                amplitude:
                    100,

                pitch:
                    50,

                speed:
                    175,

                voice:
                    "en/en-us"
            }
        );


        let attempts =
            0;


        const waitForAudio =
            setInterval(
                () => {

                    attempts++;


                    const audio =
                        document.querySelector(
                            "#audio audio"
                        );


                    if (audio) {

                        clearInterval(
                            waitForAudio
                        );


                        audio.addEventListener(
                            "ended",
                            () => {

                                if (
                                    bubble.parentNode
                                ) {

                                    bubble.remove();
                                }
                            },
                            {
                                once:
                                    true
                            }
                        );


                        audio.addEventListener(
                            "error",
                            () => {

                                if (
                                    bubble.parentNode
                                ) {

                                    bubble.remove();
                                }
                            },
                            {
                                once:
                                    true
                            }
                        );


                        return;
                    }


                    if (
                        attempts >=
                        200
                    ) {

                        clearInterval(
                            waitForAudio
                        );


                        if (
                            bubble.parentNode
                        ) {

                            bubble.remove();
                        }
                    }

                },
                50
            );
    }
}


/*
============================================================
SEND MESSAGE
============================================================
*/

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
START BUTTON = SEND
============================================================
*/

startButton.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


/*
============================================================
FOCUS MESSAGE INPUT
============================================================
*/

messageInput.addEventListener(
    "focus",
    () => {

        messageInput.select();
    }
);
