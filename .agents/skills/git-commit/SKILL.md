---
name: git-commit
description: How to make git commits safely without breaking the terminal (special characters in -m flag cause shell escaping issues)
---

# Git Commit Skill

## The Problem

Using `git commit -m "..."` with multi-line messages or special characters (backticks, quotes, unicode, emoji, angle brackets) causes the terminal to break due to shell escaping issues.

## The Rule

**Always write the commit message to a temp file and use `-F`.**

## Pattern

```bash
# 1. Write commit message to a temp file
cat > /tmp/commit_msg.txt << 'EOF'
type: short summary line

- bullet point detail
- another detail
- special chars like ∃, →, `backticks`, "quotes" are safe here
EOF

# 2. Commit using -F
git add -A && git commit -F /tmp/commit_msg.txt

# 3. Push
git push
```

## Notes

- The heredoc `<< 'EOF'` (single-quoted) prevents shell expansion inside the message
- `/tmp/commit_msg.txt` is fine — it gets cleaned up automatically
- Follow conventional commits: `feat:`, `fix:`, `refactor:`, `arch:`, `test:`, `docs:`
- First line: ≤72 chars, imperative mood ("fix:" not "fixed:")
- Body: bullet points with what and why, not how
