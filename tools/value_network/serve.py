"""serve.py — FastAPI inference endpoint for the Ramsey energy Value Network.

Loads a pre-trained value_network.pt (path configurable via VALUE_NETWORK_PATH
env var, defaults to ./value_network.pt).

Endpoints:
  GET  /health   → {"status": "ok", "device": "cpu"}
  POST /predict  → {"energy": 218.4}

Start with:
  uvicorn serve:app --host 0.0.0.0 --port 8765
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Annotated

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator

from model import ValueNetwork, INPUT_DIM
from train import get_device


# ── Global model state ───────────────────────────────────────────────────────

_model: ValueNetwork | None = None
_device: torch.device | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model at startup; release at shutdown."""
    global _model, _device

    _device = get_device()
    ckpt_path = os.environ.get("VALUE_NETWORK_PATH", "value_network.pt")

    if os.path.exists(ckpt_path):
        _model = ValueNetwork.load(ckpt_path, device=_device)
        print(f"✅ Loaded model from {ckpt_path} on {_device}")
    else:
        # Fall back to a random model for /health checks without a checkpoint
        print(f"⚠️  No checkpoint at {ckpt_path} — using random weights")
        _model = ValueNetwork().to(_device).eval()

    yield

    _model = None


app = FastAPI(
    title="Ramsey Value Network",
    description="Surrogate model predicting Ramsey energy from adjacency matrices",
    version="0.1.0",
    lifespan=lifespan,
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    matrix_flat: str

    @field_validator("matrix_flat")
    @classmethod
    def validate_matrix_flat(cls, v: str) -> str:
        if len(v) != INPUT_DIM:
            raise ValueError(
                f"matrix_flat must be exactly {INPUT_DIM} characters, got {len(v)}"
            )
        if not all(c in "01" for c in v):
            raise ValueError("matrix_flat must contain only '0' and '1' characters")
        return v


class PredictResponse(BaseModel):
    energy: float


class HealthResponse(BaseModel):
    status: str
    device: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", device=str(_device))


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    features = torch.tensor(
        [float(c) for c in req.matrix_flat], dtype=torch.float32
    ).unsqueeze(0).to(_device)

    with torch.no_grad():
        energy = _model(features).item()

    return PredictResponse(energy=float(energy))
