

from pathlib import Path
import random
import subprocess
import sys

import json
import cfg
from cfg import config
import numpy as np
from scipy.io import wavfile


SCRIPT_DIR = Path(__file__).parent


def source_dir_has_files(path: Path) -> bool:
	return any(child.is_file() for child in path.rglob("*"))


def run_source(index: int) -> str:
	source = config.sources[index]
	source_dir = cfg.SOURCE_DIR / source.dir
	message_prefix = f"Source {index}: type '{source.type}', dir '{source.dir}'"
	if any(child.is_file() for child in source_dir.rglob("*")):
		print(f"{message_prefix} already has files, skipping.")
		return "skipped"

	script_path = SCRIPT_DIR / f"src-{source.type}.py"
	if not script_path.is_file():
		print(f"{message_prefix} failed: generator script not found: {script_path}")
		return "error"

	print(f"{message_prefix} is empty or missing, running generator.")

	try:
		subprocess.run(
			[sys.executable, str(script_path), str(index)],
			cwd=SCRIPT_DIR,
			check=True,
		)
	except subprocess.CalledProcessError as error:
		print(f"{message_prefix} failed: script exited with code {error.returncode}.")
		return "error"

	print(f"{message_prefix} finished successfully.")
	return "done"


def print_summary(statuses: list[tuple[int, str, str, str]]) -> None:
	print("\nSummary:")
	for index, source_type, source_dir, status in statuses:
		print(f"- Source {index}: type '{source_type}', dir '{source_dir}' -> {status}")


def main() -> None:
	statuses: list[tuple[int, str, str, str]] = []
	for index in range(len(config.sources)):
		source = config.sources[index]
		status = run_source(index)
		statuses.append((index, source.type, str(source.dir), status))

	print_summary(statuses)

def write_sample(source_config: cfg.SourceConfig, sample_rate: int, data: np.ndarray, name: str, json_data):
    output_dir = cfg.SOURCE_DIR / source_config.dir
    output_path = output_dir / f"{name}.wav"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Save the sample as a WAV file
    wavfile.write(output_path, sample_rate, data)
    with open(output_path.with_suffix(".json"), "w") as f:
        json.dump(json_data, f, indent=4)

def generate_simple_phrase_set(positive_samples: int, negative_samples: int) -> list[tuple[str, bool, int]]:
    positive_phrases = [phrase for group in config.phrases for phrase in group]
    positive_phrases = positive_phrases * (1 + positive_samples // len(positive_phrases))
    positive_phrases = positive_phrases[:positive_samples]
    negative_phrases = config.negative_phrases * (1 + negative_samples // len(config.negative_phrases))
    negative_phrases = negative_phrases[:negative_samples]
    all_phrases = list(zip(
        positive_phrases + negative_phrases,
        [True] * len(positive_phrases) + [False] * len(negative_phrases),
        list(range(len(positive_phrases))) + list(range(len(negative_phrases))),
        ))
    random.seed(42)
    random.shuffle(all_phrases)
    return all_phrases


if __name__ == "__main__":
	main()


