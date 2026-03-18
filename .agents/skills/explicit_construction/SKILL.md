---
name: explicit_construction
description: Prove an existence statement ∃ x, P(x) by exhibiting a concrete witness and verifying the property holds, rather than arguing by contradiction or non-constructive principles.
---

# Explicit Construction

## Technique

An explicit construction proof provides a specific, computable object and verifies that it satisfies the required property. This is the strongest proof strategy for existence statements because it is constructive: the proof term itself is the witness.

The strategy proceeds in two phases: (1) **definition** — state explicitly what the object is (a formula, an algorithm, a combinatorial structure), and (2) **verification** — prove the object satisfies all required properties using lemmas, computation, or algebraic means. For Ramsey theory, this corresponds to finding a complete 2-coloring of K_n with no forbidden monochromatic clique.

In Lean 4, `exact ⟨witness, proof_of_property⟩` discharges existential goals directly. `refine ⟨?_, ?_⟩` splits the goal into the witness and the proof obligation. `decide` or `native_decide` can close finite verification goals when the domain is small enough to enumerate computationally.

## When to Apply

- The goal is `∃ x, P x` and a candidate witness is mathematically visible from the problem context.
- The property `P` is decidable over a finite domain — in which case `decide` can close the goal.
- A closed-form formula for the witness exists (e.g., a specific graph, a polynomial, a matrix).
- The ARCHITECT has an SA-generated adjacency matrix (E=0 witness) that needs to be embedded in a Lean term.
- The journal records `SA found witness with E=0` — the witness is known; only the Lean encoding remains.

## Lean 4 Template

```lean
import Mathlib

-- Existential witness
theorem [THEOREM_NAME] : ∃ x : [TYPE], [PROPERTY x] := by
  refine ⟨[CONCRETE_WITNESS], ?_⟩
  [VERIFY_PROPERTY]

-- Computationally decided witness (small finite domain)
theorem [THEOREM_NAME]_decide : ∃ x : Fin 10, x.val * x.val = 25 := by
  exact ⟨5, by decide⟩

-- Ramsey witness embedding pattern:
-- The SA worker found a 2-coloring of K_35. 
-- Encode the adjacency matrix as a Boolean function.
def ramseyColoring : Fin 35 → Fin 35 → Bool :=
  fun i j => [ADJACENCY_MATRIX_ENCODING i j]

theorem ramsey_witness : 
    (∀ i j : Fin 35, ramseyColoring i j = ramseyColoring j i) ∧
    [NO_RED_K4_PROPERTY ramseyColoring] ∧
    [NO_BLUE_K6_PROPERTY ramseyColoring] := by
  constructor
  · decide   -- symmetry check
  constructor
  · decide   -- no monochromatic K₄
  · decide   -- no monochromatic K₆

-- Constructive bijection
theorem [BIJECTION_THEOREM] : ∃ f : [A] → [B], Function.Bijective f := by
  refine ⟨fun x => [FORMULA], ?_, ?_⟩
  · intro x y hxy; [INJECTIVITY_PROOF]
  · intro y; exact ⟨[PREIMAGE_FORMULA y], by [SURJECTIVITY_PROOF]⟩
```

## Worked Example

Proving that there exists a prime between 10 and 20:

```lean
import Mathlib

theorem prime_between_10_20 : ∃ p, 10 < p ∧ p < 20 ∧ Nat.Prime p :=
  ⟨11, by norm_num, by norm_num, by norm_num⟩
```

## DAG Node Config Template

```json
{
  "id": "apply_explicit_construction",
  "kind": "skill_apply",
  "label": "Embed SA-generated witness into Lean existential proof",
  "dependsOn": ["sa_search", "lns_finisher"],
  "config": {
    "skillPath": ".agents/skills/explicit_construction/SKILL.md",
    "inputFromNode": "lns_finisher"
  }
}
```

## Key References

- Lean 4 `decide` tactic for decidable propositions — https://leanprover.github.io/lean4/doc/tactics.html
- Mathlib4: `Mathlib.Data.Fintype.Basic`, `Mathlib.Combinatorics.SimpleGraph.Clique`.
- McKay, Radziszowski. "R(4,5) = 25." *Journal of Graph Theory*, 1995 (explicit Ramsey construction).
