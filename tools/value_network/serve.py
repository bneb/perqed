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
from partition_model import PartitionValueNetwork, INPUT_DIM as P_INPUT_DIM, encode_partition
from train import get_device


# ── Global model state ───────────────────────────────────────────────────────

_model: ValueNetwork | None = None
_device: torch.device | None = None
_partition_model: PartitionValueNetwork | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models at startup; release at shutdown."""
    global _model, _device, _partition_model

    _device = get_device()

    # ── Ramsey graph value network ─────────────────────────────────────────────
    ckpt_path = os.environ.get("VALUE_NETWORK_PATH", "value_network.pt")
    if os.path.exists(ckpt_path):
        _model = ValueNetwork.load(ckpt_path, device=_device)
        print(f"✅ Ramsey model loaded from {ckpt_path} on {_device}")
    else:
        print(f"⚠️  No Ramsey checkpoint at {ckpt_path} — using random weights")
        _model = ValueNetwork().to(_device).eval()

    # ── Partition value network ────────────────────────────────────────────────
    p_ckpt = os.environ.get("PARTITION_NETWORK_PATH", "partition_value_network.pt")
    if os.path.exists(p_ckpt):
        _partition_model = PartitionValueNetwork.load(p_ckpt, device=_device)
        print(f"✅ Partition model loaded from {p_ckpt} on {_device}")
    else:
        print(f"⚠️  No partition checkpoint at {p_ckpt} — using random weights")
        _partition_model = PartitionValueNetwork().to(_device).eval()

    yield
    _model = None
    _partition_model = None


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


# ── Partition endpoints ───────────────────────────────────────────────────────

class PartitionPredictRequest(BaseModel):
    partition_enc: list[float]

    @field_validator("partition_enc")
    @classmethod
    def validate_enc(cls, v: list[float]) -> list[float]:
        if len(v) != P_INPUT_DIM:
            raise ValueError(
                f"partition_enc must have {P_INPUT_DIM} elements, got {len(v)}"
            )
        return v


class PartitionHealthResponse(BaseModel):
    status: str
    device: str
    checkpoint_loaded: bool


@app.get("/partition/health", response_model=PartitionHealthResponse)
def partition_health() -> PartitionHealthResponse:
    import os
    ckpt = os.environ.get("PARTITION_NETWORK_PATH", "partition_value_network.pt")
    return PartitionHealthResponse(
        status="ok",
        device=str(_device),
        checkpoint_loaded=os.path.exists(ckpt),
    )


@app.post("/partition/predict", response_model=PredictResponse)
def partition_predict(req: PartitionPredictRequest) -> PredictResponse:
    if _partition_model is None:
        raise HTTPException(status_code=503, detail="Partition model not loaded")

    features = torch.tensor(req.partition_enc, dtype=torch.float32)\
        .unsqueeze(0).to(_device)
    with torch.no_grad():
        energy = _partition_model(features).item()

    return PredictResponse(energy=float(energy))
