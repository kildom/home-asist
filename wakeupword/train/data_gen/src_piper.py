import wave
import io
import random
import re
import subprocess
import numpy as np
from piper import PiperVoice, SynthesisConfig
from pathlib import Path

# Generate training data using Piper TTS


tmp_dir = Path(__file__).parent.parent.parent / "tmp"
voices_dir = tmp_dir / "piper/voices"


class PiperGeneratorOptions:
    language: str = "en_US"
    num_samples: int = 1000
    length_scale: tuple[float, float] = (0.6, 1.7)
    noise_scale: tuple[float, float] = (0.5, 1.5)
    noise_w_scale: tuple[float, float] = (0.5, 1.5)
    disallow_list: list[str] = []


def download_voices(language: str, disallow_list: list[str]) -> list[str]:
    voices_dir.mkdir(parents=True, exist_ok=True)

    list_result = subprocess.run(
        ["python3", "-m", "piper.download_voices"],
        cwd=voices_dir,
        capture_output=True,
        text=True,
        check=True,
    )

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
                ["python3", "-m", "piper.download_voices", voice_name],
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


def generate(phase: str, options: PiperGeneratorOptions):
    voice_paths = download_voices(options.language, options.disallow_list)
    voice_count = len(voice_paths)

    if voice_count == 0:
        raise RuntimeError(f"No voices available for language prefix: {options.language}")

    base_count = options.num_samples // voice_count
    extra = options.num_samples % voice_count
    per_voice_counts = [base_count + (1 if i < extra else 0) for i in range(voice_count)]

    rng = random.Random()

    for voice_index, voice_path in enumerate(voice_paths):
        voice = PiperVoice.load(voice_path)
        for _ in range(per_voice_counts[voice_index]):
            length_scale = rng.uniform(*options.length_scale)
            noise_scale = rng.uniform(*options.noise_scale)
            noise_w_scale = rng.uniform(*options.noise_w_scale)

            wav_buffer = io.BytesIO()
            syn_config = SynthesisConfig(
                length_scale=length_scale,
                noise_scale=noise_scale,
                noise_w_scale=noise_w_scale,
            )
            with wave.open(wav_buffer, "wb") as wav_file:
                voice.synthesize_wav(phase, wav_file, syn_config=syn_config)

            with wave.open(io.BytesIO(wav_buffer.getvalue()), "rb") as wav_file:
                sample_rate = wav_file.getframerate()
                sample_width = wav_file.getsampwidth()
                num_frames = wav_file.getnframes()
                raw_bytes = wav_file.readframes(num_frames)

            data = _pcm_to_float32(raw_bytes, sample_width)
            data = np.clip(data, -1.0, 1.0).astype(np.float32, copy=False)
            yield sample_rate, data


def _test() -> None:
    from time import sleep
    import sounddevice as sd

    phase = "Witaj świecie!"
    options = PiperGeneratorOptions()
    options.language = "pl"
    options.num_samples = 10
    options.disallow_list = ['mls_6892']

    for index, (sample_rate, data) in enumerate(generate(phase, options), start=1):
        print(f"Sample {index}: rate={sample_rate}, shape={data.shape}, dtype={data.dtype}")
        sd.play(data, sample_rate)
        sd.wait()
        sleep(0.4)


if __name__ == "__main__":
    _test()
