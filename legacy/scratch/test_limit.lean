import Mathlib

open Filter Topology

noncomputable def f (n : ℕ) : ℝ := 2 / ((n : ℝ) + 2)

lemma tendsto_f : Tendsto f atTop (𝓝 0) := by
  have h1 : f = fun n => 2 / ((n + 2 : ℕ) : ℝ) := by
    ext n
    dsimp [f]
    push_cast
    rfl
  rw [h1]
  have h2 := tendsto_const_div_atTop_nhds_zero_nat (2 : ℝ)
  have h3 := tendsto_add_atTop_nat 2
  exact h2.comp h3
