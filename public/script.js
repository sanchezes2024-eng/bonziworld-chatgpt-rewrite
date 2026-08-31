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

const ttsOptions = document.querySelectorAll(
    'input[name="ttsMode"]'
);

let ttsMode =
    localStorage.getItem("ttsMode") || "browser";


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
TTS DATA
============================================================
*/

/*
Tracks the currently speaking utterance for YOUR player.

When you send another message, only your previous
speech is cancelled.

Other players' speech is left alone.
*/

let myBrowserUtterance = null;


/*
Each player gets their own eSpeak audio container.

This allows multiple eSpeak messages to play at once.
*/

const ttsAudioPlayers = new Map();


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


                /*
                Only cancel YOUR current browser
                speech when changing modes.
                */

                if (
                    window.speechSynthesis &&
                    myBrowserUtterance
                ) {

                    window.speechSynthesis.cancel();

                    myBrowserUtterance =
                        null;
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
    ========================================================
    CREATE CHARACTER
    ========================================================
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


    /*
    ========================================================
    PUT PLAYER INTO WORLD IMMEDIATELY
    ========================================================
    */

    world.appendChild(
        element
    );


    /*
    SAVE PLAYER
    */

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
    EVERY PLAYER CAN BE DRAGGED
    */

    setupDragging(
        player
    );


    /*
    YOUR PLAYER CLASS
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


    /*
    ========================================================
    BONZI
    ========================================================
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
    ========================================================
    SQUARE
    ========================================================
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


    player.element.style.cursor =
        "grab";


    player.element.style.touchAction =
        "none";


    player.element.style.userSelect =
        "none";


    player.element.addEventListener(
        "pointerdown",
        (event) => {

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


            /*
            Tell server which player is being moved.
            */

            socket.emit(
                "move",
                {
                    playerId:
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


        /*
        Stop any eSpeak audio belonging to
        this player.
        */

        const audio =
            ttsAudioPlayers.get(
                data.id
            );


        if (audio) {

            audio.pause();

            audio.remove();

            ttsAudioPlayers.delete(
                data.id
            );
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
REMOVE SPEECH BUBBLE
============================================================
*/

function removeSpeechBubble(
    player,
    bubble
) {

    if (
        bubble &&
        bubble.parentNode
    ) {

        bubble.remove();
    }
}


/*
============================================================
BROWSER TTS
============================================================
*/

function speakBrowser(
    player,
    text,
    bubble
) {

    if (
        !window.speechSynthesis
    ) {

        setTimeout(
            () => {

                removeSpeechBubble(
                    player,
                    bubble
                );

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


    /*
    ========================================================
    YOUR OWN MESSAGE
    ========================================================

    Only YOUR previous browser TTS gets cancelled.

    */

    if (
        player.id === myId
    ) {

        window.speechSynthesis.cancel();


        myBrowserUtterance =
            utterance;
    }


    /*
    ========================================================
    OTHER PLAYER
    ========================================================

    Do NOT call cancel().

    Their utterance gets added to the browser's
    speech queue instead of interrupting yours.
    */

    utterance.onend =
        () => {

            removeSpeechBubble(
                player,
                bubble
            );


            if (
                player.id === myId &&
                myBrowserUtterance === utterance
            ) {

                myBrowserUtterance =
                    null;
            }
        };


    utterance.onerror =
        () => {

            removeSpeechBubble(
                player,
                bubble
            );


            if (
                player.id === myId &&
                myBrowserUtterance === utterance
            ) {

                myBrowserUtterance =
                    null;
            }
        };


    window.speechSynthesis.speak(
        utterance
    );
}


/*
============================================================
ESPEAK TTS
============================================================
*/

function speakEspeak(
    player,
    text,
    bubble
) {

    if (
        typeof speak !== "function"
    ) {

        setTimeout(
            () => {

                removeSpeechBubble(
                    player,
                    bubble
                );

            },
            5000
        );

        return;
    }


    /*
    IMPORTANT:

    Do NOT use one shared #audio container.

    Every message gets its own container so
    multiple sounds can overlap.
    */

    const audioContainer =
        document.createElement("div");


    audioContainer.className =
        "ttsAudioContainer";


    audioContainer.style.display =
        "none";


    audioContainer.dataset.playerId =
        player.id;


    document.body.appendChild(
        audioContainer
    );


    /*
    Save it so it can be cleaned up later.
    */

    ttsAudioPlayers.set(
        player.id,
        audioContainer
    );


    /*
    Generate speech into this specific container.

    speakClient.js normally looks for #audio,
    so temporarily provide this container
    with that ID.
    */

    const oldAudio =
        document.getElementById(
            "audio"
        );


    if (oldAudio) {
        oldAudio.removeAttribute("id");
    }


    audioContainer.id =
        "audio";


    speak(
        text,
        {
            amplitude: 100,
            pitch: 50,
            speed: 175,
            voice: "en/en-us"
        }
    );


    /*
    Restore the ID situation.

    The generated audio remains inside this
    individual container.
    */

    audioContainer.removeAttribute(
        "id"
    );


    if (oldAudio) {

        oldAudio.id =
            "audio";
    }


    let attempts =
        0;


    const waitForAudio =
        setInterval(
            () => {

                attempts++;


                const audio =
                    audioContainer.querySelector(
                        "audio"
                    );


                if (audio) {

                    clearInterval(
                        waitForAudio
                    );


                    /*
                    Make sure it can overlap.
                    */

                    audio.preload =
                        "auto";


                    /*
                    When this particular speech
                    finishes, remove only its
                    own bubble and audio.
                    */

                    audio.addEventListener(
                        "ended",
                        () => {

                            removeSpeechBubble(
                                player,
                                bubble
                            );


                            audioContainer.remove();


                            if (
                                ttsAudioPlayers.get(
                                    player.id
                                ) ===
                                audioContainer
                            ) {

                                ttsAudioPlayers.delete(
                                    player.id
                                );
                            }

                        },
                        {
                            once: true
                        }
                    );


                    audio.addEventListener(
                        "error",
                        () => {

                            removeSpeechBubble(
                                player,
                                bubble
                            );


                            audioContainer.remove();


                            if (
                                ttsAudioPlayers.get(
                                    player.id
                                ) ===
                                audioContainer
                            ) {

                                ttsAudioPlayers.delete(
                                    player.id
                                );
                            }

                        },
                        {
                            once: true
                        }
                    );


                    return;
                }


                /*
                Timeout if speakClient failed.
                */

                if (
                    attempts >= 200
                ) {

                    clearInterval(
                        waitForAudio
                    );


                    removeSpeechBubble(
                        player,
                        bubble
                    );


                    audioContainer.remove();


                    if (
                        ttsAudioPlayers.get(
                            player.id
                        ) ===
                        audioContainer
                    ) {

                        ttsAudioPlayers.delete(
                            player.id
                        );
                    }
                }

            },
            50
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

    /*
    Remove this player's previous bubble.

    This does NOT affect other players.
    */

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
    BROWSER TTS
    ========================================================
    */

    if (
        ttsMode === "browser"
    ) {

        speakBrowser(
            player,
            text,
            bubble
        );


        return;
    }


    /*
    ========================================================
    ESPEAK
    ========================================================
    */

    if (
        ttsMode === "espeak"
    ) {

        speakEspeak(
            player,
            text,
            bubble
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


    /*
    ========================================================
    IMPORTANT:
    YOUR NEW MESSAGE SHOULD INTERRUPT YOUR
    CURRENT SPEECH.
    ========================================================

    We do this locally immediately rather than
    waiting for the server to echo the message.
    */

    if (
        ttsMode === "browser" &&
        window.speechSynthesis
    ) {

        window.speechSynthesis.cancel();

        myBrowserUtterance =
            null;
    }


    /*
    eSpeak audio for YOUR previous message
    should also stop when YOU send again.
    */

    if (
        ttsMode === "espeak" &&
        myId
    ) {

        const ownAudio =
            ttsAudioPlayers.get(
                myId
            );


        if (ownAudio) {

            const audio =
                ownAudio.querySelector(
                    "audio"
                );


            if (audio) {
                audio.pause();
            }


            ownAudio.remove();


            ttsAudioPlayers.delete(
                myId
            );
        }
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
