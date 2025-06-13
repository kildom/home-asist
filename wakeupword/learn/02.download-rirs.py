import sys
import os
from pathlib import Path
import datasets
from scipy.io import wavfile
from tqdm import tqdm
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import src.config as cfg
import numpy as np

print("Downloading RIRs...")

output_dir = Path(__file__).parent.parent / 'data/mit_rirs'
if output_dir.exists():
    print(f"Output directory {output_dir} already exists, skipping download.")
    exit(0)

removed_max = 0
tmp_dir = output_dir.with_suffix('.tmp')
tmp_dir.mkdir(parents=True, exist_ok=True)
rir_dataset = datasets.load_dataset("davidscripka/MIT_environmental_impulse_responses", split="train", streaming=True)
for row in tqdm(rir_dataset):
    name = row['audio']['path'].split('/')[-1]
    file = tmp_dir / name
    sample_rate = row['audio']['sampling_rate']
    data = (row['audio']['array'] * 32767).astype(np.int16)
    if sample_rate != 16000:
        raise ValueError(f"Expected sampling rate of 16000, got {row['audio']['sampling_rate']}")
    threshold = max(abs(data.max()), abs(data.min())) / 4
    first_real_sample = 0
    for i in range(len(data)):
        if abs(data[i]) > threshold:
            first_real_sample = max(0, i - 1)
            break
    data = data[first_real_sample:]
    removed_max = max(removed_max, first_real_sample)
    wavfile.write(file, 16000, data)
tmp_dir.rename(output_dir)
print(f'Maximum removed {removed_max / sample_rate} seconds from the beginning of each RIR file.')
