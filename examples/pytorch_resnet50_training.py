"""
Mixed precision ResNet-50 training loop for image classification.

Author: Mira — "From architecture to inference - I build models that ship."

This script focuses on the core PyTorch 2.x training primitives:
- ImageFolder-based DataLoader with realistic augmentations
- Transfer learning from torchvision's pretrained ResNet-50
- Mixed precision training via torch.amp.autocast + GradScaler
- torch.compile() to squeeze extra throughput from the forward pass

Expected directory structure for the dataset:
data_root/
  train/
    class_a/*.jpg
    class_b/*.jpg
  val/
    class_a/*.jpg
    class_b/*.jpg

Run:
  python examples/pytorch_resnet50_training.py --data-root /path/to/data
"""

from __future__ import annotations

import argparse
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

import torch
from torch import nn
from torch.amp import GradScaler, autocast
from torch.optim import Optimizer
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from torchvision.models import ResNet50_Weights, resnet50
from tqdm import tqdm


@dataclass
class TrainConfig:
  data_root: Path
  batch_size: int = 64
  num_workers: int = 8
  epochs: int = 20
  learning_rate: float = 5e-4
  weight_decay: float = 0.01
  seed: int = 17
  output_dir: Path = Path("artifacts/checkpoints")
  log_every: int = 25
  num_classes: int | None = None


def set_seed(seed: int) -> None:
  random.seed(seed)
  torch.manual_seed(seed)
  torch.cuda.manual_seed_all(seed)
  torch.backends.cudnn.deterministic = False
  torch.backends.cudnn.benchmark = True


def build_dataloaders(cfg: TrainConfig) -> Tuple[DataLoader, DataLoader, int]:
  """Construct train/val DataLoaders and infer class count."""
  train_dir = cfg.data_root / "train"
  val_dir = cfg.data_root / "val"

  if not train_dir.is_dir() or not val_dir.is_dir():
    raise FileNotFoundError(
        f"Expecting 'train' and 'val' subdirectories under {cfg.data_root}"
    )

  train_tfms = transforms.Compose(
      [
          transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
          transforms.RandomHorizontalFlip(),
          transforms.ColorJitter(0.2, 0.2, 0.2, 0.1),
          transforms.RandomApply(
              [transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))], p=0.3
          ),
          transforms.ToTensor(),
          transforms.Normalize(
              mean=ResNet50_Weights.IMAGENET1K_V2.meta["mean"],
              std=ResNet50_Weights.IMAGENET1K_V2.meta["std"],
          ),
      ]
  )

  eval_tfms = transforms.Compose(
      [
          transforms.Resize(256),
          transforms.CenterCrop(224),
          transforms.ToTensor(),
          transforms.Normalize(
              mean=ResNet50_Weights.IMAGENET1K_V2.meta["mean"],
              std=ResNet50_Weights.IMAGENET1K_V2.meta["std"],
          ),
      ]
  )

  train_dataset = datasets.ImageFolder(train_dir, transform=train_tfms)
  val_dataset = datasets.ImageFolder(val_dir, transform=eval_tfms)
  num_classes = len(train_dataset.classes)

  loader_kwargs = dict(
      batch_size=cfg.batch_size,
      num_workers=cfg.num_workers,
      pin_memory=True,
      persistent_workers=cfg.num_workers > 0,
  )

  train_loader = DataLoader(train_dataset, shuffle=True, drop_last=True, **loader_kwargs)
  val_loader = DataLoader(val_dataset, shuffle=False, drop_last=False, **loader_kwargs)

  return train_loader, val_loader, num_classes


def build_model(num_classes: int) -> nn.Module:
  """Load pretrained ResNet-50 and replace the classification head."""
  base_model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
  in_features = base_model.fc.in_features
  base_model.fc = nn.Sequential(
      nn.Dropout(p=0.2),
      nn.Linear(in_features, num_classes),
  )
  return base_model


