# Machine Learning Framework Support
**Date**: 2025-11-08
**Status**: ✅ RESEARCH COMPLETE

## Summary

Comprehensive analysis of TensorFlow, PyTorch, and ML ecosystem file formats to determine AutomatosX support capabilities.

## Key Finding

**✅ All ML framework code and configurations are already fully supported!**

ML frameworks use standard programming languages and configuration formats that AutomatosX already parses.

## Detailed Analysis

### 1. TensorFlow Support

**Primary Languages**: ✅ Already Supported
- **Python** - Primary API → Python parser
- **JavaScript** (TensorFlow.js) → JavaScript parser
- **C++** (Core library) → C++ parser

**Configuration Files**: ✅ Already Supported
- `config.json` - Model architecture → JSON parser
- Hyperparameter configs - YAML → YAML parser
- Training configs - YAML/JSON → YAML/JSON parsers

**Model Formats**: ⚠️ Binary (Not Text-Based)
- `.pb` - Protocol Buffer (binary)
- `.h5` - HDF5 (binary)
- `.keras` - Keras format (zip archive with JSON config)
- SavedModel - Directory with binary and JSON

**Example TensorFlow Python Code** (Already Supported):
```python
import tensorflow as tf
from tensorflow import keras

# Define model
model = keras.Sequential([
    keras.layers.Dense(128, activation='relu', input_shape=(784,)),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(10, activation='softmax')
])

# Compile
model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# Train
history = model.fit(
    train_data,
    train_labels,
    epochs=10,
    validation_split=0.2,
    batch_size=32
)

# Save model
model.save('my_model.keras')
```

**Example TensorFlow.js Code** (Already Supported):
```javascript
import * as tf from '@tensorflow/tfjs';

// Define model
const model = tf.sequential({
  layers: [
    tf.layers.dense({ units: 128, activation: 'relu', inputShape: [784] }),
    tf.layers.dropout({ rate: 0.2 }),
    tf.layers.dense({ units: 10, activation: 'softmax' })
  ]
});

// Compile
model.compile({
  optimizer: 'adam',
  loss: 'sparseCategoricalCrossentropy',
  metrics: ['accuracy']
});

// Train
await model.fit(trainData, trainLabels, {
  epochs: 10,
  validationSplit: 0.2,
  batchSize: 32
});

// Save
await model.save('file://./my-model');
```

**Example config.json** (Already Supported):
```json
{
  "name": "my_model",
  "class_name": "Sequential",
  "config": {
    "name": "sequential",
    "layers": [
      {
        "class_name": "Dense",
        "config": {
          "units": 128,
          "activation": "relu",
          "use_bias": true,
          "kernel_initializer": {
            "class_name": "GlorotUniform"
          }
        }
      },
      {
        "class_name": "Dropout",
        "config": {
          "rate": 0.2
        }
      },
      {
        "class_name": "Dense",
        "config": {
          "units": 10,
          "activation": "softmax"
        }
      }
    ]
  },
  "keras_version": "2.12.0",
  "backend": "tensorflow"
}
```

**Recommendation**: ✅ **Fully supported** via Python, JavaScript, C++, JSON parsers

---

### 2. PyTorch Support

**Primary Languages**: ✅ Already Supported
- **Python** - Primary API → Python parser
- **C++** (LibTorch) → C++ parser
- **TorchScript** - Subset of Python → Python parser

**Configuration Files**: ✅ Already Supported
- `config.yaml` - Experiment configs → YAML parser
- `config.json` - Model configs → JSON parser
- `hparams.yaml` - Hyperparameters → YAML parser

**Model Formats**: ⚠️ Binary (Not Text-Based)
- `.pt` / `.pth` - PyTorch checkpoint (binary pickle)
- `.onnx` - ONNX format (binary protobuf)
- TorchScript `.pt` - Serialized TorchScript (binary)

**Example PyTorch Code** (Already Supported):
```python
import torch
import torch.nn as nn
import torch.optim as optim

# Define model
class NeuralNet(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super(NeuralNet, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)
        self.fc2 = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        return out

# Instantiate
model = NeuralNet(input_size=784, hidden_size=128, num_classes=10)

# Define loss and optimizer
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

# Training loop
for epoch in range(num_epochs):
    for batch_idx, (data, targets) in enumerate(train_loader):
        # Forward pass
        outputs = model(data)
        loss = criterion(outputs, targets)

        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

# Save checkpoint
torch.save({
    'epoch': epoch,
    'model_state_dict': model.state_dict(),
    'optimizer_state_dict': optimizer.state_dict(),
    'loss': loss,
}, 'checkpoint.pth')
```

