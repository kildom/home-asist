from pathlib import Path
from dataclasses import dataclass
from typing import List

SAMPLE_RATE = 16000

ROOT = Path(__file__).parent.parent


@dataclass
class Label:
    begin: float
    end: float
    text: str
    set: 'SampleSet'

@dataclass
class SampleSet:
    wav: Path
    txt: Path
    labels: List[Label]

def process_file(wav_path: Path, txt_path: Path) -> SampleSet:
    labels: List[Label] = []
    result = SampleSet(wav=wav_path, txt=txt_path, labels=labels)
    with txt_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) != 3:
                raise ValueError(f"Invalid line format in {txt_path}: {line}")
            begin, end, text = parts
            try:
                label = Label(begin=float(begin), end=float(end), text=text, set=result)
                labels.append(label)
            except ValueError:
                raise ValueError(f"Invalid line format in {txt_path}: {line}")
    return result

def find_samples(root_dir: 'str|Path') -> List[SampleSet]:
    root = Path(root_dir)
    samples: List[SampleSet] = []
    for wav_path in root.rglob("*.wav"):
        txt_path = wav_path.with_suffix('.txt')
        if txt_path.exists():
            sample = process_file(wav_path, txt_path)
            samples.append(sample)
    return samples

def find_labels(root_dir: 'str|Path') -> tuple[List[Label], List[Label]]:
    positive: List[Label] = []
    negative: List[Label] = []
    for sample in find_samples(root_dir):
        for label in sample.labels:
            if label.text.lower().startswith('p'):
                positive.append(label)
            elif label.text.lower().startswith('n'):
                negative.append(label)
    return (positive, negative)
