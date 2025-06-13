

Distortions:
 * Resample: speed up or slow down avoiding maximum length
 * Delay at most ~100ms (more than 80ms)
 * Add noise
 * Add background: speech, music
 * Reverberate with room impulse responses

Resample:

```python
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample

# Load original WAV
original_rate, data = wavfile.read('example.wav')

# Target sample rate
target_rate = 16000

# Calculate number of samples for new rate
duration = data.shape[0] / original_rate
num_samples = int(duration * target_rate)

# Resample
resampled_data = resample(data, num_samples)

# Convert to same dtype as original (optional)
resampled_data = resampled_data.astype(data.dtype)

# Save to new file
wavfile.write('resampled.wav', target_rate, resampled_data)
```
