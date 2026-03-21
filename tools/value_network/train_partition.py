"""train_partition.py — Training loop for the Schur Partition Value Network.

CLI usage:
  python train_partition.py --data /tmp/partition_experiences.jsonl --epochs 3

The training data (partition_experiences.jsonl) is collected online by sa_loop.ts:
  {"partition_enc": [0.2, 0.1, ...], "energy": 17}

Outputs: partition_value_network.pt (saved to --checkpoint path)
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path
from typing import Optional

import torch
from torch.utils.data import DataLoader

from partition_model import PartitionValueNetwork, PartitionEnergyDataset
from train import build_optimizer, build_criterion, get_device, MetricsLogger


def train_partition_one_epoch(
    model: PartitionValueNetwork,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: torch.nn.Module,
    device: torch.device,
    epoch: int = 0,
    max_batches: Optional[int] = None,
    checkpoint_path: Optional[str] = None,
    checkpoint_every: int = 5_000,
    log_every: int = 500,
    return_losses: bool = False,
    metrics_logger: Optional[MetricsLogger] = None,
    metrics_every: int = 50,
) -> list[float] | None:
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

        if metrics_logger is not None and batch_idx % metrics_every == 0:
            metrics_logger.log(epoch=epoch, batch=batch_idx, loss=loss_val)

        if batch_idx > 0 and batch_idx % log_every == 0:
            elapsed = time.time() - t0
            print(
                f"Epoch {epoch} | Batch {batch_idx:>6} | Loss {loss_val:.4f} | "
                f"Elapsed {elapsed:.1f}s"
            )

        if checkpoint_path and batch_idx > 0 and batch_idx % checkpoint_every == 0:
            PartitionValueNetwork.save(model, checkpoint_path)  # type: ignore[arg-type]
            print(f"  ✅ Checkpoint → {checkpoint_path}")

    if checkpoint_path:
        PartitionValueNetwork.save(model, checkpoint_path)  # type: ignore[arg-type]
        print(f"  ✅ Epoch {epoch} checkpoint → {checkpoint_path}")

    return losses if return_losses else None


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train the Schur Partition Value Network")
    p.add_argument("--data", default="/tmp/partition_experiences.jsonl", help="JSONL training data")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch-size", type=int, default=256)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--weight-decay", type=float, default=1e-2)
    p.add_argument("--num-workers", type=int, default=2)
    p.add_argument("--checkpoint", default="partition_value_network.pt")
    p.add_argument("--checkpoint-every", type=int, default=5_000)
    p.add_argument("--log-every", type=int, default=500)
    p.add_argument("--metrics", default="partition_training_metrics.jsonl")
    p.add_argument("--metrics-every", type=int, default=50)
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    device = get_device()
    print(f"🧠 Device: {device}")

    if not os.path.exists(args.data):
        raise FileNotFoundError(f"Training data not found: {args.data}")

    record_count = sum(1 for line in open(args.data) if line.strip())
    print(f"📦 {record_count} training records in {args.data}")

    ds = PartitionEnergyDataset(args.data)
    loader = DataLoader(
        ds,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        pin_memory=(device.type != "cpu"),
    )

    model = PartitionValueNetwork()
    if os.path.exists(args.checkpoint):
        print(f"🔄 Resuming from {args.checkpoint}")
        model = PartitionValueNetwork.load(args.checkpoint, device=device)
        model.train()

    optimizer = build_optimizer(model, lr=args.lr, weight_decay=args.weight_decay)
    criterion = build_criterion()
    metrics_logger = MetricsLogger(filepath=args.metrics)
    print(f"📊 Telemetry → {args.metrics}")

    for epoch in range(args.epochs):
        print(f"\n── Epoch {epoch + 1}/{args.epochs} ──")
        train_partition_one_epoch(
            model, loader, optimizer, criterion,
            device=device,
            epoch=epoch,
            checkpoint_path=args.checkpoint,
            checkpoint_every=args.checkpoint_every,
            log_every=args.log_every,
            metrics_logger=metrics_logger,
            metrics_every=args.metrics_every,
        )

    print("\n✅ Partition training complete.")


if __name__ == "__main__":
    main()
