
import os
import sys
import math
from tqdm import tqdm
from pathlib import Path
import numpy as np
import numpy.typing as npt
from scipy.io import wavfile
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.common import find_labels, Label
import src.config as cfg
import audiomentations
import random
from scipy.signal import resample
import tensorflow as tf

normalize_trans = audiomentations.LoudnessNormalization(
    p=1.0,
    min_lufs=cfg.LOUDNESS_NORMALIZATION_DB,
    max_lufs=cfg.LOUDNESS_NORMALIZATION_DB,
)

default_trans = audiomentations.Compose([
    audiomentations.AddBackgroundNoise(
        p=cfg.modifications.background_noise_probability,
        min_snr_db=cfg.modifications.background_noise_min_db,
        max_snr_db=cfg.modifications.background_noise_max_db,
        sounds_path=str(cfg.DATA_DIR / 'esc50'),
        noise_rms='relative',
    ),
    audiomentations.AddColorNoise(
        p=cfg.modifications.color_noise_probability,
        min_snr_db=cfg.modifications.color_noise_min_db,
        max_snr_db=cfg.modifications.color_noise_max_db,
    ),
    audiomentations.ApplyImpulseResponse(
        p=cfg.modifications.impulse_response_probability,
        ir_path=str(cfg.DATA_DIR / 'mit_rirs'),
    ),
    audiomentations.LoudnessNormalization(
        p=1.0,
        min_lufs=cfg.LOUDNESS_NORMALIZATION_DB,
        max_lufs=cfg.LOUDNESS_NORMALIZATION_DB,
    ),
    audiomentations.Gain(
        p=cfg.modifications.gain_probability,
        min_gain_db=cfg.modifications.gain_min_db,
        max_gain_db=cfg.modifications.gain_max_db,
    ),
    audiomentations.Clip(
        p=1.0,
    ),
])


# Load the TFLite models
melspec_model = tf.lite.Interpreter(model_path=str(cfg.MODELS_DIR / 'melspectrogram.tflite'))
melspec_model.resize_tensor_input(
    melspec_model.get_input_details()[0]['index'],
    [1, cfg.INPUT_WINDOW_LENGTH_MS * cfg.SAMPLES_PER_MS],
    strict=True)
melspec_model.allocate_tensors()
melspec_input_index = melspec_model.get_input_details()[0]['index']
melspec_output_index = melspec_model.get_output_details()[0]['index']

emb_model = tf.lite.Interpreter(model_path=str(cfg.MODELS_DIR / 'embedding_model.tflite'))
emb_model.resize_tensor_input(
    emb_model.get_input_details()[0]['index'],
    [cfg.EMBEDDINGS_COUNT, 76, 32, 1],
    strict=True)
emb_model.allocate_tensors()
emb_input_index = emb_model.get_input_details()[0]['index']
emb_output_index = emb_model.get_output_details()[0]['index']

esc50_files = list((cfg.DATA_DIR / 'esc50').glob('*.wav'))

positive_labels, negative_labels = find_labels(cfg.SAMPLE_DIR)

def resample_sample(data: npt.NDArray[np.float32], begin: float, end: float, check: bool) -> tuple[npt.NDArray[np.float32], float, float]:
    if random.random() >= cfg.modifications.resample_probability:
        return data, begin, end
    if check:
        rate_max = cfg.MAX_WORD_LENGTH_MS / 1000 / (end - begin)
        rate_min = cfg.MIN_WORD_LENGTH_MS / 1000 / (end - begin)
        rate_max = min(cfg.modifications.resample_max_rate, rate_max)
        rate_min = max(cfg.modifications.resample_min_rate, rate_min)
    else:
        rate_max = cfg.modifications.resample_max_rate
        rate_min = cfg.modifications.resample_min_rate
    if rate_min > rate_max:
        return data, begin, end
    rate = random.uniform(rate_min, rate_max)
    new_sample_count = int(math.ceil(data.shape[0] * rate))
    rate = new_sample_count / data.shape[0]
    data = resample(data, new_sample_count) # can be optimized - resample needed range and some margin only
    begin *= rate
    end *= rate
    return data, begin, end

def get_random_negative(part1_smpl, part2_smpl) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]]:
    required_smpl = (part1_smpl + part2_smpl + max(part1_smpl, part2_smpl)) // 2
    while True:
        index = random.randint(0, len(negative_labels) - 1)
        label = negative_labels[index]
        begin_smpl = int(round(label.begin * cfg.SAMPLE_RATE))
        end_smpl = int(round(label.end * cfg.SAMPLE_RATE))
        length_smpl = end_smpl - begin_smpl
        if length_smpl < required_smpl:
            continue
        sample_rate, data = wavfile.read(label.set.wav)
        part1 = data[begin_smpl:begin_smpl + part1_smpl].astype(np.float32) / 32767
        part2 = data[end_smpl - part2_smpl:end_smpl].astype(np.float32) / 32767
        return part1, part2

