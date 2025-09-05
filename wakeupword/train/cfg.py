import math

########## Commonly changed configuration options ##########

# Maximum wake up word length (how long the word can be spoken if it is spoken slowly)
MAX_WORD_LENGTH_MS = 1200
# Minimum wake up word length (how long the word can be spoken if it is spoken very fast)
MIN_WORD_LENGTH_MS = 500
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

MAX_WORD_LENGTH = MAX_WORD_LENGTH_MS * SAMPLE_RATE // 1000
PREFIX_LENGTH = int(round(PREFIX_PROCESS_LENGTH_FRACTION * EMBEDDING_MODEL_WINDOW_LENGTH))
SUFFIX_LENGTH = int(round(SUFFIX_PROCESS_LENGTH_FRACTION * EMBEDDING_MODEL_WINDOW_LENGTH))
MISSALIGNMENT_LENGTH = EMBEDDING_MODEL_HOP_LENGTH

REQUIRED_TOTAL_AUDIO_LENGTH = PREFIX_LENGTH + MISSALIGNMENT_LENGTH + MAX_WORD_LENGTH + SUFFIX_LENGTH

REQUIRED_EMBEDDING_VECTORS_COUNT = (REQUIRED_TOTAL_AUDIO_LENGTH - EMBEDDING_MODEL_WINDOW_LENGTH + EMBEDDING_MODEL_HOP_LENGTH - 1) // EMBEDDING_MODEL_HOP_LENGTH + 1
EMBEDDING_VECTORS_COUNT = ((REQUIRED_EMBEDDING_VECTORS_COUNT + HEAD_INPUT_DIVISIBLE_BY - 1) // HEAD_INPUT_DIVISIBLE_BY) * HEAD_INPUT_DIVISIBLE_BY
TOTAL_AUDIO_LENGTH = EMBEDDING_MODEL_WINDOW_LENGTH + (EMBEDDING_VECTORS_COUNT - 1) * EMBEDDING_MODEL_HOP_LENGTH


if __name__ == "__main__":
    for name, value in list(vars().items()):
        if name.startswith('__'):
            continue
        if type(value) in (int, float, str, bool):
            if type(value) is int and name.endswith('_LENGTH'):
                print(f"{name} = {value} (samples->ms: {value * 1000 / SAMPLE_RATE})")
            else:
                print(f"{name} = {value}")
        # if type(value) in (Modifications, Generation):
        #     for sub_name, sub_value in list(vars(value.__class__).items()):
        #         if sub_name.startswith('__'):
        #             continue
        #         print(f"{name}.{sub_name} = {sub_value}")
