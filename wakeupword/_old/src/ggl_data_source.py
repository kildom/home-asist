from typing import Tuple
import numpy as np
from pathlib import Path
from scipy.io import wavfile
from scipy.signal import resample
from common import ROOT, SAMPLE_RATE

def open_file(filename: Path) -> Tuple[int, np.ndarray]:
    sample_rate, data = wavfile.read(filename)
    if sample_rate != SAMPLE_RATE:
        duration = data.shape[0] / sample_rate
        num_samples = int(duration * SAMPLE_RATE)
        data = resample(data, num_samples)
    if data.dtype != 'float32':
        data = data.astype('float32')
    return sample_rate, data

def detect_begin_end(sample_rate: int, data: np.ndarray) -> np.ndarray:
    WINDOW_SIZE = 128
    out = data.copy()
    acc = data[0]
    prev = data[0]
    window = data.copy()
    window_start = 0
    window_sum = 0
    max_mag = 0
    for i in range(data.shape[0]):
        acc = 0.8 * acc + 0.2 * data[i]
        adjusted = data[i] - acc
        diff = adjusted - prev
        prev = adjusted
        mag = abs(diff) #+ abs(diff)
        max_mag = max(max_mag, abs(mag))
        window[i] = mag
        window_sum += mag
        if i - window_start >= WINDOW_SIZE:
            window_sum -= window[window_start]
            window_start += 1
        out[i] = window_sum / WINDOW_SIZE
    for i in range(data.shape[0]):
        #out[i] = min(1, out[i] / max_mag * 500) * 32000
        out[i] = 32000 if out[i] / max_mag * 500 > 1 else 0
    begin = max(0, out.nonzero()[0][0] - 128) / SAMPLE_RATE
    end = out.nonzero()[0][-1] / SAMPLE_RATE
    #wavfile.write(ROOT / 'data/tmp/ggl2/debug_1.wav', SAMPLE_RATE, out.astype('int16'))
    return begin, end

def get_samples() -> None:
    dir = ROOT / 'data/tmp/ggl'
    for file in dir.glob('pl-*.wav'):
        sample_rate, data = wavfile.read(file)
        data = data.astype('float32')
        begin, end = detect_begin_end(sample_rate, data)
        print(f"File: {file}, Sample Rate: {sample_rate}, Data Shape: {data.shape} {data.dtype}")


if __name__ == '__main__':
    get_samples()