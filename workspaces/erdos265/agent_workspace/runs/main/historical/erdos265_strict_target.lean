import Mathlib

open Filter Topology Metric

/-- The baseline properties required for an Erdős 265 sequence:
    a strictly increasing sequence of integers ≥ 2 such that
    both ∑ 1/aₖ and ∑ 1/(aₖ - 1) converge to rational numbers. -/
def Erdos265_Sequence (a : ℕ → ℕ) : Prop :=
  StrictMono a ∧
  (∀ k, a k ≥ 2) ∧
  (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
  (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂)

/-!
# Erdős Problem #265 — Open Conjecture

**Source**: [erdosproblems.com/265](https://www.erdosproblems.com/265)

**Solved part** (Kovač-Tao, [KoTa24]):
There exists such a sequence with aₖ^{1/βᵏ} → ∞ for some β > 1.
This is formalized in `affirmative_proof_core.lean`.

**Open part** (this file):
Erdős conjectured that aₖ^{1/2ᵏ} → 1 is forced for every such sequence.
Equivalently, can one achieve limsup aₖ^{1/2ᵏ} > 1?

A folklore result states that ∑ 1/aₖ is irrational whenever
lim aₖ^{1/2ᵏ} = ∞, so the sequence cannot grow faster than
doubly exponentially — the question is the precise exponent.

**Previous red team note**: The former `Erdos265_Full_Resolution` was
stated as `A ∨ ¬A`, which is a classical tautology and does not
capture any mathematical content. We now state the actual conjecture.
-/

/--
**Erdős 265 Ceiling Conjecture** (OPEN):
Every Erdős 265 sequence satisfies limsup aₖ^{1/2ᵏ} ≤ 1.

Equivalently, aₖ^{1/2ᵏ} → 1 for every such sequence
(since aₖ ≥ 2 forces liminf ≥ 1).

This is an open problem in mathematics.
-/
theorem erdos265_ceiling_conjecture :
    ∀ a : ℕ → ℕ, Erdos265_Sequence a →
      limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  sorry