def fade(data: npt.NDArray[np.float32], direction: float) -> None:
    step = 1 / data.shape[0] * direction
    start = 0 if step > 0 else 1
    for i in range(data.shape[0]):
        start += step
        data[i] *= start

index_aaa = 0

def generate_positive_from_label(data: npt.NDArray[np.float32], label: Label) -> 'npt.NDArray[np.float32]|None':
    global index_aaa
    data, begin, end = resample_sample(data, label.begin, label.end, True)
    begin_smpl = int(round(begin * cfg.SAMPLE_RATE))
    end_smpl = int(round(end * cfg.SAMPLE_RATE))
    length_smpl = end_smpl - begin_smpl
    if length_smpl > cfg.MAX_WORD_LENGTH_MS * cfg.SAMPLES_PER_MS or length_smpl < cfg.MIN_WORD_LENGTH_MS * cfg.SAMPLES_PER_MS:
        return None
    # Add padding to the left to always have the same length
    padding_smpl = cfg.MAX_WORD_LENGTH_MS * cfg.SAMPLES_PER_MS - length_smpl
    # The audio must be prepended with prefix and padding before actual word
    prepend_smpl = cfg.WORD_PREFIX_LENGTH_MS * cfg.SAMPLES_PER_MS + padding_smpl
    # Shift the word because, in real life, it will not always end at the embedding model boundary
    prepend_smpl -= random.randint(0, cfg.WORD_SHIFT_LENGTH_MS * cfg.SAMPLES_PER_MS - 1)
    # Append audio at the end to ensure correct audio sample count
    total_smpl = cfg.INPUT_WINDOW_LENGTH_MS * cfg.SAMPLES_PER_MS
    append_smpl = total_smpl - prepend_smpl - length_smpl
    # Number of sample for fade-in and fade-out
    fade_smpl = 2 * cfg.MEL_WINDOW_LENGTH_MS * cfg.SAMPLES_PER_MS
    assert append_smpl > fade_smpl and prepend_smpl > fade_smpl
    # If not enough audio before or after the word, add silence
    if begin_smpl < fade_smpl:
        data = np.pad(data[0:end_smpl + fade_smpl], (fade_smpl - begin_smpl, 0), mode='constant', constant_values=0)
        end_smpl += fade_smpl - begin_smpl
        begin_smpl += fade_smpl - begin_smpl
    if data.shape[0] - end_smpl < fade_smpl:
        data = np.pad(data[begin_smpl - fade_smpl:], (0, fade_smpl - (data.shape[0] - end_smpl)), mode='constant', constant_values=0)
        end_smpl -= begin_smpl - fade_smpl
        begin_smpl -= begin_smpl - fade_smpl
    # Cut-off the word (with fading areas)
    data = data[begin_smpl - fade_smpl:end_smpl + fade_smpl].copy()
    fade(data[:fade_smpl], 1)  # Fade-in at the beginning
    fade(data[-fade_smpl:], -1)  # Fade-out at the end
    data = normalize_trans(data, cfg.SAMPLE_RATE)
    # Get some random negative samples to prepend and append
    prepend_data, append_data = get_random_negative(prepend_smpl, append_smpl)
    # Fade-out and fade-in additional samples
    fade(prepend_data[-fade_smpl:], -1)
    fade(append_data[:fade_smpl], 1)
    prepend_data = normalize_trans(prepend_data, cfg.SAMPLE_RATE)
    append_data = normalize_trans(append_data, cfg.SAMPLE_RATE)
    # Glue everything together
    result = np.zeros(total_smpl, dtype=np.float32)
    result[prepend_smpl - fade_smpl:prepend_smpl + length_smpl + fade_smpl] = data
    result[:prepend_smpl] += prepend_data
    result[prepend_smpl + length_smpl:] += append_data
    # Transform the audio
    result = default_trans(result, cfg.SAMPLE_RATE)
    #wavfile.write(Path(__file__).parent / f"../tmp/{index_aaa}.wav", cfg.SAMPLE_RATE, result)
    index_aaa += 1
    return result


def get_features(data: npt.NDArray[np.float32]) -> npt.NDArray[np.float32]:
    melspec_model.set_tensor(melspec_input_index, data.reshape(1, -1))
    melspec_model.invoke()
    spec = melspec_model.get_tensor(melspec_output_index)
    spec = spec.reshape((-1, 32, 1))
    emb_input = np.zeros((cfg.EMBEDDINGS_COUNT, 76, 32, 1), dtype=np.float32)
    for i in range(cfg.EMBEDDINGS_COUNT):
        emb_input[i] = spec[i * 8:i * 8 + 76]
    emb_model.set_tensor(emb_input_index, emb_input)
    emb_model.invoke()
    features = emb_model.get_tensor(emb_output_index)
    features = features.reshape((-1, 96))
    return features

