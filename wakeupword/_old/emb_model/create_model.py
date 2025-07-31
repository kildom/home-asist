
import torch
import numpy as np
import numpy.typing as npt
import tensorflow as tf
import math
from model_desc import nodes, get_model
from pathlib import Path
from types import SimpleNamespace
from pprint import pprint
from consts import mel_weights, fft_window, mel_bias

class QuantizationState:
    pass

class QuantizationState2D(QuantizationState):
    channel_scale: 'npt.NDArray[np.float64]' # shape: C


class Node:
    def quantize(self, state: QuantizationState, samples: 'npt.NDArray[np.int64]') -> QuantizationState:
        raise NotImplementedError()
    def forward(self, x: 'npt.NDArray[np.int64]') -> 'npt.NDArray[np.int64]':
        raise NotImplementedError()

def get_channel_min_max(x: 'npt.NDArray') -> 'tuple[npt.NDArray, npt.NDArray]':
    channel_min = x.min(axis=tuple(range(len(x.shape) - 1))).astype(np.int64)
    channel_max = x.max(axis=tuple(range(len(x.shape) - 1))).astype(np.int64)
    return channel_min, channel_max

FULL_RANGE_INT32 = 0x7FFFFFFF
HALF_RANGE_INT32 = FULL_RANGE_INT32 // 2

FULL_RANGE_INT16 = 0x7FFF
HALF_RANGE_INT16 = FULL_RANGE_INT16 // 2

def find_biggest_addends(addends: 'npt.NDArray[np.int64]') -> set[int]: # addends shape: outC, inC
    # Input index of maximum addend in each output channel
    max_in_indexes = np.argmax(addends, axis=1)
    # Generated output from those addends
    output = np.sum(addends, axis=1)
    # Array with 1 where output is valid, so there is no need to adjust anything
    valid_output = (output <= HALF_RANGE_INT32).astype(np.int64)
    # Set index to -1 where output is valid, keep unchanged where output is invalid
    max_in_indexes = max_in_indexes * (1 - valid_output) - valid_output
    # Create set of input indexes of maximum addends, but only for those outputs that are invalid
    result = set([int(x) for x in np.unique(max_in_indexes) if x >= 0])
    return result

