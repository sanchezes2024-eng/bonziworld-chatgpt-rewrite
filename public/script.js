
const socket = io();


/*
============================================================
ELEMENTS
============================================================
*/

const loginScreen =
    document.getElementById(
        "loginScreen"
    );

const desktop =
    document.getElementById(
        "desktop"
    );

const nameInput =
    document.getElementById(
        "nameInput"
    );

const roomInput =
    document.getElementById(
        "roomInput"
    );

const submitButton =
    document.getElementById(
        "submitButton"
    );

const world =
    document.getElementById(
        "world"
    );

const messageInput =
    document.getElementById(
        "messageInput"
    );

const startButton =
    document.getElementById(
        "startButton"
    );


/*
============================================================
SETTINGS ELEMENTS
============================================================
*/

const settingsButton =
    document.getElementById(
        "settingsButton"
    );

const settingsPanel =
    document.getElementById(
        "settingsPanel"
    );

const closeSettings =
    document.getElementById(
        "closeSettings"
    );

const ttsOptions =
    document.querySelectorAll(
        'input[name="ttsMode"]'
    );


let ttsMode =
    localStorage.getItem(
        "ttsMode"
    ) || "browser";


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


/*
Set saved TTS option.
*/

ttsOptions.forEach(
    (option) => {

        option.checked =
            option.value ===
            ttsMode;


        option.addEventListener(
            "change",
            () => {

                if (
                    !option.checked
                ) {
                    return;
                }


                ttsMode =
                    option.value;


                localStorage.setItem(
                    "ttsMode",
                    ttsMode
                );


                /*
                Stop browser TTS
                when switching away.
                */

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
CREATE PLAYER
============================================================
*/

function colorToHue(color) {

    const colors = {
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


    color = color.toLowerCase();


    if (colors[color] !== undefined) {
        return colors[color];
    }


    return 270;
}


function updatePlayerColor(player, color) {

    player.color = color;


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


    /*
    Only change the background
    when using the old square.
    */

    if (
        player.character === "square"
    ) {

        player.element.style.backgroundColor =
            color;
    }
}

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
        document.createElement(
            "div"
        );


    element.className =
        "player";


    element.dataset.id =
        data.id;


    /*
    Player name.
    */

    const nameLabel =
        document.createElement(
            "div"
        );


    nameLabel.className =
        "playerName";


    nameLabel.textContent =
        data.name;


    element.appendChild(
        nameLabel
    );


    /*
    Position.
    */

    element.style.left =
        `${data.x}%`;

    element.style.top =
        `${data.y}%`;


    /*
    Color.
    */

    element.style.backgroundColor =
        data.color ||
        "#8000ff";

    /*
    ========================================================
    CHARACTER
    ========================================================
    */

    if (data.character === "bonzi") {

        const image =
            document.createElement("img");

        image.src =
            "/bonzi.png";

        image.className =
            "bonziCharacter";

        element.appendChild(
            image
        );

    } else {

        element.classList.add(
            "squareCharacter"
        );
    }


    world.appendChild(
        element
    );


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
            data.color,

        character: data.character || "bonzi",

        element:
            element
    };


    players[data.id] =
        player;


    /*
    Only YOUR player can be dragged.
    */

    if (
        data.id === myId
    ) {

        setupDragging(
            player
        );
    }


    return player;
}


/*
============================================================
DRAGGING
============================================================
*/

function setupDragging(player) {
    let dragging = false;

    player.element.style.cursor = "grab";
    player.element.style.touchAction = "none";
    player.element.style.userSelect = "none";

    player.element.addEventListener("pointerdown", (event) => {
        // Only allow YOUR player to be dragged.
        if (player.id !== myId) {
            return;
        }

        dragging = true;

        player.element.style.cursor = "grabbing";

        try {
            player.element.setPointerCapture(event.pointerId);
        } catch (error) {
            console.log("Pointer capture unavailable.");
        }

        event.preventDefault();
        event.stopPropagation();
    });

    player.element.addEventListener("pointermove", (event) => {
        if (!dragging) {
            return;
        }

        const rect = world.getBoundingClientRect();

        // Convert mouse position to percentage of the world.
        let x =
            ((event.clientX - rect.left) / rect.width) * 100;

        let y =
            ((event.clientY - rect.top) / rect.height) * 100;

        // Keep the character inside the world.
        x = Math.max(2, Math.min(98, x));
        y = Math.max(2, Math.min(95, y));

        player.x = x;
        player.y = y;

        player.element.style.left = `${x}%`;
        player.element.style.top = `${y}%`;

        // Synchronize with everyone else.
        socket.emit("move", {
            x: x,
            y: y
        });

        event.preventDefault();
    });

    function stopDragging(event) {
        if (!dragging) {
            return;
        }

        dragging = false;

        player.element.style.cursor = "grab";

        try {
            player.element.releasePointerCapture(
                event.pointerId
            );
        } catch (error) {
            // Pointer capture may already be released.
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
            dragging = false;
            player.element.style.cursor = "grab";
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


        /*
        Hide login.
        */

        loginScreen.style.display =
            "none";


        /*
        Show desktop.
        */

        desktop.style.display =
            "block";


        /*
        Create ourselves.
        */

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

    /*
    Remove previous bubble.
    */

    const oldBubble =
        player.element.querySelector(
            ".speechBubble"
        );


    if (oldBubble) {
        oldBubble.remove();
    }


    /*
    Create bubble.
    */

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

            console.error(
                "Browser TTS is unavailable."
            );

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
            (error) => {

                console.error(
                    "Browser TTS error:",
                    error
                );


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

            console.error(
                "speak.js is not loaded."
            );


            /*
            Keep the bubble briefly
            if eSpeak is unavailable.
            */

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


        /*
        Clear old eSpeak audio.
        */

        const audioContainer =
            document.getElementById(
                "audio"
            );


        if (audioContainer) {

            audioContainer.innerHTML =
                "";
        }


        /*
        Start eSpeak.
        */

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


        /*
        Wait for speak.js to
        create its audio element.
        */

        let attempts = 0;


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


                    /*
                    Stop looking after 10 seconds.
                    */

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


        return;
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

        /*
        Enter also sends.
        */

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