def accuracy(output: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
  preds = output.argmax(dim=1)
  return (preds == target).float().mean()


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: Optimizer,
    scaler: GradScaler,
    device: torch.device,
    epoch: int,
    cfg: TrainConfig,
) -> Tuple[float, float]:
  model.train()
  running_loss = 0.0
  running_acc = 0.0

  for step, (images, labels) in enumerate(tqdm(loader, desc=f"Epoch {epoch} [train]")):
    images = images.to(device, non_blocking=True)
    labels = labels.to(device, non_blocking=True)

    optimizer.zero_grad(set_to_none=True)

    with autocast(device_type=device.type, dtype=torch.float16 if device.type == "cuda" else torch.bfloat16):
      logits = model(images)
      loss = nn.functional.cross_entropy(logits, labels)

    scaler.scale(loss).backward()
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)
    scaler.update()

    with torch.no_grad():
      running_loss += loss.item()
      running_acc += accuracy(logits, labels).item()

    if step % cfg.log_every == 0:
      current_lr = optimizer.param_groups[0]["lr"]
      print(
          f"Epoch {epoch} | step {step:04d} | lr {current_lr:.2e} | "
          f"loss {loss.item():.4f}"
      )

  steps = len(loader)
  return running_loss / steps, running_acc / steps


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
) -> Tuple[float, float]:
  model.eval()
  total_loss = 0.0
  total_acc = 0.0

  for images, labels in tqdm(loader, desc="Validation"):
    images = images.to(device, non_blocking=True)
    labels = labels.to(device, non_blocking=True)

    logits = model(images)
    total_loss += nn.functional.cross_entropy(logits, labels).item()
    total_acc += accuracy(logits, labels).item()

  steps = len(loader)
  return total_loss / steps, total_acc / steps


def save_checkpoint(
    model: nn.Module,
    optimizer: Optimizer,
    epoch: int,
    cfg: TrainConfig,
    metric: float,
) -> None:
  cfg.output_dir.mkdir(parents=True, exist_ok=True)
  ckpt = {
      "epoch": epoch,
      "state_dict": model.state_dict(),
      "optimizer_state": optimizer.state_dict(),
      "val_top1": metric,
  }
  torch.save(ckpt, cfg.output_dir / f"resnet50_epoch{epoch:03d}_acc{metric:.3f}.pt")


def train_model(cfg: TrainConfig) -> None:
  set_seed(cfg.seed)

  train_loader, val_loader, inferred_classes = build_dataloaders(cfg)
  num_classes = cfg.num_classes or inferred_classes

  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
  print(f"Using device: {device}")

  torch.set_float32_matmul_precision("high")
  model = build_model(num_classes).to(device)
  model = torch.compile(model)  # PyTorch 2.x graph capture for extra throughput

  optimizer = torch.optim.AdamW(
      model.parameters(), lr=cfg.learning_rate, weight_decay=cfg.weight_decay
  )
  scheduler = CosineAnnealingLR(optimizer, T_max=cfg.epochs)
  scaler = GradScaler(device.type if device.type == "cuda" else "cpu")

  best_acc = 0.0

  for epoch in range(1, cfg.epochs + 1):
    epoch_start = time.time()

    train_loss, train_acc = train_one_epoch(
        model, train_loader, optimizer, scaler, device, epoch, cfg
    )
    val_loss, val_acc = evaluate(model, val_loader, device)
    scheduler.step()

    elapsed = time.time() - epoch_start
    print(
        f"Epoch {epoch:02d} finished in {elapsed:.1f}s | "
        f"train loss {train_loss:.4f}, train acc {train_acc*100:.2f}% | "
        f"val loss {val_loss:.4f}, val acc {val_acc*100:.2f}%"
    )

    if val_acc > best_acc:
      best_acc = val_acc
      save_checkpoint(model, optimizer, epoch, cfg, metric=val_acc)


def parse_args() -> TrainConfig:
  parser = argparse.ArgumentParser(description="ResNet-50 mixed precision training")
  parser.add_argument("--data-root", type=Path, required=True, help="Dataset root path")
  parser.add_argument("--epochs", type=int, default=20)
  parser.add_argument("--batch-size", type=int, default=64)
  parser.add_argument("--num-workers", type=int, default=8)
  parser.add_argument("--lr", type=float, default=5e-4)
  parser.add_argument("--weight-decay", type=float, default=0.01)
  parser.add_argument("--seed", type=int, default=17)
  parser.add_argument("--output-dir", type=Path, default=Path("artifacts/checkpoints"))
  args = parser.parse_args()

  return TrainConfig(
      data_root=args.data_root,
      epochs=args.epochs,
      batch_size=args.batch_size,
      num_workers=args.num_workers,
      learning_rate=args.lr,
      weight_decay=args.weight_decay,
      seed=args.seed,
      output_dir=args.output_dir,
  )


if __name__ == "__main__":
  config = parse_args()
  train_model(config)
