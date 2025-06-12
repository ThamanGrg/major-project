from flask import Flask, request, jsonify
from flask_cors import CORS
import ollama
import datetime
import re
import requests
import traceback

app = Flask(__name__)
CORS(app)

hour = int(datetime.datetime.now().strftime("%H"))

@app.route("/process-text", methods=["POST"])
def process_text():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or empty request body"}), 400

        user_input = data.get("text")

        def extract_city(user_text):
            match_in = re.search(r'in\s+([A-Za-z\s]+)', user_text, re.IGNORECASE)
            if match_in:
                return match_in.group(1).strip()

            match_of = re.search(r'of\s+([A-Za-z\s]+)', user_text, re.IGNORECASE)
            if match_of:
                return match_of.group(1).strip()

            match_at = re.search(r'at\s+([A-Za-z\s]+)', user_text, re.IGNORECASE)
            if match_at:
                return match_at.group(1).strip()

            return None
        

        if re.search(r"\b(what is your name|your name|who are you)\b(?!\s+\w)", user_input.strip(), re.IGNORECASE):
            response = ollama.chat(model="llama3.2", messages=[{"role": "user", "content": "user asked your name or who are you, your name is lily now response in a friendly way in short"}])
            ai_response = response.get("message", {}).get("content", "No response from AI")

        elif "exit" in user_input:
            if (hour <= 2 or hour > 20):
                ai_response = "Good night. Incase you need any help, feel free to ask me."
            else:
                ai_response = "Bye. If you need any help feel free to ask. Have a great day."
        
        elif "weather" in user_input:
            city = extract_city(user_input)
            print("Extracted city: ", city)
            api_request = requests.get(f"https://api.weatherapi.com/v1/current.json?key=2b7ba4ca5d47461798b41048250706&q={city}")
            if api_request.status_code == 200:
                weather = api_request.json()
                weather = f"Temperature: {weather['current']['temp_c']}°C, Condition: {weather['current']['condition']['text']}"
            else:
                weather = "Could not retrieve weather information."

            response = ollama.chat(model="llama3.2", messages=[{"role": "user", "content": f"weather information for {city} is {weather}, now respond in a friendly way in short"}])
            ai_response = response.get("message", {}).get("content", "No response from AI")

        else:
            response = ollama.chat(model="llama3.2", messages=[{"role": "user", "content": user_input}])
            ai_response = response.get("message", {}).get("content", "No response from AI")

        return jsonify({"response": ai_response})
        
    except Exception as e:
        print("Error:", e)
        traceback.print_exc()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5700)