class Conv2D(Node):
    filter: 'npt.NDArray[np.float64]' # shape: outC, H, W, inC
    bias: 'npt.NDArray[np.float64]' # shape: outC
    qfilter: 'npt.NDArray[np.int64]' # shape: outC, H, W, inC
    qbias: 'npt.NDArray[np.int64]' # shape: outC
    input_shift: 'npt.NDArray[np.int64]' # shape: inC
    input_limits: 'npt.NDArray[np.int64]' # shape: 2, inC
    output_shift: 'npt.NDArray[np.int64]' # shape: outC
    output_limits: 'npt.NDArray[np.int64]' # shape: 2, outC

    def __init__(self, desc):
        self.filter = desc.filter.astype(np.float64)
        self.bias = desc.bias.astype(np.float64)
        self.out_channels = self.filter.shape[0]
        self.kernel_height = self.filter.shape[1]
        self.kernel_width = self.filter.shape[2]
        self.in_channels = self.filter.shape[3]
        # dummy values for now
        self.qfilter = self.filter.astype(np.int64)
        self.qbias = self.bias.astype(np.int64)
        self.output_shift = self.bias.astype(np.int64)

    def quantize(self, state: QuantizationState, samples: 'npt.NDArray[np.int64]') -> QuantizationState:
        self.input_shift = np.zeros(self.in_channels, dtype=np.int64)
        while True: # Repeat only if input_shift was adjusted
            in_channel_min, in_channel_max = get_channel_min_max(state.sample_quantized_data) # TODO: Move outside of the loop
            # Adjust input to the current bit shift
            in_scale = state.channel_scale / (1 << self.input_shift)
            in_channel_min = in_channel_min >> input_shift
            in_channel_max = in_channel_max >> input_shift
            in_channel_est = np.maximum(np.max(np.abs(in_channel_min)), np.max(np.abs(in_channel_max))) >> 1 # TODO: Better estimate
            # Scale filter weights to invert input scale
            filter = self.filter.copy() # shape: outC, H, W, inC
            filter = filter / in_scale
            # Get the maximum value for each filter channel and create output scale, so it becomes ±127
            mag = np.max(np.abs(filter), axis=(1, 2, 3))
            mag = np.maximum(mag, np.max(mag) / 1000000)
            output_scale = 127 / mag
            # Calculate scaled filter (but not quantized yet)
            filter = filter * output_scale.reshape(-1, 1, 1, 1)
            # If possible, maximize weights for each input channel by shifting the input
            max_filter_per_in_channel = np.max(np.abs(filter), axis=(0, 1, 2))
            can_be_updated = (((in_channel_est >> input_shift) / max_filter_per_in_channel > 6) & (max_filter_per_in_channel <= 63)).astype(np.int64)
            if max(can_be_updated) > 0:
                input_shift += can_be_updated
                continue
            # Quantize filter
            filter = np.round(filter)
            assert np.max(np.abs(filter)) <= 127
            filter = filter.astype(np.int64)
            self.qfilter = filter
            # Check if maximum values during convolution operation are within limits of HALF_RANGE_INT32
            positive_filter = np.maximum(0, filter)
            negative_filter = np.minimum(0, filter)
            positive_addends = np.abs(positive_filter * in_channel_max) + np.abs(negative_filter * in_channel_min)
            negative_addends = np.abs(positive_filter * in_channel_min) + np.abs(negative_filter * in_channel_max)
            positive_addends = np.sum(positive_addends, axis=(1, 2)) # shape: outC, inC
            negative_addends = np.sum(negative_addends, axis=(1, 2)) # shape: outC, inC
            if np.max(np.sum(positive_addends, axis=1)) > HALF_RANGE_INT32 or np.max(np.sum(negative_addends, axis=1)) > HALF_RANGE_INT32:
                indexes = find_biggest_addends(positive_addends)
                indexes = indexes.union(find_biggest_addends(negative_addends))
                for i in indexes:
                    input_shift[i] += 1
                continue
            # Calculate quantized bias
            self.qbias = np.round(self.bias * output_scale).astype(np.int64)
            # Make sure that the bias occupies half of the range (other half will be used by the convolution)
            if np.max(np.abs(self.qbias)) > HALF_RANGE_INT32:
                input_shift += 1
                continue
            break
        # TODO: Maximize input clamping
        # TODO: Calculate output shifts to fit into int16 output range
        self.output_shift = np.zeros(self.out_channels, dtype=np.int64)
        max_output = np.maximum(np.sum(positive_addends, axis=1), np.sum(negative_addends, axis=1))
        while np.max(max_output) > FULL_RANGE_INT16:
            too_big = (max_output > FULL_RANGE_INT16).astype(np.int64)
            output_scale = output_scale / (1 + too_big.astype(np.float64))
            max_output = max_output >> too_big
            self.output_shift += too_big
        # TODO: Adjust output shifts based on feedback (probably in different method)
        state = QuantizationState2D()
        state.channel_scale = output_scale
        return state

# n = Conv2D(nodes[0])
# s = QuantizationState2D()
# s.channel_scale = np.array([255], dtype=np.float64)
# s.sample_quantized_data = np.random.randint(0, 255, (10, 76, 34, 1), dtype=np.int64)
# r = n.quantize(s)

# pprint(n.qfilter)
# pprint(n.qbias)
# pprint(n.output_shift)
# pprint(r.__dict__)

##########################################################
# Mel spectrogram 100% compatible with the original model
##########################################################

# mod, mod_in, mod_out = get_model(12400)
# data = np.random.rand(12400).astype(np.float32) * 2 - 1
# mod.set_tensor(mod_in, data.reshape(1, -1))
# mod.invoke()
# mel = mod.get_tensor(66).reshape(-1, 32)

# def calc_mel(data):
#     data = data[:400]
#     data = data * fft_window
#     data = np.pad(data, (0, 512 - len(data)), mode='constant', constant_values=0)
#     data = torch.from_numpy(data)
#     compl = torch.fft.rfft(data)
#     real = compl.abs().numpy()
#     result = np.dot(mel_weights, real) + mel_bias
#     return np.log(result)

# mel2 = calc_mel(data)
# pprint(mel[0])
# pprint(mel2)
# pprint(np.max(mel[0] - mel2))
# pprint(np.max(mel[1] - calc_mel(data[160:])))
# pprint(np.max(mel[2] - calc_mel(data[320:])))
# pprint(np.max(mel[3] - calc_mel(data[480:])))
# print(mod.get_tensor(mod_out).shape)
