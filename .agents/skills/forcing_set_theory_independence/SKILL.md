---
name: forcing_set_theory_independence
description: Prove that a statement is independent of ZFC by constructing a forcing extension of the set-theoretic universe in which the statement holds (or fails), while the base model satisfies the opposite.
---

# Forcing (Set Theory Independence)

## Technique

Forcing, introduced by Paul Cohen in 1963, is the technique for constructing models of set theory in which prescribed sentences hold. Starting from a ground model M ⊨ ZFC, a forcing poset (P, ≤) and a generic filter G over P yield an extended model M[G] ⊨ ZFC in which new sets have been "forced" to exist.

The Continuum Hypothesis (CH) states `2^ℵ₀ = ℵ₁`. Cohen showed: (1) M[G] ⊨ ¬CH by adding ℵ₂-many Cohen reals, and (2) Gödel's constructible universe L satisfies CH. Together they show CH is independent of ZFC.

Independence proofs proceed by showing a sentence φ and its negation ¬φ are each consistent with ZFC: exhibit models of each. The key tools are: the forcing relation `p ⊩ φ` (read "p forces φ"), the truth lemma (M[G] ⊨ φ iff some p ∈ G forces φ), and the definability lemma.

## When to Apply

- The goal is to prove that a statement cannot be decided within ZFC (independence).
- The Continuum Hypothesis or a consequence is involved in the proof.
- A Ramsey-type combinatorial principle (like ◇ or Martin's Axiom) is being used as an axiom and the proof requires clarifying its independence status.
- The ARCHITECT's context shows that the current goal is inherently independent of ZFC (Zermelo-Fraenkel + Choice).
- A large cardinal axiom is required and needs to be flagged as an assumption.

## Lean 4 Template

```lean
import Mathlib

-- NOTE: Full forcing machinery is not yet in mathlib4 as of 2024.
-- This SKILL provides the mathematical structure for the ARCHITECT to:
-- (a) recognize independence results, and
-- (b) correctly annotate proofs that require additional axioms.

-- Gödel's constructibility (L is a model of ZFC + CH)
-- In Lean: assuming axioms and proving relative consistency
axiom CH : Cardinal.continuum = Cardinal.aleph 1  -- The Continuum Hypothesis as axiom
-- Use CH when: a proof requires card(ℝ) = ℵ₁ for a combinatorial argument

-- Recognize when result needs large cardinals
-- E.g., "Every projective set is Lebesgue measurable" requires  
-- "there exist infinitely many Woodin cardinals" (Foreman-Magidor-Shelah type results)

-- Template for flagging independence
theorem [THEOREM_NAME] ([HYPOTHESES]) : [CONCLUSION] := by
  -- This theorem is independent of ZFC.
  -- The following proof assumes [ADDITIONAL_AXIOM].
  -- Consistency: [CITATION]
  sorry

-- Martin's Axiom (MA) — consistent with ZFC + ¬CH
-- MA asserts: for any ccc forcing poset P and family of ≤ κ < 2^ℵ₀ dense sets,
-- a generic filter exists meeting all of them
-- Applications: every set of reals of size < 2^ℵ₀ has measure zero under MA
axiom MartinAxiom : ∀ (P : Type*) [PartialOrder P] [CountableChainCondition P]
    (D : Finset (Set P)) (hD : ∀ d ∈ D, Dense d), ∃ G : Set P, IsGenericFilter G D

-- Cardinal arithmetic assuming CH
example (hCH : 2^Cardinal.aleph 0 = Cardinal.aleph 1) :
    Cardinal.aleph 1 + Cardinal.aleph 0 = Cardinal.aleph 1 := by
  rw [← hCH]
  simp [Cardinal.add_eq_max]
```

## Worked Example

Independence of CH — recognizing the independence pattern:

```lean
import Mathlib

-- This is a landmark result: neither CH nor ¬CH can be proved from ZFC
-- Gödel 1938: L ⊨ CH (consistency of CH)
-- Cohen 1963: ∃ model ⊨ ¬CH (consistency of ¬CH)

-- In a theorem requiring CH, flag it explicitly:
theorem [THEOREM_REQUIRING_CH] (hCH : Cardinal.continuum = Cardinal.aleph 1) :
    [CONCLUSION] := by
  -- Requires CH. If you see this in a DAG, consider whether the problem's
  -- intended interpretation is in ZFC alone or ZFC + CH.
  sorry
```

## DAG Node Config Template

```json
{
  "id": "apply_forcing_independence",
  "kind": "skill_apply",
  "label": "Identify independence from ZFC; flag additional axioms needed",
  "dependsOn": ["literature", "lean_step"],
  "config": {
    "skillPath": ".agents/skills/forcing_set_theory_independence/SKILL.md",
    "inputFromNode": "lean_step"
  }
}
```

## Key References

- Mathlib4: `Mathlib.SetTheory.Cardinal.Basic`, `Mathlib.SetTheory.Ordinal.Basic`.
- Cohen, Paul. *Set Theory and the Continuum Hypothesis.* Benjamin, 1966 (original forcing exposition).
- Kunen, Kenneth. *Set Theory: An Introduction to Independence Proofs.* Elsevier, 1980.
- Jech, Thomas. *Set Theory*, 3rd ed. Springer Monographs, 2003 (comprehensive forcing reference).
