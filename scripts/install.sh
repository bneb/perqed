#!/usr/bin/env bash
set -e

# Navigate to the perqed project root
cd "$(dirname "$0")/.."

echo "🚀 Building perqed CLI..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  echo "Error: bun is not installed. Please install bun (https://bun.sh) to build perqed."
  exit 1
fi

# Build the CLI into a standalone executable using bun build
bun build ./src/cli/perqed.ts --compile --outfile perqed

chmod +x perqed

INSTALL_DIR="/usr/local/bin"
echo "📦 Installing perqed to ${INSTALL_DIR}..."

# Use sudo if the user doesn't have write permissions to /usr/local/bin
if [ ! -w "$INSTALL_DIR" ]; then
  echo "You may be prompted for your password to install to $INSTALL_DIR"
  sudo mv perqed "$INSTALL_DIR/perqed"
else
  mv perqed "$INSTALL_DIR/perqed"
fi

echo "✅ perqed installed successfully! You can now run 'perqed' from anywhere."
