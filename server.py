from flask import Flask, request, jsonify
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
        if not data:
            return jsonify({"error": "Invalid JSON or empty request body"}), 400

        user_input = data.get("text")
        if not user_input:
            return jsonify({"error": "No text provided"}), 400

        user_input_lower = user_input.lower()

        def extract_city(user_text):
            for keyword in ['in', 'of', 'at']:
                match = re.search(rf'\b{keyword}\s+([A-Za-z\s]+)', user_text, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
            if "my area" in user_text.lower():
                return "Pokhara"
            return None

        if re.search(r"\b(what is your name|your name|who are you)\b(?!\s+\w)", user_input.strip(), re.IGNORECASE):
            response = ollama.chat(
                model= current_model,
                messages=[{"role": "user", "content": "user asked your name or who are you, your name is Lily. Respond in a friendly way in short"}]
            )
            ai_response = response.get("message", {}).get("content", "No response from AI")

        elif "exit" in user_input_lower:
            if (hour <= 2 or hour > 20):
                ai_response = "Good night. In case you need any help, feel free to ask me."
            else:
                ai_response = "Bye. If you need any help, feel free to ask. Have a great day."

        elif "time now" in user_input_lower or "current time" in user_input_lower:
            time_now = datetime.datetime.now()
            ai_response = f"The current date and time is: {time_now}"

        elif "weather" in user_input_lower or "temperature" in user_input_lower or "outdoor" in user_input_lower or "outside" in user_input_lower:
            is_current_weather_request = (
                any(keyword in user_input_lower for keyword in ["weather", "temperature", "outdoor", "outside"])
                and (
                    "in " in user_input_lower
                    or "my area" in user_input_lower
                    or "right now" in user_input_lower
                )
            )
            is_weather_explanation = (
                any(keyword in user_input_lower for keyword in ["how", "why", "what"])
                and "weather" in user_input_lower
            )

            if is_current_weather_request:
                city = extract_city(user_input)
                if not city:
                    city = "Pokhara"

                print("Extracted city:", city)
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
                except Exception as e:
                    weather = "Something went wrong while fetching the weather."

                prompt = (
                    f"Hey! Here's the latest weather update for {city}: {weather}. "
                    f"Please respond in a short, friendly, and helpful tone with a quick tip if needed."
                )

                response = ollama.chat(
                    model=current_model,
                    messages=[{"role": "user", "content": prompt}]
                )
                ai_response = response.get("message", {}).get("content", "No response from AI")

            elif is_weather_explanation:
                prompt = f"User asked: '{user_input}'. Provide a simple and friendly explanation."
                response = ollama.chat(
                    model=current_model,
                    messages=[{"role": "user", "content": prompt}]
                )
                ai_response = response.get("message", {}).get("content", "No response from AI")
            else:
                ai_response = "Could you please clarify your weather-related question?"

        else:
            response = ollama.chat(
                model=current_model,
                messages=[{"role": "user", "content": user_input}]
            )
            ai_response = response.get("message", {}).get("content", "No response from AI")

        return jsonify({"response": ai_response})
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5700)
