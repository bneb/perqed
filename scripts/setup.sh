#!/bin/bash
# ═══════════════════════════════════════════════
# Perqed Setup Script
# One-command bootstrap for any machine (macOS/Linux)
# ═══════════════════════════════════════════════
set -e

echo "═══════════════════════════════════════════════"
echo "  🔧 Perqed — Environment Setup"
echo "═══════════════════════════════════════════════"

# ── 1. Bun ──
if command -v bun &> /dev/null; then
  echo "✅ Bun $(bun --version) found"
else
  echo "📦 Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# ── 2. Node deps ──
echo "📦 Installing Node dependencies..."
bun install

# ── 3. Lean 4 (via elan) ──
if command -v lean &> /dev/null || [ -f "$HOME/.elan/bin/lean" ]; then
  echo "✅ Lean $(${HOME}/.elan/bin/lean --version 2>/dev/null | head -1) found"
else
  echo "📦 Installing Lean 4 via elan..."
  curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --default-toolchain leanprover/lean4:stable
fi
export PATH="$HOME/.elan/bin:$PATH"

# ── 4. Z3 (via pip) ──
if python3 -c "import z3" 2>/dev/null; then
  echo "✅ Z3 Python bindings found"
else
  echo "📦 Installing Z3 Python bindings..."
  pip3 install z3-solver
fi

# ── 5. Ollama ──
if command -v ollama &> /dev/null; then
  echo "✅ Ollama $(ollama --version 2>/dev/null) found"
else
  echo "📦 Installing Ollama..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install ollama
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
fi

# ── 6. Start Ollama server (if not running) ──
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "✅ Ollama server already running"
else
  echo "🔌 Starting Ollama server..."
  OLLAMA_FLASH_ATTENTION="1" OLLAMA_KV_CACHE_TYPE="q8_0" ollama serve &
  sleep 3
fi

# ── 7. Pull models ──
echo ""
echo "📥 Pulling AI models (this may take a while on first run)..."

echo "  → deepseek-r1:8b (reasoning + JSON hybrid)..."
ollama pull deepseek-r1:8b

echo ""
echo "  ℹ️  deepseek-prover-v2:7b is NOT in the Ollama registry."
echo "     To install it, download the GGUF from HuggingFace and run:"
echo "       ollama create deepseek-prover-v2:7b -f Modelfile.prover"
echo "     See README.md for full instructions."

# ── 8. Verify ──
echo ""
echo "═══════════════════════════════════════════════"
echo "  🧪 Running verification..."
echo "═══════════════════════════════════════════════"
PATH="$HOME/.elan/bin:$PATH" bun test 2>&1 | tail -5

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  To run the live fire exercise:"
echo "    bun run src/scripts/live_fire.ts"
echo ""
echo "  To run tests:"
echo "    bun test"
echo "═══════════════════════════════════════════════"
