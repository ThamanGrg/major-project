from flask import Flask, request, jsonify
from flask_cors import CORS
import datetime
import re
import requests
import logging

app = Flask(__name__)
CORS(app)

def get_ollama_response(prompt):
    try:
        import ollama
        response = ollama.chat(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.get("message", {}).get("content", "No response from AI")
    except Exception as e:
        logging.error(f"Ollama chat error: {e}")
        return f"AI service error: {e}"

def extract_city(user_text):
    for keyword in ['in', 'of', 'at']:
        match = re.search(rf'\b{keyword}\s+([A-Za-z\s]+)', user_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    if "my area" in user_text.lower():
        return "Pokhara"
    return None

@app.route("/process-text", methods=["POST"])
def process_text():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or empty request body"}), 400

        user_input = data.get("text")
        if not user_input:
            return jsonify({"error": "No text provided"}), 400

        user_input_lower = user_input.lower()
        hour = datetime.datetime.now().hour

        if re.search(r"\b(what is your name|your name|who are you)\b(?!\s+\w)", user_input.strip(), re.IGNORECASE):
            prompt = "user asked your name or who are you, your name is Lily. Respond in a friendly way in short"
            ai_response = get_ollama_response(prompt)

        elif "exit" in user_input_lower:
            if (hour <= 2 or hour > 20):
                ai_response = "Good night. In case you need any help, feel free to ask me."
            else:
                ai_response = "Bye. If you need any help, feel free to ask. Have a great day."

        elif "time now" in user_input_lower or "current time" in user_input_lower:
            time_now = datetime.datetime.now()
            ai_response = f"The current date and time is: {time_now}"

        elif any(k in user_input_lower for k in ["weather", "temperature", "outdoor", "outside"]):
            city = extract_city(user_input) or "Pokhara"
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
            except requests.RequestException as e:
                logging.error(f"Weather API error: {e}")
                weather = "Sorry, I couldn't fetch the weather information due to a network issue."
            except Exception as e:
                logging.error(f"Unexpected weather error: {e}")
                weather = "Something went wrong while fetching the weather."

            prompt = (
                f"Hey! Here's the latest weather update for {city}: {weather}. "
                "Please respond in a short, friendly, and helpful tone with a quick tip if needed."
            )
            ai_response = get_ollama_response(prompt)

        else:
            ai_response = get_ollama_response(user_input)

        return jsonify({"response": ai_response})

    except Exception as e:
        logging.error(f"Unexpected server error: {e}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5700)
