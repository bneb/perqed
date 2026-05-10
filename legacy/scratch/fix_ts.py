"""
Fix TSC errors across the Perqed codebase.
Run with: python3 fix_ts.py
"""
import os
import re

patched_files = []

def patch_file(path, content, new_content, reason):
    if content != new_content:
        with open(path, "w") as f:
            f.write(new_content)
        patched_files.append((path, reason))

for root, _, files in os.walk("."):
    if "node_modules" in root or ".git/" in root or "dist" in root or "build" in root:
        continue
    for file in files:
        if not file.endswith(".ts"):
            continue
        path = os.path.join(root, file)
        with open(path, "r") as f:
            content = f.read()
        new_content = content

        # ── Fix 1: globalThis.fetch mock assignments ──
        # Only target lines where the assignment is a raw async closure,
        # NOT lines where it's already cast or assigned from a helper function.
        lines = new_content.splitlines()
        result_lines = []
        in_fetch_mock = False
        brace_depth = 0
        i = 0

        while i < len(lines):
            line = lines[i]
            stripped = line.rstrip()

            # Only match raw async closures assigned directly to globalThis.fetch
            # Skip if it already has the cast, or if it's assigned from a helper
            if ("globalThis.fetch =" in line
                and "as unknown as typeof fetch" not in line
                and "originalFetch" not in line
                and "createGeminiMockFetch" not in line  # skip helper-based assignments
                and ("async" in line or "mock(" in line)):

                # Multi-line: starts with { and doesn't end with ;
                if not stripped.endswith(";"):
                    in_fetch_mock = True
                    brace_depth = 0
                    # Insert opening paren after =
                    m = re.match(r"(\s*globalThis\.fetch\s*=\s*)(.*)", line)
                    if m:
                        rhs = m.group(2)
                        result_lines.append(m.group(1) + "(" + rhs)
                        brace_depth += rhs.count("{") - rhs.count("}")
                    else:
                        result_lines.append(line)
                    i += 1
                    continue
                else:
                    # Single-line: wrap and cast
                    m = re.match(r"(\s*globalThis\.fetch\s*=\s*)(.*);$", stripped)
                    if m:
                        result_lines.append(m.group(1) + "(" + m.group(2) + ") as unknown as typeof fetch;")
                    else:
                        result_lines.append(line)
                    i += 1
                    continue

            if in_fetch_mock:
                brace_depth += line.count("{") - line.count("}")
                if brace_depth <= 0:
                    # Closing line - add cast
                    if stripped.endswith(";"):
                        result_lines.append(line.rstrip()[:-1] + ") as unknown as typeof fetch;")
                    else:
                        result_lines.append(line.rstrip() + ") as unknown as typeof fetch")
                    in_fetch_mock = False
                    i += 1
                    continue

            result_lines.append(line)
            i += 1

        new_content = "\n".join(result_lines)
        if content.endswith("\n") and not new_content.endswith("\n"):
            new_content += "\n"

        # ── Fix 2: ScribeAgent.draftPaper -> draftResearchPaper ──
        new_content = new_content.replace(".draftPaper(", ".draftResearchPaper(")

        # ── Fix 3: ProofNode missing splitType and value ──
        if "ProofNode" in new_content and "splitType" not in new_content:
            new_content = re.sub(
                r"(errorHistory:\s*\[\],?)",
                r'\1\n    splitType: "AND",\n    value: 0.0,',
                new_content,
            )

        # ── Fix 4: EvaluatorRouter.evaluate -> getInstance().evaluate ──
        new_content = new_content.replace(
            "EvaluatorRouter.evaluate(",
            'EvaluatorRouter.getInstance("test").evaluate(',
        )

        # ── Fix 5: RoutingSignals missing required fields ──
        if "hasArchitectDirective:" in new_content and "globalFailures:" not in new_content:
            new_content = re.sub(
                r"(hasArchitectDirective:\s*(?:true|false)),",
                r"\1,\n    globalFailures: 0,\n    identicalErrorCount: 0,\n    totalTacticianCalls: 0,",
                new_content,
            )

        # ── Fix 6: Mock<...> cast missing unknown bridge ──
        # ) as typeof fetch  ->  ) as unknown as typeof fetch
        # But skip lines that already have "as unknown as typeof fetch"
        new_content = re.sub(
            r"\)\s+as\s+typeof\s+fetch(?!\s*;?\s*$)",
            ") as unknown as typeof fetch",
            new_content,
        )
        # Specifically: `) as typeof fetch;` at end of line
        lines2 = new_content.splitlines()
        for idx, ln in enumerate(lines2):
            if ") as typeof fetch;" in ln and "as unknown" not in ln:
                lines2[idx] = ln.replace(") as typeof fetch;", ") as unknown as typeof fetch;")
        new_content = "\n".join(lines2)
        if content.endswith("\n") and not new_content.endswith("\n"):
            new_content += "\n"

        patch_file(path, content, new_content, file)

print(f"Patched {len(patched_files)} files:")
for p, r in patched_files:
    print(f"  {p}")
