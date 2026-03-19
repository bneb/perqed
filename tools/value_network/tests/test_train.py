"""RED tests for the training loop — written before implementation.

These tests use tiny synthetic data so they run fast with no GPU.
"""
import json
import os
import tempfile
import pytest
import torch
from train import train_one_epoch, build_optimizer, build_criterion
from model import ValueNetwork
from dataset import MatrixEnergyDataset
from torch.utils.data import DataLoader

INPUT_DIM = 595


def _synthetic_jsonl(path: str, n: int = 64) -> None:
    """Write n synthetic JSONL records."""
    import random
    with open(path, "w") as f:
        for _ in range(n):
            flat = "".join(random.choice("01") for _ in range(INPUT_DIM))
            energy = float(random.randint(0, 1000))
            f.write(json.dumps({"matrix_flat": flat, "energy": energy}) + "\n")


class TestTrainingLoop:
    def test_one_batch_step_runs_without_error(self, tmp_path):
        p = str(tmp_path / "data.jsonl")
        _synthetic_jsonl(p, n=32)
        ds = MatrixEnergyDataset(p)
        loader = DataLoader(ds, batch_size=16)
        net = ValueNetwork()
        opt = build_optimizer(net)
        crit = build_criterion()
        # Should not raise
        train_one_epoch(net, loader, opt, crit, device=torch.device("cpu"), epoch=0, max_batches=2)

    def test_loss_is_finite_after_step(self, tmp_path):
        p = str(tmp_path / "data.jsonl")
        _synthetic_jsonl(p, n=32)
        ds = MatrixEnergyDataset(p)
        loader = DataLoader(ds, batch_size=16)
        net = ValueNetwork()
        opt = build_optimizer(net)
        crit = build_criterion()
        losses = train_one_epoch(
            net, loader, opt, crit, device=torch.device("cpu"), epoch=0, max_batches=2,
            return_losses=True
        )
        assert all(torch.isfinite(torch.tensor(l)) for l in losses), "Loss must be finite"

    def test_parameters_change_after_step(self, tmp_path):
        p = str(tmp_path / "data.jsonl")
        _synthetic_jsonl(p, n=32)
        ds = MatrixEnergyDataset(p)
        loader = DataLoader(ds, batch_size=16)
        net = ValueNetwork()
        before = {k: v.clone() for k, v in net.named_parameters()}
        opt = build_optimizer(net)
        crit = build_criterion()
        train_one_epoch(
            net, loader, opt, crit, device=torch.device("cpu"), epoch=0, max_batches=1
        )
        changed = any(
            not torch.allclose(before[k], v) for k, v in net.named_parameters()
        )
        assert changed, "At least one parameter must change after an optimizer step"

    def test_checkpoint_creates_file(self, tmp_path):
        p = str(tmp_path / "data.jsonl")
        _synthetic_jsonl(p, n=64)
        ckpt = str(tmp_path / "ckpt.pt")
        ds = MatrixEnergyDataset(p)
        loader = DataLoader(ds, batch_size=16)
        net = ValueNetwork()
        opt = build_optimizer(net)
        crit = build_criterion()
        train_one_epoch(
            net, loader, opt, crit, device=torch.device("cpu"), epoch=0,
            checkpoint_path=ckpt, checkpoint_every=2
        )
        assert os.path.exists(ckpt), f"Checkpoint not found at {ckpt}"

    def test_criterion_is_smooth_l1(self):
        crit = build_criterion()
        assert isinstance(crit, torch.nn.SmoothL1Loss), "Must use SmoothL1Loss (Huber)"
