import Mathlib

/-!
# Erdős 265: R₁ Growing Kills Limsup

The key lemma: if R₁(k) grows as P₁(k)^α for any α > 0,
then limsup aₖ^{1/2^k} = 1.
-/

open Filter Topology

noncomputable section

/-- Product of the first k terms -/
def prodPrefix (a : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prodPrefix a n * a n

/-- The residual R₁(k): R₁(0) = p, R₁(k+1) = aₖ · R₁(k) - q · P₁(k) -/
def R₁ (a : ℕ → ℕ) (p q : ℕ) : ℕ → ℤ
  | 0 => (p : ℤ)
  | n + 1 => (a n : ℤ) * R₁ a p q n - (q : ℤ) * (prodPrefix a n : ℤ)

/-- The recurrence holds definitionally -/
theorem R₁_succ (a : ℕ → ℕ) (p q : ℕ) (k : ℕ) :
    R₁ a p q (k + 1) = (a k : ℤ) * R₁ a p q k - (q : ℤ) * (prodPrefix a k : ℤ) :=
  rfl

/-- If R₁(k) > 0 then R₁(k+1) > 0 iff aₖ · R₁(k) > q · P₁(k) -/
theorem R₁_pos_iff (a : ℕ → ℕ) (p q : ℕ) (k : ℕ)
    (hR : R₁ a p q k > 0) :
    R₁ a p q (k + 1) > 0 ↔
      (a k : ℤ) * R₁ a p q k > (q : ℤ) * (prodPrefix a k : ℤ) := by
  rw [R₁_succ]; omega

/-- **Main Theorem (sorry)**: R₁ growing as P₁^α (α > 0) kills doubly-exp growth.
    If R₁(k) ≥ P₁(k)^α for large k, then aₖ^{1/2^k} → 1. -/
theorem R₁_growing_kills_limsup
    (a : ℕ → ℕ) (p q : ℕ) (hq : q ≥ 1)
    (ha : ∀ k, a k ≥ 2) (hm : StrictMono a)
    (hR : ∀ k, R₁ a p q k > 0)
    (α : ℝ) (hα : α > 0) (N : ℕ)
    (hgrow : ∀ k, k ≥ N →
      (R₁ a p q k : ℝ) ≥ (prodPrefix a k : ℝ) ^ α) :
    ∀ ε > 0, ∃ M, ∀ k ≥ M, (a k : ℝ) ^ ((1 : ℝ) / 2 ^ k) < 1 + ε := by
  sorry

/-- **Contrapositive**: limsup > 1 ⟹ R₁ bounded -/
theorem limsup_gt_one_implies_R₁_bounded
    (a : ℕ → ℕ) (p q : ℕ) (hq : q ≥ 1)
    (ha : ∀ k, a k ≥ 2) (hm : StrictMono a)
    (hR : ∀ k, R₁ a p q k > 0)
    (hsum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ((p : ℝ) / q))
    (hlimsup : ∃ L > 1, ∀ᶠ k in atTop, (a k : ℝ) ^ ((1 : ℝ) / 2 ^ k) ≥ L) :
    ∃ B : ℕ, ∀ k, R₁ a p q k ≤ (B : ℤ) := by
  sorry

end
