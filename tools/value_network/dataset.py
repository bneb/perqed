"""dataset.py — Streaming IterableDataset for Ramsey energy JSONL data.

Reads line-by-line from disk — never loads the full file into RAM.
Compatible with DataLoader(num_workers=N) via worker-aware sharding.
"""
from __future__ import annotations

import json
from typing import Iterator

import torch
from torch.utils.data import IterableDataset, get_worker_info


class MatrixEnergyDataset(IterableDataset):
    """Stream (matrix_flat, energy) tensors from a JSONL file.

    Each record must have:
      - ``matrix_flat``: string of '0'/'1' chars (length = N*(N-1)/2)
      - ``energy``: numeric Ramsey energy score

    Blank lines and malformed JSON are silently skipped.
    """

    def __init__(self, filepath: str) -> None:
        self.filepath = filepath

    # ── DataLoader multi-worker support ─────────────────────────────────────
    # When DataLoader uses num_workers > 0 each worker gets a copy of the
    # dataset. We shard by line index so workers don't duplicate records.

    def __iter__(self) -> Iterator[tuple[torch.Tensor, torch.Tensor]]:
        worker_info = get_worker_info()
        worker_id = worker_info.id if worker_info else 0
        num_workers = worker_info.num_workers if worker_info else 1

        with open(self.filepath, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                # Shard across workers
                if line_idx % num_workers != worker_id:
                    continue

                line = line.strip()
                if not line:
                    continue

                try:
                    rec = json.loads(line)
                    features = torch.tensor(
                        [float(c) for c in rec["matrix_flat"]], dtype=torch.float32
                    )
                    target = torch.tensor([float(rec["energy"])], dtype=torch.float32)
                    yield features, target
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue  # skip malformed records