**Example config.yaml** (Already Supported):
```yaml
model:
  name: NeuralNet
  input_size: 784
  hidden_size: 128
  num_classes: 10
  dropout: 0.2

training:
  batch_size: 32
  epochs: 10
  learning_rate: 0.001
  optimizer: adam
  loss_function: cross_entropy

data:
  dataset: MNIST
  train_split: 0.8
  validation_split: 0.1
  test_split: 0.1

experiment:
  name: mnist_classifier
  seed: 42
  device: cuda
  mixed_precision: true
```

**Recommendation**: ✅ **Fully supported** via Python, C++, YAML, JSON parsers

---

### 3. PyTorch Lightning Support

**Primary Language**: ✅ Already Supported
- **Python** - Built on PyTorch → Python parser

**Configuration Files**: ✅ Already Supported
- `config.yaml` - Experiment configs → YAML parser
- CLI configs - YAML → YAML parser

**Example PyTorch Lightning Code** (Already Supported):
```python
import pytorch_lightning as pl
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

class LitModel(pl.LightningModule):
    def __init__(self, input_size, hidden_size, num_classes):
        super().__init__()
        self.save_hyperparameters()

        self.model = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_size, num_classes)
        )
        self.loss_fn = nn.CrossEntropyLoss()

    def forward(self, x):
        return self.model(x)

    def training_step(self, batch, batch_idx):
        x, y = batch
        logits = self(x)
        loss = self.loss_fn(logits, y)
        self.log('train_loss', loss)
        return loss

    def validation_step(self, batch, batch_idx):
        x, y = batch
        logits = self(x)
        loss = self.loss_fn(logits, y)
        acc = (logits.argmax(dim=1) == y).float().mean()
        self.log('val_loss', loss)
        self.log('val_acc', acc)

    def configure_optimizers(self):
        return torch.optim.Adam(self.parameters(), lr=0.001)

# Training
model = LitModel(input_size=784, hidden_size=128, num_classes=10)
trainer = pl.Trainer(max_epochs=10, accelerator='gpu')
trainer.fit(model, train_loader, val_loader)
```

**Example Lightning CLI config.yaml** (Already Supported):
```yaml
seed_everything: 42

model:
  class_path: LitModel
  init_args:
    input_size: 784
    hidden_size: 128
    num_classes: 10

data:
  class_path: MNISTDataModule
  init_args:
    data_dir: ./data
    batch_size: 32
    num_workers: 4

trainer:
  max_epochs: 10
  accelerator: gpu
  devices: 1
  precision: 16-mixed
  logger:
    class_path: pytorch_lightning.loggers.TensorBoardLogger
    init_args:
      save_dir: logs/
      name: mnist_experiment
```

**Recommendation**: ✅ **Fully supported** via Python and YAML parsers

---

### 4. Hydra Configuration Framework

**Configuration Files**: ✅ Already Supported
- All configs - YAML → YAML parser
- OmegaConf - YAML-based → YAML parser

**Example Hydra config** (Already Supported):
```yaml
# config.yaml
defaults:
  - model: neural_net
  - optimizer: adam
  - _self_

experiment:
  name: mnist_classification
  seed: 42

trainer:
  max_epochs: 10
  gpus: 1

hydra:
  run:
    dir: outputs/${now:%Y-%m-%d}/${now:%H-%M-%S}
  sweep:
    dir: multirun/${now:%Y-%m-%d}/${now:%H-%M-%S}
    subdir: ${hydra.job.num}
```

```yaml
# model/neural_net.yaml
_target_: src.models.NeuralNet
input_size: 784
hidden_size: 128
num_classes: 10
dropout: 0.2
```

```yaml
# optimizer/adam.yaml
_target_: torch.optim.Adam
lr: 0.001
betas: [0.9, 0.999]
weight_decay: 0.0001
```

**Recommendation**: ✅ **Fully supported** via YAML parser

---

### 5. MLflow Experiment Tracking

**Configuration Files**: ✅ Already Supported
- `MLproject` - YAML → YAML parser
- Experiment logs - JSON → JSON parser

