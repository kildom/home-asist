
import numpy as np

# Example code, computes the coefficients of a low-pass windowed-sinc filter.

# Configuration.
fS = 3072000  # Sampling rate.
fL = 24000  # Cutoff frequency.
N = 512  # Filter length, must be odd.

# Compute sinc filter.
h = np.sinc(2 * fL / fS * (np.arange(N) - (N - 1) / 2))

# Apply window.
h *= np.hamming(N)

# Normalize to get unity gain.
h /= np.sum(h)

print(len(h))

# Applying the filter to a signal s can be as simple as writing
# s = np.convolve(s, h)