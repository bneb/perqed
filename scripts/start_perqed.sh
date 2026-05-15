#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# Perqed — Unified Start Script
# Orchestrates Ollama checks, Lean paths, and execution.
# ═══════════════════════════════════════════════
set -e

# Configuration
OLLAMA_HOST="http://localhost:11434"
REQUIRED_MODELS=("nomic-embed-text" "deepseek-r1:8b" "deepseek-prover-v2:7b" "gemma4:26b")

echo "═══════════════════════════════════════════════"
echo "  🚀 PERQED — Environment Check & Run"
echo "═══════════════════════════════════════════════"

# 1. Path Setup
export PATH="$HOME/.elan/bin:$HOME/.bun/bin:$PATH"

# 2. Dependency Check
if ! command -v jq &> /dev/null; then
  echo "❌ Error: 'jq' is not installed (required for parsing Ollama API responses)."
  echo "   Install it with: brew install jq"
  exit 1
fi

# 3. Environment Check (.env)
if [ -f ".env" ]; then
  # Source .env safely without exporting everything or use a simple grep check
  # Since Bun loads it automatically, we just check if it's defined in the current shell or .env
  GEMINI_KEY=$(grep "^GEMINI_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  if [ -n "$GEMINI_KEY" ]; then
    export GEMINI_API_KEY="$GEMINI_KEY"
  fi
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY is not set (not in environment or .env file)."
  echo "   Add it to your .env file: GEMINI_API_KEY=your_key_here"
  exit 1
fi
echo "✅ GEMINI_API_KEY found."

# 4. Ollama Server Check
if ! curl -s "$OLLAMA_HOST/api/tags" > /dev/null; then
  echo "❌ Error: Ollama server is not running."
  echo "   Run 'ollama serve' in a separate terminal first."
  exit 1
fi
echo "✅ Ollama server reachable."

# 5. Ollama Model Check
INSTALLED_MODELS=$(curl -s "$OLLAMA_HOST/api/tags" | jq -r '.models[].name')
for model in "${REQUIRED_MODELS[@]}"; do
  if [[ ! "$INSTALLED_MODELS" == *"$model"* ]]; then
    echo "⚠️  Warning: Model '$model' not found in Ollama."
    if [ "$model" == "deepseek-prover-v2:7b" ]; then
      echo "   → This model requires manual creation. Run:"
      echo "     ollama create deepseek-prover-v2:7b -f Modelfile.prover"
    else
      echo "   → Pulling it now..."
      ollama pull "$model"
    fi
  else
    echo "✅ Model '$model' is ready."
  fi
done

# 6. Lean / Lake Check
if ! command -v lake &> /dev/null; then
  echo "❌ Error: 'lake' build tool not found."
  echo "   Run './scripts/setup.sh' to install Lean 4."
  exit 1
fi

if [ ! -d ".lake" ]; then
  echo "⚠️  Warning: Lean dependencies (.lake) not found."
  echo "   Attempting quick 'lake update' (this may take a while)..."
  lake update
fi
echo "✅ Lean environment ready."

# 7. Installation (Optional)
if [ "$1" == "--install" ]; then
  echo "📦 Installing Perqed as a global CLI..."
  
  # Build the binary
  bun build ./src/cli/perqed.ts --compile --outfile perqed
  
  # Ensure /usr/local/bin exists
  sudo mkdir -p /usr/local/bin
  
  # Symlink to /usr/local/bin
  sudo ln -sf "$(pwd)/perqed" /usr/local/bin/perqed
  
  echo "✅ Binary symlinked to /usr/local/bin/perqed"
  
  # Set PERQED_HOME in .zshrc or .bashrc if not already there
  SHELL_CONFIG=""
  if [ -f "$HOME/.zshrc" ]; then SHELL_CONFIG="$HOME/.zshrc";
  elif [ -f "$HOME/.bashrc" ]; then SHELL_CONFIG="$HOME/.bashrc"; fi
  
  if [ -n "$SHELL_CONFIG" ]; then
    if ! grep -q "PERQED_HOME" "$SHELL_CONFIG"; then
      echo "export PERQED_HOME=\"$(pwd)\"" >> "$SHELL_CONFIG"
      echo "✅ Added PERQED_HOME to $SHELL_CONFIG"
      echo "💡 Run 'source $SHELL_CONFIG' or restart your terminal to complete installation."
    else
      echo "ℹ️  PERQED_HOME already set in $SHELL_CONFIG"
    fi
  fi
  
  echo "🎉 Installation complete! You can now run 'perqed' from any directory."
  exit 0
fi

echo "📦 Compiling Perqed CLI..."
bun build ./src/cli/perqed.ts --compile --outfile perqed > /dev/null
echo "🎬 Starting Perqed CLI..."
echo "═══════════════════════════════════════════════"
exec ./perqed "$@"
