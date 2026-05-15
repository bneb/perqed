import Mathlib

open Filter Topology Metric Set

/-!
# Erdős Problem #265: Formal Specification

**Problem (Erdős, [ErGr80, p.64], [Er88c, p.104]):**
Assume that ∑ 1/nₖ and ∑ 1/(nₖ - 1) are both rational. 
How fast can nₖ tend to infinity?

Erdős conjectured that nₖ^{1/k} → ∞ is possible but that 
nₖ^{1/2^k} must tend to 1.

**Solution (Kovač-Tao, [KoTa24], Theorem 2.8 / Corollary 2.9 with d=2):**
There exist β > 1 and a strictly increasing sequence (aₖ) of 
positive integers with aₖ ≥ 2 such that:
  (1) lim_{k→∞} aₖ^{1/βᵏ} = ∞  (double-exponential growth)
  (2) ∑ₖ 1/aₖ ∈ ℚ
  (3) ∑ₖ 1/(aₖ - 1) ∈ ℚ

This confirms nₖ^{1/k} → ∞ is achievable. The question of 
whether nₖ^{1/2^k} → 1 is forced remains open.

Reference: arXiv:2406.17593v4, Acta Math. Hungar. 175 (2025), 572–608.
-/

/-- The Ahmes vector: maps n to (1/n, 1/(n(n+1))) for the two simultaneous series -/
noncomputable def φ (n : ℕ) : ℝ × ℝ := (1 / (n : ℝ), 1 / ((n : ℝ) * ((n : ℝ) + 1)))

/--
Erdős Problem #265 (Formal Specification — Kovač-Tao Theorem 2.8/2.9):
There exist β > 1 and a strictly increasing sequence of integers aₖ ≥ 2
growing at least double-exponentially (i.e., aₖ^{1/βᵏ} → ∞),
such that both ∑ 1/aₖ and ∑ 1/(aₖ - 1) converge to rational numbers.
-/
axiom erdos_265 :
  ∃ (β : ℝ) (a : ℕ → ℕ),
    β > 1 ∧
    (∀ k, a k ≥ 2) ∧
    StrictMono a ∧
    Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop ∧
    (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
    (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂)
