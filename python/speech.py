import sounddevice as sd
import numpy as np
import whisper

# Set recording parameters
SAMPLE_RATE = 16000
DURATION = 3  # seconds

def record_audio(duration, sample_rate):
    print("Listening... 🎙️")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype=np.float32)
    sd.wait()  # Wait until recording is finished
    audio = audio.flatten()  # Flatten to 1D array
    print("Recording done!")
    return audio

def save_wav(audio, sample_rate, filename):
    from scipy.io.wavfile import write
    # Convert to 16-bit PCM format
    audio_int16 = np.int16(audio * 32767)
    write(filename, sample_rate, audio_int16)
    print(f"Audio saved to {filename}")

def transcribe_whisper(filename):
    model = whisper.load_model("base")  # use "base", "small", "medium", or "large"
    result = model.transcribe(filename)
    print("Transcription:")
    print(result["text"])

def main():
    audio = record_audio(DURATION, SAMPLE_RATE)
    wav_filename = "output.wav"
    save_wav(audio, SAMPLE_RATE, wav_filename)
    transcribe_whisper(wav_filename)

if __name__ == "__main__":
    main()
