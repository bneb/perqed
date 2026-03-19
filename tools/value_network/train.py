"""train.py — Training loop for the Ramsey energy Value Network.

Exports ``train_one_epoch``, ``build_optimizer``, ``build_criterion`` so
tests can import them directly without running the CLI.

CLI usage:
  python train.py --data experiences.jsonl --epochs 5 --batch-size 512
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from dataset import MatrixEnergyDataset
from model import ValueNetwork


# ── MetricsLogger ─────────────────────────────────────────────────────────────────

class MetricsLogger:
    """Append structured JSON telemetry to a JSONL file immediately on every log() call.

    The file is cleared on instantiation so each training run starts fresh.
    Each record contains: epoch, batch, loss, timestamp.
    """

    def __init__(self, filepath: str = "training_metrics.jsonl") -> None:
        self.filepath = Path(filepath)
        # Clear previous run's metrics
        if self.filepath.exists():
            self.filepath.unlink()

    def log(self, epoch: int, batch: int, loss: float) -> None:
        record = {
            "epoch": epoch,
            "batch": batch,
            "loss": loss,
            "timestamp": time.time(),
        }
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record) + "\n")
            f.flush()  # Flush immediately so concurrent readers see the record


# ── Public API (imported by tests) ──────────────────────────────────────────

def build_optimizer(model: nn.Module, lr: float = 1e-4, weight_decay: float = 1e-2) -> optim.Optimizer:
    return optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)


def build_criterion() -> nn.SmoothL1Loss:
    return nn.SmoothL1Loss(beta=1.0)


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
    epoch: int = 0,
    max_batches: Optional[int] = None,
    checkpoint_path: Optional[str] = None,
    checkpoint_every: int = 10_000,
    log_every: int = 1_000,
    return_losses: bool = False,
    metrics_logger: Optional[MetricsLogger] = None,
    metrics_every: int = 50,
) -> list[float] | None:
    """Run one full pass over ``loader``.

    Parameters
    ----------
    max_batches:
        Cap on number of batches (useful for fast tests).
    return_losses:
        If True, return a list of per-batch loss values.
    """
    model.train().to(device)
    losses: list[float] = []
    t0 = time.time()

    for batch_idx, (features, targets) in enumerate(loader):
        if max_batches is not None and batch_idx >= max_batches:
            break

        features = features.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)
        preds = model(features)
        loss = criterion(preds, targets)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        loss_val = loss.item()
        if return_losses:
            losses.append(loss_val)

        # ── Structured telemetry (every metrics_every batches) ─────────────────────
        if metrics_logger is not None and batch_idx % metrics_every == 0:
            metrics_logger.log(epoch=epoch, batch=batch_idx, loss=loss_val)

        if batch_idx > 0 and batch_idx % log_every == 0:
            elapsed = time.time() - t0
            print(
                f"Epoch {epoch} | Batch {batch_idx:>6} | Loss {loss_val:.4f} | "
                f"Elapsed {elapsed:.1f}s"
            )

        if checkpoint_path and batch_idx > 0 and batch_idx % checkpoint_every == 0:
            ValueNetwork.save(model, checkpoint_path)  # type: ignore[arg-type]
            print(f"  ✅ Checkpoint saved → {checkpoint_path}")

    # Final checkpoint at end of epoch
    if checkpoint_path:
        ValueNetwork.save(model, checkpoint_path)  # type: ignore[arg-type]
        print(f"  ✅ Epoch {epoch} checkpoint → {checkpoint_path}")

    return losses if return_losses else None


# ── CLI entrypoint ───────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train the Ramsey energy Value Network")
    p.add_argument("--data", default="experiences.jsonl", help="Path to training JSONL")
    p.add_argument("--epochs", type=int, default=5)
    p.add_argument("--batch-size", type=int, default=512)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--weight-decay", type=float, default=1e-2)
    p.add_argument("--num-workers", type=int, default=4)
    p.add_argument("--checkpoint", default="value_network.pt", help="Checkpoint output path")
    p.add_argument("--checkpoint-every", type=int, default=10_000)
    p.add_argument("--log-every", type=int, default=1_000)
    p.add_argument("--metrics", default="training_metrics.jsonl", help="Telemetry JSONL output")
    p.add_argument("--metrics-every", type=int, default=50, help="Log metrics every N batches")
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    device = get_device()
    print(f"🧠 Device: {device}")

    if not os.path.exists(args.data):
        raise FileNotFoundError(f"Training data not found: {args.data}")

    ds = MatrixEnergyDataset(args.data)
    loader = DataLoader(
        ds,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        pin_memory=(device.type != "cpu"),
    )

    model = ValueNetwork()
    optimizer = build_optimizer(model, lr=args.lr, weight_decay=args.weight_decay)
    criterion = build_criterion()
    metrics_logger = MetricsLogger(filepath=args.metrics)
    print(f"📊 Telemetry → {args.metrics}  (every {args.metrics_every} batches)")

    for epoch in range(args.epochs):
        print(f"\n── Epoch {epoch + 1}/{args.epochs} ──")
        train_one_epoch(
            model, loader, optimizer, criterion,
            device=device,
            epoch=epoch,
            checkpoint_path=args.checkpoint,
            checkpoint_every=args.checkpoint_every,
            log_every=args.log_every,
            metrics_logger=metrics_logger,
            metrics_every=args.metrics_every,
        )

    print("\n✅ Training complete.")


if __name__ == "__main__":
    main()
