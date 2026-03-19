"""RED tests for MetricsLogger and plot_loss — written before implementation."""
import json
import math
import os
import random
import tempfile
import pytest


def _write_synthetic_metrics(path: str, n: int = 1000) -> None:
    """Write n synthetic JSONL metrics rows (noisy sine-wave loss)."""
    import time
    with open(path, "w") as f:
        for i in range(n):
            loss = abs(math.sin(i * 0.01)) * 500 + random.gauss(0, 20) + 10
            record = {
                "epoch": i // 200,
                "batch": i % 200,
                "loss": loss,
                "timestamp": time.time(),
            }
            f.write(json.dumps(record) + "\n")


class TestMetricsLogger:
    def test_logger_creates_file(self, tmp_path):
        from train import MetricsLogger
        p = str(tmp_path / "metrics.jsonl")
        logger = MetricsLogger(filepath=p)
        logger.log(epoch=0, batch=0, loss=42.0)
        assert os.path.exists(p), "MetricsLogger must create the JSONL file"

    def test_logger_writes_valid_json(self, tmp_path):
        from train import MetricsLogger
        p = str(tmp_path / "metrics.jsonl")
        logger = MetricsLogger(filepath=p)
        logger.log(epoch=1, batch=50, loss=123.456)
        with open(p) as f:
            record = json.loads(f.readline())
        assert record["epoch"] == 1
        assert record["batch"] == 50
        assert abs(record["loss"] - 123.456) < 1e-6
        assert "timestamp" in record

    def test_logger_appends_multiple_records(self, tmp_path):
        from train import MetricsLogger
        p = str(tmp_path / "metrics.jsonl")
        logger = MetricsLogger(filepath=p)
        for i in range(5):
            logger.log(epoch=0, batch=i * 50, loss=float(i))
        lines = open(p).readlines()
        assert len(lines) == 5

    def test_logger_clears_file_on_new_instance(self, tmp_path):
        from train import MetricsLogger
        p = str(tmp_path / "metrics.jsonl")
        # First training run
        logger1 = MetricsLogger(filepath=p)
        for i in range(3):
            logger1.log(epoch=0, batch=i, loss=float(i))
        # Second training run — must clear and start fresh
        logger2 = MetricsLogger(filepath=p)
        logger2.log(epoch=0, batch=0, loss=999.0)
        lines = open(p).readlines()
        assert len(lines) == 1, "New MetricsLogger must clear previous metrics"

    def test_logger_flushes_immediately(self, tmp_path):
        """File must be readable immediately after log() — no buffering."""
        from train import MetricsLogger
        p = str(tmp_path / "metrics.jsonl")
        logger = MetricsLogger(filepath=p)
        logger.log(epoch=0, batch=0, loss=1.0)
        # Read without closing the logger — must already be on disk
        content = open(p).read()
        assert "loss" in content


class TestPlotLoss:
    def test_plot_creates_png(self, tmp_path):
        from plot_loss import plot_metrics
        metrics_path = str(tmp_path / "training_metrics.jsonl")
        png_path = str(tmp_path / "training_loss_curve.png")
        _write_synthetic_metrics(metrics_path, n=1000)
        plot_metrics(jsonl_path=metrics_path, save_path=png_path)
        assert os.path.exists(png_path), "plot_metrics must create the PNG file"

    def test_plot_creates_nonzero_png(self, tmp_path):
        from plot_loss import plot_metrics
        metrics_path = str(tmp_path / "training_metrics.jsonl")
        png_path = str(tmp_path / "training_loss_curve.png")
        _write_synthetic_metrics(metrics_path, n=1000)
        plot_metrics(jsonl_path=metrics_path, save_path=png_path)
        assert os.path.getsize(png_path) > 10_000, "PNG must be a real image (> 10KB)"

    def test_plot_handles_empty_file_gracefully(self, tmp_path):
        from plot_loss import plot_metrics
        metrics_path = str(tmp_path / "empty.jsonl")
        open(metrics_path, "w").close()  # empty file
        png_path = str(tmp_path / "training_loss_curve.png")
        # Must not raise — should print a message and return
        plot_metrics(jsonl_path=metrics_path, save_path=png_path)
        # PNG may not exist, but no exception should be raised

    def test_ema_column_values_bounded(self, tmp_path):
        """EMA must be strictly less volatile than raw loss."""
        import pandas as pd
        from plot_loss import compute_ema
        metrics_path = str(tmp_path / "training_metrics.jsonl")
        _write_synthetic_metrics(metrics_path, n=2000)
        with open(metrics_path) as f:
            data = [json.loads(l) for l in f if l.strip()]
        df = pd.DataFrame(data)
        ema = compute_ema(df["loss"], span=500)
        assert ema.std() < df["loss"].std(), "EMA must have lower variance than raw loss"

    def test_plot_accepts_custom_paths(self, tmp_path):
        from plot_loss import plot_metrics
        metrics_path = str(tmp_path / "custom_metrics.jsonl")
        png_path = str(tmp_path / "custom_curve.png")
        _write_synthetic_metrics(metrics_path, n=200)
        plot_metrics(jsonl_path=metrics_path, save_path=png_path)
        assert os.path.exists(png_path)
