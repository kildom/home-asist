
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
    positive_from_samples = 4000
    negative_from_samples = 3000
    negative_from_background = 1000
    negative_from_start_of_label_probability = 0.5
    dump_probability = 0.001

########## Not so ofter changed configuration options ##########

# The embedding window must be divisible by this value if we want to reuse head model weights
EMBEDDINGS_WINDOW_DEVISABLE_BY = 3
# Length of the input needed to generate a single mel frequency vector
MEL_WINDOW_LENGTH = 400
# Sampling rate of the audio samples
SAMPLE_RATE = 16000
# Maximum wake up word length in samples
REQUIRED_MAX_WORD_LENGTH = int(math.ceil(REQUIRED_MAX_WORD_LENGTH_MS * SAMPLE_RATE / 1000))
# Minimum wake up word length in samples
MIN_WORD_LENGTH = int(math.floor(MIN_WORD_LENGTH_MS * SAMPLE_RATE / 1000))
# Input shape of the embedding model
EMBEDDING_MODEL_INPUT_SHAPE = (76, 32)
# Step of the embedding model, number of vectors of mel bins
EMBEDDING_MODEL_STEP = 8
# Number of samples every mel frequency vector
MEL_WINDOW_STEP = 160
# Number of milliseconds that the target word can be shifted in time and still be recognized.
WORD_SHIFT_LENGTH = EMBEDDING_MODEL_STEP * MEL_WINDOW_STEP
# Length of the audio that must be also analyzed before the target word (because of windows sizes).
WORD_PREFIX_LENGTH = MEL_WINDOW_LENGTH // 2 + EMBEDDING_MODEL_INPUT_SHAPE[0] * MEL_WINDOW_STEP
# Length of the audio that must be also analyzed after the target word (because of windows sizes).
WORD_SUFFIX_LENGTH = MEL_WINDOW_LENGTH // 2 + EMBEDDING_MODEL_INPUT_SHAPE[0] * MEL_WINDOW_STEP
# Number of embedding vectors generated from input window (INPUT_WINDOW_LENGTH_MS)
for EMBEDDINGS_COUNT in range(EMBEDDINGS_WINDOW_DEVISABLE_BY, 1000000, EMBEDDINGS_WINDOW_DEVISABLE_BY):
    # Number of vectors in the mel histogram generated from input window (INPUT_WINDOW_LENGTH_MS)
    HISTOGRAM_LENGTH = (EMBEDDINGS_COUNT - 1) * EMBEDDING_MODEL_STEP + EMBEDDING_MODEL_INPUT_SHAPE[0]
    # The input audio window needed to do single detection. Training sample must be exactly this length.
    INPUT_WINDOW_LENGTH = (HISTOGRAM_LENGTH - 1) * MEL_WINDOW_STEP + MEL_WINDOW_LENGTH
    if INPUT_WINDOW_LENGTH >= REQUIRED_MAX_WORD_LENGTH + WORD_SHIFT_LENGTH + WORD_PREFIX_LENGTH + WORD_SUFFIX_LENGTH:
        break
# Actual maximum word length in milliseconds, which may be greater than the required because of the required alignment.
MAX_WORD_LENGTH = INPUT_WINDOW_LENGTH - WORD_SHIFT_LENGTH - WORD_PREFIX_LENGTH - WORD_SUFFIX_LENGTH
# Sample loudness in LUFS for training
LOUDNESS_NORMALIZATION_DB = -22.0

modifications = Modifications()
generation = Generation()


if __name__ == "__main__":
    for name, value in list(vars().items()):
        if name.startswith('__'):
            continue
        if type(value) in (int, float, str, bool):
            print(f"{name} = {value}")
        if type(value) in (Modifications, Generation):
            for sub_name, sub_value in list(vars(value.__class__).items()):
                if sub_name.startswith('__'):
                    continue
                print(f"{name}.{sub_name} = {sub_value}")
