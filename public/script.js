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


/*
============================================================
TTS
============================================================
*/

let ttsMode =
    localStorage.getItem("ttsMode") ||
    "browser";


ttsOptions.forEach(
    (option) => {

        option.checked =
            option.value === ttsMode;


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
PLAYER DATA
============================================================
*/

const players = {};

let myId = null;

let myName = "";

let currentRoom = "default";

let currentlyDraggingPlayer = null;

/*
============================================================
DEFAULT ROOM
============================================================
*/

if (roomInput) {

    roomInput.value =
        "default";
}


/*
============================================================
SETTINGS
============================================================
*/

if (settingsButton) {

    settingsButton.addEventListener(
        "click",
        () => {

            settingsPanel.style.display =
                settingsPanel.style.display === "block"
                    ? "none"
                    : "block";
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


/*
============================================================
COLOR → HUE
============================================================
*/

function colorToHue(color) {

    if (!color) {
        return 270;
    }


    const colors = {

        red: 0,
        orange: 30,
        yellow: 60,
        green: 120,
        cyan: 180,
        blue: 240,
        purple: 270,
        magenta: 300,
        pink: 330,

        black: 270,
        gray: 270,
        grey: 270,
        lime: 90,
        aqua: 180,
        navy: 240,
        teal: 180,
        silver: 270,
        white: 270

    };


    color =
        color.toLowerCase();


    if (
        colors[color] !== undefined
    ) {

        return colors[color];
    }


    /*
    Handle hex colors.
    */

    if (
        /^#[0-9a-f]{6}$/i.test(color)
    ) {

        const r =
            parseInt(
                color.substring(1, 3),
                16
            );

        const g =
            parseInt(
                color.substring(3, 5),
                16
            );

        const b =
            parseInt(
                color.substring(5, 7),
                16
            );


        const max =
            Math.max(r, g, b);

        const min =
            Math.min(r, g, b);


        if (max === min) {
            return 270;
        }


        let hue;


        if (max === r) {

            hue =
                60 * (
                    (g - b) /
                    (max - min)
                );

        } else if (max === g) {

            hue =
                60 * (
                    2 +
                    (b - r) /
                    (max - min)
                );

        } else {

            hue =
                60 * (
                    4 +
                    (r - g) /
                    (max - min)
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


    if (bonzi) {

        const hue =
            colorToHue(color);


        bonzi.style.setProperty(
            "--bonzi-hue",
            `${hue - 270}deg`
        );
    }


    if (
        player.character === "square"
    ) {

        player.element.style.backgroundColor =
            color;
    }
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
    NAME
    */

    const nameLabel =
        document.createElement("div");


    nameLabel.className =
        "playerName";


    nameLabel.textContent =
        data.name;


    element.appendChild(
        nameLabel
    );


    /*
    POSITION
    */

    element.style.left =
        `${data.x}%`;

    element.style.top =
        `${data.y}%`;


    /*
    PLAYER DATA
    */

    const player = {

        id:
            data.id,

        name:
            data.name,

        x:
            data.x,

        y:
            data.y,

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
    CHARACTER
    */

    if (
        player.character === "bonzi"
    ) {

        element.classList.add(
            "bonziPlayer"
        );


        const image =
            document.createElement("img");


        image.src =
            "/bonzi.png";


        image.className =
            "bonziCharacter";


        image.draggable =
            false;


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


    players[data.id] =
        player;


    /*
    APPLY COLOR
    */

    updatePlayerColor(
        player,
        player.color
    );


    /*
    DRAGGING
    */

    setupDragging(
        player
    );


    return player;
}


/*
============================================================
CHANGE PLAYER CHARACTER
============================================================
*/

function updatePlayerCharacter(
    player,
    character
) {

    player.character =
        character;


    /*
    Remove old Bonzi image.
    */

    const oldBonzi =
        player.element.querySelector(
            ".bonziCharacter"
        );


    if (oldBonzi) {
        oldBonzi.remove();
    }


    /*
    Remove character classes.
    */

    player.element.classList.remove(
        "bonziPlayer",
        "squareCharacter"
    );


    /*
    Clear square background.
    */

    player.element.style.backgroundColor =
        "";


    /*
    BONZI
    */

    if (
        character === "bonzi"
    ) {

        player.element.classList.add(
            "bonziPlayer"
        );


        const image =
            document.createElement("img");


        image.src =
            "/bonzi.png";


        image.className =
            "bonziCharacter";


        image.draggable =
            false;


        player.element.appendChild(
            image
        );


        updatePlayerColor(
            player,
            player.color
        );


        return;
    }


    /*
    SQUARE
    */

    if (
        character === "square"
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


    player.element.addEventListener(
        "pointerdown",
        (event) => {

            dragging =
                true;

            currentlyDraggingPlayer =
                player;

            player.element.style.cursor =
                "grabbing";


            try {

                player.element.setPointerCapture(
                    event.pointerId
                );

            } catch (error) {
                // Ignore.
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
                    Math.min(
                        98,
                        x
                    )
                );


            y =
                Math.max(
                    2,
                    Math.min(
                        95,
                        y
                    )
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
                    id: 
                        player.id,
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


        if (
            currentlyDraggingPlayer === player
        ) {
    
            currentlyDraggingPlayer =
                null;
        }


        try {

            player.element.releasePointerCapture(
                event.pointerId
            );

        } catch (error) {
            // Ignore.
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
            event.key === "Enter"
        ) {

            joinRoom();
        }
    }
);


roomInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter"
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


        /*
        Ignore the server echo for the character
        we are currently dragging.

        It already moved locally.
        */

        if (
            player === currentlyDraggingPlayer
        ) {
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
        document.createElement("div");


    bubble.className =
        "speechBubble";


    bubble.textContent =
        text;


    player.element.appendChild(
        bubble
    );


    /*
    BROWSER TTS
    */

    if (
        ttsMode === "browser"
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
    ESPEAK
    */

    if (
        ttsMode === "espeak"
    ) {

        if (
            typeof speak !== "function"
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
                amplitude: 100,
                pitch: 50,
                speed: 175,
                voice: "en/en-us"
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
                                once: true
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
                                once: true
                            }
                        );


                        return;
                    }


                    if (
                        attempts >= 200
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


startButton.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


messageInput.addEventListener(
    "focus",
    () => {

        messageInput.select();
    }
);
