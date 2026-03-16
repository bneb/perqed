#!/usr/bin/env bash
# tex2pdf.sh — Compile the torus decomposition paper and copy to both locations
#
# Usage:
#   ./scripts/tex2pdf.sh
#
# Prerequisites:
#   brew install tectonic
#
# Tectonic is a modern single-binary LaTeX engine that auto-downloads
# any missing packages on first run. No full texlive install needed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAPER_DIR="$REPO_ROOT/projects/torus-decomposition/paper"
TEX_FILE="$PAPER_DIR/torus_decomposition.tex"
PDF_FILE="$PAPER_DIR/torus_decomposition.pdf"
COMPAT_DIR="$REPO_ROOT/paper"

if ! command -v tectonic &>/dev/null; then
  echo "❌ tectonic not found. Install with: brew install tectonic"
  exit 1
fi

echo "📄 Compiling $TEX_FILE ..."
cd "$PAPER_DIR"
tectonic "$TEX_FILE"

echo "✅ PDF written: $PDF_FILE ($(du -h "$PDF_FILE" | cut -f1))"

# Copy to backward-compatible location
mkdir -p "$COMPAT_DIR"
cp "$PDF_FILE" "$COMPAT_DIR/torus_decomposition.pdf"
echo "📋 Copied to: $COMPAT_DIR/torus_decomposition.pdf"
