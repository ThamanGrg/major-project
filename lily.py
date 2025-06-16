import eel
import subprocess
import time

subprocess.Popen(["python", "server.py"])
time.sleep(1)


eel.init('web')
eel.start('index.html', size = (1920, 1080))