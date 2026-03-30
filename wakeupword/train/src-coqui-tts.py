

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
from typing import Any


def download_cv_speakers(language: str, require_samples: int, required_length: float, speakers_dir: Path):

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



class CoquiTTSConfig(SourceConfig):
    model: str
    language: str
    negative_samples_per_speaker: int
    weight: float
    negative_weight_coefficient: float
    speaker_weights: dict[str, float]
    common_voice_speakers: int | None


def adjust_optional(obj, name, default):
    if not hasattr(obj, name):
        setattr(obj, name, default)

def adjust_config(tts_config: CoquiTTSConfig):
    adjust_optional(tts_config, 'model', 'tts_models/multilingual/multi-dataset/xtts_v2')
    adjust_optional(tts_config, 'language', 'en')
    adjust_optional(tts_config, 'negative_samples_per_speaker', 0x7FFFFFFF)
    adjust_optional(tts_config, 'weight', 1.0)
    adjust_optional(tts_config, 'negative_weight_coefficient', 1.0)
    adjust_optional(tts_config, 'speaker_weights', {})
    adjust_optional(tts_config, 'common_voice_speakers', None)

class SpeakerInfo(SimpleNamespace):
    name: str
    weight: float
    args: dict[str, Any]

def speakers_from_cv(tts_config: CoquiTTSConfig):
    speakers_dir = cfg.TMP_DIR / tts_config.dir / "speakers"
    download_cv_speakers(tts_config.language, tts_config.common_voice_speakers, 40.0, speakers_dir)
    speakers_files = [speakers_dir / f for f in speakers_dir.glob("*.wav")]
    print(f"Downloaded {len(speakers_files)} speakers")
    result: list[SpeakerInfo] = []
    for file in speakers_files:
        result.append(SpeakerInfo(
            name=file.stem,
            weight=tts_config.weight,
            args={
                'speaker_wav': str(file),
                'language': tts_config.language,
            },
        ))
    return result

def speakers_from_model(tts_config: CoquiTTSConfig, tts: TTS):
    if tts.is_multi_lingual:
        args = { 'language': tts_config.language }
    else:
        args = {}

    if not tts.is_multi_speaker:
        print("Using single speaker model")
        return [SpeakerInfo(
            name='default',
            weight=tts_config.weight,
            args=args,
        )]
   
    speaker_weights = tts_config.speaker_weights
    speakers = [
        SpeakerInfo(
            name=s,
            weight=speaker_weights.get(s, tts_config.weight),
            args={
                **args,
                'speaker': s,
            }
        )
        for s in tts.speakers
    ]

    print("Speakers and their weights:")
    for speaker in speakers:
        print(f"  {speaker.name}: positive: {speaker.weight}, negative: {speaker.weight * tts_config.negative_weight_coefficient}")
    speakers = [s for s in speakers if s.weight > 0.0]
    return speakers
    

def generate(tts_config: CoquiTTSConfig):
    adjust_config(tts_config)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = TTS(tts_config.model).to(device)
    if tts_config.common_voice_speakers:
        speakers = speakers_from_cv(tts_config)
    else:
        speakers = speakers_from_model(tts_config, tts)

    sample_rate = tts.synthesizer.output_sample_rate

    negative_samples_per_speaker = min(tts_config.negative_samples_per_speaker, len(config.negative_phrases))
    positive_phrases = [phrase for group in config.phrases for phrase in group]

    print(f"Generating {len(positive_phrases)} positive phrases with {len(speakers)} speakers totalling {len(positive_phrases) * len(speakers)} samples.")
    print(f"Generating {negative_samples_per_speaker} negative phrases with {len(speakers)} speakers totalling {negative_samples_per_speaker * len(speakers)} samples.")

    positive_sample_index = 0
    negative_sample_index = 0
    progress = tqdm(total=len(positive_phrases) * len(speakers) + negative_samples_per_speaker * len(speakers), desc=tts_config.dir)
    for speaker in speakers:
        negative_phrases = config.negative_phrases
        if len(negative_phrases) > negative_samples_per_speaker:
            random.shuffle(negative_phrases)
            negative_phrases = negative_phrases[:negative_samples_per_speaker]
        all_phrases = list(zip(
            positive_phrases + negative_phrases,
            [True] * len(positive_phrases) + [False] * len(negative_phrases),
            list(range(positive_sample_index, positive_sample_index + len(positive_phrases)))
                + list(range(negative_sample_index, negative_sample_index + len(negative_phrases))),
        ))
        positive_sample_index += len(positive_phrases)
        negative_sample_index += len(negative_phrases)
        for phrase in all_phrases:
            for _ in range(2): # Workaround: some models add some trash at the end of sample, so retry generation
                wav = tts.tts(text=phrase[0], **speaker.args)
                wav = np.array(wav, dtype=np.float32)
                if len(wav) / sample_rate > 2 * config.phrase_length_max and phrase[1]:
                    continue
                output_name = (("positive" if phrase[1] else "negative")
                    + f"/{phrase[2] // 100:03d}/{phrase[2]:05d}-{speaker.name.replace(' ', '-')}")
                write_sample(tts_config, sample_rate, wav, output_name, [{
                    "start": 0.0,
                    "end": len(wav) / sample_rate,
                    "phrase": phrase[0],
                    "weight": speaker.weight * (tts_config.negative_weight_coefficient if phrase[1] else 1.0),
                    "trim": "both",
                }])
                break
            progress.update()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        for index, source in enumerate(config.sources):
            if source.type == 'coqui-tts':
                break
    else:
        index = int(sys.argv[1])        
    generate(config.sources[index])

