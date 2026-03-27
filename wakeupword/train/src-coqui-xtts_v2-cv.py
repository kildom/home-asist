

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


def download_speakers(language: str, require_samples: int, required_length: float, speakers_dir: Path):

    class Sentence(SimpleNamespace):
        next: 'str | None'
        score: int
        index: int

    class Speaker(SimpleNamespace):
        id: str
        score: float
        total_samples: int
        sentences: dict[str, Sentence]
        copied_sentences: int

    speakers_dir.mkdir(parents=True, exist_ok=True)

    # Check if directory is empty, if not, assume that data is already generated
    if any(speakers_dir.iterdir()):
        return

    cv_17 = load_dataset("fixie-ai/common_voice_17_0", language, split="validated")
    # cv_17 = load_dataset("fixie-ai/common_voice_17_0", language, split="validation")

    speakers: dict[str, Speaker] = {}
    avg_score = 0.0
    avg_score_count = 0

    # Scan through all samples and prepare data for further processing.
    for index, sample in tqdm(enumerate(cv_17), desc='Initial scan', total=len(cv_17)):
        speaker_id = sample['client_id']
        score = sample['up_votes'] - 2 * sample['down_votes']
        sentence = sample['sentence']
        next_sentence = sample['continuation']
        if not next_sentence:
            next_sentence = None
        avg_score += score
        avg_score_count += 1
        if speaker_id not in speakers:
            speakers[speaker_id] = Speaker(
                id=speaker_id,
                score=0.0,
                total_samples=1,
                sentences={sentence: Sentence(next=next_sentence, score=score, index=index)},
                copied_sentences=0,
            )
        else:
            speaker = speakers[speaker_id]
            speaker.total_samples += 1
            speaker.sentences[sentence] = Sentence(next=next_sentence, score=score, index=index)

    avg_score /= avg_score_count

    # Calculate scores for speakers and sort sentences in the order they should be spoken (if possible).
    for speaker in speakers.values():
        speaker.score = sum(s.score for s in speaker.sentences.values()) / speaker.total_samples
        speaker.score += math.log10(speaker.total_samples) * avg_score
        all_sentences = set(speaker.sentences.keys())
        next_sentences = set(s.next for s in speaker.sentences.values() if s.next)
        starting_sentences = list(all_sentences - next_sentences)
        sorted_dict: 'list[tuple[str, Sentence]]' = []
        for sentence in starting_sentences:
            current = sentence
            while current and current in speaker.sentences:
                tmp = speaker.sentences[current]
                del speaker.sentences[current]
                sorted_dict.append((current, tmp))
                current = tmp.next
        sorted_dict.extend(speaker.sentences.items())
        speaker.sentences = dict(sorted_dict)

    # Sort speakers by score
    speakers_sorted = list(sorted(speakers.values(), key=lambda item: item.score, reverse=True))

    speaker_index = 0
    generated_samples = 0

    progress_bar = tqdm(total=require_samples, desc='Generating samples')

    while generated_samples < require_samples and len(speakers_sorted) > 0:
        # If there are no more sentences to copy for the current speaker, remove it and move to the next one.
        speaker = speakers_sorted[speaker_index]
        if speaker.copied_sentences >= len(speaker.sentences):
            speakers_sorted.pop(speaker_index)
            continue
        # Get first sentence of the current speaker
        sentences_list = list(speaker.sentences.values())
        speaker_index = (speaker_index + 1) % len(speakers_sorted)
        item = cv_17[sentences_list[speaker.copied_sentences].index]
        speaker.copied_sentences += 1
        sample_rate = item['audio']['sampling_rate']
        data = item['audio']['array']
        sentences_text = [ item['sentence'] ]
        # Keep adding sentences until we have enough data
        while len(data) / sample_rate < required_length and speaker.copied_sentences < len(sentences_list):
            item = cv_17[sentences_list[speaker.copied_sentences].index]
            speaker.copied_sentences += 1
            this_sample_rate = item['audio']['sampling_rate']
            this_data = item['audio']['array']
            if this_sample_rate != sample_rate:
                this_data = resample(this_data, int(len(this_data) * sample_rate / this_sample_rate))
            data = np.concatenate((data, np.zeros(this_sample_rate // 10, dtype=data.dtype), this_data))
            sentences_text.append(item['sentence'])
        # If we have not enough data, ignore created data and move to the next speaker.
        if len(data) / sample_rate < required_length:
            continue
        speaker_file = speakers_dir / (str(generated_samples) + ".wav")
        generated_samples += 1
        progress_bar.update(1)
        # Write data to a file
        wavfile.write(speaker_file, sample_rate, data)
        with open(speaker_file.with_suffix(".txt"), "w") as f:
            f.write("\n".join(s.strip() for s in sentences_text))
    if generated_samples < require_samples:
        print(f"Warning: Only generated {generated_samples} samples out of requested {require_samples}.")



class CoquiTTSCVConfig(SourceConfig):
    language: str
    positive_samples: int # TODO: Similar case as in src-coqui-tts.py
    negative_samples: int
    speakers: int
    weight: float


def generate(tts_config: CoquiTTSCVConfig):
    speakers_dir = cfg.TMP_DIR / tts_config.dir / "speakers"
    download_speakers(tts_config.language, tts_config.speakers, 40.0, speakers_dir)
    speakers_files = [speakers_dir / f for f in speakers_dir.glob("*.wav")]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    sample_rate = tts.synthesizer.output_sample_rate
    speaker_index = 0

    all_phrases = generate_simple_phrase_set(tts_config.positive_samples, tts_config.negative_samples)
    
    for phrase, is_positive, sample_index in tqdm(all_phrases, desc=tts_config.dir):
        speaker_file = speakers_files[speaker_index]
        speaker_index = (speaker_index + 1) % len(speakers_files)
        wav = tts.tts(text=phrase, speaker_wav=str(speaker_file), language=tts_config.language)
        wav = np.array(wav, dtype=np.float32)
        max_val = np.max(np.abs(wav))
        if max_val <= 1.0:
            pass # no need to normalize
        elif max_val <= 256.0:
            wav = wav / 256.0
        elif max_val <= 65536.0:
            wav = wav / 65536.0
        else:
            wav = wav / max_val
        output_name = ('positive' if is_positive else 'negative') + f"/{sample_index // 100:03d}/{sample_index:05d}-{speaker_index}"
        write_sample(tts_config, sample_rate, wav, output_name, [{
            "start": 0.0,
            "end": len(wav) / sample_rate,
            "phrase": phrase,
            "weight": tts_config.weight,
        }])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        for index, source in enumerate(config.sources):
            if source.type == 'coqui-xtts_v2-cv':
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