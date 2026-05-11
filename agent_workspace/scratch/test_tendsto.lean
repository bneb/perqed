import Mathlib

open Topology

lemma tendsto_r_test (r : ℕ → ℝ) (h_pos : ∀ n, 0 ≤ r n)
  (h_decay : ∀ n ≥ 3, r (n + 1) ≤ r n / 3) : Filter.Tendsto r Filter.atTop (𝓝 0) := by
  have h_bound : ∀ k, r (3 + k) ≤ r 3 * (1/3)^k := by
    intro k
    induction' k with k ih
    · simp
    · calc
        r (3 + (k + 1)) = r (3 + k + 1) := by ring_nf
        _ ≤ r (3 + k) / 3 := h_decay (3 + k) (by linarith)
        _ = r (3 + k) * (1/3) := by ring
        _ ≤ (r 3 * (1/3)^k) * (1/3) := by
          apply mul_le_mul_of_nonneg_right ih (by norm_num)
        _ = r 3 * (1/3)^(k+1) := by ring
  
  have h_tendsto_geom : Filter.Tendsto (fun k => (1/3 : ℝ)^k) Filter.atTop (𝓝 0) := by
    have h_abs : |(1/3 : ℝ)| < 1 := by
      rw [abs_lt]
      constructor <;> norm_num
    exact tendsto_pow_atTop_nhds_zero_of_abs_lt_one h_abs
  have h_tendsto_geom2 : Filter.Tendsto (fun k => r 3 * (1/3 : ℝ)^k) Filter.atTop (𝓝 0) := by
    have h_zero : (0 : ℝ) = r 3 * 0 := by ring
    rw [h_zero]
    exact Filter.Tendsto.const_mul (r 3) h_tendsto_geom

  have h_tendsto_shifted : Filter.Tendsto (fun k => r (k + 3)) Filter.atTop (𝓝 0) := by
    have h_bound2 : ∀ k, r (k + 3) ≤ r 3 * (1/3)^k := by
      intro k
      have : k + 3 = 3 + k := by ring
      rw [this]
      exact h_bound k
    apply tendsto_of_tendsto_of_tendsto_of_le_of_le tendsto_const_nhds h_tendsto_geom2
    · intro k
      exact h_pos (k + 3)
    · intro k
      exact h_bound2 k
      
  exact (Filter.tendsto_add_atTop_iff_nat 3).1 h_tendsto_shifted
