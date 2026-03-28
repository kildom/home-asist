import sys
import json
import wave
import io
import random
import re
import subprocess
import numpy as np
from piper import PiperVoice, SynthesisConfig
from pathlib import Path
from cfg import config, SourceConfig
import cfg
from scipy.io import wavfile
from tqdm import tqdm
from src import write_sample
from src import generate_simple_phrase_set

# Generate training data using Piper TTS


voices_dir = cfg.TMP_DIR / "piper/voices"


class PiperConfig(SourceConfig):
    language: str
    positive_samples: int
    negative_samples: int
    weight: float
    length_scale: tuple[float, float]
    noise_scale: tuple[float, float]
    noise_w_scale: tuple[float, float]
    model_weights: dict[str, float]


def validate_scale(value) -> tuple[float, float]:
    if isinstance(value, float) or isinstance(value, int):
        return (float(value), float(value))
    value = tuple(float(x) for x in value)
    return (value[0], value[1]) if len(value) == 2 else (value[0], value[0])


def validate_config(source: PiperConfig) -> PiperConfig:
    source.length_scale = validate_scale(source.length_scale)
    source.noise_scale = validate_scale(source.noise_scale)
    source.noise_w_scale = validate_scale(source.noise_w_scale)
    if not hasattr(source, 'model_weights'):
        source.model_weights = {}
    return source

def download_voices(language: str, disallow_list: list[str]) -> list[str]:
    voices_dir.mkdir(parents=True, exist_ok=True)

    list_result = subprocess.run(
        [sys.executable, "-m", "piper.download_voices"],
        cwd=voices_dir,
        capture_output=True,
        text=True,
        check=False,
    )

    if list_result.returncode != 0:
        print(list_result.stdout)
        print(list_result.stderr, file=sys.stderr)

    list_result.check_returncode()

    pattern = re.compile(rf"\b{re.escape(language)}[-_][A-Za-z0-9_.-]*\b")
    parsed_voices: set[str] = set()
    for match in pattern.findall(list_result.stdout + "\n" + list_result.stderr):
        voice_name = match.removesuffix(".json").removesuffix(".onnx")
        parsed_voices.add(voice_name)

    available_voices = sorted(parsed_voices)
    disallowed_substrings = [item.lower() for item in disallow_list if item]
    available_voices = [
        voice
        for voice in available_voices
        if not any(disallowed in voice.lower() for disallowed in disallowed_substrings)
    ]
    if not available_voices:
        raise RuntimeError(f"No Piper voices found for language prefix: {language}")

    resolved_onnx_paths: list[str] = []
    for voice_name in available_voices:
        onnx_path = voices_dir / f"{voice_name}.onnx"
        json_path = voices_dir / f"{voice_name}.onnx.json"

        if not (onnx_path.exists() and json_path.exists()):
            subprocess.run(
                [sys.executable, "-m", "piper.download_voices", voice_name],
                cwd=voices_dir,
                check=True,
            )

        if not (onnx_path.exists() and json_path.exists()):
            raise RuntimeError(
                f"Missing Piper voice files after download: {onnx_path.name}, {json_path.name}"
            )

        resolved_onnx_paths.append(str(onnx_path))

    return resolved_onnx_paths


def _pcm_to_float32(raw_bytes: bytes, sampwidth: int) -> np.ndarray:
    if sampwidth == 1:
        pcm = np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32)
        return (pcm - 128.0) / 128.0
    if sampwidth == 2:
        pcm = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32)
        return pcm / 32768.0
    if sampwidth == 4:
        pcm = np.frombuffer(raw_bytes, dtype=np.int32).astype(np.float32)
        return pcm / 2147483648.0
    raise ValueError(f"Unsupported WAV sample width: {sampwidth}")


def generate(piper_config: PiperConfig):
    disallow_list = [x[0] for x in piper_config.model_weights.items() if x[1] <= 0.0]
    voice_paths = download_voices(piper_config.language, disallow_list)
    voice_count = len(voice_paths)

    positive_dir = cfg.SOURCE_DIR / piper_config.dir / 'positive'
    negative_dir = cfg.SOURCE_DIR / piper_config.dir / 'negative'

    if voice_count == 0:
        raise RuntimeError(f"No voices available for language prefix: {piper_config.language}")
    
    all_phrases = generate_simple_phrase_set(piper_config.positive_samples, piper_config.negative_samples)

    base_count = len(all_phrases) // voice_count
    extra = len(all_phrases) % voice_count
    per_voice_counts = [base_count + (1 if i < extra else 0) for i in range(voice_count)]

    rng = random.Random(42)

    progress = tqdm(total=len(all_phrases), desc=piper_config.dir)

    for voice_index, voice_path in enumerate(voice_paths):
        voice = PiperVoice.load(voice_path)
        weight = piper_config.weight
        for model_name, model_weight in piper_config.model_weights.items():
            if Path(voice_path).stem.find(model_name) >= 0:
                weight = model_weight
                break
        for _ in range(per_voice_counts[voice_index]):
            phrase, is_positive, sample_index = all_phrases.pop()
            progress.update()
            length_scale = rng.uniform(*piper_config.length_scale)
            noise_scale = rng.uniform(*piper_config.noise_scale)
            noise_w_scale = rng.uniform(*piper_config.noise_w_scale)

            wav_buffer = io.BytesIO()
            syn_config = SynthesisConfig(
                length_scale=length_scale,
                noise_scale=noise_scale,
                noise_w_scale=noise_w_scale,
            )
            with wave.open(wav_buffer, "wb") as wav_file:
                voice.synthesize_wav(phrase, wav_file, syn_config=syn_config)

            with wave.open(io.BytesIO(wav_buffer.getvalue()), "rb") as wav_file:
                sample_rate = wav_file.getframerate()
                sample_width = wav_file.getsampwidth()
                num_frames = wav_file.getnframes()
                raw_bytes = wav_file.readframes(num_frames)

            data = _pcm_to_float32(raw_bytes, sample_width)
            data = np.clip(data, -1.0, 1.0).astype(np.float32, copy=False)
            output_name = ('positive' if is_positive else 'negative') + f"/{sample_index // 100:03d}/{sample_index:05d}-{Path(voice_path).stem}"
            write_sample(piper_config, sample_rate, data, output_name, [{
                "start": 0.0,
                "end": len(data) / sample_rate,
                "phrase": phrase,
                "weight": weight,
            }])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        for index, source in enumerate(config.sources):
            if source.type == 'piper':
                break
    else:
        index = int(sys.argv[1])        
    generate(config.sources[index])

