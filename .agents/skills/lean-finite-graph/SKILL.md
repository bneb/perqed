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
3. **Proof**: The `native_decide` tactic evaluates the spec via kernel reflection

## How It's Automated

The `ProofRegistry` in `src/search/proof_registry.ts` handles this automatically:

```typescript
const registry = ProofRegistry.withDefaults();
const generator = registry.getGenerator("ramsey");

// Lean source
const lean = generator.generateLean({ theoremName, witness, params });

// LaTeX proof document
const latex = generator.generateLatex({ ...input, wallTimeSeconds, iterations, ips });
```

Currently registered: `RamseyProofGenerator`. Add new problem classes with `registry.register(new SRGProofGenerator())`.

## Generated Lean Structure

See `src/codegen/lean_codegen.ts` — generates:

```lean
set_option maxHeartbeats 800000000

def ramsey_R4_4_adj : Fin 17 → Fin 17 → Bool
  | 0, 1 => true
  | 1, 0 => true
  -- ... (match cases for all edges)
  | _, _ => false

def ramsey_R4_4_noK4 : Bool :=
  let fins := List.finRange 17
  fins.all fun v0 => fins.all fun v1 => ...
    if v0.val < v1.val && ... then !(adj v0 v1 && ...) else true

def ramsey_R4_4_noI4 : Bool :=
  -- parallel structure for independent sets

theorem ramsey_R4_4 : ramsey_R4_4_noK4 = true ∧ ramsey_R4_4_noI4 = true := by native_decide
```

## Key Principles

1. **Use `Fin n`, not `ZMod n`** — avoids Mathlib dependency, minimizes TCB
2. **Split into sub-theorems** for large graphs (helps kernel manage memory)
3. **Increase `maxHeartbeats`** proportionally to n² (pair checks) or n³ (triple checks)
4. **`native_decide`** is used for performance (trusted native code evaluator)
5. **Adjacency as match cases** — the codegen produces match-based adjacency functions

## Scaling Guidelines

| Graph size | maxHeartbeats | Est. compile time |
|-----------|--------------|-------------------|
| n ≤ 20 | 4×10⁶ (default) | < 1s |
| n ~ 17 | 8×10⁸ | ~3s (R(4,4)) |
| n ~ 24 | 8×10⁸ | ~40s (R(4,5)) |
| n ~ 64 | 4×10⁷ | ~5s |
| n ~ 99 | 8×10⁸ | ~2-5 min (est.) |

## LaTeX Output

The proof registry also generates a complete LaTeX proof document with:
- Theorem statement + formal proof sketch
- Full adjacency matrix (pmatrix for n≤20, tabular for larger)
- Verification metadata table (wall time, IPS, Lean theorem name)
- Compiled to PDF via `tectonic` (installed via `brew install tectonic`)
