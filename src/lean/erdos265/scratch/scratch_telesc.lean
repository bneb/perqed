import Mathlib

private lemma warp_to_mul_bound' {a b : ℕ} (ha : a ≥ 2) (h : b ≥ a ^ 2 - a + 1) :
    a * (a - 1) + 1 ≤ b := by
  have ha1 : a ≥ 1 := by omega
  zify [ha1, show a ^ 2 ≥ a from by nlinarith] at *
  nlinarith

/-- The telescoping inequality stated purely in ℝ. -/
lemma telescoping_ineq_real {x y : ℝ} (hx : x ≥ 2) (hy : y - 1 ≥ x * (x - 1)) :
    1 / x ≤ 1 / (x - 1) - 1 / (y - 1) := by
  have hx_pos : x > 0 := by linarith
  have hx1_pos : x - 1 > 0 := by linarith
  have hy1_pos : y - 1 > 0 := by nlinarith
  have h_inv : 1 / (y - 1) ≤ 1 / (x * (x - 1)) := by
    rw [div_le_div_iff₀ hy1_pos (mul_pos hx_pos hx1_pos)]
    linarith
  have h_id : 1 / (x - 1) - 1 / (x * (x - 1)) = 1 / x := by
    field_simp [ne_of_gt hx1_pos, ne_of_gt hx_pos]
  linarith

/-- Helper: cast a ℕ inequality to ℝ, handling the Nat subtraction. -/
private lemma cast_mul_sub_le {a b : ℕ} (ha : 1 ≤ a) (hb : 1 ≤ b) 
    (h : a * (a - 1) ≤ b - 1) : (b : ℝ) - 1 ≥ (a : ℝ) * ((a : ℝ) - 1) := by
  have h1 : ((a * (a - 1) : ℕ) : ℤ) ≤ ((b - 1 : ℕ) : ℤ) := Int.ofNat_le.mpr h
  push_cast [Nat.cast_sub ha, Nat.cast_sub hb] at h1
  exact_mod_cast h1

/-- The telescoping inequality for sequences. -/
lemma telescoping_ineq_seq (a : ℕ → ℕ) (n : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  1 / (a n : ℝ) ≤ 1 / ((a n : ℝ) - 1) - 1 / ((a (n + 1) : ℝ) - 1) := by
  apply telescoping_ineq_real
  · exact_mod_cast h_pos n
  · have hkey := warp_to_mul_bound' (h_pos n) (h_warp n)
    -- hkey : a n * (a n - 1) + 1 ≤ a (n + 1)
    have h3 : a n * (a n - 1) ≤ a (n + 1) - 1 := Nat.le_sub_one_of_lt (by linarith)
    exact cast_mul_sub_le (by linarith [h_pos n]) (by linarith [h_pos (n+1)]) h3