def generate_from_samples(labels: list[Label], to_generate: int, callback) -> None:
    prev_file = None
    while to_generate > 0:
        for index, label in enumerate(labels):
            count = int(math.ceil(to_generate / (len(labels) - index)))
            count = min(count, to_generate)
            if prev_file != label.set.wav:
                prev_file = label.set.wav
                sample_rate, data = wavfile.read(label.set.wav)
                if sample_rate != cfg.SAMPLE_RATE:
                    raise ValueError(f"Invalid sample rate.")
                data = data.astype(np.float32) / 32767
            failure_left = 2 * count
            success_left = count
            while failure_left > 0 and success_left > 0:
                if callback(data, label):
                    success_left -= 1
                    to_generate -= 1
                else:
                    failure_left -= 1


dump_sample_counter = 0

def dump_sample(name: str, data: npt.NDArray[np.float32]) -> None:
    global dump_sample_counter
    if random.random() < cfg.generation.dump_probability:
        wavfile.write(cfg.DATA_DIR / f'../tmp/{name}_{dump_sample_counter}.wav', cfg.SAMPLE_RATE, data)
        dump_sample_counter += 1

def generate_positive_from_samples():
    def callback(data: npt.NDArray[np.float32], label: Label) -> bool:
        sample_data = generate_positive_from_label(data, label)
        if sample_data is None:
            return False
        dump_sample('positive', sample_data)
        features = get_features(sample_data)
        add_positive(features)
        return True
    generate_from_samples(positive_labels, cfg.generation.positive_from_samples, callback)


def generate_negative_from_label(data: npt.NDArray[np.float32], label: Label) -> 'npt.NDArray[np.float32]|None':
    data, begin, end = resample_sample(data, label.begin, label.end, False)
    begin_smpl = int(round(begin * cfg.SAMPLE_RATE))
    end_smpl = int(round(end * cfg.SAMPLE_RATE))
    length_smpl = end_smpl - begin_smpl
    total_smpl = cfg.INPUT_WINDOW_LENGTH_MS * cfg.SAMPLES_PER_MS
    if length_smpl < total_smpl:
        return None
    if random.random() < cfg.generation.negative_from_start_of_label_probability:
        shift = 0
    else:
        max_shift = length_smpl - total_smpl
        shift = random.randint(0, max_shift)
    data = data[begin_smpl + shift:begin_smpl + shift + total_smpl].copy()
    data = default_trans(data, cfg.SAMPLE_RATE)
    return data


def generate_negative_from_samples():
    def callback(data: npt.NDArray[np.float32], label: Label) -> bool:
        sample_data = generate_negative_from_label(data, label)
        if sample_data is None:
            return False
        dump_sample('negative', sample_data)
        features = get_features(sample_data)
        add_negative(features)
        return True
    generate_from_samples(negative_labels, cfg.generation.negative_from_samples, callback)


def generate_negative_from_noise():
    for i in range(cfg.generation.negative_from_background):
        file = random.choice(esc50_files)
        sample_rate, data = wavfile.read(file)
        data = data.astype(np.float32) / 32767
        sample_data = generate_negative_from_label(data, Label(
            begin=0.0,
            end=len(data) / sample_rate,
            text='n',
            set=None
        ))
        assert sample_data is not None
        dump_sample('negative', sample_data)
        features = get_features(sample_data)
        add_negative(features)

def prepare_arrays():
    global positive_outputs, positive_count, negative_outputs, negative_count, progress_bar
    total_positive = cfg.generation.positive_from_samples
    positive_count = 0
    positive_outputs = np.memmap(
        cfg.DATA_DIR / 'positive.dat',
        dtype='float32',
        mode='w+',
        shape=(total_positive, cfg.EMBEDDINGS_COUNT, cfg.FEATURES_COUNT))
    total_negative = cfg.generation.negative_from_samples + cfg.generation.negative_from_background
    negative_count = 0
    negative_outputs = np.memmap(
        cfg.DATA_DIR / 'negative.dat',
        dtype='float32',
        mode='w+',
        shape=(total_negative, cfg.EMBEDDINGS_COUNT, cfg.FEATURES_COUNT))
    progress_bar = tqdm(total=total_positive + total_negative)

def done_arrays():
    global positive_outputs, positive_count, negative_outputs, negative_count
    assert positive_outputs.shape[0] == positive_count, f'Expected {positive_outputs.shape[0]} positive samples, but got {positive_count}.'
    positive_outputs.flush()
    del positive_outputs
    positive_outputs = None
    assert negative_outputs.shape[0] == negative_count, f'Expected {negative_outputs.shape[0]} negative samples, but got {negative_count}.'
    negative_outputs.flush()
    del negative_outputs
    negative_outputs = None

def add_positive(features: npt.NDArray[np.float32]) -> None:
    global positive_outputs, positive_count, progress_bar
    positive_outputs[positive_count] = features
    positive_count += 1
    progress_bar.update()

def add_negative(features: npt.NDArray[np.float32]) -> None:
    global negative_outputs, negative_count, progress_bar
    negative_outputs[negative_count] = features
    negative_count += 1
    progress_bar.update()

print(f'Found {len(positive_labels)} positive labels and {len(negative_labels)} negative labels.')
prepare_arrays()
generate_positive_from_samples()
generate_negative_from_samples()
generate_negative_from_noise()
done_arrays()
