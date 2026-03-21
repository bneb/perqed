"""test_partition_model.py — TDD for partition_model.py"""
from __future__ import annotations
import json, math, os, sys, tempfile
import pytest
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from partition_model import (
    encode_partition,
    PartitionValueNetwork,
    PartitionEnergyDataset,
    INPUT_DIM,
    BLOCK,
    N_DEFAULT,
    K_DEFAULT,
)


# ── encode_partition ──────────────────────────────────────────────────────────

class TestEncodePartition:
    def test_output_length_default(self):
        """Default params: ⌈537/20⌉ * 6 = 27 * 6 = 162 features."""
        partition = [i % K_DEFAULT for i in range(N_DEFAULT)]
        enc = encode_partition(partition)
        assert len(enc) == INPUT_DIM == 162

    def test_output_length_custom(self):
        """Custom N/K/BLOCK give ⌈N/BLOCK⌉ * K features."""
        enc = encode_partition([0, 1, 2, 0, 1, 2], N=6, K=3, block=2)
        expected_len = math.ceil(6 / 2) * 3   # 3 blocks * 3 colors = 9
        assert len(enc) == expected_len

    def test_features_in_unit_range(self):
        """All features must be in [0, 1]."""
        partition = [i % K_DEFAULT for i in range(N_DEFAULT)]
        enc = encode_partition(partition)
        assert all(0.0 <= v <= 1.0 for v in enc), "features out of [0,1]"

    def test_features_sum_to_one_per_block(self):
        """Each block's K features must sum to ~1.0 (they're fractions)."""
        partition = [i % K_DEFAULT for i in range(N_DEFAULT)]
        enc = encode_partition(partition)
        n_blocks = math.ceil(N_DEFAULT / BLOCK)
        for b in range(n_blocks):
            block_sum = sum(enc[b * K_DEFAULT : (b + 1) * K_DEFAULT])
            assert abs(block_sum - 1.0) < 1e-6, f"block {b} sum = {block_sum}"

    def test_one_indexed_input(self):
        """1-indexed array (len=N+1, index 0 unused) should work identically."""
        base = [i % K_DEFAULT for i in range(N_DEFAULT)]
        enc_zero = encode_partition(base)
        one_indexed = [0] + base   # prepend dummy 0
        enc_one = encode_partition(one_indexed)
        assert enc_zero == enc_one

    def test_uniform_partition_equal_fracs(self):
        """All-color-0 partition: first feature of each block = 1.0, rest = 0."""
        N_small, K_small, BLOCK_small = 6, 3, 2
        partition = [0] * N_small   # all color 0
        enc = encode_partition(partition, N=N_small, K=K_small, block=BLOCK_small)
        n_blocks = math.ceil(N_small / BLOCK_small)
        for b in range(n_blocks):
            assert abs(enc[b * K_small] - 1.0) < 1e-6, f"block {b} color 0 frac != 1"
            for k in range(1, K_small):
                assert enc[b * K_small + k] == 0.0


# ── PartitionValueNetwork ─────────────────────────────────────────────────────

class TestPartitionValueNetwork:
    def test_forward_shape(self):
        """Model returns (B, 1) tensor for batch of size B."""
        model = PartitionValueNetwork()
        x = torch.rand(4, INPUT_DIM)
        out = model(x)
        assert out.shape == (4, 1)

    def test_forward_single(self):
        """Model returns scalar-like tensor for single input."""
        model = PartitionValueNetwork()
        x = torch.rand(1, INPUT_DIM)
        out = model(x)
        assert out.shape == (1, 1)
        assert out.item() == out.item()  # not NaN

    def test_parameters_exist(self):
        """Model has trainable parameters."""
        model = PartitionValueNetwork()
        params = list(model.parameters())
        assert len(params) > 0
        total = sum(p.numel() for p in params)
        assert total > 1_000, f"Too few parameters: {total}"

    def test_save_load_roundtrip(self):
        """Saved weights can be reloaded and produce the same output."""
        model = PartitionValueNetwork().eval()  # eval() disables Dropout for determinism
        x = torch.rand(2, INPUT_DIM)
        with torch.no_grad():
            out_before = model(x).clone()

        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
            path = f.name
        try:
            PartitionValueNetwork.save(model, path)
            loaded = PartitionValueNetwork.load(path)
            with torch.no_grad():
                out_after = loaded(x)
            assert torch.allclose(out_before, out_after, atol=1e-6)
        finally:
            os.unlink(path)

    def test_eval_mode_deterministic(self):
        """In eval mode, two forward passes produce the same output (no dropout)."""
        model = PartitionValueNetwork().eval()
        x = torch.rand(1, INPUT_DIM)
        with torch.no_grad():
            out1 = model(x)
            out2 = model(x)
        assert torch.allclose(out1, out2)


# ── PartitionEnergyDataset ────────────────────────────────────────────────────

class TestPartitionEnergyDataset:
    def _make_jsonl(self, n_records: int = 5):
        enc = encode_partition([0] * N_DEFAULT)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
        ) as f:
            for i in range(n_records):
                json.dump({"partition_enc": enc, "energy": float(i * 3)}, f)
                f.write("\n")
            return f.name

    def test_yields_correct_count(self):
        path = self._make_jsonl(5)
        try:
            ds = PartitionEnergyDataset(path)
            records = list(ds)
            assert len(records) == 5
        finally:
            os.unlink(path)

    def test_feature_tensor_shape(self):
        path = self._make_jsonl(3)
        try:
            ds = PartitionEnergyDataset(path)
            feats, target = next(iter(ds))
            assert feats.shape == (INPUT_DIM,)
            assert target.shape == (1,)
        finally:
            os.unlink(path)

    def test_energy_values_correct(self):
        path = self._make_jsonl(4)
        try:
            ds = PartitionEnergyDataset(path)
            energies = [rec[1].item() for rec in ds]
            assert energies == [0.0, 3.0, 6.0, 9.0]
        finally:
            os.unlink(path)

    def test_malformed_lines_skipped(self):
        """Malformed JSON lines are silently skipped."""
        enc = encode_partition([0] * N_DEFAULT)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
        ) as f:
            f.write("not-json\n")
            json.dump({"partition_enc": enc, "energy": 42.0}, f)
            f.write("\n")
            f.write("{bad\n")
            path = f.name
        try:
            ds = PartitionEnergyDataset(path)
            records = list(ds)
            assert len(records) == 1
            assert records[0][1].item() == 42.0
        finally:
            os.unlink(path)
