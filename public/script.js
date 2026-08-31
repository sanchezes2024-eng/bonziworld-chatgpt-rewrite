/*
============================================================
SPEECH BUBBLE + TTS
============================================================
*/

/*
Track the TTS utterance that belongs to YOU.
Other players' speech is allowed to overlap.
*/

let myCurrentUtterance = null;


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


        /*
        Create a new utterance.
        */

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
        ====================================================
        YOUR OWN MESSAGE
        ====================================================
        */

        if (
            player.id === myId
        ) {

            /*
            Interrupt YOUR previous message.
            */

            if (
                myCurrentUtterance
            ) {

                window.speechSynthesis.cancel();

                myCurrentUtterance =
                    null;
            }


            myCurrentUtterance =
                utterance;
        }


        /*
        ====================================================
        FINISHED
        ====================================================
        */

        utterance.onend =
            () => {

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }


                if (
                    player.id === myId &&
                    myCurrentUtterance === utterance
                ) {

                    myCurrentUtterance =
                        null;
                }
            };


        /*
        ====================================================
        ERROR
        ====================================================
        */

        utterance.onerror =
            () => {

                if (
                    bubble.parentNode
                ) {

                    bubble.remove();
                }


                if (
                    player.id === myId &&
                    myCurrentUtterance === utterance
                ) {

                    myCurrentUtterance =
                        null;
                }
            };


        /*
        IMPORTANT:
        Do NOT call speechSynthesis.cancel() here.

        That allows different players' voices to overlap.
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


        const audioContainer =
            document.getElementById(
                "audio"
            );


        /*
        Only remove the previous audio when
        THIS is your own message.

        Other players can keep their audio playing.
        */

        if (
            player.id === myId &&
            audioContainer
        ) {

            audioContainer.innerHTML =
                "";
        }


        /*
        Create a separate audio container
        for each player's speech.
        */

        const speechContainer =
            document.createElement("div");

        speechContainer.className =
            "ttsAudio";

        speechContainer.style.display =
            "none";

        document.body.appendChild(
            speechContainer
        );


        /*
        Temporarily make this the target
        used by speakClient.js.
        */

        const oldAudio =
            document.getElementById(
                "audio"
            );


        if (oldAudio) {
            oldAudio.id = "audio-old";
        }


        speechContainer.id =
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


        let attempts =
            0;


        const waitForAudio =
            setInterval(
                () => {

                    attempts++;


                    const audio =
                        speechContainer.querySelector(
                            "audio"
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


                                speechContainer.remove();


                                /*
                                Restore the normal
                                audio container.
                                */

                                if (
                                    oldAudio
                                ) {

                                    oldAudio.id =
                                        "audio";
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


                                speechContainer.remove();


                                if (
                                    oldAudio
                                ) {

                                    oldAudio.id =
                                        "audio";
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


                        speechContainer.remove();


                        if (
                            oldAudio
                        ) {

                            oldAudio.id =
                                "audio";
                        }
                    }

                },
                50
            );
    }
}
