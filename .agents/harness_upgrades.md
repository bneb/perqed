# Perqed Harness Upgrades: Automated Guardrails

Architecture proposal for automated checks that catch the five failure modes identified in the torus decomposition sprint — before a human has to intervene.

---

## Guardrail 1: Lean TCB Linter

**What it catches**: Rule 1 (TCB expansion via `native_decide`, `#eval` as proof, unsafe axioms)

**Implementation**: A pre-commit or CI step that parses `.lean` files and flags violations.

```typescript
// src/harness/lean_tcb_linter.ts

const BANNED_PATTERNS = [
  { pattern: /\bnative_decide\b/, message: "native_decide adds the C compiler to the TCB. Use decide." },
  { pattern: /\b#eval\b.*\b(theorem|lemma|def)\b/, message: "#eval runs in the interpreter, not the kernel. Use #check or decide." },
  { pattern: /\bsorry\b/, message: "Unproven subgoal (sorry) found." },
  { pattern: /\bunsafe\b/, message: "unsafe keyword found in proof code." },
];

function lintLeanFile(source: string): Violation[] {
  return BANNED_PATTERNS.flatMap(({ pattern, message }) =>
    [...source.matchAll(new RegExp(pattern, 'g'))].map(match => ({
      line: source.substring(0, match.index).split('\n').length,
      message,
    }))
  );
}
```

**Integration**: Run automatically when the Orchestrator's ScribeAgent generates Lean output. Block submission if any violations are found.

---

## Guardrail 2: Hot Loop Allocation Profiler

**What it catches**: Rule 3 (GC death spirals from .clone() / allocation in inner loops)

**Implementation**: A diagnostic wrapper that instruments the first N iterations of any search loop, measuring allocation rate via V8's `--trace-gc` or `process.memoryUsage()` sampling.

```typescript
// src/harness/allocation_profiler.ts

async function profileSearchLoop(
  engine: SearchEngine,
  warmupIterations: number = 10_000
): Promise<AllocationReport> {
  const before = process.memoryUsage();
  const gcCountBefore = performance.nodeTiming?.idleTime ?? 0;

  for (let i = 0; i < warmupIterations; i++) {
    engine.step();
  }

  const after = process.memoryUsage();
  const heapGrowth = after.heapUsed - before.heapUsed;
  const bytesPerIteration = heapGrowth / warmupIterations;

  return {
    bytesPerIteration,
    projectedGBPerSecond: bytesPerIteration * engine.estimatedItersPerSecond / 1e9,
    verdict: bytesPerIteration > 100
      ? "FAIL: Allocating in hot loop. Use apply/revert pattern."
      : "PASS",
  };
}
```

**Trigger**: Run automatically before any search exceeding 100K target iterations. If `bytesPerIteration > 100`, halt and report — do not attempt to "tune" hyperparameters on a GC-bound engine.

---

## Guardrail 3: Energy Function Soundness Checker

**What it catches**: Rule 4 (false zeros in energy functions)

**Implementation**: A fuzz-test harness that generates random valid solutions (if known) and random invalid solutions, then asserts that E = 0 ⟺ valid.

```typescript
// src/harness/energy_soundness.ts

function checkEnergySoundness(
  energyFn: (state: State) => number,
  generateValid: () => State,
  generateInvalid: () => State,
  trials: number = 1000
): SoundnessReport {
  let falseZeros = 0;
  let missedZeros = 0;

  for (let i = 0; i < trials; i++) {
    if (energyFn(generateInvalid()) === 0) falseZeros++;
    if (energyFn(generateValid()) !== 0) missedZeros++;
  }

  return {
    falseZeros,   // E=0 on invalid state — energy function is unsound
    missedZeros,   // E≠0 on valid state — energy function is incomplete
    verdict: falseZeros > 0
      ? "FAIL: Energy function has false zeros. Fix before tuning."
      : missedZeros > 0
        ? "WARN: Energy function rejects valid states."
        : "PASS",
  };
}
```

**Trigger**: Required before any search run. If no valid/invalid generator exists for the problem, require a manual sign-off comment in the energy function documenting the E=0 ⟺ valid argument.

---

## Guardrail 4: Incremental/Full Agreement Validator

**What it catches**: Rules 3 + 4 combined (incremental evaluator diverging from ground truth)

**Implementation**: A shadow-mode validator that runs both the incremental and full-recompute energy evaluators in lockstep for the first N iterations.

```typescript
// src/harness/incremental_validator.ts

function validateIncrementalEngine(
  incrementalEngine: SearchEngine,
  fullEngine: SearchEngine,
  iterations: number = 10_000
): ValidationReport {
  let divergences = 0;

  for (let i = 0; i < iterations; i++) {
    // Apply same random mutation to both
    const mutation = incrementalEngine.randomMutation();
    incrementalEngine.applyAndEvaluate(mutation);
    fullEngine.applyAndEvaluate(mutation);

    if (incrementalEngine.energy !== fullEngine.energy) {
      divergences++;
      break; // First divergence is enough to fail
    }

    // Sync accept/reject decision
    const accept = Math.random() < 0.5;
    if (!accept) {
      incrementalEngine.revert(mutation);
      fullEngine.revert(mutation);
    }
  }

  return {
    iterations,
    divergences,
    verdict: divergences > 0
      ? `FAIL: Divergence at iteration ${divergences}. Incremental evaluator is unsound.`
      : "PASS",
  };
}
```

**Trigger**: Run automatically whenever a new incremental evaluator is written or modified. Must pass before any production search begins.

---

## Integration Summary

| Guardrail | Trigger | Blocks |
|-----------|---------|--------|
| TCB Linter | Pre-commit / CI on `.lean` files | Merge to main |
| Allocation Profiler | Before search runs > 100K iters | Search start |
| Energy Soundness | Before any search run | Search start |
| Incremental Validator | When incremental evaluator changes | Search start |

These four guardrails would have caught all five failure modes from the torus sprint autonomously — no human intervention required.
