"""RED tests for ValueNetwork — written before implementation."""
import tempfile
import os
import pytest
import torch
from model import ValueNetwork

INPUT_DIM = 595


class TestValueNetwork:
    def test_output_shape_single(self):
        net = ValueNetwork()
        x = torch.zeros(1, INPUT_DIM)
        out = net(x)
        assert out.shape == (1, 1), f"Expected (1,1), got {out.shape}"

    def test_output_shape_batch(self):
        net = ValueNetwork()
        x = torch.randn(8, INPUT_DIM)
        out = net(x)
        assert out.shape == (8, 1), f"Expected (8,1), got {out.shape}"

    def test_deterministic_in_eval_mode(self):
        net = ValueNetwork().eval()
        x = torch.randn(4, INPUT_DIM)
        with torch.no_grad():
            out1 = net(x)
            out2 = net(x)
        assert torch.allclose(out1, out2), "eval() mode must be deterministic"

    def test_stochastic_in_train_mode(self):
        """Dropout should introduce stochasticity in training mode."""
        net = ValueNetwork().train()
        x = torch.ones(32, INPUT_DIM)  # large enough to hit dropout
        # Run many forward passes — at least one pair should differ
        outputs = [net(x).detach() for _ in range(10)]
        all_same = all(torch.allclose(outputs[0], o) for o in outputs[1:])
        assert not all_same, "train() mode should have stochastic dropout"

    def test_save_load_roundtrip(self, tmp_path):
        net = ValueNetwork().eval()  # eval mode: dropout disabled for deterministic reference
        x = torch.randn(2, INPUT_DIM)
        with torch.no_grad():
            out_before = net(x)

        pt_path = str(tmp_path / "test_model.pt")
        ValueNetwork.save(net, pt_path)

        net2 = ValueNetwork.load(pt_path, device="cpu")  # load() also puts in eval()
        with torch.no_grad():
            out_after = net2(x)

        assert torch.allclose(out_before, out_after, atol=1e-6), (
            "Weights must be identical after save/load roundtrip"
        )

    def test_has_expected_depth(self):
        """Network must have at least 4 linear layers (as per spec)."""
        net = ValueNetwork()
        linears = [m for m in net.modules() if isinstance(m, torch.nn.Linear)]
        assert len(linears) >= 4, f"Expected ≥4 Linear layers, found {len(linears)}"

    def test_accepts_zero_input(self):
        net = ValueNetwork()
        x = torch.zeros(1, INPUT_DIM)
        out = net(x)
        assert torch.isfinite(out).all(), "Output must be finite on zero input"

    def test_gradient_flows_on_backward(self):
        net = ValueNetwork()
        x = torch.randn(4, INPUT_DIM)
        out = net(x)
        loss = out.sum()
        loss.backward()
        for name, param in net.named_parameters():
            assert param.grad is not None, f"No grad for {name}"
