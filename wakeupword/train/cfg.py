from pathlib import Path
import sys
from types import SimpleNamespace
import yaml

DATA_DIR = Path(__file__).parent.parent / "data"
SOURCE_DIR = DATA_DIR / "src"
TMP_DIR = DATA_DIR / "tmp"

class SourceConfig(SimpleNamespace):
    type: str
    dir: Path

class Config(SimpleNamespace):
    phrases: list[list[str]]
    phrase_length_min: float
    phrase_length_max: float
    negative_phrases: list[str]
    sources: list[SourceConfig]

def read_config() -> Config:
    yaml_path = DATA_DIR / "config.yaml"
    if not yaml_path.exists():
        print(f"Config file not found at {yaml_path.resolve()}.", file=sys.stderr)
        print(f"See 'config-sample.yaml' for an example configuration.", file=sys.stderr)
        yaml_path = DATA_DIR / "config-sample.yaml"
        #exit(1)
    # Load config
    with yaml_path.open() as f:
        data = yaml.safe_load(f)
    # Make phrases always a list of lists of strings
    if isinstance(data['phrases'], str):
        data['phrases'] = [[data['phrases']]]
    elif isinstance(data['phrases'], list) and isinstance(data['phrases'][0], str):
        data['phrases'] = [data['phrases']]
    # Convert sources to SourceConfig objects
    data['sources'] = [SourceConfig(**source) for source in data.get('sources', [])]
    return Config(**data)

config = read_config()

########## Commonly changed configuration options ##########

# Maximum wake up word length (how long the word can be spoken if it is spoken slowly)
MAX_WORD_LENGTH_MS = int(round(config.phrase_length_max * 1000))
# Minimum wake up word length (how long the word can be spoken if it is spoken very fast)
MIN_WORD_LENGTH_MS = int(round(config.phrase_length_min * 1000))
# Prefix process length (in fraction of embedding model window length - 775 ms)
PREFIX_PROCESS_LENGTH_FRACTION = 0.5
# Suffix process length (in fraction of embedding model window length - 775 ms)
SUFFIX_PROCESS_LENGTH_FRACTION = 0.5

# The input data should look like this:
#
# |----time---->
# | prefix | misaligned | maximum-length target word | 1 - misaligned | suffix |
#
# where: prefix - audio needed to start the embedding model window before the target word,
#        suffix - audio needed to end the embedding model window after the target word,
#        misaligned - how much the target word can be misaligned with the embedding model hop length,
#                     which is less than 1280 samples (80 ms).
#        maximum-length target word - the longest target word that can be recognized,
#                                     if it is shorter, it will be aligned to the right.


########## Embedding model specific configuration ##########

# Sample rate
SAMPLE_RATE = 16000
# Window length for the embedding model (including mel window)
EMBEDDING_MODEL_WINDOW_LENGTH = 12400
# Hop length for the embedding model
EMBEDDING_MODEL_HOP_LENGTH = 1280
# Window length for the mel spectrogram
MEL_SPECTROGRAM_WINDOW_LENGTH = 400
# Hop length for the mel spectrogram
MEL_SPECTROGRAM_HOP_LENGTH = 160


########## Head model specific configuration ##########


# The count of the head model input embeddings must be divisible by this value
HEAD_INPUT_DIVISIBLE_BY = 3


########## Configuration calculated based on previous data ##########

# Maximum wake up word length (if spoken very slowly) in samples
MAX_WORD_LENGTH = MAX_WORD_LENGTH_MS * SAMPLE_RATE // 1000
# Prefix process length in samples
PREFIX_LENGTH = int(round(PREFIX_PROCESS_LENGTH_FRACTION * EMBEDDING_MODEL_WINDOW_LENGTH))
# Suffix process length in samples
SUFFIX_LENGTH = int(round(SUFFIX_PROCESS_LENGTH_FRACTION * EMBEDDING_MODEL_WINDOW_LENGTH))
# Misalignment length in samples
MISALIGNMENT_LENGTH = EMBEDDING_MODEL_HOP_LENGTH
# Required total audio length needed for training process (in samples), actual can be longer because of the alignment
REQUIRED_TOTAL_AUDIO_LENGTH = PREFIX_LENGTH + MISALIGNMENT_LENGTH + MAX_WORD_LENGTH + SUFFIX_LENGTH
# Required embedding vectors count, actual can be more because of the alignment
REQUIRED_EMBEDDING_VECTORS_COUNT = (REQUIRED_TOTAL_AUDIO_LENGTH - EMBEDDING_MODEL_WINDOW_LENGTH + EMBEDDING_MODEL_HOP_LENGTH - 1) // EMBEDDING_MODEL_HOP_LENGTH + 1
# Actual embedding vectors count
EMBEDDING_VECTORS_COUNT = ((REQUIRED_EMBEDDING_VECTORS_COUNT + HEAD_INPUT_DIVISIBLE_BY - 1) // HEAD_INPUT_DIVISIBLE_BY) * HEAD_INPUT_DIVISIBLE_BY
# Actual total audio length needed for training process (in samples)
TOTAL_AUDIO_LENGTH = EMBEDDING_MODEL_WINDOW_LENGTH + (EMBEDDING_VECTORS_COUNT - 1) * EMBEDDING_MODEL_HOP_LENGTH


def _test():
    from pprint import pprint
    pprint(config)
    for name, value in list(globals().items()):
        if name.startswith('__'):
            continue
        if type(value) in (int, float, str, bool):
            if type(value) is int and name.endswith('_LENGTH'):
                print(f"{name} = {value} (ms: {value * 1000 / SAMPLE_RATE})")
            else:
                print(f"{name} = {value}")


if __name__ == "__main__":
    _test()
