#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# Perqed — Jujutsu (jj) Onboarding
# Sets up enhanced version control for math research.
# ═══════════════════════════════════════════════

set -e

# 1. Check for jj
if ! command -v jj &> /dev/null; then
  echo "❌ Jujutsu (jj) is not installed."
  echo "💡 To install on macOS: brew install jj"
  echo "💡 To install on Linux: cargo install jj-cli"
  echo "💡 Visit https://github.com/martinvonz/jj for instructions."
  exit 1
fi

echo "✅ Jujutsu (jj) found."

# 2. Initialize jj in the current repo
if [ ! -d ".jj" ]; then
  echo "📦 Initializing Jujutsu workspace..."
  jj git init --git-repo .
  echo "✅ Jujutsu initialized. It will track your existing Git history."
else
  echo "ℹ️  Jujutsu already initialized in this directory."
fi

# 3. Configure for math research
echo "🛠️  Configuring jj for non-linear exploration..."
jj config set --user user.name "$(git config user.name)"
jj config set --user user.email "$(git config user.email)"

echo "🎉 Onboarding complete!"
echo ""
echo "🚀 Why use jj for math?"
echo "1. Automatic Commits: Every change is recorded. No more lost 'what if' ideas."
echo "2. Non-linear History: Branch and experiment without switching contexts."
echo "3. Clean Git Sync: Push to 'main' only when the proof is pristine."
echo ""
echo "💡 Try running: jj log"
