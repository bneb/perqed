---
description: Pattern for verifying finite graph properties in Lean 4 via the decide tactic
---

# Lean 4 Finite Graph Verification

## When to Use

Use this pattern when you have a **concrete witness** (specific adjacency matrix) and need to formally verify it satisfies graph-theoretic properties.

## Architecture

The proof has three layers:
1. **Data**: A hardcoded adjacency function `adj : Fin n → Fin n → Bool`
2. **Spec**: A `Prop`-valued definition encoding the target property
3. **Proof**: The `decide` tactic evaluates the spec via kernel reflection

## Template

```lean
set_option maxHeartbeats 400000000  -- increase for large graphs

abbrev V := Fin n  -- vertex type

-- Hardcoded witness (from SA output)
def adj : V → V → Bool := fun i j =>
  -- lookup into a static array
  (witnessArray.getD (i.val * n + j.val) 0) == 1

-- Property specification
def IsTargetGraph (adj : V → V → Bool) : Prop :=
  (∀ i, adj i i = false) ∧                    -- irreflexive
  (∀ i j, adj i j = adj j i) ∧                -- symmetric
  (∀ i, (Finset.univ.filter fun j => adj i j).card = k) ∧  -- k-regular
  -- ... additional problem-specific constraints

-- Verification
theorem witness_valid : IsTargetGraph adj := by decide
```

## Key Principles

1. **Use `Fin n`, not `ZMod n`** — avoids Mathlib dependency, minimizes TCB
2. **Split into sub-theorems** for large graphs (helps kernel manage memory)
3. **Increase `maxHeartbeats`** proportionally to n² (pair checks) or n³ (triple checks)
4. **Never use `native_decide`** — stays within trusted kernel
5. **Include redundant checks** (e.g., injectivity even when implied) for definitional completeness

## Scaling Guidelines

| Graph size | maxHeartbeats | Est. compile time |
|-----------|--------------|-------------------|
| n ≤ 20 | 4×10⁶ (default) | < 1s |
| n ~ 64 | 4×10⁷ | ~5s |
| n ~ 99 | 8×10⁸ | ~2-5 min (est.) |
| n ~ 216 | 4×10⁸ | ~57s |
