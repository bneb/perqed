"""partition_model.py — Value Network for Schur partition energy prediction.

Architecture (block-histogram encoding → MLP regression):
  encode_partition: partition {1..N} with K colors → ⌈N/BLOCK⌉ × K features
  PartitionValueNetwork: Linear(162,256)→GELU→DO→Linear(256,128)→GELU→DO→Linear(128,64)→GELU→Linear(64,1)

Default encoding dims: N=537, K=6, BLOCK=20 → ⌈537/20⌉=27 blocks × 6 = 162 features.
The encoder is dimension-agnostic: any N/K/BLOCK combination produces ⌈N/BLOCK⌉*K features.
"""
from __future__ import annotations

import json
import math
from typing import Iterator

import torch
import torch.nn as nn
from torch.utils.data import IterableDataset, get_worker_info


BLOCK: int = 20          # block size for histogram encoding
N_DEFAULT: int = 537     # Schur S(6) domain size
K_DEFAULT: int = 6       # number of color classes
INPUT_DIM: int = math.ceil(N_DEFAULT / BLOCK) * K_DEFAULT  # = 27 * 6 = 162


def encode_partition(
    partition: list[int],
    N: int = N_DEFAULT,
    K: int = K_DEFAULT,
    block: int = BLOCK,
) -> list[float]:
    """
    Encode a Schur partition as a block histogram feature vector.

    Each block of `block` consecutive elements contributes K soft-count
    features (fraction of elements assigned to each color class).

    Parameters
    ----------
    partition : list[int]
        1-indexed partition array. partition[i] ∈ {0, ..., K-1} for i=1..N.
        Can be 0-indexed (len=N) or 1-indexed (len=N+1, index 0 ignored).
    N, K, block : int
        Domain size, color count, block width.

    Returns
    -------
    list[float]
        Feature vector of length ⌈N/block⌉ × K, values in [0, 1].
    """
    # Normalise to 1-indexed regardless of input length
    if len(partition) == N:
        arr = [0] + list(partition)   # make 1-indexed
    else:
        arr = list(partition)         # already 1-indexed

    n_blocks = math.ceil(N / block)
    features: list[float] = []

    for b in range(n_blocks):
        start = b * block + 1            # 1-indexed
        end = min((b + 1) * block, N)   # inclusive
        block_len = end - start + 1
        counts = [0] * K
        for i in range(start, end + 1):
            color = arr[i] if i < len(arr) else 0
            if 0 <= color < K:
                counts[color] += 1
        # normalise by block length → fraction in [0,1]
        features.extend(c / block_len for c in counts)

    return features


# ── Model ──────────────────────────────────────────────────────────────────────

class PartitionValueNetwork(nn.Module):
    """Surrogate model predicting Schur partition energy from block-histogram features."""

    def __init__(self, input_dim: int = INPUT_DIM, dropout: float = 0.1) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.GELU(),
            nn.Dropout(p=dropout),
            nn.Linear(256, 128),
            nn.GELU(),
            nn.Dropout(p=dropout),
            nn.Linear(128, 64),
            nn.GELU(),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

    @staticmethod
    def save(model: "PartitionValueNetwork", path: str) -> None:
        torch.save(model.state_dict(), path)

    @staticmethod
    def load(path: str, device: str | torch.device = "cpu") -> "PartitionValueNetwork":
        m = PartitionValueNetwork()
        state = torch.load(path, map_location=device, weights_only=True)
        m.load_state_dict(state)
        m.to(device)
        m.eval()
        return m


# ── Dataset ────────────────────────────────────────────────────────────────────

class PartitionEnergyDataset(IterableDataset):
    """
    Stream (partition_enc, energy) tensors from a JSONL file.

    Each record must have:
      - ``partition_enc``: list[float] of length INPUT_DIM
      - ``energy``: numeric Schur energy score
    """

    def __init__(self, filepath: str) -> None:
        self.filepath = filepath

    def __iter__(self) -> Iterator[tuple[torch.Tensor, torch.Tensor]]:
        worker_info = get_worker_info()
        worker_id = worker_info.id if worker_info else 0
        num_workers = worker_info.num_workers if worker_info else 1

        with open(self.filepath, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                if line_idx % num_workers != worker_id:
                    continue
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    features = torch.tensor(rec["partition_enc"], dtype=torch.float32)
                    target = torch.tensor([float(rec["energy"])], dtype=torch.float32)
                    yield features, target
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue
