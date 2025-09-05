import numpy as np
import numpy.typing as npt
import tensorflow as tf
import math
from typing import Literal
from pathlib import Path
from types import SimpleNamespace

MAX_DIFF = 3e-5

sn = SimpleNamespace

MODEL_FILE = Path(__file__).parent.parent.parent / 'data/models/embedding_model.tflite'

def get_model(samples=12480):
    model2 = tf.lite.Interpreter(model_path=str(MODEL_FILE), experimental_preserve_all_tensors=True)
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
    sn(
        id='11 12',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Pad'),
        output=None,
        filter=(var('arith.constant38') * var('arith.constant41')[:, np.newaxis, np.newaxis, np.newaxis]),
        bias=var('arith.constant39'),
    ),
    sn(
        id='11',
        type='ReLU',
        input=None,
        output=None,
    ),
    sn(
        id='13',
        type='Add',
        input=None,
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm/FusedBatchNormV31'),
        value=var('arith.constant40'),
    ),
    sn(
        id='14 15',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm/FusedBatchNormV31'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_1'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='16',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_1'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_1/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv/Conv2D'),
        filter=var('arith.constant37'),
        bias=var('arith.constant17'),
    ),
    sn(
        id='17 18',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_1/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_3'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='19',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_3'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_2/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_1/Conv2D'),
        filter=var('arith.constant36'),
        bias=var('arith.constant16'),
    ),
    sn(
        id='20 21',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_2/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_1/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_5'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='22',
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_5'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D/MaxPool'),
        size=(2, 2),
    ),
    sn(
        id='23',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_3/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_2/Conv2D'),
        filter=var('arith.constant35'),
        bias=var('arith.constant15'),
    ),
    sn(
        id='24 25',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_3/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_2/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_7'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='26',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_7'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_4/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_3/Conv2D'),
        filter=var('arith.constant34'),
        bias=var('arith.constant14'),
    ),
    sn(
        id='27 28',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_4/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_3/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_9'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='29',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_9'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_5/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_4/Conv2D'),
        filter=var('arith.constant33'),
        bias=var('arith.constant13'),
    ),
    sn(
        id='30 31',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_5/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_4/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_11'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='32',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_11'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_6/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_5/Conv2D'),
        filter=var('arith.constant32'),
        bias=var('arith.constant12'),
    ),
    sn(
        id='33 34',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_6/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_5/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_13'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='35',
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_13'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_1/MaxPool'),
        size=(1, 2),
    ),
    sn(
        id='36',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_1/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_7/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_6/Conv2D'),
        filter=var('arith.constant31'),
        bias=var('arith.constant11'),
    ),
    sn(
        id='37 38',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_7/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_6/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_15'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='39',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_15'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_8/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_7/Conv2D'),
        filter=var('arith.constant30'),
        bias=var('arith.constant10'),
    ),
    sn(
        id='40 41',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_8/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_7/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_17'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='42',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_17'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_9/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_8/Conv2D'),
        filter=var('arith.constant29'),
        bias=var('arith.constant9'),
    ),
    sn(
        id='43 44',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_9/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_8/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_19'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='45',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_19'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_10/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_9/Conv2D'),
        filter=var('arith.constant28'),
        bias=var('arith.constant8'),
    ),
    sn(
        id='46 47',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_10/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_9/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_21'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='48',
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_21'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_2/MaxPool'),
        size=(2, 2),
    ),
    sn(
        id='49',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_2/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_11/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_10/Conv2D'),
        filter=var('arith.constant26'),
        bias=var('arith.constant7'),
    ),
    sn(
        id='50 51',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_11/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_10/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_23'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='52',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_23'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_12/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_11/Conv2D'),
        filter=var('arith.constant25'),
        bias=var('arith.constant6'),
    ),
    sn(
        id='53 54',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_12/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_11/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_25'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='55',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_25'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_13/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_12/Conv2D'),
        filter=var('arith.constant24'),
        bias=var('arith.constant5'),
    ),
    sn(
        id='56 57',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_13/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_12/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_27'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='58',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_27'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_14/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_13/Conv2D'),
        filter=var('arith.constant23'),
        bias=var('arith.constant4'),
    ),
    sn(
        id='59 60',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_14/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_13/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_29'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='61',
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_29'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_3/MaxPool'),
        size=(1, 2),
    ),
    sn(
        id='62',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_3/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_15/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_14/Conv2D'),
        filter=var('arith.constant22'),
        bias=var('arith.constant3'),
    ),
    sn(
        id='63 64',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_15/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_14/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_31'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='65',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_31'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_16/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_15/Conv2D'),
        filter=var('arith.constant21'),
        bias=var('arith.constant2'),
    ),
    sn(
        id='66 67',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_16/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_15/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_33'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='68',
        type='Conv2D',
        padding='same',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_33'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_17/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_16/Conv2D'),
        filter=var('arith.constant20'),
        bias=var('arith.constant1'),
    ),
    sn(
        id='69 70',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_17/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_16/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_35'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='71',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_35'),
        output=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_18/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_17/Conv2D'),
        filter=var('arith.constant19'),
        bias=var('arith.constant'),
    ),
    sn(
        id='72 73',
        type='ClampedLeakyReLU',
        alpha=0.2,
        input=idx('embeddings_apply_default/MudpuppyLite/BatchNorm_18/FusedBatchNormV3;embeddings_apply_default/MudpuppyLite/Conv_17/Conv2D'),
        output=idx('embeddings_apply_default/MudpuppyLite/Maximum_37'),
        min=-0.4,
        max=+math.inf,
    ),
    sn(
        id='74',
        type='MaxPool2D',
        input=idx('embeddings_apply_default/MudpuppyLite/Maximum_37'),
        output=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_4/MaxPool'),
        size=(2, 2),
    ),
    sn(
        id='75',
        type='Conv2D',
        padding='valid',
        input=idx('embeddings_apply_default/MudpuppyLite/MaxPool2D_4/MaxPool'),
        output=idx('embeddings_apply_default/MudpuppyLite/Conv_18/Conv2D'),
        filter=var('arith.constant18'),
        bias=var('arith.constant27'),
    ),
]


