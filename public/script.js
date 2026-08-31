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
Browser TTS:

Other people's speech is allowed to overlap.

Your own speech is tracked separately so sending
another message interrupts your previous message.
*/

let myBrowserUtterance = null;


/*
eSpeak:

Each generated audio gets moved into its own
independent playback container.

This prevents one player's eSpeak audio from
deleting another player's audio.
*/

let myEspeakAudio = null;

let espeakPlaybackContainer =
    document.getElementById(
        "espeakPlaybackContainer"
    );

if (!espeakPlaybackContainer) {

    espeakPlaybackContainer =
        document.createElement("div");

    espeakPlaybackContainer.id =
        "espeakPlaybackContainer";

    espeakPlaybackContainer.style.display =
        "none";

    document.body.appendChild(
        espeakPlaybackContainer
    );
}


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

        if (
            settingsPanel.style.display === "block"
        ) {

            settingsPanel.style.display =
                "none";

        } else {

            settingsPanel.style.display =
                "block";
        }

    });
}


if (closeSettings) {

    closeSettings.addEventListener("click", () => {

        settingsPanel.style.display =
            "none";

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
        Only stop OUR currently playing speech.

        This does not attempt to cancel other
        players' independent eSpeak audio.
        */

        if (
            ttsMode === "browser" &&
            window.speechSynthesis
        ) {

            window.speechSynthesis.cancel();

        }

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
    CHARACTER
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
            Only YOUR player can be moved.
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


            /*
            Only send our own movement.

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
        IMPORTANT:

        Only cancel speech if this is OUR
        message.

        Other players' browser TTS is allowed
        to continue.
        */

        if (
            player.id === myId
        ) {

            window.speechSynthesis.cancel();

            myBrowserUtterance =
                utterance;
        }


        utterance.onend =
            () => {

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }

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

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }

                if (
                    player.id === myId &&
                    myBrowserUtterance === utterance
                ) {

                    myBrowserUtterance =
                        null;
                }
            };


        /*
        Do NOT cancel here for other players.
        */

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


        /*
        Get the generator container.

        We intentionally clear ONLY the temporary
        generator audio.
        */

        const audioContainer =
            document.getElementById(
                "audio"
            );


        if (!audioContainer) {

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
        Remove any previous generated audio
        from the temporary generator container.

        This does NOT touch audio that has already
        been moved into espeakPlaybackContainer.
        */

        audioContainer.innerHTML =
            "";


        /*
        Generate the new speech.
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
                        ==================================================
                        IMPORTANT FIX
                        ==================================================

                        Move this audio OUT of #audio.

                        #audio is reused by speak().

                        If we leave the audio there, the next
                        eSpeak message can delete it.

                        Each message gets its own independent
                        audio element.
                        */


                        audioContainer.removeChild(
                            audio
                        );


                        /*
                        Create a private playback wrapper.
                        */

                        const playback =
                            document.createElement(
                                "div"
                            );

                        playback.className =
                            "espeakAudioInstance";


                        playback.style.display =
                            "none";


                        /*
                        Put this message's audio
                        into its own wrapper.
                        */

                        playback.appendChild(
                            audio
                        );


                        espeakPlaybackContainer.appendChild(
                            playback
                        );


                        /*
                        ==================================================
                        PLAYBACK
                        ==================================================
                        */

                        /*
                        If this is OUR message, stop our
                        previous eSpeak message.

                        Other players are never stopped.
                        */

                        if (
                            player.id === myId
                        ) {

                            if (
                                myEspeakAudio &&
                                myEspeakAudio !== audio
                            ) {

                                try {

                                    myEspeakAudio.pause();

                                    myEspeakAudio.currentTime =
                                        0;

                                } catch (error) {
                                    // Ignore.
                                }
                            }


                            myEspeakAudio =
                                audio;
                        }


                        /*
                        Audio can now play independently
                        of every other audio element.
                        */

                        audio.addEventListener(
                            "ended",
                            () => {

                                if (
                                    bubble.parentNode
                                ) {

                                    bubble.remove();
                                }


                                playback.remove();


                                if (
                                    player.id === myId &&
                                    myEspeakAudio === audio
                                ) {

                                    myEspeakAudio =
                                        null;
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


                                playback.remove();


                                if (
                                    player.id === myId &&
                                    myEspeakAudio === audio
                                ) {

                                    myEspeakAudio =
                                        null;
                                }

                            },
                            {
                                once:
                                    true
                            }
                        );


                        /*
                        Start this audio.

                        It is independent from all other
                        players' audio.
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
                                        "eSpeak playback error:",
                                        error
                                    );

                                }
                            );
                        }


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
