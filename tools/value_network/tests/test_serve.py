"""RED tests for the FastAPI inference server — written before implementation."""
import json
import os
import pytest
import torch

# Use httpx AsyncClient via pytest-asyncio or the sync TestClient from httpx
from httpx import Client
from fastapi.testclient import TestClient

INPUT_DIM = 595


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """Start the FastAPI app with a randomly-initialized model (no .pt file needed)."""
    tmp = tmp_path_factory.mktemp("serve")
    # Write a fresh random model so the server can load it
    from model import ValueNetwork
    ckpt = str(tmp / "value_network.pt")
    ValueNetwork.save(ValueNetwork(), ckpt)

    # Patch the checkpoint path via env var so serve.py picks it up
    os.environ["VALUE_NETWORK_PATH"] = ckpt
    from serve import app
    with TestClient(app) as c:
        yield c
    del os.environ["VALUE_NETWORK_PATH"]


class TestServeEndpoints:
    def test_health_endpoint_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "device" in body

    def test_predict_returns_float(self, client):
        payload = {"matrix_flat": "0" * INPUT_DIM}
        r = client.post("/predict", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert "energy" in body
        assert isinstance(body["energy"], float)

    def test_predict_returns_finite_value(self, client):
        payload = {"matrix_flat": "1" * INPUT_DIM}
        r = client.post("/predict", json=payload)
        assert r.status_code == 200
        import math
        assert math.isfinite(r.json()["energy"])

    def test_predict_rejects_wrong_length(self, client):
        payload = {"matrix_flat": "0" * (INPUT_DIM - 1)}  # 594 chars
        r = client.post("/predict", json=payload)
        assert r.status_code == 422, f"Expected 422 for wrong length, got {r.status_code}"

    def test_predict_rejects_non_binary_chars(self, client):
        # Contains '2' — invalid
        payload = {"matrix_flat": "2" * INPUT_DIM}
        r = client.post("/predict", json=payload)
        assert r.status_code == 422, f"Expected 422 for non-binary, got {r.status_code}"

    def test_predict_deterministic_in_eval_mode(self, client):
        payload = {"matrix_flat": "01" * (INPUT_DIM // 2) + "0"}
        r1 = client.post("/predict", json=payload)
        r2 = client.post("/predict", json=payload)
        assert r1.json()["energy"] == r2.json()["energy"], (
            "Predictions must be deterministic (model in eval mode)"
        )
