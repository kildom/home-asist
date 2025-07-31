
import numpy as np
import tensorflow as tf
import math
from pathlib import Path
from types import SimpleNamespace


sn = SimpleNamespace

MODELS_DIR = Path(__file__).parent.parent / 'models'

def get_model(samples=12480):
    model2 = tf.lite.Interpreter(model_path=str(MODELS_DIR / 'conv_speech_embedding.tflite'), experimental_preserve_all_tensors=True)
    model2.resize_tensor_input(
        model2.get_input_details()[0]['index'],
        [1, samples],
        strict=True)
    model2.allocate_tensors()
    model2_in = model2.get_input_details()[0]['index']
    model2_out = model2.get_output_details()[0]['index']
    return model2, model2_in, model2_out

tflite_model, tflite_model_in, tflite_model_out = get_model()
data = np.random.rand(12480).astype(np.float32)
tflite_model.set_tensor(tflite_model_in, data.reshape(1, -1))
tflite_model.invoke()

tensor_details = tflite_model.get_tensor_details()

def var(name):
    for d in tensor_details:
        if d['name'] == name:
            x = tflite_model.get_tensor(d['index'])
            return x
    raise ValueError(f"Variable '{name}' not found in model tensor details.")

def idx(name):
    for d in tensor_details:
        if d['name'] == name:
            return d['index']
    raise ValueError(f"Variable '{name}' not found in model tensor details.")


nodes = [
    sn( # 11 12
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Pad'),
        output=None,
        filter=(var('arith.constant38') * var('arith.constant41')[:, np.newaxis, np.newaxis, np.newaxis]),
        bias=var('arith.constant39'),
    ),
    sn( # 11
        type='ReLU',
        input=None,
        output=None,
    ),
    sn( # 13
        type='Add',
        input=None,
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm/FusedBatchNormV31'),
        value=var('arith.constant40'),
    ),
    sn( # 14 15
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm/FusedBatchNormV31'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_1'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 16
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_1'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_1/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv/Conv2D'),
        filter=var('arith.constant37'),
        bias=var('arith.constant17'),
    ),
    sn( # 17 18
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_1/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_3'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 19
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_3'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_2/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_1/Conv2D'),
        filter=var('arith.constant36'),
        bias=var('arith.constant16'),
    ),
    sn( # 20 21
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_2/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_1/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_5'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 22
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_5'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D/MaxPool'),
        size=(2, 2),
    ),
    sn( # 23
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_3/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_2/Conv2D'),
        filter=var('arith.constant35'),
        bias=var('arith.constant15'),
    ),
    sn( # 24 25
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_3/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_2/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_7'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 26
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_7'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_4/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_3/Conv2D'),
        filter=var('arith.constant34'),
        bias=var('arith.constant14'),
    ),
    sn( # 27 28
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_4/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_3/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_9'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 29
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_9'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_5/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_4/Conv2D'),
        filter=var('arith.constant33'),
        bias=var('arith.constant13'),
    ),
    sn( # 30 31
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_5/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_4/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_11'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 32
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_11'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_6/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_5/Conv2D'),
        filter=var('arith.constant32'),
        bias=var('arith.constant12'),
    ),
    sn( # 33 34
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_6/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_5/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_13'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 35
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_13'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_1/MaxPool'),
        size=(1, 2),
    ),
    sn( # 36
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_1/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_7/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_6/Conv2D'),
        filter=var('arith.constant31'),
        bias=var('arith.constant11'),
    ),
    sn( # 37 38
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_7/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_6/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_15'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 39
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_15'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_8/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_7/Conv2D'),
        filter=var('arith.constant30'),
        bias=var('arith.constant10'),
    ),
    sn( # 40 41
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_8/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_7/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_17'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 42
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_17'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_9/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_8/Conv2D'),
        filter=var('arith.constant29'),
        bias=var('arith.constant9'),
    ),
    sn( # 43 44
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_9/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_8/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_19'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 45
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_19'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_10/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_9/Conv2D'),
        filter=var('arith.constant28'),
        bias=var('arith.constant8'),
    ),
    sn( # 46 47
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_10/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_9/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_21'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 48
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_21'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_2/MaxPool'),
        size=(2, 2),
    ),
    sn( # 49
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_2/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_11/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_10/Conv2D'),
        filter=var('arith.constant26'),
        bias=var('arith.constant7'),
    ),
    sn( # 50 51
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_11/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_10/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_23'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 52
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_23'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_12/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_11/Conv2D'),
        filter=var('arith.constant25'),
        bias=var('arith.constant6'),
    ),
    sn( # 53 54
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_12/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_11/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_25'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 55
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_25'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_13/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_12/Conv2D'),
        filter=var('arith.constant24'),
        bias=var('arith.constant5'),
    ),
    sn( # 56 57
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_13/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_12/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_27'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 58
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_27'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_14/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_13/Conv2D'),
        filter=var('arith.constant23'),
        bias=var('arith.constant4'),
    ),
    sn( # 59 60
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_14/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_13/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_29'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 61
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_29'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_3/MaxPool'),
        size=(1, 2),
    ),
    sn( # 62
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_3/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_15/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_14/Conv2D'),
        filter=var('arith.constant22'),
        bias=var('arith.constant3'),
    ),
    sn( # 63 64
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_15/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_14/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_31'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 65
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_31'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_16/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_15/Conv2D'),
        filter=var('arith.constant21'),
        bias=var('arith.constant2'),
    ),
    sn( # 66 67
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_16/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_15/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_33'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 68
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_33'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_17/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_16/Conv2D'),
        filter=var('arith.constant20'),
        bias=var('arith.constant1'),
    ),
    sn( # 69 70
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_17/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_16/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_35'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 71
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_35'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_18/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_17/Conv2D'),
        filter=var('arith.constant19'),
        bias=var('arith.constant'),
    ),
    sn( # 72 73
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_18/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_17/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_37'),
        min=-0.4,
        max=+math.inf,
    ),
    sn( # 74
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_37'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_4/MaxPool'),
        size=(2, 2),
    ),
    sn( # 75
        type='Conv2D',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_4/MaxPool'),
        output=idx('Identity'),
        filter=var('arith.constant18'),
        bias=var('arith.constant27'),
    ),
]
