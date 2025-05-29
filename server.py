from flask import Flask, request, jsonify
from flask_cors import CORS
import ollama
import datetime
import re

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
        if not user_input:
            return jsonify({"error": "No text provided"}), 400

        if re.search(r"\b(what is your name|your name|who are you)\b(?!\s+\w)", user_input.strip(), re.IGNORECASE):
            ai_response = "My name is lily. I am a voice assistant based on a ollama."
        
        elif "exit" in user_input:
            if (hour <= 2 or hour > 20):
                ai_response = "Good night. Incase you need any help, feel free to ask me."
            else:
                ai_response = "Bye. If you need any help feel free to ask. Have a great day."

        elif "time now" in user_input or "current time" in user_input:
            timeNow = datetime.datetime.now()
            ai_response = f"The current date and time is: {timeNow}"

        else:
            response = ollama.chat(model="llama3.2", messages=[{"role": "user", "content": user_input}])
            ai_response = response.get("message", {}).get("content", "No response from AI")

        return jsonify({"response": ai_response})
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5700)
