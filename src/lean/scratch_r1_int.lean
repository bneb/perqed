import Mathlib
import erdos265.erdos265_strict_target
import erdos265.beta2_boundary

open Finset

def P_N (a : ℕ → ℕ) (N : ℕ) : ℕ := ∏ i ∈ Finset.range N, a i

-- Integer version of the residual
def R₁_int (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℤ :=
  p * (P_N a N : ℤ) - (q : ℤ) * ∑ i ∈ Finset.range N, ((P_N a N) / a i : ℤ)

-- Bridge from Real to Integer
lemma R₁_eq_R₁_int (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) (h_pos : ∀ i, a i > 0) (hq : q > 0) :
    R₁ a p q N = (R₁_int a p q N : ℝ) := by
  unfold R₁ R₁_int P_N
  push_cast
  have hq_ne_zero : (q : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt hq)
  calc
    (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (↑p / ↑q - ∑ i ∈ Finset.range N, 1 / (a i : ℝ))
    _ = (q : ℝ) * (↑p / ↑q - ∑ i ∈ Finset.range N, 1 / (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
    _ = (↑p - (q : ℝ) * ∑ i ∈ Finset.range N, 1 / (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
      congr 1
      rw [mul_sub, mul_div_cancel₀ (p : ℝ) hq_ne_zero]
    _ = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) - (q : ℝ) * (∑ i ∈ Finset.range N, 1 / (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
    _ = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) - (q : ℝ) * ∑ i ∈ Finset.range N, ((∏ j ∈ Finset.range N, (a j : ℝ)) / (a i : ℝ)) := by
      congr 2
      rw [sum_mul]
      congr 1
      ext i
      rw [← mul_div_assoc, one_mul]
    _ = ↑p * ∏ i ∈ Finset.range N, (a i : ℝ) - ↑q * ∑ i ∈ Finset.range N, ((∏ i_1 ∈ Finset.range N, (a i_1 : ℝ)) / (a i : ℝ)) := by rfl

-- Because R₁ is an integer, and it is monotonically decreasing, we can map it to ℕ.
-- Actually, we know R₁_int > 0 from the tail bound being strictly positive (unless it's empty, but the sum is infinite).
-- Wait, we need to prove R₁_int > 0.

