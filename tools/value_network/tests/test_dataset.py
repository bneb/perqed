"""RED tests for MatrixEnergyDataset — written before implementation."""
import json
import os
import tempfile
import pytest
import torch
from torch.utils.data import DataLoader

# The module under test — will fail to import until dataset.py exists
from dataset import MatrixEnergyDataset

N = 35
FLAT_LEN = N * (N - 1) // 2  # 595


def _write_jsonl(records: list[dict], path: str) -> None:
    with open(path, "w") as f:
        for rec in records:
            f.write(json.dumps(rec) + "\n")


def _valid_record(energy: float = 210.0) -> dict:
    return {"matrix_flat": "0" * FLAT_LEN, "energy": energy}


class TestMatrixEnergyDataset:
    def test_yields_correct_dtypes(self, tmp_path):
        p = tmp_path / "data.jsonl"
        _write_jsonl([_valid_record()], str(p))
        ds = MatrixEnergyDataset(str(p))
        feat, tgt = next(iter(ds))
        assert feat.dtype == torch.float32, f"Expected float32 features, got {feat.dtype}"
        assert tgt.dtype == torch.float32, f"Expected float32 target, got {tgt.dtype}"

    def test_yields_correct_shapes(self, tmp_path):
        p = tmp_path / "data.jsonl"
        _write_jsonl([_valid_record()], str(p))
        ds = MatrixEnergyDataset(str(p))
        feat, tgt = next(iter(ds))
        assert feat.shape == (FLAT_LEN,), f"Expected ({FLAT_LEN},), got {feat.shape}"
        assert tgt.shape == (1,), f"Expected (1,), got {tgt.shape}"

    def test_yields_all_records(self, tmp_path):
        p = tmp_path / "data.jsonl"
        records = [_valid_record(float(i)) for i in range(5)]
        _write_jsonl(records, str(p))
        ds = MatrixEnergyDataset(str(p))
        items = list(ds)
        assert len(items) == 5

    def test_skips_blank_lines(self, tmp_path):
        p = tmp_path / "data.jsonl"
        with open(p, "w") as f:
            f.write("\n")
            f.write(json.dumps(_valid_record()) + "\n")
            f.write("   \n")
            f.write(json.dumps(_valid_record(42.0)) + "\n")
        ds = MatrixEnergyDataset(str(p))
        items = list(ds)
        assert len(items) == 2, f"Expected 2 records, got {len(items)}"

    def test_skips_malformed_lines(self, tmp_path):
        p = tmp_path / "data.jsonl"
        with open(p, "w") as f:
            f.write("not valid json\n")
            f.write(json.dumps(_valid_record()) + "\n")
            f.write("{broken\n")
        ds = MatrixEnergyDataset(str(p))
        items = list(ds)
        assert len(items) == 1, f"Expected 1 valid record, got {len(items)}"

    def test_features_match_matrix_flat(self, tmp_path):
        flat = "1" * 10 + "0" * (FLAT_LEN - 10)
        p = tmp_path / "data.jsonl"
        _write_jsonl([{"matrix_flat": flat, "energy": 0.0}], str(p))
        ds = MatrixEnergyDataset(str(p))
        feat, _ = next(iter(ds))
        expected = torch.FloatTensor([float(c) for c in flat])
        assert torch.allclose(feat, expected)

    def test_works_with_dataloader(self, tmp_path):
        p = tmp_path / "data.jsonl"
        records = [_valid_record(float(i)) for i in range(20)]
        _write_jsonl(records, str(p))
        ds = MatrixEnergyDataset(str(p))
        loader = DataLoader(ds, batch_size=4)
        batch_feat, batch_tgt = next(iter(loader))
        assert batch_feat.shape == (4, FLAT_LEN)
        assert batch_tgt.shape == (4, 1)
