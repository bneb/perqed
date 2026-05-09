# Deep Semantic Review: Heuristically Ranked Files

Following a stack-ranked heuristic review prioritizing length, complexity, and churn, the following deep, logical bugs were discovered:

## 1. Out-of-bounds Array Access in `src/cli/perqed.ts`
**Location:** `src/cli/perqed.ts` around Line 1419.
**Description:**
During `algebraic_partition_construction`, the witness is generated and partitioned into `colorClasses`:
```typescript
const colorClasses: number[][] = Array.from({ length: partConfig.num_partitions }, () => []);
for (let i = 1; i <= partConfig.domain_size; i++) {
  const b = partResult.partition[i];
  if (b !== undefined && b >= 0) colorClasses[b]!.push(i);
}
```
**The Bug:** The `if` condition checks `b >= 0`, but does not bound it against `b < partConfig.num_partitions`. If the LLM-generated `partition_rule_js` returns a value `b` that is greater than or equal to `num_partitions`, `colorClasses[b]` will be `undefined`. The subsequent `!` non-null assertion will fail at runtime, throwing a `TypeError: Cannot read properties of undefined (reading 'push')` and violently crashing the proof loop.

## 2. Environment Variable Truthiness in `src/orchestration/machine.ts`
**Location:** `src/orchestration/machine.ts` around Line 466.
**Description:**
The state machine transition logger conditionally prints based on the debug flag:
```typescript
logTransition: ({ context, event }) => {
  if (process.env.DEBUG) {
    console.log(`🔄 [Machine] Event: ...`);
  }
}
```
**The Bug:** `process.env.DEBUG` evaluates to a string. A user running `DEBUG=false perqed ...` will inadvertently trigger the debug output because the string `"false"` is truthy in JavaScript. The condition should explicitly check `process.env.DEBUG === "true"`.

## 3. Ambiguous `K` Dimension Handling in `src/search/bridge_learner.ts`
**Location:** `src/search/bridge_learner.ts` around `makeProductBridge`.
**Description:**
The `makeProductBridge` splits the `K`-dimensional space into a spherical part and a simplex part using `const half = Math.floor(K / 2)`. While the code concatenates `v.slice(0, half)` and `v.slice(half)` correctly to reconstruct length `K`, if the user or orchestrator passes an odd `K`, the dimensions of the spherical manifold and simplex manifold will be unequal. This asymmetric behavior is undocumented and might severely skew the Riemannian gradient magnitudes, making the product bridge unstable for odd color counts.

## 4. Potentially Flawed SFT Harvesting logic in `src/orchestration/machine.ts`
**Location:** `src/orchestration/machine.ts` around Line 383.
**Description:**
The `harvestSFTData` action traverses `winningPath` extracting states and tactics:
```typescript
const stateNode = winningPath[i]!;
const tacticNode = winningPath[i+1]!;
```
**The Bug:** `stateNode.leanState` is accessed directly to append to JSONL. According to the TypeScript compilation output (`TS2739`), `ProofNode` may be missing properties or have undefined `leanState` at times if not strictly validated by the tree topology, potentially polluting the `sft_dataset.jsonl` with `undefined` strings.

---

*(Note: These bugs were found by bypassing keyword searches and analyzing the logical flow and semantic types of the highest-rated files in the codebase.)*