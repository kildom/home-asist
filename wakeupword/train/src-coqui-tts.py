

import math
import random
import sys
import numpy as np
from types import SimpleNamespace
from pathlib import Path
from tqdm import tqdm
from datasets import load_dataset
from scipy.signal import resample
from scipy.io import wavfile
from cfg import SourceConfig, config
import cfg
import torch
from TTS.api import TTS
from src import write_sample
from src import generate_simple_phrase_set



class CoquiTTSConfig(SourceConfig):
    model: str
    language: str
    max_negative_samples_per_speaker: int
    weight: float # Since we have different number of sample, we may want to do positive_weight and negative_weight
    positive_weight: float
    negative_weight: float
    speaker_weights: dict[str, float]


def adjust_optional(obj, name, default):
    if not hasattr(obj, name):
        setattr(obj, name, default)

def adjust_config(tts_config: CoquiTTSConfig):
    adjust_optional(tts_config, 'model', 'tts_models/multilingual/multi-dataset/xtts_v2')
    adjust_optional(tts_config, 'language', 'en')
    adjust_optional(tts_config, 'max_negative_samples_per_speaker', 0x7FFFFFFF)
    adjust_optional(tts_config, 'weight', 1.0)
    adjust_optional(tts_config, 'positive_weight', tts_config.weight)
    adjust_optional(tts_config, 'negative_weight', tts_config.weight)
    adjust_optional(tts_config, 'speaker_weights', {})


def generate(tts_config: CoquiTTSConfig):
    adjust_config(tts_config)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = TTS(tts_config.model).to(device)

    print("Speakers and their weights:")
    speaker_weights = tts_config.speaker_weights
    negative_weight_coefficient = tts_config.negative_weight / tts_config.positive_weight
    if tts.speakers is not None:
        speakers = [
            (s, speaker_weights.get(s, tts_config.weight))
            for s in tts.speakers
        ]
    else:
        speakers = [("default", 1.0)]
    for speaker_name, weight in speakers:
        print(f"  {speaker_name}: positive: {weight}, negative: {weight * negative_weight_coefficient}")
    speakers = [p for p in speakers if p[1] > 0.0]
    
    sample_rate = tts.synthesizer.output_sample_rate

    negative_samples_per_speaker = min(tts_config.max_negative_samples_per_speaker, len(config.negative_phrases))
    positive_phrases = [phrase for group in config.phrases for phrase in group]

    print(f"Generating {len(positive_phrases)} positive phrases with {len(speakers)} speakers totalling {len(positive_phrases) * len(speakers)} samples.")
    print(f"Generating {negative_samples_per_speaker} negative phrases with {len(speakers)} speakers totalling {negative_samples_per_speaker * len(speakers)} samples.")

    sample_index = 0
    progress = tqdm(total=len(positive_phrases) * len(speakers) + negative_samples_per_speaker * len(speakers), desc=tts_config.dir)
    for speaker_name, weight in speakers:
        for phrase in positive_phrases:
            for _ in range(2): # Workaround: some models add some trash at the end of sample, so retry generation
                wav = tts.tts(text=phrase, language=tts_config.language if tts.is_multi_lingual else None, speaker=speaker_name if tts.is_multi_speaker else None)
                wav = np.array(wav, dtype=np.float32)
                if len(wav) / sample_rate > 2 * config.phrase_length_max:
                    continue
                output_name = f"positive/{sample_index // 100:03d}/{sample_index:05d}-{speaker_name.replace(' ', '-')}"
                sample_index += 1
                write_sample(tts_config, sample_rate, wav, output_name, [{
                    "start": 0.0,
                    "end": len(wav) / sample_rate,
                    "phrase": phrase,
                    "weight": weight,
                }])
                break
            progress.update()

    sample_index = 0
    for speaker_name, weight in speakers:
        negative_phrases = config.negative_phrases
        if len(negative_phrases) != negative_samples_per_speaker:
            random.shuffle(negative_phrases)
            negative_phrases = negative_phrases[:negative_samples_per_speaker]
        for phrase in negative_phrases:
            wav = tts.tts(text=phrase, language=tts_config.language if tts.is_multi_lingual else None, speaker=speaker_name if tts.is_multi_speaker else None)
            wav = np.array(wav, dtype=np.float32)
            output_name = f"negative/{sample_index // 100:03d}/{sample_index:05d}-{speaker_name.replace(' ', '-')}"
            sample_index += 1
            write_sample(tts_config, sample_rate, wav, output_name, [{
                "start": 0.0,
                "end": len(wav) / sample_rate,
                "phrase": phrase,
                "weight": weight * negative_weight_coefficient,
            }])
            progress.update()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        for index, source in enumerate(config.sources):
            if source.type == 'coqui-tts':
                break
    else:
        index = int(sys.argv[1])        
    generate(config.sources[index])



# TODO: Implement
# https://github.com/idiap/coqui-ai-TTS
# https://coqui-tts.readthedocs.io/
#
# 1. Use pre-trained single voice models (if available)
# 2. Find and download library of different speeches 
# 3. Use voice cloning with multiple models
# 4. Use voice conversion with multiple models
#    - Source files generated by other methods
#    - Speaker files from downloaded library


# import torch
# from TTS.api import TTS

# # Get device
# device = "cuda" if torch.cuda.is_available() else "cpu"

# print(f"Using device: {device}")

# # List available 🐸TTS models
# print('\n'.join(TTS().list_models()))

# # Initialize TTS
# tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

# # List speakers
# print(tts.speakers)

# # Run TTS
# # ❗ XTTS supports both, but many models allow only one of the `speaker` and
# # `speaker_wav` arguments

# # TTS with list of amplitude values as output, clone the voice from `speaker_wav`
# wav = tts.tts(
#   text="Hello world!",
#   speaker_wav="my/cloning/audio.wav",
#   language="en"
# )

# # TTS to a file, use a preset speaker
# tts.tts_to_file(
#   text="Hello world!",
#   speaker="Craig Gutsy",
#   language="en",
#   file_path="output.wav"
# )