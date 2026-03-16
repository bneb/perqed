---
description: How to start a new proof project in the Perqed workspace
---

# Start a New Proof Project

## Workspace Convention

Active problem files use the flat workspace structure. Only ONE problem should be active at a time. If the workspace already contains files from a previous problem, archive it first using `/archive-project`.

## Steps

1. Confirm the workspace is clean (no leftover problem-specific files):
```bash
ls src/lean/    # should be empty or contain only shared files
ls data/*.json  # should be empty or contain only shared data
```

2. Create the problem state class implementing `IState<T>`:
```
src/math/<problem>_state.ts
```
   - Import from `./optim/IState` (the shared interface)
   - Implement `getEnergy()`, `mutate()`, `getPayload()`

3. Create the hunt script:
```
src/scripts/<problem>_hunt.ts
```
   - Import `SimulatedAnnealing` from `../math/optim/SimulatedAnnealing`
   - Import problem state from `../math/<problem>_state`
   - Write output to `data/`

4. Create tests (TDD — write tests first):
```
tests/<problem>_state.test.ts
```

5. Create Lean proof skeleton with `sorry`:
```
src/lean/<Problem>.lean
```

// turbo
6. Run the test suite to confirm the new code integrates cleanly:
```bash
bun test
```

7. When the problem is solved and verified, archive it using `/archive-project`.
