"""model.py — Value Network: 595-dim MLP for Ramsey energy prediction.

Architecture (per spec):
  Linear(595, 1024) → GELU → Dropout(0.2)
  → Linear(1024, 512) → GELU → Dropout(0.2)
  → Linear(512, 256) → GELU
  → Linear(256, 1)   (regression head)
"""
from __future__ import annotations

import torch
import torch.nn as nn


INPUT_DIM: int = 595  # N=35 upper-triangle: 35*34//2


class ValueNetwork(nn.Module):
    """Surrogate model predicting Ramsey energy from a flattened adjacency matrix."""

    def __init__(self, input_dim: int = INPUT_DIM, dropout: float = 0.2) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 1024),
            nn.GELU(),
            nn.Dropout(p=dropout),
            nn.Linear(1024, 512),
            nn.GELU(),
            nn.Dropout(p=dropout),
            nn.Linear(512, 256),
            nn.GELU(),
            nn.Linear(256, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

    # ── Serialisation helpers ────────────────────────────────────────────────

    @staticmethod
    def save(model: "ValueNetwork", path: str) -> None:
        """Save model weights to ``path``."""
        torch.save(model.state_dict(), path)

    @staticmethod
    def load(path: str, device: str | torch.device = "cpu") -> "ValueNetwork":
        """Load from ``path`` and return a model in eval mode."""
        model = ValueNetwork()
        state = torch.load(path, map_location=device, weights_only=True)
        model.load_state_dict(state)
        model.to(device)
        model.eval()
        return model
