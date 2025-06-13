
import os
import sys
import math
from tqdm import tqdm
import numpy as np
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.common import find_samples
import src.config as cfg

positive_length_max = 0
positive_length_min = float('inf')
negative_length_max = 0
negative_length_min = float('inf')
hist = np.zeros(100).astype('int32')
total = 0
for sample in tqdm(find_samples(cfg.SAMPLE_DIR)):
    for label in sample.labels:
        total += 1
        length = label.end - label.begin
        if label.text.lower().startswith('p'):
            positive_length_max = max(positive_length_max, length)
            positive_length_min = min(positive_length_min, length)
            hist[math.ceil(length * 10)] += 1
        elif label.text.lower().startswith('n'):
            negative_length_max = max(negative_length_max, length)
            negative_length_min = min(negative_length_min, length)
print(f'Total labels: {total}')
print(f'    Positive: {sum(hist)}')
print(f'    Negative: {total - sum(hist)}')
print(f'Positive length max: {positive_length_max}')
print(f'Positive length min: {positive_length_min}')
print(f'Positive length configured max: {cfg.MAX_WORD_LENGTH_MS / 1000}')
print(f'Negative length max: {negative_length_max}')
print(f'Negative length min: {negative_length_min}')
print(f'Number of samples per length:\n    LEN      COUNT')
for i in range(1, len(hist) - 1):
    if hist[i] or (max(hist[:i]) > 0 and max(hist[i + 1:]) > 0):
        print(f'    {i / 10:1.1f}{hist[i]:8}  {"■" * round(hist[i] / max(hist) * 30)}')
if positive_length_max > cfg.MAX_WORD_LENGTH_MS / 1000:
    raise ValueError(f'WARNING: Positive length max {positive_length_max} exceeds configured max {cfg.MAX_WORD_LENGTH_MS / 1000}.')