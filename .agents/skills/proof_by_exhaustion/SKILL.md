---
name: proof_by_exhaustion
description: Prove a property by partitioning all cases and verifying each one individually; subsumes finite case analysis and decision procedures over bounded domains.
---

# Proof by Exhaustion

## Technique

Proof by exhaustion (case analysis) partitions the domain into finitely many cases — determined by a finite set of conditions, a finite type, or a bounded quantifier — and verifies the property in each case independently. When the domain is small enough, this reduces to a computation that a decision procedure can perform automatically.

For larger or structured case sets, the `rcases` and `omega` tactics decompose disjunctions efficiently. The `fin_cases` tactic handles goals over `Fin n` by enumerating all `n` cases and delegating each to `decide` or `norm_num`.

This technique is the backbone of all computer-verified combinatorial proofs — the four-colour theorem, the Kepler conjecture, and Ramsey bound verifications all rely on exhaustive case checking, often aided by reducibility to SAT.

## When to Apply

- The domain is finite and small: `Fin n` for small `n`, or a bounded `Nat` range.
- The proof splits naturally into a small number of structurally different cases (parities, modular residues, sign conditions).
- `decide` or `omega` can close each leaf case independently.
- The ARCHITECT's context shows a goal with a universal quantifier over a finite type.
- Z3 returned SAT with a small explicit model — each case from that model can be verified directly.

## Lean 4 Template

```lean
import Mathlib

-- Automated exhaustion over Fin n
theorem [THEOREM_NAME] (i : Fin 4) : [P i] := by
  fin_cases i <;> decide

-- Manual case split via rcases on a disjunction
theorem [THEOREM_NAME]_manual (n : ℕ) (h : n = 0 ∨ n = 1 ∨ n ≥ 2) : [P n] := by
  rcases h with rfl | rfl | hn
  · [CASE_0]
  · [CASE_1]
  · [CASE_GE_2]

-- Modular case analysis
theorem [THEOREM_NAME]_mod3 (n : ℕ) : [P n] := by
  have := Nat.mod_three_cases n
  rcases this with h | h | h <;> omega

-- Interval case enumeration (small bounded range)
theorem [THEOREM_NAME]_range : ∀ n ∈ Finset.range 10, [P n] := by
  decide

-- Omega for linear arithmetic after case split
theorem [THEOREM_NAME]_omega (n m : ℕ) (h : n ≤ 5) (hm : m ≤ 3) : n + m ≤ 8 := by
  omega
```

## Worked Example

Proving that `n² mod 4 ∈ {0, 1}` for all naturals:

```lean
import Mathlib

theorem sq_mod_four (n : ℕ) : n ^ 2 % 4 = 0 ∨ n ^ 2 % 4 = 1 := by
  have h := n % 4
  have : n % 4 < 4 := Nat.mod_lt n (by norm_num)
  interval_cases (n % 4) <;> omega
```

## DAG Node Config Template

```json
{
  "id": "apply_proof_by_exhaustion",
  "kind": "skill_apply",
  "label": "Case-split over finite domain and close each branch",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/proof_by_exhaustion/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Lean 4 tactics `fin_cases`, `rcases`, `interval_cases`, `decide`, `omega`.
- Mathlib4: `Mathlib.Tactic.FinCases`, `Mathlib.Tactic.Omega`.
- Appel, Haken. "Every Planar Map is Four-Colorable." *Illinois J. Math.*, 1977 (proto-exhaustion proof).
