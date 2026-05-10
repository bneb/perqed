import Mathlib

lemma tendsto_exp_exp (c : ℝ) (hc : c > 1) : 
  Filter.Tendsto (fun k : ℕ => ((10 : ℝ) ^ (c ^ k))) Filter.atTop Filter.atTop := by
  have h1 : Filter.Tendsto (fun x : ℝ => (10 : ℝ) ^ x) Filter.atTop Filter.atTop := by
    have hlog : Real.log 10 > 0 := Real.log_pos (by norm_num)
    have heq : (fun x : ℝ => (10 : ℝ) ^ x) = fun x => Real.exp (x * Real.log 10) := by
      ext x
      rw [Real.rpow_def_of_pos (by norm_num)]
      congr 1
      ring
    rw [heq]
    exact Real.tendsto_exp_atTop.comp (Filter.Tendsto.atTop_mul_const hlog Filter.tendsto_id)
  have h2 : Filter.Tendsto (fun k : ℕ => c ^ k) Filter.atTop Filter.atTop := 
    tendsto_pow_atTop_atTop_of_one_lt hc
  exact Filter.Tendsto.comp h1 h2
