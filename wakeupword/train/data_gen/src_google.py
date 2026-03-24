import io
import random
import wave
from pathlib import Path

import numpy as np
from google.cloud import texttospeech

# Generate training data using Google Cloud Text-to-Speech UNTESTED!!!


project_root = Path(__file__).parent.parent.parent
default_credentials_path = project_root.parent / "auth/google.json"


class GoogleGeneratorOptions:
	language_code: str = "en-US"
	num_samples: int = 1000
	speaking_rate: tuple[float, float] = (0.8, 1.2)
	pitch: tuple[float, float] = (-4.0, 4.0)
	volume_gain_db: tuple[float, float] = (-2.0, 2.0)
	sample_rate_hz: int = 16000
	disallow_list: list[str] = []
	allowed_genders: list[str] = ["FEMALE", "MALE", "NEUTRAL", "SSML_VOICE_GENDER_UNSPECIFIED"]
	credentials_path: str = str(default_credentials_path)


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


def _load_client(credentials_path: str) -> texttospeech.TextToSpeechClient:
	path = Path(credentials_path)
	if not path.exists():
		raise FileNotFoundError(
			f"Google credentials file not found: {path}. "
			"Set GoogleGeneratorOptions.credentials_path to a valid service-account JSON file."
		)
	return texttospeech.TextToSpeechClient.from_service_account_json(str(path))


def _list_voice_candidates(
	client: texttospeech.TextToSpeechClient, options: GoogleGeneratorOptions
) -> list[texttospeech.Voice]:
	response = client.list_voices(language_code=options.language_code)
	candidates = list(response.voices)

	disallowed_substrings = [item.lower() for item in options.disallow_list if item]
	allowed_genders = {item.strip().upper() for item in options.allowed_genders if item}

	filtered: list[texttospeech.Voice] = []
	for voice in candidates:
		if disallowed_substrings and any(d in voice.name.lower() for d in disallowed_substrings):
			continue

		gender_name = texttospeech.SsmlVoiceGender(voice.ssml_gender).name.upper()
		if allowed_genders and gender_name not in allowed_genders:
			continue

		filtered.append(voice)

	if not filtered:
		raise RuntimeError(
			f"No Google TTS voices found for language={options.language_code} after filtering"
		)

	return filtered


def generate(phase: str, options: GoogleGeneratorOptions):
	if options.num_samples <= 0:
		return

	client = _load_client(options.credentials_path)
	voices = _list_voice_candidates(client, options)
	voice_count = len(voices)

	base_count = options.num_samples // voice_count
	extra = options.num_samples % voice_count
	per_voice_counts = [base_count + (1 if i < extra else 0) for i in range(voice_count)]

	rng = random.Random()

	for voice_index, voice in enumerate(voices):
		for _ in range(per_voice_counts[voice_index]):
			speaking_rate = rng.uniform(*options.speaking_rate)
			pitch = rng.uniform(*options.pitch)
			volume_gain_db = rng.uniform(*options.volume_gain_db)

			synthesis_input = texttospeech.SynthesisInput(text=phase)
			voice_params = texttospeech.VoiceSelectionParams(
				language_code=options.language_code,
				name=voice.name,
				ssml_gender=voice.ssml_gender,
			)
			audio_config = texttospeech.AudioConfig(
				audio_encoding=texttospeech.AudioEncoding.LINEAR16,
				speaking_rate=speaking_rate,
				pitch=pitch,
				volume_gain_db=volume_gain_db,
				sample_rate_hertz=options.sample_rate_hz,
			)

			response = client.synthesize_speech(
				request={
					"input": synthesis_input,
					"voice": voice_params,
					"audio_config": audio_config,
				}
			)

			with wave.open(io.BytesIO(response.audio_content), "rb") as wav_file:
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
	options = GoogleGeneratorOptions()
	options.language_code = "pl-PL"
	options.num_samples = 10
	options.disallow_list = ["Journey"]

	for index, (sample_rate, data) in enumerate(generate(phase, options), start=1):
		print(f"Sample {index}: rate={sample_rate}, shape={data.shape}, dtype={data.dtype}")
		sd.play(data, sample_rate)
		sd.wait()
		sleep(0.4)


if __name__ == "__main__":
	_test()
