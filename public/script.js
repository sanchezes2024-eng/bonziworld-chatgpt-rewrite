
const socket = io();

/*
============================================================
ELEMENTS
============================================================
*/

const loginScreen = document.getElementById("loginScreen");
const desktop = document.getElementById("desktop");
const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const submitButton = document.getElementById("submitButton");
const world = document.getElementById("world");
const messageInput = document.getElementById("messageInput");
const startButton = document.getElementById("startButton");

const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");

const players = {};

let myId = null;
let myName = "";
let currentRoom = "default";

/*
============================================================
ESPEAK AUDIO STATE
============================================================

IMPORTANT:

Every message gets its OWN audio element.

There is NO shared playback queue.

Other people's audio is NEVER stopped.

Only your own previous audio is stopped when
you send another message.
============================================================
*/

let myEspeakAudio = null;

const audioGenerator =
    document.getElementById("audio");

const playbackContainer =
    document.createElement("div");

playbackContainer.id =
    "espeakPlaybackContainer";

playbackContainer.style.display =
    "none";

document.body.appendChild(
    playbackContainer
);


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
        pink: 330

    };


    color =
        color.toLowerCase();


    if (
        colors[color] !== undefined
    ) {

        return colors[color];
    }


    const hexColors = {

        "#ff0000": 0,
        "#00ff00": 120,
        "#0000ff": 240,
        "#ffff00": 60,
        "#ff00ff": 300,
        "#00ffff": 180,
        "#ff8800": 30,
        "#8800ff": 270,
        "#00aa88": 168,
        "#ff66aa": 330,
        "#6666ff": 240,
        "#66cc66": 120,
        "#ffffff": 270

    };


    if (
        hexColors[color] !== undefined
    ) {

        return hexColors[color];
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
        player.character ===
        "square"
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
    PLAYER NAME
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
        player.character ===
        "bonzi"
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


    /*
    ADD TO WORLD IMMEDIATELY
    */

    world.appendChild(
        element
    );


    /*
    SAVE
    */

    players[data.id] =
        player;


    /*
    COLOR
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


    /*
    OUR PLAYER
    */

    if (
        data.id === myId
    ) {

        element.classList.add(
            "myPlayer"
        );
    }


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


    const oldBonzi =
        player.element.querySelector(
            ".bonziCharacter"
        );


    if (oldBonzi) {
        oldBonzi.remove();
    }


    player.element.classList.remove(
        "bonziPlayer",
        "squareCharacter"
    );


    player.element.style.backgroundColor =
        "";


    if (
        character ===
        "bonzi"
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

    let dragging = false;


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
            Only YOUR player can move.
            */

            if (
                player.id !== myId
            ) {

                return;
            }


            dragging = true;


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


        dragging = false;


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

            dragging = false;

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
PLAYER COLOR
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
PLAYER CHARACTER
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
    ========================================================
    eSPEAK ONLY
    ========================================================
    */

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


    if (!audioGenerator) {

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
    ========================================================
    GENERATE SPEECH
    ========================================================

    #audio is ONLY a temporary generator.

    We clear it BEFORE generating.

    Once the generated audio exists, it is
    immediately removed from #audio and placed
    into its own permanent playback container.
    */

    audioGenerator.innerHTML =
        "";


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


                const generatedAudio =
                    audioGenerator.querySelector(
                        "audio"
                    );


                if (generatedAudio) {

                    clearInterval(
                        waitForAudio
                    );


                    /*
                    ====================================================
                    DETACH FROM GENERATOR
                    ====================================================
                    */

                    audioGenerator.removeChild(
                        generatedAudio
                    );


                    /*
                    ====================================================
                    CREATE COMPLETELY INDEPENDENT AUDIO
                    ====================================================
                    */

                    const playback =
                        document.createElement(
                            "div"
                        );


                    playback.className =
                        "espeakAudioInstance";


                    playback.style.display =
                        "none";


                    playback.appendChild(
                        generatedAudio
                    );


                    playbackContainer.appendChild(
                        playback
                    );


                    /*
                    ====================================================
                    OWN MESSAGE INTERRUPT
                    ====================================================

                    If this is YOUR message, stop only
                    your previous message.

                    If this belongs to somebody else,
                    DO NOTHING to previous audio.
                    */

                    if (
                        player.id === myId
                    ) {

                        if (
                            myEspeakAudio &&
                            myEspeakAudio !==
                                generatedAudio
                        ) {

                            try {

                                myEspeakAudio.pause();

                                myEspeakAudio.currentTime =
                                    0;

                            } catch (error) {

                                console.log(
                                    "Could not stop previous own TTS:",
                                    error
                                );
                            }
                        }


                        myEspeakAudio =
                            generatedAudio;
                    }


                    /*
                    ====================================================
                    CLEANUP
                    ====================================================
                    */

                    const cleanup =
                        () => {

                            if (
                                bubble.parentNode
                            ) {

                                bubble.remove();
                            }


                            playback.remove();


                            if (
                                player.id === myId &&
                                myEspeakAudio ===
                                    generatedAudio
                            ) {

                                myEspeakAudio =
                                    null;
                            }
                        };


                    generatedAudio.addEventListener(
                        "ended",
                        cleanup,
                        {
                            once: true
                        }
                    );


                    generatedAudio.addEventListener(
                        "error",
                        cleanup,
                        {
                            once: true
                        }
                    );


                    /*
                    ====================================================
                    START PLAYING IMMEDIATELY
                    ====================================================

                    There is deliberately NO queue and NO
                    shared audio element.

                    Therefore:

                    Person A ────────▶
                    Person B ─────▶
                    Person C ───▶

                    All three can play simultaneously.
                    */

                    const playPromise =
                        generatedAudio.play();


                    if (
                        playPromise &&
                        typeof playPromise.catch ===
                            "function"
                    ) {

                        playPromise.catch(
                            (error) => {

                                console.log(
                                    "eSpeak playback error:",
                                    error
                                );

                            }
                        );
                    }


                    return;
                }


                /*
                ====================================================
                GENERATION TIMEOUT
                ====================================================
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