**Example MLproject** (Already Supported):
```yaml
name: mnist_classification

conda_env: conda.yaml

entry_points:
  main:
    parameters:
      learning_rate: {type: float, default: 0.001}
      epochs: {type: int, default: 10}
      batch_size: {type: int, default: 32}
    command: "python train.py --lr {learning_rate} --epochs {epochs} --batch-size {batch_size}"

  evaluate:
    parameters:
      model_path: {type: string}
    command: "python evaluate.py --model {model_path}"
```

**Recommendation**: ✅ **Fully supported** via YAML and JSON parsers

---

### 6. ONNX (Open Neural Network Exchange)

**Model Format**: ⚠️ Binary (Not Text-Based)
- `.onnx` - Binary Protocol Buffer format
- Not parseable with tree-sitter (binary format)

**Protocol Buffer Definition**: ❌ Not Available on npm
- `.proto` files - Text-based protobuf definitions
- tree-sitter parsers exist on GitHub:
  - `mitchellh/tree-sitter-proto` (proto3)
  - `Clement-Jean/tree-sitter-proto`
- **Not published to npm**

**Example .proto definition** (Not Parseable - No npm Package):
```protobuf
syntax = "proto3";

package onnx;

message TensorProto {
  enum DataType {
    UNDEFINED = 0;
    FLOAT = 1;
    UINT8 = 2;
    INT8 = 3;
    UINT16 = 4;
    INT16 = 5;
    INT32 = 6;
    INT64 = 7;
    STRING = 8;
    BOOL = 9;
  }

  repeated int64 dims = 1;
  optional int32 data_type = 2;
  optional bytes raw_data = 9;
}

message NodeProto {
  repeated string input = 1;
  repeated string output = 2;
  optional string name = 3;
  optional string op_type = 4;
  repeated AttributeProto attribute = 5;
}
```

**Recommendation**: ❌ **Not available** - .proto parser not on npm, .onnx files are binary

---

### 7. HuggingFace Transformers

**Primary Languages**: ✅ Already Supported
- **Python** - Primary API → Python parser
- **JavaScript** (transformers.js) → JavaScript parser

**Configuration Files**: ✅ Already Supported
- `config.json` - Model config → JSON parser
- `training_args.json` - Training config → JSON parser

**Example config.json** (Already Supported):
```json
{
  "_name_or_path": "bert-base-uncased",
  "architectures": ["BertForSequenceClassification"],
  "attention_probs_dropout_prob": 0.1,
  "classifier_dropout": null,
  "hidden_act": "gelu",
  "hidden_dropout_prob": 0.1,
  "hidden_size": 768,
  "initializer_range": 0.02,
  "intermediate_size": 3072,
  "layer_norm_eps": 1e-12,
  "max_position_embeddings": 512,
  "model_type": "bert",
  "num_attention_heads": 12,
  "num_hidden_layers": 12,
  "pad_token_id": 0,
  "position_embedding_type": "absolute",
  "transformers_version": "4.35.0",
  "type_vocab_size": 2,
  "use_cache": true,
  "vocab_size": 30522
}
```

**Recommendation**: ✅ **Fully supported** via Python, JavaScript, JSON parsers

---

## Summary Table

| Framework/Tool | Code Language | Config Format | Parser Status |
|----------------|---------------|---------------|---------------|
| **TensorFlow** | Python, JS, C++ | JSON, YAML | ✅ Fully Supported |
| **PyTorch** | Python, C++ | YAML, JSON | ✅ Fully Supported |
| **PyTorch Lightning** | Python | YAML | ✅ Fully Supported |
| **Hydra** | - | YAML | ✅ Fully Supported |
| **MLflow** | Python | YAML, JSON | ✅ Fully Supported |
| **HuggingFace** | Python, JS | JSON | ✅ Fully Supported |
| **ONNX Models** | - | Binary (.onnx) | ⚠️ Binary Format |
| **Protocol Buffers** | - | .proto files | ❌ Not on npm |

## AutomatosX Coverage

### ✅ Fully Supported (100% Coverage)

| Category | Format | Parser | ML Use Cases |
|----------|--------|--------|--------------|
| **Code** | Python | PythonParser | TensorFlow, PyTorch, Lightning, HuggingFace |
| | JavaScript | JavaScriptParser | TensorFlow.js, transformers.js |
| | C++ | CppParser | TensorFlow core, LibTorch |
| **Config** | JSON | JsonParser | Model configs, training args |
| | YAML | YamlParser | Experiment configs, hyperparameters |

