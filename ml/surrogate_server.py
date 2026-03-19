"""
surrogate_server.py — PyTorch Value Network FastAPI Server.

Serves a lightweight MLP surrogate that predicts Ramsey energy from a
flattened binary adjacency matrix. Used by the TypeScript SurrogateClient
to pre-filter candidate matrices before sending them to the exact C++ evaluator.

Endpoints:
  GET  /health         → {"status": "ok"}
  POST /predict        → {"energy": <float>}   (single matrix; legacy compat)
  POST /predict_batch  → {"predictions": [float, ...]}  (batch inference)

Usage:
  pip install -r ml/requirements.txt
  python ml/surrogate_server.py

The model loads weights from ml/surrogate_model.pt if found on disk.
Otherwise it initialises with random weights (scaffolding mode — zero-shot
prediction quality, full-speed FFI pipeline training loop ready).
"""

import os
import json
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel
import torch
import torch.nn as nn

# ── Model definition ──────────────────────────────────────────────────────────

DEFAULT_N = 35  # R(4,6) uses K_35 — 595 upper-triangle edges, flat = 35*35 = 1225
INPUT_DIM = DEFAULT_N * DEFAULT_N  # Use full adjacency matrix for flexibility

class SurrogateModel(nn.Module):
    """
    Lightweight MLP: input_dim → 512 → 256 → 64 → 1.
    Input:  flattened binary adjacency matrix as float32 tensor
    Output: scalar predicted energy (raw, not sigmoid-bounded)
    """
    def __init__(self, input_dim: int = INPUT_DIM):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(0.2),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def load_model() -> SurrogateModel:
    """Load model from disk if available, else return randomly-initialised model."""
    model = SurrogateModel(input_dim=INPUT_DIM)
    weights_path = Path(__file__).parent / "surrogate_model.pt"
    if weights_path.exists():
        try:
            state = torch.load(str(weights_path), map_location="cpu", weights_only=True)
            model.load_state_dict(state)
            print(f"[SurrogateServer] Loaded weights from {weights_path}")
        except Exception as e:
            print(f"[SurrogateServer] WARNING: Failed to load weights ({e}). Using random init.")
    else:
        print("[SurrogateServer] No weights file found — using random init (scaffolding mode).")
    model.eval()
    return model


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="Perqed Surrogate Value Network", version="1.0.0")
model = load_model()

# ── Request / response schemas ────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Single matrix prediction (legacy / surrogate_client.ts compatibility)."""
    matrix_flat: str  # Binary string of length N*(N-1)/2 (upper triangle) or N*N (full)


class BatchPredictRequest(BaseModel):
    """Batch prediction for the predict_batch endpoint."""
    matrices: List[List[int]]  # List of flattened int8 arrays, one per matrix


# ── Helper ────────────────────────────────────────────────────────────────────

def flat_to_tensor(matrix_flat: str) -> torch.Tensor:
    """
    Convert a binary string or list of ints to a padded/cropped float32 tensor of shape [1, INPUT_DIM].
    Pads with zeros if shorter than INPUT_DIM; clips if longer.
    """
    values = [float(c) for c in matrix_flat]
    pad = INPUT_DIM - len(values)
    if pad > 0:
        values += [0.0] * pad
    else:
        values = values[:INPUT_DIM]
    return torch.tensor(values, dtype=torch.float32).unsqueeze(0)


def int_list_to_tensor(row: List[int]) -> torch.Tensor:
    values = [float(v) for v in row]
    pad = INPUT_DIM - len(values)
    if pad > 0:
        values += [0.0] * pad
    else:
        values = values[:INPUT_DIM]
    return torch.tensor(values, dtype=torch.float32)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(req: PredictRequest):
    """Single-matrix energy prediction (compatible with SurrogateClient.predict)."""
    x = flat_to_tensor(req.matrix_flat)
    with torch.no_grad():
        energy = float(model(x).squeeze().item())
    return {"energy": energy}


@app.post("/predict_batch")
def predict_batch(req: BatchPredictRequest):
    """
    Batch energy prediction for SurrogateClient.predictBatch.

    Accepts a list of flattened adjacency matrix rows (int8 arrays).
    Returns a list of predicted energy floats in the same order.
    """
    if not req.matrices:
        return {"predictions": []}

    rows = [int_list_to_tensor(row) for row in req.matrices]
    x = torch.stack(rows)  # Shape: [B, INPUT_DIM]

    with torch.no_grad():
        preds = model(x).squeeze(-1)  # Shape: [B]
        predictions = preds.tolist()

    # Ensure scalar wrapping for batch of 1
    if isinstance(predictions, float):
        predictions = [predictions]

    return {"predictions": predictions}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8765"))
    print(f"[SurrogateServer] Starting on http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
