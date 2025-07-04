import torch
import sys
import torch.nn as nn
import torch.optim as optim
from torch.utils.tensorboard import SummaryWriter
from torch.utils.data import Dataset, DataLoader
import numpy as np
import os
from datetime import datetime
from tqdm import tqdm
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import src.config as cfg
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score

head_model_input_size = cfg.EMBEDDINGS_COUNT * cfg.FEATURES_COUNT
shared_input_parts = cfg.EMBEDDINGS_WINDOW_DEVISABLE_BY
shared_output_size = 16
middle_layer_size = 16

# ===== Model Definition =====

class SharedLinearNet(nn.Module):
    def __init__(self):
        super(SharedLinearNet, self).__init__()

        assert head_model_input_size % shared_input_parts == 0, "Input size must be divisible by number of parts"

        self.part_size = head_model_input_size // shared_input_parts
        self.shared_linear = nn.Linear(self.part_size, shared_output_size)

        self.classifier = nn.Sequential(
            nn.ReLU(),
            nn.Linear(shared_output_size * shared_input_parts, middle_layer_size),
            nn.ReLU(),
            nn.Linear(middle_layer_size, 1),
            #nn.Sigmoid()
        )

    def forward(self, x):
        parts = torch.chunk(x, chunks=shared_input_parts, dim=1)
        transformed_parts = [self.shared_linear(part) for part in parts]
        combined = torch.cat(transformed_parts, dim=1)
        return self.classifier(combined)

# ===== Dataset Loader with np.memmap =====

class MemmapDataset(Dataset):
    def __init__(self, positive_file, negative_file, input_size):
        # Load positive samples
        self.positive = np.memmap(positive_file, dtype='float32', mode='r')
        self.positive = self.positive.reshape(-1, input_size)
        self.negative = np.memmap(negative_file, dtype='float32', mode='r')
        self.negative = self.negative.reshape(-1, input_size)

        self.data = np.vstack([self.positive, self.negative])
        self.labels = np.hstack([
            np.ones(len(self.positive), dtype='float32'),
            np.zeros(len(self.negative), dtype='float32')
        ])

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        x = torch.from_numpy(self.data[idx])
        y = torch.tensor(self.labels[idx])
        return x, y

def evaluate(model, dataloader, criterion):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    all_preds = []
    all_labels = []

    with torch.no_grad():
        for x, y in dataloader:
            output = model(x).view(-1)
            loss = criterion(output, y)
            total_loss += loss.item()
            preds = (output >= 0.0).float()
            correct += (preds == y).sum().item()
            total += y.size(0)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(y.cpu().numpy())

    avg_loss = total_loss / len(dataloader)
    accuracy = correct / total

    # Evaluation metrics
    y_true = np.array(all_labels)
    y_pred = np.array(all_preds)

    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)

    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)

    print(f"False Positives: {fp}/{fp + tn} = ({fp / (fp + tn) * 100:.2f}%)")
    print(f"False Negatives: {fn}/{fn + tp} = ({fn / (fn + tp) * 100:.2f}%)")
    print(f"Precision: {precision:.3f}")
    print(f"Recall:    {recall:.3f}")
    print(f"F1 Score:  {f1:.3f}")

    return avg_loss, accuracy

# ===== Training Function =====

def train():
    batch_size = 32
    epochs = 100
    lr = 1e-5

    dataset = MemmapDataset('data/positive.dat', 'data/negative.dat', head_model_input_size)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    val_dataset = MemmapDataset('data/v_positive.dat', 'data/v_negative.dat', head_model_input_size)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    model = SharedLinearNet()
    #criterion = nn.BCELoss()
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([3.0]))
    optimizer = optim.Adam(model.parameters(), lr=lr)

    # TensorBoard setup
    log_dir = f"runs/binary_classifier_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    writer = SummaryWriter(log_dir)

    progress_bar = tqdm(total=epochs)

    for epoch in range(epochs):
        progress_bar.update()
        correct = 0
        total = 0
        total_loss = 0.0
        for batch_idx, (x, y) in enumerate(dataloader):
            optimizer.zero_grad()
            output = model(x).squeeze()
            loss = criterion(output, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            preds = (output >= 0.5).float()
            correct += (preds == y).sum().item()
            total += y.size(0)

        avg_loss = total_loss / len(dataloader)
        accuracy = correct / total
        val_loss, val_accuracy = evaluate(model, val_loader, criterion)
        writer.add_scalars("Loss", {"train": avg_loss, "val": val_loss}, epoch)
        writer.add_scalars("Accuracy", {"train": accuracy, "val": val_accuracy}, epoch)
        writer.flush()
        progress_bar.set_description(f"Loss: {avg_loss:.7f}, Acc: {accuracy*100:.2f}%, VLoss: {val_loss:.8f}, VAcc: {val_accuracy*100:.2f}%", True)
        torch.save(model.state_dict(), "binary_model.pth")

    writer.close()
    #torch.save(model.state_dict(), "binary_model.pth")
    print("Training complete. Model saved to binary_model.pth")

if __name__ == "__main__":
    train()