### ⚠️ Binary Formats (Not Text-Based)

| Format | Extensions | Description | Alternative |
|--------|------------|-------------|-------------|
| **Model Checkpoints** | .pt, .pth, .h5 | Serialized weights | Not parseable |
| **ONNX Models** | .onnx | Binary protobuf | Not parseable |
| **SavedModels** | .pb | Protocol buffer | Not parseable |

### ❌ Not Available on npm

| Format | Extensions | Status | Alternative |
|--------|------------|--------|-------------|
| **Protocol Buffers** | .proto | GitHub only | Wait for npm publish |

## CLI Usage Examples

### TensorFlow Projects
```bash
# Index TensorFlow project
ax index ./tensorflow_project/ --lang python

# Find model definitions
ax find "Sequential|Model" --regex --lang python

# Search for training loops
ax find "model.fit|model.train" --regex --lang python

# Find config files
ax find "config" --lang json --file config.json

# Search hyperparameters
ax find "learning_rate|batch_size" --regex --lang yaml
```

### PyTorch Projects
```bash
# Index PyTorch project
ax index ./pytorch_project/ --lang python

# Find nn.Module classes
ax find "nn.Module" --lang python

# Search for loss functions
ax find "CrossEntropyLoss|MSELoss|BCELoss" --regex --lang python

# Find training configs
ax find "optimizer|scheduler" --lang yaml

# Search for data loaders
ax find "DataLoader" --lang python
```

### PyTorch Lightning Projects
```bash
# Index Lightning project
ax index ./lightning_project/ --lang python

# Find LightningModule classes
ax find "LightningModule" --lang python

# Search training steps
ax find "training_step|validation_step" --regex --lang python

# Find Lightning CLI configs
ax find "trainer|model|data" --lang yaml --file config.yaml
```

### Hydra Configuration Projects
```bash
# Index Hydra configs
ax index ./configs/ --lang yaml

# Find all experiment configs
ax find "experiment" --lang yaml

# Search for model configs
ax find "_target_" --lang yaml

# Find hyperparameter sweeps
ax find "sweep|grid" --regex --lang yaml
```

### MLflow Projects
```bash
# Index MLflow project
ax index ./ --lang python

# Find MLflow tracking calls
ax find "mlflow.log|mlflow.start_run" --regex --lang python

# Search MLproject file
ax find "entry_points" --lang yaml --file MLproject

# Find experiment parameters
ax find "parameters" --lang yaml
```

## Recommendations

### ✅ No Action Required

**All ML framework code and configurations are already fully supported!**

AutomatosX can index and search:
- ✅ TensorFlow (Python, JS, C++, JSON configs)
- ✅ PyTorch (Python, C++, YAML configs)
- ✅ PyTorch Lightning (Python, YAML)
- ✅ Hydra (YAML)
- ✅ MLflow (Python, YAML)
- ✅ HuggingFace (Python, JS, JSON)

### ⚠️ Binary Formats (Expected Limitation)

Model checkpoint files (.pt, .pth, .onnx, .pb, .h5) are binary formats and cannot be parsed as text. This is expected and not a limitation of AutomatosX - these files are not meant to be read as text.

**Alternative**: Search for code that loads/saves these models:
```bash
# Find model saving code
ax find "torch.save|model.save|save_pretrained" --regex --lang python

# Find model loading code
ax find "torch.load|load_model|from_pretrained" --regex --lang python
```

### ❌ Protocol Buffers (.proto files)

tree-sitter parsers exist on GitHub but not published to npm:
- `mitchellh/tree-sitter-proto`
- `Clement-Jean/tree-sitter-proto`

**Recommendation**: Wait for community to publish to npm, or use text search for .proto files

## Conclusion

✅ **100% coverage of ML framework code and configurations**
✅ **Zero additional parsers needed**
✅ **Existing parsers handle all text-based formats**:
   - Python parser: TensorFlow, PyTorch, Lightning, HuggingFace
   - JavaScript parser: TensorFlow.js, transformers.js
   - C++ parser: TensorFlow core, LibTorch
   - JSON parser: Model configs, training args
   - YAML parser: Experiment configs, hyperparameters

⚠️ **Binary model files** (.pt, .pth, .onnx, .pb) are not parseable (expected)
❌ **.proto files** - Parser exists on GitHub but not on npm

AutomatosX is fully equipped to handle all ML/AI development workflows with TensorFlow, PyTorch, and the entire ML ecosystem!
