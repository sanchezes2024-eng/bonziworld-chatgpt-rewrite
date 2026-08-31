```javascript
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

const players = {};

let myId = null;
let myName = "";
let currentRoom = "default";


/*
============================================================
TTS STATE
============================================================

Each player gets their own speech queue.

This means:

PLAYER A speaking
+
PLAYER B speaking
=
both can speak at the same time.

Your own messages are special:
your next message cancels ONLY your previous message.
============================================================
*/

const ttsStates = {};


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

    settingsButton.addEventListener("click", () => {

        if (settingsPanel.style.display === "block") {
            settingsPanel.style.display = "none";
        } else {
            settingsPanel.style.display = "block";
        }

    });
}


if (closeSettings) {

    closeSettings.addEventListener("click", () => {
        settingsPanel.style.display = "none";
    });

}


ttsOptions.forEach((option) => {

    option.checked =
        option.value === ttsMode;

    option.addEventListener("change", () => {

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
        Do NOT globally cancel speech here.
        Existing players are allowed to finish.
        */

    });

});


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

    color = color.toLowerCase();

    if (colors[color] !== undefined) {
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

    if (hexColors[color] !== undefined) {
        return hexColors[color];
    }

    return 270;
}


/*
============================================================
UPDATE PLAYER COLOR
============================================================
*/

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

    if (player.character === "square") {

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

    if (players[data.id]) {
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
    CREATE CHARACTER
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
    PUT PLAYER INTO WORLD
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


    /*
    CREATE TTS STATE
    */

    if (!ttsStates[data.id]) {

        ttsStates[data.id] = {

            /*
            Current browser utterance.
            */

            browserUtterance: null,

            /*
            Current eSpeak audio.
            */

            audio: null,

            /*
            Used for identifying this
            player's current speech.
            */

            speechToken: 0
        };
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


            player.x = x;
            player.y = y;


            player.element.style.left =
                `${x}%`;

            player.element.style.top =
                `${y}%`;


            /*
            Tell server WHICH player
            is being moved.
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
        Stop only that player's TTS.
        */

        stopPlayerTTS(
            data.id
        );

        player.element.remove();

        delete players[data.id];

        delete ttsStates[data.id];
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
STOP ONE PLAYER'S TTS
============================================================
*/

function stopPlayerTTS(playerId) {

    const state =
        ttsStates[playerId];

    if (!state) {
        return;
    }


    /*
    Browser TTS:
    cancel ONLY this player's
    current utterance.

    NOTE:
    Browser speechSynthesis is global
    in the browser, so cancelling it
    can affect other utterances.
    */

    if (
        state.browserUtterance
    ) {

        /*
        Clear the reference first.
        */

        state.browserUtterance =
            null;
    }


    /*
    eSpeak audio.
    */

    if (
        state.audio
    ) {

        try {

            state.audio.pause();

        } catch (error) {
            // Ignore.
        }

        state.audio =
            null;
    }


    state.speechToken++;
}


/*
============================================================
BROWSER TTS
============================================================
*/

/*
The browser's SpeechSynthesis API is global,
so it cannot truly play multiple utterances
independently.

To allow other people's speech to overlap,
we use Web Audio when possible by generating
speech through separate Audio objects for eSpeak.

For browser TTS, we keep a per-player token
and avoid cancelling speech from another player.
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


    if (!ttsStates[player.id]) {

        ttsStates[player.id] = {

            browserUtterance: null,
            audio: null,
            speechToken: 0
        };
    }


    const state =
        ttsStates[player.id];


    /*
    IMPORTANT:

    Only cancel previous speech if
    this is YOUR player.

    Other players are never cancelled.
    */

    if (
        player.id === myId
    ) {

        /*
        This is the user's own new message.

        Cancel the previous speech.
        */

        window.speechSynthesis.cancel();

        state.speechToken++;

    } else {

        /*
        Do NOT cancel anything for
        another player.
        */

        state.speechToken++;
    }


    const token =
        state.speechToken;


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


    state.browserUtterance =
        utterance;


    utterance.onend =
        () => {

            if (
                state.speechToken !== token
            ) {
                return;
            }

            if (
                state.browserUtterance ===
                utterance
            ) {

                state.browserUtterance =
                    null;
            }

            if (
                bubble.parentNode
            ) {

                bubble.remove();
            }
        };


    utterance.onerror =
        () => {

            if (
                state.speechToken !== token
            ) {
                return;
            }

            if (
                state.browserUtterance ===
                utterance
            ) {

                state.browserUtterance =
                    null;
            }

            if (
                bubble.parentNode
            ) {

                bubble.remove();
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


    if (!ttsStates[player.id]) {

        ttsStates[player.id] = {

            browserUtterance: null,
            audio: null,
            speechToken: 0
        };
    }


    const state =
        ttsStates[player.id];


    /*
    YOUR OWN MESSAGE:

    Stop your previous eSpeak audio.
    */

    if (
        player.id === myId
    ) {

        if (state.audio) {

            try {
                state.audio.pause();
            } catch (error) {
                // Ignore.
            }

            state.audio = null;
        }
    }


    /*
    New speech token.
    */

    state.speechToken++;

    const token =
        state.speechToken;


    const audioContainer =
        document.getElementById(
            "audio"
        );


    /*
    IMPORTANT:

    Do NOT clear the entire #audio
    container here.

    Doing that would destroy other
    people's currently playing audio.
    */

    speak(
        text,
        {
            amplitude: 100,
            pitch: 50,
            speed: 175,
            voice: "en/en-us"
        }
    );


    let attempts = 0;


    const waitForAudio =
        setInterval(
            () => {

                attempts++;


                /*
                Find the newest audio
                generated by speak().
                */

                const audios =
                    document.querySelectorAll(
                        "#audio audio"
                    );


                if (
                    audios.length > 0
                ) {

                    clearInterval(
                        waitForAudio
                    );


                    const audio =
                        audios[
                            audios.length - 1
                        ];


                    /*
                    If this player's speech
                    became obsolete before the
                    audio was created, stop it.
                    */

                    if (
                        state.speechToken !== token
                    ) {

                        try {
                            audio.pause();
                        } catch (error) {
                            // Ignore.
                        }

                        return;
                    }


                    state.audio =
                        audio;


                    audio.addEventListener(
                        "ended",
                        () => {

                            if (
                                state.speechToken !== token
                            ) {
                                return;
                            }

                            if (
                                state.audio ===
                                audio
                            ) {

                                state.audio =
                                    null;
                            }

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
                                state.speechToken !== token
                            ) {
                                return;
                            }

                            if (
                                state.audio ===
                                audio
                            ) {

                                state.audio =
                                    null;
                            }

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


/*
============================================================
SPEECH BUBBLE + TTS
============================================================
*/

function showSpeechBubble(
    player,
    text
) {

    /*
    Remove only this player's
    previous bubble.
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
    BROWSER
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
    ESPEAK
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
    IMPORTANT:

    The server broadcasts this message
    back to everyone, including us.

    showSpeechBubble() sees that the
    message belongs to myId and therefore
    cancels only MY previous TTS.
    */

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
```
