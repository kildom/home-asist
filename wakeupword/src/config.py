
import math
from pathlib import Path

########## Commonly changed configuration options ##########

# Source of samples (WAV + TXT files with labels)
SAMPLE_DIR = (Path(__file__).parent / '../../../home-asist-samples').resolve()
MODELS_DIR = (Path(__file__).parent / '../models').resolve()
DATA_DIR = (Path(__file__).parent / '../data').resolve()

# Maximum wake up word length (how long the word can be spoken if it is spoken slowly)
REQUIRED_MAX_WORD_LENGTH_MS = 1200
# Minimum wake up word length (how long the word can be spoken if it is spoken very fast)
MIN_WORD_LENGTH_MS = 500

# Possible modifications to the samples when generating distorted samples for training
class Modifications:
    resample_probability = 0.5
    resample_max_rate = 1.2
    resample_min_rate = 0.8

    background_noise_probability = 0.8
    background_noise_min_db = 20
    background_noise_max_db = 25

    color_noise_probability = 0.6
    color_noise_min_db = 17
    color_noise_max_db = 20

    impulse_response_probability = 0.9

    gain_probability = 0.9
    gain_min_db = -15
    gain_max_db = 0.0

# Number of samples to generate for training
class Generation:
    positive_from_samples = 40000 * 3
    negative_from_samples = 30000 * 3
    negative_from_background = 10000 * 3
    negative_from_start_of_label_probability = 0.5
    dump_probability = 0.001

########## Not so ofter changed configuration options ##########

# The embedding window must be divisible by this value if we want to reuse head model weights
EMBEDDINGS_WINDOW_DEVISABLE_BY = 3
# The input audio window needed to do single detection. Training sample must be exactly this length.
_INPUT_WINDOW_LENGTH_MS = REQUIRED_MAX_WORD_LENGTH_MS + 1640
# Number of vectors in the histogram generated from input window (INPUT_WINDOW_LENGTH_MS)
_HISTOGRAM_LENGTH = math.ceil((_INPUT_WINDOW_LENGTH_MS - 30) / 10)
# Number of embedding vectors generated from input window (INPUT_WINDOW_LENGTH_MS)
EMBEDDINGS_COUNT = math.ceil(((_HISTOGRAM_LENGTH - 76) / 8 + 1) / EMBEDDINGS_WINDOW_DEVISABLE_BY) * EMBEDDINGS_WINDOW_DEVISABLE_BY
# Number of vectors in the histogram generated from input window (INPUT_WINDOW_LENGTH_MS)
HISTOGRAM_LENGTH = (EMBEDDINGS_COUNT - 1) * 8 + 76
# The input audio window needed to do single detection. Training sample must be exactly this length.
INPUT_WINDOW_LENGTH_MS = HISTOGRAM_LENGTH * 10 + 30
# Actual maximum word length in milliseconds, which may be greater than the required because of the required alignment.
MAX_WORD_LENGTH_MS = INPUT_WINDOW_LENGTH_MS - 1640
# Number of features in each embedding vector
FEATURES_COUNT = 96
# Number of values in single frequency vector of the mel frequency spectrum
MEL_FREQUENCY_VALUES = 32
# Length of the input needed to generate a single mel frequency vector
MEL_WINDOW_LENGTH_MS = 40
# Length of single step in time that generates next mel frequency vector
MEL_STEP_LENGTH_MS = 10
# Length of the input needed to generate a single embedding vector
EMBEDDING_MODEL_INPUT_LENGTH_MS = 760
# Length of the audio that must be also analyzed before the target word (because of windows sizes).
WORD_PREFIX_LENGTH_MS = 780
# Length of the audio that must be also analyzed after the target word (because of windows sizes).
WORD_SUFFIX_LENGTH_MS = 780
# Number of milliseconds that the target word can be shifted in time and still be recognized.
WORD_SHIFT_LENGTH_MS = 80
# Sampling rate of the audio samples
SAMPLE_RATE = 16000
# Number of samples per millisecond
SAMPLES_PER_MS = int(round(SAMPLE_RATE / 1000))
# Sample loudness in LUFS for training
LOUDNESS_NORMALIZATION_DB = -22.0

modifications = Modifications()
generation = Generation()


if __name__ == "__main__":
    print(f"REQUIRED_MAX_WORD_LENGTH_MS = {REQUIRED_MAX_WORD_LENGTH_MS}")
    print(f"SAMPLE_DIR = {SAMPLE_DIR}")
    print(f"EMBEDDINGS_WINDOW_DEVISABLE_BY = {EMBEDDINGS_WINDOW_DEVISABLE_BY}")
    print(f"INPUT_WINDOW_LENGTH_MS = {INPUT_WINDOW_LENGTH_MS}")
    print(f"MAX_WORD_LENGTH_MS = {MAX_WORD_LENGTH_MS}")
    print(f"HISTOGRAM_LENGTH = {HISTOGRAM_LENGTH}")
    print(f"EMBEDDINGS_COUNT = {EMBEDDINGS_COUNT}")
    print(f"FEATURES_COUNT = {FEATURES_COUNT}")
    print(f"MEL_FREQUENCY_VALUES = {MEL_FREQUENCY_VALUES}")
    print(f"MEL_WINDOW_LENGTH_MS = {MEL_WINDOW_LENGTH_MS}")
    print(f"EMBEDDING_MODEL_INPUT_LENGTH_MS = {EMBEDDING_MODEL_INPUT_LENGTH_MS}")
    print(f"SAMPLE_RATE = {SAMPLE_RATE}")
    print(f"modifications.resample_probability = {modifications.resample_probability}")
    print(f"modifications.resample_max_rate = {modifications.resample_max_rate}")
    print(f"modifications.resample_min_rate = {modifications.resample_min_rate}")
    print(f"modifications.background_noise_probability = {modifications.background_noise_probability}")
    print(f"modifications.background_noise_min_db = {modifications.background_noise_min_db}")
    print(f"modifications.background_noise_max_db = {modifications.background_noise_max_db}")
    print(f"modifications.color_noise_probability = {modifications.color_noise_probability}")
    print(f"modifications.color_noise_min_db = {modifications.color_noise_min_db}")
    print(f"modifications.color_noise_max_db = {modifications.color_noise_max_db}")
    print(f"modifications.impulse_response_probability = {modifications.impulse_response_probability}")
    print(f"modifications.gain_probability = {modifications.gain_probability}")
    print(f"modifications.gain_min_db = {modifications.gain_min_db}")
    print(f"modifications.gain_max_db = {modifications.gain_max_db}")
    print(f"generation.positive_from_samples = {generation.positive_from_samples}")
    print(f"generation.negative_from_samples = {generation.negative_from_samples}")
    print(f"generation.negative_from_background = {generation.negative_from_background}")
