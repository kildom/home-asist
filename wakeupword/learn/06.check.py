import numpy as np
import math
import sounddevice as sd
import queue
import threading
import onnxruntime as ort
import torch.nn as nn
import torch

# Parameters
SAMPLE_RATE = 16000
FRAME_SIZE = 640
STEP_SIZE = 160
FIRST_MODEL_OUTPUT_SIZE = 32
SECOND_MODEL_INPUT_SIZE = 76
SECOND_MODEL_STEP = 8  # Vectors per step -> 1280 samples

# Load first model (ONNX or TFLite)
USE_TFLITE = False  # Change to True to use TFLite
FIRST_MODEL_PATH = "models/melspectrogram.onnx"  # or .tflite
SECOND_MODEL_PATH = "models/embedding_model.onnx"  # or .tflite

head_model_input_size = 96 * 27
shared_input_parts = 3
shared_output_size = 16
middle_layer_size = 16

# ===== Model Definition =====

class SharedLinearNet(nn.Module):
    def __init__(self):
        super(SharedLinearNet, self).__init__()

        assert head_model_input_size % shared_input_parts == 0, "Input size must be divisible by number of parts"

        self.part_size = head_model_input_size // shared_input_parts
        self.shared_linear = nn.Linear(self.part_size, shared_output_size)

        self.classifier = nn.Sequential(
            nn.ReLU(),
            nn.Linear(shared_output_size * shared_input_parts, middle_layer_size),
            nn.ReLU(),
            nn.Linear(middle_layer_size, 1),
            #nn.Sigmoid()
        )

    def forward(self, x):
        parts = torch.chunk(x, chunks=shared_input_parts, dim=0)
        transformed_parts = [self.shared_linear(part) for part in parts]
        combined = torch.cat(transformed_parts, dim=0)
        return self.classifier(combined)


def load_model(path, use_tflite=False):
    if use_tflite:
        interpreter = tflite.Interpreter(model_path=path)
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        return ('tflite', interpreter, input_details, output_details)
    else:
        session = ort.InferenceSession(path)
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        print(path)
        print('    input ', session.get_inputs()[0])
        print('    output ', session.get_outputs()[0])
        return ('onnx', session, input_name, output_name)

first_model = load_model(FIRST_MODEL_PATH, USE_TFLITE)
second_model = load_model(SECOND_MODEL_PATH, USE_TFLITE)

# Audio stream setup
audio_queue = queue.Queue()

def audio_callback(indata, frames, time, status):
    if status:
        print("Audio status:", status)
    audio_queue.put(indata.copy())

# Processing thread
def process_audio():
    mel = np.zeros((76, 32), dtype=np.float32)  # Placeholder for mel spectrogram
    history = np.zeros(480, dtype=np.float32)
    features = np.zeros((27, 96), dtype=np.float32)
    model = SharedLinearNet()
    model.load_state_dict(torch.load("binary_model.pth"))
    model.eval()
    abs_max = 0.0

    while True:
        # Pull new audio
        new_audio = audio_queue.get()
        new_audio = new_audio.flatten().astype(np.float32)
        full_window = np.concatenate((history, new_audio))
        history = full_window[-480:]
        #print("-- ", len(full_window), min(full_window), max(full_window))
        input_tensor = full_window.astype(np.float32).reshape(1, -1)
        mel_output = first_model[1].run([first_model[3]], {(first_model[2]): input_tensor})[0].reshape(8, -1)
        mel[:-8] = mel[8:].copy()
        mel[-8:] = mel_output
        #print("-- ", min(mel.flatten()), max(mel.flatten()))
        features_output = second_model[1].run([second_model[3]], {(second_model[2]): mel.reshape((1, 76, 32, 1))})[0].flatten()
        features[:-1] = features[1:].copy()
        features[-1] = features_output
        #print("-- ", features.shape, min(features.flatten()), max(features.flatten()))
        output = model(torch.from_numpy(features.flatten()))
        result = output.detach().numpy()[0]
        abs_max = max(abs_max, abs(result))
        if result > 0:
            RED = "\033[91m"
            RESET = "\033[0m"
            #print(f"{RED}{result:3.2f} - DETECTED!!!{RESET}")
            mag = math.ceil(result / (abs_max if abs_max > 0 else 1) * 20)
            print(RED + ' ' * 20 + '█' * mag + ' ' * (20 - mag) + f' {result:3.2f} - DETECTED!!!' + RESET)
        else:
            mag = math.ceil(result / (abs_max if abs_max > 0 else 1) * -20)
            print(' ' * (20 - mag) + '▒' * mag + ' ' * 20 + f' {result:3.2f}')
        continue

# Start audio input stream
stream = sd.InputStream(callback=audio_callback, channels=1, samplerate=SAMPLE_RATE, blocksize=1280)
stream.start()

# Start processing thread
thread = threading.Thread(target=process_audio, daemon=True)
thread.start()

print("Listening and processing... Press Ctrl+C to stop.")
try:
    while True:
        sd.sleep(1000)
except KeyboardInterrupt:
    print("\nStopping...")
    stream.stop()
    stream.close()
