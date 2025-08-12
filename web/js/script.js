const startBtn = document.getElementById("start-chat");
const stopBtn = document.getElementById("stop-chat");
const stopSpeech = document.getElementById("stop-speech");

let isRecording = false;
let isSpeaking = false;
let isRequestInProgress = false;
let isChatting = false;
let audioStream = null;


async function getMicrophoneAccess() {
    if (!audioStream) {
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Microphone access granted.");
        } catch (error) {
            console.error("Microphone access denied:", error);
        }
    }
}

function loadVoices() {
    voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        setTimeout(loadVoices, 100);
    }
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    recognition = 'webkitSpeechRecognition' in window ? new webkitSpeechRecognition() : new SpeechRecognition();

    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        sendToBackend(transcript);
    };

    recognition.onerror = (event) => {
        if (event.error == "no-speech") {
            console.log("Speech Recognition Error: " + event.error);
            isListening = false;
            recognition.stop();

            setTimeout(() => {
                if (!isListening && isChatting) {
                    recognition.stop();
                    isChatting = false;

                    stopBtn.style.display = 'none';
                    startBtn.style.display = 'flex';

                } else {
                    console.log("Resuming chat...");
                    recognition.start();
                }
            }, 10000);
        } else {
            console.error("Recognition Error:" + event.error);
        }
    };


    recognition.onend = () => {
        isListening = false;
    };

} else {
    alert("Speech recognition is not supported in your browser.");
}

startBtn.onclick = async () => {
    isChatting = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    await getMicrophoneAccess();
    recognition.start();
};

stopBtn.onclick = () => {
    isChatting = false;
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    recognition.stop();
};

async function sendToBackend(text) {
    if (isRequestInProgress) return;
    isRequestInProgress = true;

    try {
        console.log("You: ", text);

        let response = await fetch("http://127.0.0.1:5700/process-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text }),
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        let result = await response.json();

        if (result && result.response) {
            let aiResponse = result.response;
            console.log("AI Response:", aiResponse);
            speakResponse(aiResponse);

            if (["bye", "good night"].some(word => aiResponse.toLowerCase().includes(word))) {
                console.log("AI said 'Bye'. Exiting chat...");
                isChatting = false;
                recognition.stop();

                stopBtn.style.display = 'none';
                startBtn.style.display = 'flex';
            }
        } else {
            console.error("Invalid response format:", result);
        }
    } catch (error) {
        console.error("Error fetching response:", error);
        recognition.stop();
        stopBtn.style.display = 'none';
        startBtn.style.display = 'flex';
    } finally {
        isRequestInProgress = false;
    }
}

function speakResponse(responseText) {
    const cleanedResponse = responseText.replace(/\*/g, '').replace(/<\/?think>/g, '').trim();

    if (isSpeaking) return;
    isSpeaking = true;

    recognition.stop();
    stopSpeech.style.display = 'flex';

    let availableVoices = window.speechSynthesis.getVoices();
    const googleUKFemaleVoice = availableVoices.find(voice => voice.name === 'Google UK English Female');
    const defaultVoice = availableVoices.find(voice => voice.lang.includes('en')) || null;

    window.speechSynthesis.cancel();

    const sentences = cleanedResponse.split(/(?<=[.!?]) +/);

    function speakChunks(index) {
        if (index >= sentences.length) {
            isSpeaking = false;
            stopSpeech.style.display = 'none';
            console.log("Finished speaking...");

            setTimeout(() => {
                if (isChatting) {
                    getMicrophoneAccess().then(() => recognition.start());
                }
            }, 200);

            return;
        }

        const utterance = new SpeechSynthesisUtterance(sentences[index].trim());
        if (googleUKFemaleVoice) utterance.voice = googleUKFemaleVoice;
        else if (defaultVoice) utterance.voice = defaultVoice;

        utterance.pitch = 1;
        utterance.rate = 1;
        utterance.volume = 1;

        utterance.onend = () => {
            speakChunks(index + 1);
        };

        window.speechSynthesis.speak(utterance);
    }

    speakChunks(0);

    stopSpeech.onclick = async () => {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        stopSpeech.style.display = 'none';
        await getMicrophoneAccess();
        recognition.start();
    };
}

loadVoices();
