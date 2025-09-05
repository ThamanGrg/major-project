from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import ollama
import datetime
import re
import requests

app = Flask(__name__)
CORS(app)
hour = int(datetime.datetime.now().strftime("%H"))
current_model = "llama3.2"


@app.route('/set-model', methods=['POST'])
def set_model():
    global current_model
    data = request.json
    current_model = data.get('model', 'llama3.2')
    print("Current model set to:", current_model)
    return jsonify({"message": "Model updated", "current_model": current_model})


@app.route("/process-text", methods=["POST"])
def process_text():
    global current_model
    try:
        data = request.get_json()
        if not data or not data.get("text"):
            return jsonify({"error": "No text provided"}), 400

        user_input = data.get("text")
        mode = data.get("mode")
        user_input_lower = user_input.lower()

        def extract_city(user_text):
            for keyword in ['in', 'of', 'at']:
                match = re.search(rf'\b{keyword}\s+([A-Za-z\s]+)', user_text, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
            if "my area" in user_input_lower:
                return "Pokhara"
            return None

        if re.search(r"\b(what is your name|your name|who are you)\b(?!\s+\w)", user_input.strip(), re.IGNORECASE):
            prompt = "user asked your name or who are you, your name is Lily. Respond in a friendly way in short"

        elif "exit" in user_input_lower:
            if hour <= 2 or hour > 20:
                return Response("Good night. In case you need any help, feel free to ask me.", mimetype='text/plain')
            else:
                return Response("Bye. If you need any help, feel free to ask. Have a great day.", mimetype='text/plain')

        elif "time now" in user_input_lower or "current time" in user_input_lower:
            time_now = datetime.datetime.now()
            return Response(f"The current date and time is: {time_now}", mimetype='text/plain')

        elif "weather" in user_input_lower or "temperature" in user_input_lower or "outdoor" in user_input_lower or "outside" in user_input_lower:
            city = extract_city(user_input)
            if not city:
                city = "Pokhara"

            try:
                api_request = requests.get(
                    f"https://api.weatherapi.com/v1/current.json?key=2b7ba4ca5d47461798b41048250706&q={city}",
                    timeout=5
                )
                api_request.raise_for_status()
                weather_data = api_request.json()
                temp_c = weather_data['current']['temp_c']
                condition = weather_data['current']['condition']['text']
                weather = f"Temperature: {temp_c}°C, Condition: {condition}"
            except requests.RequestException:
                weather = "Sorry, I couldn't fetch the weather information due to a network issue."
            except Exception:
                weather = "Something went wrong while fetching the weather."

            prompt = (
                f"Hey! Here's the latest weather update for {city}: {weather}. "
                f"Please respond in a short, friendly, and helpful tone with a quick tip if needed."
            )

        else:
            if mode == "voice":
                prompt = f"user asked about '{user_input}', respond in a short, friendly, and helpful way"

            elif mode == "text":
                prompt = user_input 


        stream = ollama.chat(
            model=current_model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )

        def generate():
            for chunk in stream:
                text = chunk.get("message", {}).get("content", "")
                if text:
                    yield text

        return Response(generate(), mimetype='text/plain')

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5700)
