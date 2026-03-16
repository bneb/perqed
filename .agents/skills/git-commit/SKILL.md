---
name: git-commit
description: How to make git commits safely without breaking the terminal (special characters in -m flag and heredoc EOF both cause shell escaping issues in zsh)
---

# Git Commit Skill

## The Problem

Two patterns break the zsh terminal:
1. `git commit -m "..."` — multi-line or special characters cause shell escaping issues
2. `cat > /tmp/msg.txt << 'EOF' ... EOF` — heredoc also breaks zsh

## The Rule

**Always use `write_to_file` to write the commit message, then `git commit -F`.**

This avoids the terminal entirely for text with special chars.

## Pattern

```
Step 1: Use write_to_file tool to write /tmp/commit_msg.txt
         (plain text, no escaping needed, special chars are safe)

Step 2: Run in terminal:
git -C /path/to/repo add -A && git -C /path/to/repo commit -F /tmp/commit_msg.txt && git -C /path/to/repo push
```

## Commit Message Format

```
type: short summary line (≤72 chars, imperative mood)

- bullet point: what and why, not how
- another detail
- special chars like ∃, →, backticks, "quotes" are safe in the file
```

## Conventional Commit Types
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructure, no behavior change
- `arch:` — architectural change
- `test:` — tests only
- `docs:` — documentation only

## Notes
- Use `git -C /path/to/repo` instead of `cd && git` — avoids shell state issues
- `/tmp/commit_msg.txt` is cleaned up automatically
- Never use `-m` for anything beyond a single short line with no special chars
