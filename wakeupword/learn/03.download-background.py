import sys
import os
from pathlib import Path
import datasets
from scipy.io import wavfile
from scipy.signal import resample
from tqdm import tqdm
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import src.config as cfg
import numpy as np

print("Downloading background sounds...")

output_dir = Path(__file__).parent.parent / 'data/esc50'
if not output_dir.exists():
    tmp_dir = output_dir.with_suffix('.tmp')
    tmp_dir.mkdir(parents=True, exist_ok=True)
    esc50_dataset = datasets.load_dataset("ashraq/esc50", split="train", streaming=True)
    for row in tqdm(esc50_dataset):
        name = row['filename']
        file = tmp_dir / name
        data = row['audio']['array']
        sampling_rate = row['audio']['sampling_rate']
        if sampling_rate != cfg.SAMPLE_RATE:
            duration = data.shape[0] / sampling_rate
            num_samples = int(duration * cfg.SAMPLE_RATE)
            data = resample(data, num_samples)
        wavfile.write(file, 16000, (data * 32767).astype(np.int16))
    tmp_dir.rename(output_dir)
else:
    print(f"Output directory {output_dir} already exists, skipping download.")
