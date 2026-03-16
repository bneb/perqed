---
description: How to verify a Lean 4 proof from the Perqed workspace
---

# Verify a Lean 4 Proof

## Active Project (files in src/lean/)

// turbo
1. Compile the proof:
```bash
lake env lean src/lean/<ProofFile>.lean
```

No output means success. If errors occur, they will be printed to stderr.

2. If the proof times out, increase heartbeats by adding to the `.lean` file:
```lean
set_option maxHeartbeats 400000000
```

3. **NEVER** use `native_decide` to work around timeouts. Always use `decide`. See `.agents/system_rules.md` Rule 1.

4. If `decide` hits recursion depth limits, decompose the theorem into isolated sub-lemmas. See `.agents/system_rules.md` Rule 2.

## Archived Project (files in projects/<id>/lean/)

// turbo
1. Compile from the repo root:
```bash
lake env lean projects/<project-id>/lean/<ProofFile>.lean
```

## Expected Timings (Apple M4)

| Proof | Approximate Time |
|-------|-----------------|
| m=4 torus (64 vertices) | ~5 seconds |
| m=6 torus (216 vertices) | ~60 seconds |
