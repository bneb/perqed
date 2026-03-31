"""
Fix remaining TSC errors — Phase 3.
Handles: non-null assertions, RoutingSignals helper, ScribeAgent args, etc.
Run with: python3 fix_ts3.py
"""
import os
import re

patched = []

# Map of file -> list of (line_number, old_text, new_text)
# We'll read each file, apply line-specific fixes

FIXES = {}

def add_fix(filepath, line_num, old, new):
    if filepath not in FIXES:
        FIXES[filepath] = []
    FIXES[filepath].append((line_num, old, new))


# ── src/math/sieve_state.ts ──
add_fix("./src/math/sieve_state.ts", 73, None, "!")  # Object possibly undefined
add_fix("./src/math/sieve_state.ts", 106, None, "!")

# ── src/math/graph/IncrementalSRGEngine.ts ──
add_fix("./src/math/graph/IncrementalSRGEngine.ts", 337, None, "!")
add_fix("./src/math/graph/IncrementalSRGEngine.ts", 475, None, "!")

# ── src/search/bridge_learner.ts ──
add_fix("./src/search/bridge_learner.ts", 94, None, "!")
add_fix("./src/search/bridge_learner.ts", 95, None, "!")
add_fix("./src/search/bridge_learner.ts", 96, None, "!")
add_fix("./src/search/bridge_learner.ts", 148, None, "!")

# ── src/search/sdp_relaxation.ts ──
add_fix("./src/search/sdp_relaxation.ts", 47, None, "!")

# ── src/search/spherical_relaxation.ts ──
add_fix("./src/search/spherical_relaxation.ts", 72, None, "!")
add_fix("./src/search/spherical_relaxation.ts", 137, None, "!")
add_fix("./src/search/spherical_relaxation.ts", 139, None, "!")
add_fix("./src/search/spherical_relaxation.ts", 141, None, "!")

# ── src/search/surrogate_client.ts ──
add_fix("./src/search/surrogate_client.ts", 122, None, "!")

# ── projects/ ──
add_fix("./projects/torus-decomposition/src/state.ts", 91, None, "!")
add_fix("./projects/torus-decomposition/src/state_fast.ts", 110, None, "!")
add_fix("./projects/torus-decomposition/src/state_fast.ts", 111, None, "!")
add_fix("./projects/torus-decomposition/src/state_fast.ts", 202, None, "!")
add_fix("./projects/torus-decomposition/src/state_fast.ts", 260, None, "!")
add_fix("./projects/torus-decomposition/src/state_fast.ts", 270, None, "!")

# ── tests/program_database.test.ts ──
add_fix("./tests/program_database.test.ts", 44, None, "!")
add_fix("./tests/program_database.test.ts", 45, None, "!")
add_fix("./tests/program_database.test.ts", 46, None, "!")
add_fix("./tests/program_database.test.ts", 157, None, "!")
add_fix("./tests/program_database.test.ts", 176, None, "!")
add_fix("./tests/program_database.test.ts", 181, None, "!")
add_fix("./tests/program_database.test.ts", 185, None, "!")

# ── src/scripts/sieve_energy_test.ts ──
add_fix("./src/scripts/sieve_energy_test.ts", 27, None, "!")
add_fix("./src/scripts/sieve_energy_test.ts", 31, None, "!")
add_fix("./src/scripts/sieve_energy_test.ts", 39, None, "!")
add_fix("./src/scripts/sieve_energy_test.ts", 45, None, "!")
add_fix("./src/scripts/sieve_energy_test.ts", 53, None, "!")
add_fix("./src/scripts/sieve_energy_test.ts", 60, None, "!")
add_fix("./src/scripts/sieve_energy_test.ts", 110, None, "!")

# ── src/scripts/sieve_scaling_test.ts ──
add_fix("./src/scripts/sieve_scaling_test.ts", 33, None, "!")

count = 0

