import torch
from onnx2torch import convert
import onnx


# Step 1: Load ONNX model and convert to PyTorch
#onnx_model_path = 'models/embedding_model.onnx'
onnx_model_path = 'models/melspectrogram.onnx'
onnx_model = onnx.load(onnx_model_path)
onnx.checker.check_model(onnx_model)
print(onnx.helper.printable_graph(onnx_model.graph))
pytorch_model = convert(onnx_model)
pytorch_model.eval()

# Step 2: (Optional) Fuse layers for better quantization performance
# This works only for certain layer patterns
# You may skip or modify depending on your model structure
# Example:
# pytorch_model = torch.quantization.fuse_modules(pytorch_model, [['conv', 'bn', 'relu']], inplace=False)

# Step 3: Define quantization config
pytorch_model.qconfig = torch.quantization.get_default_qconfig('fbgemm')

# Step 4: Prepare the model for static quantization
torch.quantization.prepare(pytorch_model, inplace=True)

# Step 5: Calibrate with representative data
# Replace this with a batch from your real dataset
example_input = torch.randn(1, 1, 76, 32)
pytorch_model(example_input)

# Step 6: Convert the model to quantized version
quantized_model = torch.quantization.convert(pytorch_model, inplace=False)

# Step 7: Save the quantized PyTorch model
torch.save(quantized_model.state_dict(), 'quantized_model.pt')
