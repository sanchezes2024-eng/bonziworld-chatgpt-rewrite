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
TTS DATA
============================================================
*/

/*
All currently playing eSpeak audio objects.

Each player can have their own audio.
*/

const activeEspeakAudio = new Set();


/*
The audio belonging to YOUR latest message.

This is the only audio that gets interrupted
when you send another message.
*/

let myActiveEspeakAudio = null;


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
                Stop browser TTS when
                changing modes.
                */

                if (
                    window.speechSynthesis
                ) {

                    window.speechSynthesis.cancel();
                }


                /*
                Stop YOUR currently playing
                eSpeak audio.

                Do NOT stop everybody else's.
                */

                if (
                    myActiveEspeakAudio
                ) {

                    myActiveEspeakAudio.pause();

                    myActiveEspeakAudio.currentTime =
                        0;

                    activeEspeakAudio.delete(
                        myActiveEspeakAudio
                    );

                    myActiveEspeakAudio = null;
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
    PUT PLAYER INTO WORLD
    ========================================================
    */

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
            Tell the server WHICH player
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


if (submitButton) {

    submitButton.addEventListener(
        "click",
        joinRoom
    );
}


if (nameInput) {

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
}


if (roomInput) {

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
}


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
BROWSER TTS
============================================================
*/

function speakBrowser(
    text,
    player
) {

    if (
        !window.speechSynthesis
    ) {

        return;
    }


    /*
    YOUR OWN NEW MESSAGE interrupts
    YOUR previous browser TTS.

    Other players do NOT call cancel().
    */

    if (
        player.id === myId
    ) {

        window.speechSynthesis.cancel();
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

            /*
            Bubble removal is handled
            separately by showSpeechBubble.
            */
        };


    utterance.onerror =
        () => {
            // Ignore TTS errors.
        };


    window.speechSynthesis.speak(
        utterance
    );
}


/*
============================================================
ESPEAK
============================================================
*/

function speakEspeak(
    text,
    player,
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


    /*
    ========================================================
    IMPORTANT
    ========================================================

    YOUR audio:
        New message stops old message.

    OTHER PEOPLE:
        Their audio is left alone.

    Each call gets its own audio element.
    ========================================================
    */


    if (
        player.id === myId
    ) {

        if (
            myActiveEspeakAudio
        ) {

            myActiveEspeakAudio.pause();

            myActiveEspeakAudio.currentTime =
                0;

            activeEspeakAudio.delete(
                myActiveEspeakAudio
            );

            myActiveEspeakAudio =
                null;
        }
    }


    /*
    Create a private container for
    this particular speech request.
    */

    const container =
        document.createElement("div");


    container.style.display =
        "none";


    container.className =
        "ttsAudioContainer";


    document.body.appendChild(
        container
    );


    /*
    speakClient.js writes its generated
    audio into the target #audio element.
    */

    const oldAudio =
        document.getElementById(
            "audio"
        );


    /*
    Use the existing audio container,
    but don't clear it. Multiple audio
    elements are allowed to coexist.
    */

    let audioRoot =
        document.getElementById(
            "audio"
        );


    if (!audioRoot) {

        audioRoot =
            document.createElement("div");

        audioRoot.id =
            "audio";

        audioRoot.style.display =
            "none";

        document.body.appendChild(
            audioRoot
        );
    }


    /*
    speakClient.js normally inserts
    an audio element into #audio.

    We monitor for the new audio element.
    */

    const existingAudios =
        new Set(
            document.querySelectorAll(
                "#audio audio"
            )
        );


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


                const audios =
                    document.querySelectorAll(
                        "#audio audio"
                    );


                let audio =
                    null;


                for (
                    const candidate of audios
                ) {

                    if (
                        !existingAudios.has(
                            candidate
                        )
                    ) {

                        audio =
                            candidate;

                        break;
                    }
                }


                if (audio) {

                    clearInterval(
                        waitForAudio
                    );


                    /*
                    Keep this audio alive
                    independently.
                    */

                    activeEspeakAudio.add(
                        audio
                    );


                    /*
                    If this is YOUR audio,
                    remember it as your current
                    message.
                    */

                    if (
                        player.id === myId
                    ) {

                        myActiveEspeakAudio =
                            audio;
                    }


                    /*
                    When this individual
                    audio finishes, remove
                    only its own bubble/audio.
                    */

                    audio.addEventListener(
                        "ended",
                        () => {

                            activeEspeakAudio.delete(
                                audio
                            );


                            if (
                                myActiveEspeakAudio ===
                                audio
                            ) {

                                myActiveEspeakAudio =
                                    null;
                            }


                            if (
                                bubble.parentNode
                            ) {

                                bubble.remove();
                            }


                            audio.remove();
                        },
                        {
                            once:
                                true
                        }
                    );


                    audio.addEventListener(
                        "error",
                        () => {

                            activeEspeakAudio.delete(
                                audio
                            );


                            if (
                                myActiveEspeakAudio ===
                                audio
                            ) {

                                myActiveEspeakAudio =
                                    null;
                            }


                            if (
                                bubble.parentNode
                            ) {

                                bubble.remove();
                            }


                            audio.remove();
                        },
                        {
                            once:
                                true
                        }
                    );


                    /*
                    Make sure it plays.
                    */

                    audio.play().catch(
                        () => {}
                    );


                    return;
                }


                /*
                Don't wait forever.
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
SPEECH BUBBLE
============================================================
*/

function showSpeechBubble(
    player,
    text
) {

    /*
    A player only has one visible
    speech bubble at a time.
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
            text,
            player
        );


        /*
        Browser TTS does not provide
        true overlapping audio.

        Give the bubble a reasonable
        lifetime instead.
        */

        const estimatedTime =
            Math.max(
                2500,
                Math.min(
                    15000,
                    text.length * 60
                )
            );


        setTimeout(
            () => {

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }

            },
            estimatedTime
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
            text,
            player,
            bubble
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


if (startButton) {

    startButton.addEventListener(
        "click",
        sendMessage
    );
}


if (messageInput) {

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
}
