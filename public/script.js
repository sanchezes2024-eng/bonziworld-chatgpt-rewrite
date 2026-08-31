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
*/

/*
Each player's currently playing eSpeak audio.

This is what allows:

Player A -> audio
Player B -> audio
Player C -> audio

to all play at the same time.

Your own audio is tracked separately so sending
another message can interrupt only YOUR previous audio.
*/

const playerAudio = {};


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
        Stop only YOUR currently playing TTS.

        Other players' eSpeak audio is not touched.
        */

        stopOwnTTS();

    });

});


/*
============================================================
STOP OWN TTS
============================================================
*/

function stopOwnTTS() {

    /*
    Browser TTS

    Native browser speech is global, so unfortunately
    cancel() affects the browser speech engine.

    This is only used when switching TTS mode.
    */

    if (window.speechSynthesis) {

        window.speechSynthesis.cancel();

    }


    /*
    eSpeak

    Only stop audio belonging to this client/player.
    */

    if (myId && playerAudio[myId]) {

        const audioList =
            playerAudio[myId];


        audioList.forEach((audio) => {

            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                // Ignore.
            }

            try {
                audio.remove();
            } catch (error) {
                // Ignore.
            }

        });


        delete playerAudio[myId];

    }

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
    PUT PLAYER INTO WORLD IMMEDIATELY
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
    DRAGGING
    */

    setupDragging(
        player
    );


    /*
    YOUR PLAYER
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

            /*
            IMPORTANT:

            Only YOUR OWN player can be moved.

            Clicking another player's sprite will NOT
            move your sprite.
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


            if (
                player.id !== myId
            ) {

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
            The server already knows which socket
            sent this movement.

            */

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
        Stop audio belonging to the player
        who left.
        */

        if (
            playerAudio[data.id]
        ) {

            playerAudio[data.id].forEach(
                (audio) => {

                    try {

                        audio.pause();
                        audio.remove();

                    } catch (error) {
                        // Ignore.
                    }

                }
            );


            delete playerAudio[data.id];

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
REMOVE OLD BUBBLE
============================================================
*/

function removeSpeechBubble(player) {

    const oldBubble =
        player.element.querySelector(
            ".speechBubble"
        );


    if (oldBubble) {

        oldBubble.remove();

    }

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
    Only replace the visual bubble.

    IMPORTANT:
    We do NOT stop the player's old audio here.

    That allows audio from multiple players to
    overlap.
    */

    removeSpeechBubble(
        player
    );


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


        /*
        Native browser speech cannot actually
        overlap multiple utterances.

        Do NOT call cancel() here because that
        would interrupt everyone.
        */

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


        if (!audioContainer) {

            console.error(
                'Missing <div id="audio"></div>'
            );


            return;
        }


        /*
        DO NOT DO:

        audioContainer.innerHTML = "";

        That was the reason previous TTS
        sounds were being destroyed.
        */


        /*
        Remember which audio elements existed
        before this message.
        */

        const oldAudio =
            new Set(
                audioContainer.querySelectorAll(
                    "audio"
                )
            );


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


                    const allAudio =
                        Array.from(
                            audioContainer.querySelectorAll(
                                "audio"
                            )
                        );


                    /*
                    Find the newly-created audio
                    element instead of grabbing
                    whichever audio happens to be
                    first.
                    */

                    const audio =
                        allAudio.find(
                            (item) =>
                                !oldAudio.has(item)
                        );


                    if (audio) {

                        clearInterval(
                            waitForAudio
                        );


                        /*
                        Create the audio list for
                        this player if necessary.
                        */

                        if (
                            !playerAudio[player.id]
                        ) {

                            playerAudio[player.id] =
                                [];

                        }


                        playerAudio[player.id].push(
                            audio
                        );


                        /*
                        Make sure it can play
                        independently.
                        */

                        audio.volume =
                            1;


                        /*
                        Start it immediately.
                        */

                        const playPromise =
                            audio.play();


                        if (
                            playPromise &&
                            typeof playPromise.catch ===
                                "function"
                        ) {

                            playPromise.catch(
                                (error) => {

                                    console.log(
                                        "Audio playback was blocked:",
                                        error
                                    );

                                }
                            );

                        }


                        /*
                        When this particular
                        message finishes, remove
                        only this audio.
                        */

                        audio.addEventListener(
                            "ended",
                            () => {

                                try {
                                    audio.remove();
                                } catch (error) {
                                    // Ignore.
                                }


                                if (
                                    playerAudio[player.id]
                                ) {

                                    playerAudio[player.id] =
                                        playerAudio[
                                            player.id
                                        ].filter(
                                            (item) =>
                                                item !==
                                                audio
                                        );

                                }


                                /*
                                Remove bubble only if
                                this is still the
                                current bubble.
                                */

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

                                try {
                                    audio.remove();
                                } catch (error) {
                                    // Ignore.
                                }


                                if (
                                    playerAudio[player.id]
                                ) {

                                    playerAudio[player.id] =
                                        playerAudio[
                                            player.id
                                        ].filter(
                                            (item) =>
                                                item !==
                                                audio
                                        );

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


                    /*
                    Timeout.
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

    Stop only our own previous eSpeak audio.

    We do NOT stop anyone else's audio.
    */

    if (
        ttsMode === "espeak"
    ) {

        stopOwnTTS();

    }


    /*
    Send message.
    */

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
SEND BUTTON
============================================================
*/

startButton.addEventListener(
    "click",
    sendMessage
);


/*
============================================================
ENTER TO SEND
============================================================
*/

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


/*
============================================================
FOCUS MESSAGE BOX
============================================================
*/

messageInput.addEventListener(
    "focus",
    () => {

        messageInput.select();

    }
);
