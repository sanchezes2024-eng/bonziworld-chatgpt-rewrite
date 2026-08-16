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


    /*
    Handle some of the hex colors
    used by /color.
    */

    if (
        color === "#ff0000"
    ) {
        return 0;
    }

    if (
        color === "#00ff00"
    ) {
        return 120;
    }

    if (
        color === "#0000ff"
    ) {
        return 240;
    }

    if (
        color === "#ffff00"
    ) {
        return 60;
    }

    if (
        color === "#ff00ff"
    ) {
        return 300;
    }

    if (
        color === "#00ffff"
    ) {
        return 180;
    }

    if (
        color === "#ff8800"
    ) {
        return 30;
    }

    if (
        color === "#8800ff"
    ) {
        return 270;
    }

    if (
        color === "#00aa88"
    ) {
        return 168;
    }

    if (
        color === "#ff66aa"
    ) {
        return 330;
    }

    if (
        color === "#6666ff"
    ) {
        return 240;
    }

    if (
        color === "#66cc66"
    ) {
        return 120;
    }

    if (
        color === "#ffffff"
    ) {
        return 270;
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
    Player name.
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
    Position.
    */

    element.style.left =
        `${data.x}%`;

    element.style.top =
        `${data.y}%`;


    /*
    Player data.
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
    Create the correct character.
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
    Apply Bonzi color.
    */

    updatePlayerColor(
        player,
        player.color
    );


    /*
    Only YOUR player can be dragged.
    */

    if (
        data.id === myId
    ) {

        element.classList.add(
            "myPlayer"
        );


        setupDragging(
            player
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
    Remove old character classes.
    */

    player.element.classList.remove(
        "bonziPlayer",
        "squareCharacter"
    );


    /*
    Clear old square background.
    */

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


        /*
        Reapply color hue.
        */

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
