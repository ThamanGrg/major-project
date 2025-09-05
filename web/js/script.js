
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
        addMessage(transcript, "user");
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


let speechBuffer = "";
let speechTimer = null;
let aiResponseBuffer = "";

async function sendToBackend(text) {
    if (isRequestInProgress) return;
    isRequestInProgress = true;

    try {
        console.log("You: ", text);

        const response = await fetch("http://127.0.0.1:5700/process-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text, mode: "voice" }),
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        if (!response.body) throw new Error("ReadableStream not supported");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        aiResponseBuffer = "";
        speechBuffer = "";
        isSpeaking = true;
        recognition.stop();
        stopSpeech.style.display = 'flex';

        let done = false;

        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            if (value) {
                const chunk = decoder.decode(value);
                aiResponseBuffer += chunk;   
                speechBuffer += chunk;     
                scheduleSpeech();                       
            }
        }

        // Speak any remaining buffered text
        if (speechBuffer.trim()) speakBufferedText();

        // After TTS finishes, append full AI response to chatbox
        utteranceEndCallback = () => {
            appendToChatBox(aiResponseBuffer, "bot");
            aiResponseBuffer = "";
        };

    } catch (error) {
        console.error("Error fetching response:", error);
        recognition.stop();
        stopBtn.style.display = 'none';
        startBtn.style.display = 'flex';
    } finally {
        isRequestInProgress = false;
    }
}

// Append messages to chat box
function appendToChatBox(text, sender) {
    const chatBox = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.classList.add("message", sender === "user" ? "user-message" : "bot-message");
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Schedule buffered text for speech
function scheduleSpeech() {
    if (speechTimer) clearTimeout(speechTimer);
    speechTimer = setTimeout(speakBufferedText, 500);
}

// Speech synthesis for buffered chunks
let utteranceEndCallback = null;

function speakBufferedText() {
    if (!speechBuffer.trim()) return;

    const textToSpeak = speechBuffer.replace(/\*/g, '').replace(/<\/?think>/g, '').trim();
    speechBuffer = "";

    const availableVoices = window.speechSynthesis.getVoices();
    const googleUKFemaleVoice = availableVoices.find(voice => voice.name === 'Google UK English Female');
    const defaultVoice = availableVoices.find(voice => voice.lang.includes('en')) || null;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (googleUKFemaleVoice) utterance.voice = googleUKFemaleVoice;
    else if (defaultVoice) utterance.voice = defaultVoice;

    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 1;

    utterance.onend = async () => {
        isSpeaking = false;
        stopSpeech.style.display = 'none';

        // Update chatbox with full response
        if (utteranceEndCallback) {
            utteranceEndCallback();
            utteranceEndCallback = null;
        }

        // Resume listening
        if (isChatting) {
            await getMicrophoneAccess();
            recognition.start();
        }
    };

    window.speechSynthesis.speak(utterance);
}

// Stop button
stopSpeech.onclick = async () => {
    window.speechSynthesis.cancel();
    speechBuffer = "";
    aiResponseBuffer = "";
    if (speechTimer) clearTimeout(speechTimer);
    isSpeaking = false;
    stopSpeech.style.display = 'none';
    await getMicrophoneAccess();
    recognition.start();
};