def as_json():
    import json
    def convert(o):
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, (np.float32, np.float64)):
            return float(o)
        if isinstance(o, (np.int32, np.int64)):
            return int(o)
        if isinstance(o, Path):
            return str(o)
        if isinstance(o, sn):
            return o.__dict__
        return o
    return json.dumps(nodes, default=convert)


def self_test():

    import torch
    import torch.nn.functional as F

    class Conv2DNode:
        type = 'Conv2D'
        input: int|None
        output: int|None
        filter: npt.NDArray[np.float32]
        bias: npt.NDArray[np.float32]
        padding: Literal["same", "valid"]

    def execute(nodes, x):

        def execute_Conv2D(node: Conv2DNode, x):
            x = F.conv2d(
                input=x.permute(0, 3, 1, 2),
                weight=torch.from_numpy(node.filter).permute(0, 3, 1, 2),
                bias=torch.from_numpy(node.bias),
                padding=node.padding,
            )
            x = x.permute(0, 2, 3, 1)
            return x

        def execute_ReLU(node, x):
            x = F.relu(x)
            return x

        def execute_Add(node, x):
            x = x + node.value
            return x

        def execute_ClampedLeakyReLU(node, x):
            x = F.leaky_relu(x, negative_slope=node.alpha)
            x = torch.clamp(x, min=node.min, max=node.max)
            return x

        def execute_MaxPool2D(node, x):
            x = F.max_pool2d(
                input=x.permute(0, 3, 1, 2),
                kernel_size=node.size
                )
            x = x.permute(0, 2, 3, 1)
            return x

        x = torch.from_numpy(x)
        for node in nodes:
            name = f"execute_{node.type}"
            x = locals()[name](node, x)
        return x.cpu().numpy()

    for i, last_node in enumerate(nodes):
        if last_node.output is None:
            continue
        tflite_model, tflite_model_in, tflite_model_out = get_model()
        data = np.random.rand(12480).astype(np.float32)
        tflite_model.set_tensor(tflite_model_in, data.reshape(1, -1))
        tflite_model.invoke()
        imm = tflite_model.get_tensor(last_node.output)
        x = tflite_model.get_tensor(nodes[0].input)
        # print(f"Node {i} ({last_node.type}) - TFLite shape: {imm.shape}, min: {imm.min()}, max: {imm.max()}, mean: {imm.mean()}")
        # print(f"         x - TFLite shape: {x.shape}, min: {x.min()}, max: {x.max()}, mean: {x.mean()}")
        out = execute(nodes[:i + 1], x)
        diff = np.max(np.abs(out - imm))
        print(f"{last_node.id:7} {last_node.type:17}: {diff * 1e6:.2f} ppm", out.shape, imm.shape)
        assert diff < MAX_DIFF, f"Difference detected at node {last_node.id}: {diff}"
        #break
    print("Success")
