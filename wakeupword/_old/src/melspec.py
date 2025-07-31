import sys
import os
import torch
from torchaudio.transforms import MelSpectrogram
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import src.config as cfg

# Mel spectrogram configuration from:
# https://www.kaggle.com/models/google/speech-embedding/tensorFlow1/speech-embedding/
SAMPLE_RATE = 16000
N_FFT = 400 # 25ms window
WIN_LENGTH = 400 # 25ms window
HOP_LENGTH = 160 # 10ms step
F_MIN = 60 # Minimum frequency
F_MAX = 3800 # Maximum frequency
N_MELS = 32 # Number of mel bands

assert SAMPLE_RATE == cfg.SAMPLE_RATE, "SAMPLE_RATE in config must match the one used here."
assert N_FFT == cfg.MEL_WINDOW_LENGTH, "N_FFT must match MEL_WINDOW_LENGTH in config."
assert WIN_LENGTH == cfg.MEL_WINDOW_LENGTH, "WIN_LENGTH must match N_FFT."
assert HOP_LENGTH == cfg.MEL_WINDOW_STEP, "HOP_LENGTH must match MEL_WINDOW_STEP in config."
assert N_MELS == cfg.EMBEDDING_MODEL_INPUT_SHAPE[1], "N_MELS must match the second dimension of EMBEDDING_MODEL_INPUT_SHAPE in config."

def create_mel_spectrogram():
    return MelSpectrogram(
        sample_rate=SAMPLE_RATE,
        n_fft=N_FFT,
        win_length=N_FFT,
        hop_length=HOP_LENGTH,
        f_min=F_MIN,
        f_max=F_MAX,
        n_mels=N_MELS,
        window_fn=torch.hann_window,
        )

if __name__ == "__main__":
    import numpy as np
    import matplotlib.pyplot as plt

    mel_spectrogram = create_mel_spectrogram()

    # Generate 250ms of 60 Hz, 1200 Hz, and 3800 Hz sine waves
    duration = 0.25  # seconds
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    sig_60 = np.sin(2 * np.pi * 60 * t)
    sig_1200 = np.sin(2 * np.pi * 1200 * t)
    sig_3800 = np.sin(2 * np.pi * 3800 * t)

    # Concatenate the signals
    signal = np.concatenate([sig_60, sig_1200, sig_3800]).astype(np.float32)
    signal_tensor = torch.from_numpy(signal).unsqueeze(0)  # shape: (1, N)

    # Compute mel spectrogram
    mel_spec = mel_spectrogram(signal_tensor)
    mel_spec_db = 1 * torch.log(mel_spec + 1e-3)  # Convert to dB

    # Plot
    plt.figure(figsize=(10, 4))
    plt.imshow(mel_spec_db.squeeze().numpy(), aspect='auto', origin='lower', 
               extent=[0, len(signal)/SAMPLE_RATE, F_MIN, F_MAX])
    plt.title("Mel Spectrogram of Test Signal")
    plt.ylabel("Mel Frequency")
    plt.xlabel("Time (s)")
    plt.colorbar(label="dB")
    plt.tight_layout()
    plt.show()
