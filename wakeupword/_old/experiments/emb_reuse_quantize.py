
import pandas as pd
import numpy as np
import tensorflow as tf
from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent / 'models'

# Load the TFLite models
melspec_model = tf.lite.Interpreter(model_path=str(MODELS_DIR / 'melspectrogram.tflite'))
melspec_model.resize_tensor_input(
    melspec_model.get_input_details()[0]['index'],
    [1, 2 * 16000],
    strict=True)
melspec_model.allocate_tensors()
melspec_input_index = melspec_model.get_input_details()[0]['index']
melspec_output_index = melspec_model.get_output_details()[0]['index']

emb_model = tf.lite.Interpreter(model_path=str(MODELS_DIR / 'embedding_model.tflite'), experimental_preserve_all_tensors=True)
emb_model.resize_tensor_input(
    emb_model.get_input_details()[0]['index'],
    [1, 76, 32, 1],
    strict=True)
emb_model.allocate_tensors()
emb_input_index = emb_model.get_input_details()[0]['index']
emb_output_index = emb_model.get_output_details()[0]['index']

# for i, d in enumerate(emb_model.get_signature_list()):
#     print(i, ':::SIG:::', d)
# for i, d in enumerate(emb_model.get_input_details()):
#     print(i, ':::IN:::', d)
# for i, d in enumerate(emb_model.get_tensor_details()):
#     print(i, ':::IMM:::', d)
# for i, d in enumerate(emb_model.get_output_details()):
#     print(i, ':::OUT:::', d)
print(emb_output_index)

np.random.seed(42)
data = np.random.rand(2 * 16000).astype(np.float32)  # Simulated audio data
melspec_model.set_tensor(melspec_input_index, data.reshape(1, -1))
melspec_model.invoke()
spec = melspec_model.get_tensor(melspec_output_index)
spec = spec.reshape((-1, 32, 1))

emb_input = np.zeros((1, 76, 32, 1), dtype=np.float32)
emb_input[0] = spec[0:76]
emb_model.set_tensor(emb_input_index, emb_input)
emb_model.invoke()
features = emb_model.get_tensor(emb_output_index)
features = features.reshape((-1, 96))
#print(features)

padded = emb_model.get_tensor(43)
print(padded.shape)
conv1 = emb_model.get_tensor(44)
print(conv1.shape)

with pd.ExcelWriter('aaaa.xlsx', engine="openpyxl", mode="w") as writer:
    pd.DataFrame(padded.reshape(padded.shape[1], -1)).to_excel(writer, sheet_name='data', index=False, header=False)



'''

    76x32

* Pad with zeros one column on right side and one on left.

    76x34

'''