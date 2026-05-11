import Mathlib

open Filter Topology

lemma integer_convergence_rigidity (f : ℕ → ℤ) (c : ℝ)
    (h_lim : Tendsto (fun n => (f n : ℝ)) atTop (𝓝 c)) :
    ∃ (B : ℤ) (N : ℕ), ∀ n ≥ N, f n = B := by
  have h_eps : (1/2 : ℝ) > 0 := by norm_num
  rcases Metric.tendsto_atTop.mp h_lim (1/2) h_eps with ⟨N, hN⟩
  use f N, N
  intro n hn
  have h1 := hN n hn
  have h2 := hN N (le_refl N)
  have h_dist : |(f n : ℝ) - (f N : ℝ)| < 1 := by
    calc |(f n : ℝ) - (f N : ℝ)|
      _ = |((f n : ℝ) - c) + (c - (f N : ℝ))| := by ring_nf
      _ ≤ |(f n : ℝ) - c| + |c - (f N : ℝ)| := abs_add _ _
      _ = |(f n : ℝ) - c| + |(f N : ℝ) - c| := by rw [abs_sub_comm c (f N : ℝ)]
      _ < 1/2 + 1/2 := add_lt_add h1 h2
      _ = 1 := by norm_num
  
  -- Remove abs on reals
  have h_dist_pos : (f n : ℝ) - (f N : ℝ) < 1 := (abs_lt.mp h_dist).2
  have h_dist_neg : -1 < (f n : ℝ) - (f N : ℝ) := (abs_lt.mp h_dist).1
  
  -- Push cast backwards
  have h_dist_pos_int : ((f n - f N : ℤ) : ℝ) < 1 := by exact_mod_cast h_dist_pos
  have h_dist_neg_int : (-1 : ℝ) < ((f n - f N : ℤ) : ℝ) := by exact_mod_cast h_dist_neg
  
  have h_pos_int2 : f n - f N < 1 := by exact_mod_cast h_dist_pos_int
  have h_neg_int2 : -1 < f n - f N := by exact_mod_cast h_dist_neg_int
  
  omega
