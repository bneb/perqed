"""plot_loss.py — Publication-quality training loss visualizer.

Reads training_metrics.jsonl (written by MetricsLogger in train.py) and
produces a high-resolution PNG with both raw batch loss and an EMA trendline.

Usage:
  # One-shot: save PNG
  python plot_loss.py

  # Custom paths
  python plot_loss.py --metrics training_metrics.jsonl --output my_curve.png

  # Live mode: re-reads and redraws every 5 seconds while training runs
  python plot_loss.py --live
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.animation as animation


# ── EMA helper (public — imported by tests) ──────────────────────────────────

def compute_ema(series: pd.Series, span: int = 500) -> pd.Series:
    """Return the Exponential Moving Average of ``series`` with the given span."""
    return series.ewm(span=span, adjust=False).mean()


# ── Core plot function ────────────────────────────────────────────────────────

def plot_metrics(
    jsonl_path: str = "training_metrics.jsonl",
    save_path: str = "training_loss_curve.png",
    ema_span: int = 500,
    ax: plt.Axes | None = None,
) -> bool:
    """Parse ``jsonl_path``, compute EMA, render and save the figure.

    Returns True if data was available and the plot was saved, False if the
    file was empty or missing (caller should handle gracefully).
    """
    data: list[dict] = []
    try:
        with open(jsonl_path, "r") as f:
            for line in f:
                stripped = line.strip()
                if stripped:
                    try:
                        data.append(json.loads(stripped))
                    except json.JSONDecodeError:
                        continue
    except FileNotFoundError:
        print(f"[plot_loss] File not found: {jsonl_path}")
        return False

    if not data:
        print("[plot_loss] No metrics found yet — nothing to plot.")
        return False

    df = pd.DataFrame(data)
    df["step"] = range(len(df))
    df["loss_ema"] = compute_ema(df["loss"], span=ema_span)

    standalone = ax is None
    if standalone:
        plt.style.use("dark_background")
        fig, ax = plt.subplots(figsize=(12, 6))
    else:
        ax.clear()

    # Raw loss (faint background)
    ax.plot(
        df["step"],
        df["loss"],
        alpha=0.15,
        color="#ff7f0e",
        linewidth=0.8,
        label="Raw Batch Loss",
    )

    # EMA smoothed line (bold foreground)
    ax.plot(
        df["step"],
        df["loss_ema"],
        linewidth=2.5,
        color="#1f77b4",
        label=f"EMA (span={ema_span})",
    )

    # Annotations
    min_ema = df["loss_ema"].min()
    min_step = int(df.loc[df["loss_ema"].idxmin(), "step"])
    ax.axhline(min_ema, linestyle=":", linewidth=1.0, color="#2ca02c", alpha=0.6)
    ax.annotate(
        f"  best EMA = {min_ema:.2f}",
        xy=(min_step, min_ema),
        color="#2ca02c",
        fontsize=9,
    )

    total_steps = len(df)
    epochs = int(df["epoch"].max()) + 1 if "epoch" in df.columns else "?"
    ax.set_title(
        f"Value Network Training Convergence  "
        f"[{total_steps:,} steps | {epochs} epoch(s)]",
        fontsize=14,
        pad=15,
    )
    ax.set_xlabel("Training Steps (Batches)", fontsize=12)
    ax.set_ylabel("Smooth L1 Loss", fontsize=12)
    ax.grid(True, alpha=0.3, linestyle="--")
    ax.legend(loc="upper right", fontsize=10)

    if standalone:
        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches="tight")
        plt.close()
        print(f"[plot_loss] Saved → {save_path}  ({total_steps:,} steps, best EMA={min_ema:.4f})")
        return True

    return True


# ── Live mode ─────────────────────────────────────────────────────────────────

def live_plot(jsonl_path: str, save_path: str, ema_span: int, interval_ms: int = 5_000) -> None:
    """Tail the JSONL file and redraw every `interval_ms` milliseconds."""
    plt.style.use("dark_background")
    fig, ax = plt.subplots(figsize=(12, 6))

    def update(_frame: int) -> None:
        plot_metrics(jsonl_path=jsonl_path, save_path=save_path, ema_span=ema_span, ax=ax)
        fig.canvas.draw_idle()

    ani = animation.FuncAnimation(
        fig, update, interval=interval_ms, cache_frame_data=False
    )
    plt.tight_layout()
    plt.show()
    # Keep reference alive to prevent garbage collection
    _ = ani


# ── CLI ───────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Plot Value Network training loss curve")
    p.add_argument("--metrics", default="training_metrics.jsonl", help="JSONL metrics file")
    p.add_argument("--output", default="training_loss_curve.png", help="Output PNG path")
    p.add_argument("--ema-span", type=int, default=500, help="EMA span in batches")
    p.add_argument(
        "--live",
        action="store_true",
        help="Live mode: continuously re-read and redraw every 5s",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    if args.live:
        live_plot(
            jsonl_path=args.metrics,
            save_path=args.output,
            ema_span=args.ema_span,
        )
    else:
        plot_metrics(
            jsonl_path=args.metrics,
            save_path=args.output,
            ema_span=args.ema_span,
        )
