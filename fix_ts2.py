"""
Fix remaining TSC errors across the Perqed codebase.
Phase 2: Handles undefined checks, worker self, RoutingSignals, and fetch casts.
Run with: python3 fix_ts2.py
"""
import os
import re

patched = []

for root, _, files in os.walk("."):
    if "node_modules" in root or ".git/" in root:
        continue
    for file in files:
        if not file.endswith(".ts"):
            continue
        path = os.path.join(root, file)
        with open(path, "r") as f:
            content = f.read()
        new_content = content

        # ── Fix: Worker files missing `self` declaration ──
        if "self" in new_content and "worker" in path.lower():
            if "declare var self" not in new_content and "const self" not in new_content:
                # Add declaration at top after imports
                lines = new_content.splitlines()
                insert_idx = 0
                for idx, ln in enumerate(lines):
                    if ln.startswith("import ") or ln.startswith("export "):
                        insert_idx = idx + 1
                    elif ln.strip() == "" and insert_idx > 0:
                        insert_idx = idx + 1
                        break
                lines.insert(insert_idx, "declare var self: Worker;")
                new_content = "\n".join(lines)
                if content.endswith("\n") and not new_content.endswith("\n"):
                    new_content += "\n"

        # ── Fix: typeof fetch -> Mock cast (opposite direction) ──
        # (globalThis.fetch as Mock<...>) needs `as unknown` bridge
        new_content = re.sub(
            r"globalThis\.fetch\s+as\s+ReturnType<typeof mock>",
            "(globalThis.fetch as unknown as ReturnType<typeof mock>)",
            new_content,
        )

        # ── Fix: RoutingSignals — make identicalErrorCount and totalTacticianCalls non-optional ──
        # Pattern: identicalErrorCount?: 0  or identicalErrorCount?: number
        # These appear as function params with Partial-like spreading
        # The actual issue is test fixtures using a helper that makes them optional.
        # Let me find the helper function in the test files.
        if "identicalErrorCount" in new_content and ("?: " in new_content or "| undefined" in new_content):
            # Replace optional markers for these specific fields
            new_content = new_content.replace("identicalErrorCount?:", "identicalErrorCount:")
            new_content = new_content.replace("totalTacticianCalls?:", "totalTacticianCalls:")

        if content != new_content:
            with open(path, "w") as f:
                f.write(new_content)
            patched.append(path)

print(f"Phase 2 patched {len(patched)} files:")
for p in patched:
    print(f"  {p}")
