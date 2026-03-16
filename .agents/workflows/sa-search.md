---
description: How to run a Simulated Annealing search for a combinatorial witness
---

# Run a Stochastic Search (SA)

## Workspace Convention

Active problem files live in the flat workspace:
- `src/math/<problem>_state.ts` — SA state class (implements `IState`)
- `src/math/<problem>_state_fast.ts` — Incremental variant (optional)
- `src/scripts/<problem>_hunt.ts` — Runner script
- `data/` — Output witnesses land here

The shared SA framework lives in `src/math/optim/` and should NOT be modified per-problem.

## Running the Hunt

// turbo
1. Run with default parameters:
```bash
bun run src/scripts/<problem>_hunt.ts
```

2. Run with custom parameters (typical: problem-size, restarts, iterations-per-restart):
```bash
bun run src/scripts/<problem>_hunt.ts <size> <restarts> <iters>
```

## Pre-Flight Checks (MANDATORY)

Before running a long search, verify:

1. **Energy function soundness**: Confirm E=0 ⟺ valid solution. See `.agents/system_rules.md` Rule 4.

2. **Zero allocation in hot loop**: The mutation loop must use in-place `applyMutation`/`revertMutation` with no `.clone()`, `[...spread]`, or `new Map()`. See `.agents/system_rules.md` Rule 3.

3. **Incremental/full agreement**: If using an incremental evaluator, run the fuzz test first (≥10K iterations comparing incremental vs full recompute).

## When Search Stalls

- If stuck at a specific energy plateau (e.g., E=2), diagnose what that energy value means combinatorially BEFORE tuning hyperparameters.
- Try non-monotonic reheat: `temperature = max(1, E_best^0.4)` when stagnating.
- If a specific mutation type can't cross the basin, consider a multi-vertex "topological" mutation.

## After Finding a Witness

1. The hunt script writes the witness to `data/<problem>_<params>.json`.
2. Hardcode the witness payload into a Lean `.lean` file in `src/lean/`.
3. Verify with `decide` using the `/lean-verify` workflow.
4. Run the test suite to confirm nothing broke.
