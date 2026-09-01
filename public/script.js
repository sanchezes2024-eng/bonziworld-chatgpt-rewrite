const socket = io();

# /*

# ELEMENTS

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

# /*

# PLAYER / ROOM STATE

*/

const players = {};

let myId = null;

let myName = "";

let currentRoom = "default";

# /*

# ESPEAK STATE

*/

/*
Each player's message gets its own Audio element.

There is deliberately NO global audio.stop(),
audio.pause(), or audioContainer.innerHTML = ""
after playback has started.
*/

let myEspeakAudio = null;

const audioContainer =
document.getElementById("audio");

let espeakPlaybackContainer =
document.getElementById(
"espeakPlaybackContainer"
);

/*
Fallback in case the HTML does not contain
the playback container.
*/

if (!espeakPlaybackContainer) {

```
espeakPlaybackContainer =
    document.createElement("div");

espeakPlaybackContainer.id =
    "espeakPlaybackContainer";

document.body.appendChild(
    espeakPlaybackContainer
);
```

}

# /*

# DEFAULT ROOM

*/

if (roomInput) {
roomInput.value = "default";
}

# /*

# SETTINGS

*/

if (settingsButton) {

```
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
```

}

if (closeSettings) {

```
closeSettings.addEventListener(
    "click",
    () => {

        settingsPanel.style.display =
            "none";
    }
);
```

}

# /*

# COLOR → HUE

*/

function colorToHue(color) {

```
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
    String(color).toLowerCase();


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
```

}

# /*

# UPDATE PLAYER COLOR

*/

function updatePlayerColor(
player,
color
) {

```
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
```

}

# /*

# CREATE PLAYER

*/

function createPlayer(data) {

```
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


/*
PUT INTO WORLD
*/

world.appendChild(
    element
);


players[data.id] =
    player;


updatePlayerColor(
    player,
    player.color
);


/*
EVERYONE CAN DRAG EVERYONE.

The server receives playerId so it knows
which character was moved.
*/

setupDragging(
    player
);


if (
    data.id === myId
) {

    element.classList.add(
        "myPlayer"
    );
}


return player;
```

}

# /*

# CHANGE PLAYER CHARACTER

*/

function updatePlayerCharacter(
player,
character
) {

```
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
```

}

# /*

# DRAGGING

*/

function setupDragging(player) {

```
let dragging =
    false;


player.element.style.cursor =
    "grab";

player.element.style.touchAction =
    "none";

player.element.style.userSelect =
    "none";


/*
START DRAG
*/

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


/*
DRAG
*/

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
                    98,
                    y
                )
            );


        /*
        Update this player's local position.
        */

        player.x =
            x;

        player.y =
            y;


        player.element.style.left =
            `${x}%`;

        player.element.style.top =
            `${y}%`;


        /*
        IMPORTANT:

        Include player.id.

        The server needs this because
        anyone can drag anyone.
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


/*
STOP DRAG
*/

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
```

}

# /*

# LOGIN

*/

function joinRoom() {

```
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
```

}

submitButton.addEventListener(
"click",
joinRoom
);

nameInput.addEventListener(
"keydown",
(event) => {

```
    if (
        event.key === "Enter"
    ) {

        joinRoom();
    }
}
```

);

roomInput.addEventListener(
"keydown",
(event) => {

```
    if (
        event.key === "Enter"
    ) {

        joinRoom();
    }
}
```

);

# /*

# JOINED

*/

socket.on(
"joined",
(data) => {

```
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
```

);

# /*

# PLAYER JOINED

*/

socket.on(
"playerJoined",
(data) => {

```
    createPlayer(
        data
    );
}
```

);

# /*

# PLAYER MOVED

*/

socket.on(
"playerMoved",
(data) => {

```
    const player =
        players[data.id];


    if (!player) {
        return;
    }


    player.x =
        Number(data.x);

    player.y =
        Number(data.y);


    player.element.style.left =
        `${data.x}%`;

    player.element.style.top =
        `${data.y}%`;
}
```

);

# /*

# PLAYER COLOR CHANGED

*/

socket.on(
"playerColorChanged",
(data) => {

```
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
```

);

# /*

# PLAYER CHARACTER CHANGED

*/

socket.on(
"playerCharacterChanged",
(data) => {

```
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
```

);

# /*

# PLAYER LEFT

*/

socket.on(
"playerLeft",
(data) => {

```
    const player =
        players[data.id];


    if (!player) {
        return;
    }


    player.element.remove();

    delete players[data.id];
}
```

);

# /*

# CHAT MESSAGE

*/

socket.on(
"message",
(data) => {

```
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
```

);

# /*

# SYSTEM MESSAGE

*/

socket.on(
"systemMessage",
(data) => {

```
    console.log(
        "System:",
        data.text
    );
}
```

);

# /*

# SPEECH BUBBLE

*/

function showSpeechBubble(
player,
text
) {

```
/*
Replace only this player's previous
bubble.

It does NOT affect another player's bubble.
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
ESPEAK ONLY
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
IMPORTANT:

speak() uses #audio as its temporary
generation area.

Clear only BEFORE generating this
particular message.
*/

audioContainer.innerHTML =
    "";


/*
Generate eSpeak audio.
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
                DETACH THE AUDIO IMMEDIATELY
                ==================================================

                Once detached from #audio, future
                calls to speak() cannot delete it.
                */

                audioContainer.removeChild(
                    audio
                );


                /*
                Create an independent playback
                wrapper for this message.
                */

                const playback =
                    document.createElement(
                        "div"
                    );


                playback.className =
                    "espeakAudioInstance";


                playback.appendChild(
                    audio
                );


                espeakPlaybackContainer.appendChild(
                    playback
                );


                /*
                ==================================================
                OWN MESSAGE TRACKING
                ==================================================

                If YOU send another message, your
                previous speech is stopped.

                Other players' audio is untouched.
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

                            console.log(
                                "Could not stop previous own eSpeak audio:",
                                error
                            );
                        }
                    }


                    myEspeakAudio =
                        audio;
                }


                /*
                ==================================================
                AUDIO FINISHED
                ==================================================
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
                            myEspeakAudio === audio
                        ) {

                            myEspeakAudio =
                                null;
                        }
                    };


                audio.addEventListener(
                    "ended",
                    cleanup,
                    {
                        once:
                            true
                    }
                );


                audio.addEventListener(
                    "error",
                    cleanup,
                    {
                        once:
                            true
                    }
                );


                /*
                ==================================================
                PLAY
                ==================================================

                No global pause.
                No global stop.
                No speech queue.

                Every Audio object plays independently.
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
            ==================================================
            GENERATION TIMEOUT
            ==================================================
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
```

}

# /*

# SEND MESSAGE

*/

function sendMessage() {

```
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
```

}

startButton.addEventListener(
"click",
sendMessage
);

messageInput.addEventListener(
"keydown",
(event) => {

```
    if (
        event.key === "Enter"
    ) {

        event.preventDefault();

        sendMessage();
    }
}
```

);

messageInput.addEventListener(
"focus",
() => {

```
    messageInput.select();
}
```

);
