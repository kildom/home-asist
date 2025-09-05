
import numpy as np
import torch
from consts import mel_weights, fft_window, mel_bias

def calc_mel(data):
    if len(data) < 400:
        return np.zeros((0, 32), dtype=np.float32)
    if isinstance(data, np.ndarray):
        data = torch.from_numpy(data)
    count = (len(data) - 400) // 160 + 1
    result = np.zeros((count, 32), dtype=np.float32)
    for i in range(count):
        frame_data = data[i * 160:i * 160 + 400]
        frame_data = frame_data * fft_window
        frame_data = np.pad(frame_data, (0, 512 - len(frame_data)), mode='constant', constant_values=0)
        frame_data = torch.from_numpy(frame_data)
        compl = torch.fft.rfft(frame_data)
        real = compl.abs().numpy()
        result[i] = np.dot(mel_weights, real) + mel_bias
    return np.log(result)
