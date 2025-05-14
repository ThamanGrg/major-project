const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const stopSpeech = document.getElementById("speechStop");
const transcriptP = document.getElementById("transcript");
const chatHistory = document.getElementById("chat-history");

let isChatting = false;
let isListening = false;
let isSpeaking = false;
let isRequestInProgress = false;
let recognition;
let audioStream = null;

function appendChatMessage(sender, message) {
    let messageElement = document.createElement("p");

    if (/\d+\.\s/.test(message)) {
        let cleanedMessage = message.replace(/\n\n/g, ' ').trim();

        let listItems = cleanedMessage.split(/\d+\.\s/).filter(item => item.trim() !== '').map(item => item.trim());

        let finalList = [];
        let currentItem = listItems[0];

        for (let i = 1; i < listItems.length; i++) {
            if (listItems[i].startsWith(' ')) { 
                currentItem += ' ' + listItems[i].trim();
            } else {
                finalList.push(currentItem);
                currentItem = listItems[i];
            }
        }
        finalList.push(currentItem);

        let listElement = document.createElement("ul");
        listElement.style.listStyleType = 'none';
        finalList.forEach((item, index) => {
            let listItem = document.createElement("li");
            listItem.textContent = `${index + 1}. ${item}`;
            listElement.appendChild(listItem);
        });

        let listMessageElement = document.createElement("div");
        listMessageElement.innerHTML = `<strong>${sender}:</strong>`;
        listMessageElement.appendChild(listElement);
        chatHistory.appendChild(listMessageElement);
    } else {
        messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatHistory.appendChild(messageElement);
    }

    chatHistory.scrollTop = chatHistory.scrollHeight;
}



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
        transcriptP.textContent = "Listening...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        transcriptP.textContent = transcript;
        sendToBackend(transcript);
    };

    recognition.onerror = (event) => {
        if (event.error == "no-speech") {
            console.log("Speech Recognition Error: " + event.error);
            isChatting = true;
            isListening = false;
            recognition.stop();

            setTimeout(() => {
                if (!isListening && isChatting) {
                    transcriptP.textContent = "No voice detected. Exiting chat...";
                    recognition.stop();
                    isChatting = false;

                    stopBtn.style.display = 'none';
                    stopSpeech.style.display = 'none';
                    startBtn.style.display = 'inline';

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
    stopBtn.style.display = 'inline';
    stopSpeech.style.display = 'none';
    await getMicrophoneAccess();
    recognition.start();
};

stopBtn.onclick = () => {
    isChatting = false;
    startBtn.style.display = 'inline';
    stopBtn.style.display = 'none';
    stopSpeech.style.display = 'none';
    recognition.stop();
};

async function sendToBackend(text) {
    if (isRequestInProgress) return;
    isRequestInProgress = true;

    try {
        console.log("You: ", text);
        appendChatMessage("You", text);

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
            appendChatMessage("AI", aiResponse);
            speakResponse(aiResponse);

            if (["bye", "good night"].some(word => aiResponse.toLowerCase().includes(word))) {
                console.log("AI said 'Bye'. Exiting chat...");
                isChatting = false;
                recognition.stop();

                stopBtn.style.display = 'none';
                stopSpeech.style.display = 'none';
                startBtn.style.display = 'inline';
            }
        } else {
            console.error("Invalid response format:", result);
        }

    } catch (error) {
        console.error("Error fetching response:", error);
    } finally {
        isRequestInProgress = false;
    }
}

function speakResponse(responseText) {
    const cleanedResponse = responseText.replace(/\*/g, '').replace(/<\/?think>/g, '').trim();

    if (isSpeaking) return;

    isSpeaking = true;
    recognition.stop();

    let availableVoices = window.speechSynthesis.getVoices();
    const googleUKFemaleVoice = availableVoices.find(voice => voice.name === 'Google UK English Female');

    window.speechSynthesis.cancel();

    stopSpeech.style.display = 'inline';

    let sentences = cleanedResponse.match(/(\d+\.\s*[^.!?]+|[^.!?]+[.!?])/g) || [cleanedResponse];

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

        let utterance = new SpeechSynthesisUtterance(sentences[index].trim());
        if (googleUKFemaleVoice) utterance.voice = googleUKFemaleVoice;

        utterance.pitch = 1;
        utterance.rate = 1;
        utterance.volume = 1;

        utterance.onend = () => {
            speakChunks(index + 1);
        }

        window.speechSynthesis.speak(utterance);
    }

    speakChunks(0);



    stopSpeech.onclick = async () => {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        await getMicrophoneAccess();
        recognition.start();
        stopSpeech.style.display = 'none';
    };
}

loadVoices();