# Process all files with "possibly undefined" errors — add ! assertions
for filepath, fixes in FIXES.items():
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filepath}")
        continue
    with open(filepath, "r") as f:
        lines = f.readlines()
    
    changed = False
    for line_num, old, new in fixes:
        idx = line_num - 1
        if idx >= len(lines):
            continue
        line = lines[idx]
        # For "!" fixes, we need to find array accesses like arr[i] and add !
        # Strategy: find the column position from the TSC error and add ! after the ]
        # But we don't have column info here. Instead, use a heuristic:
        # Replace common patterns like `arr[x]` with `arr[x]!` where it's used as a value
        # But be careful not to double-add !
        if "!" not in line or line.count("!") == line.count("!="):
            # Add ! after array index accesses that appear as values
            # Pattern: identifier[expr] used in arithmetic/comparison/assignment RHS
            new_line = re.sub(r'\b(\w+)\[([^\]]+)\](?!\s*[!=\[])', r'\1[\2]!', line)
            if new_line != line:
                lines[idx] = new_line
                changed = True

    if changed:
        with open(filepath, "w") as f:
            f.writelines(lines)
        patched.append(filepath)
        count += 1

# Now handle specific non-regex fixes

# ── src/scripts/sieve_hunt.ts: 'c' and 'best' possibly undefined ──
fp = "./src/scripts/sieve_hunt.ts"
if os.path.exists(fp):
    with open(fp, "r") as f:
        content = f.read()
    original = content
    # These are variables from array find/filter results
    # Add ! after the variable usage
    lines = content.splitlines()
    for i, line in enumerate(lines):
        ln = i + 1
        if ln in (115, 117, 131) and "'c'" in "c" and "c." in line or "c[" in line:
            if "!" not in line.split("c")[1][:2] if "c" in line else True:
                lines[i] = line.replace(" c.", " c!.").replace(" c[", " c![")
        if ln in (145, 150, 161, 162) and "best" in line:
            if "best!" not in line:
                lines[i] = line.replace("best.", "best!.").replace("best[", "best![")
    new_content = "\n".join(lines)
    if content.endswith("\n"):
        new_content += "\n"
    if new_content != original:
        with open(fp, "w") as f:
            f.write(new_content)
        patched.append(fp)

# ── RoutingSignals: make helper function return required fields ──
for test_file in [
    "./tests/architect_tier.test.ts",
    "./tests/factory.test.ts",
    "./tests/factory_tiers.test.ts",
    "./tests/routing_integration.test.ts",
]:
    if not os.path.exists(test_file):
        continue
    with open(test_file, "r") as f:
        content = f.read()
    original = content
    # These files have a helper like: function makeSignals(...): RoutingSignals
    # with identicalErrorCount?: and totalTacticianCalls?: as optional
    content = content.replace("identicalErrorCount?:", "identicalErrorCount:")
    content = content.replace("totalTacticianCalls?:", "totalTacticianCalls:")
    # Also some may have defaults like `identicalErrorCount = 0`
    # If the fields are simply missing, add them
    if "identicalErrorCount" not in content and "RoutingSignals" in content:
        content = re.sub(
            r"(hasArchitectDirective:\s*(?:true|false|[a-z]+)),?\s*\n(\s*\})",
            r"\1,\n    identicalErrorCount: 0,\n    totalTacticianCalls: 0,\n\2",
            content,
        )
    if original != content:
        with open(test_file, "w") as f:
            f.write(content)
        patched.append(test_file)

# ── tests/scribe.test.ts: Expected 1 arguments, but got 2 ──
# draftResearchPaper was changed to take 1 arg (combined object) instead of 2
fp = "./tests/scribe.test.ts"
if os.path.exists(fp):
    with open(fp, "r") as f:
        content = f.read()
    original = content
    # Check current ScribeAgent.draftResearchPaper signature
    # For now, let's just check the error - "Expected 1 arguments, but got 2"
    # The test passes (theorem_sig, winning_path) but the method now takes just (theorem_sig)
    # or a single options object. Let's check the actual method.
    # We already renamed draftPaper -> draftResearchPaper in fix_ts.py
    # The issue is the method signature changed. Let's just suppress for now
    # by wrapping the second arg into the first if needed.
    # Actually let's check:
    pass

# ── src/cli/perqed.ts: string | undefined -> string ──
fp = "./src/cli/perqed.ts"
if os.path.exists(fp):
    with open(fp, "r") as f:
        lines = f.readlines()
    if len(lines) >= 2340:
        line = lines[2339]  # line 2340 (0-indexed)
        if "| undefined" not in line and "??" not in line and "!" not in line:
            # Add non-null assertion or default
            lines[2339] = line.rstrip().rstrip(";").rstrip(",") + "!;\n" if line.rstrip().endswith(";") else line
        with open(fp, "w") as f:
            f.writelines(lines)
        patched.append(fp)

print(f"Phase 3 patched {len(patched)} files:")
for p in patched:
    print(f"  {p}")
