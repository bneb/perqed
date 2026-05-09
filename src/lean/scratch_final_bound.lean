import Mathlib
import «kt_combinatorics»
import «kt_proof_d2»

open Filter Topology

lemma h_final_bound_proof (c β : ℝ) (x : ℝ × ℝ)
    (hc : c = (1.02 : ℝ) ^ (1 / 4 : ℝ)) 
    (hβ : β > 1) : 
  ∀ᶠ (k : ℕ) in atTop, ((3 / 4 : ℝ) ^ ((1 : ℝ) / β ^ k)) * ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k) ≤ (construct_a x k : ℝ) ^ ((1 : ℝ) / β ^ k) := by
  filter_upwards [eventually_ge_atTop 2] with k hk
  rw [← Real.mul_rpow (by norm_num) (by positivity)]
  have h_exp_pos : (1 : ℝ) / β ^ k ≥ 0 := by positivity
  apply Real.rpow_le_rpow (by positivity)
  · calc (3 / 4 : ℝ) * (10 : ℝ) ^ (14 * c ^ k)
      _ = (3 / 4 : ℝ) * (10 : ℝ) ^ (14 * c ^ (k : ℝ)) := by rw [Real.rpow_natCast]
      _ = (3 / 4 : ℝ) * (10 : ℝ) ^ (14 * ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ)) := by rw [hc]
      _ ≤ (3 / 4 : ℝ) * (10 : ℝ) ^ (E_seq (k / 2) : ℝ) := by
          have he : (E_seq (k / 2) : ℝ) ≥ 14 * (1.02 : ℝ) ^ (k / 2 : ℕ) := E_seq_exp_bound (k / 2)
          have hc1 : (1.02 : ℝ) ^ (k / 2 : ℕ) = (1.02 : ℝ) ^ ((k / 2 : ℕ) : ℝ) := by
            rw [Real.rpow_natCast]
          have hc2 : ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ) = (1.02 : ℝ) ^ ((k : ℝ) / 4) := by
            rw [← Real.rpow_mul (by norm_num)]; congr 1; ring
          have hle : ((k / 2 : ℕ) : ℝ) ≥ (k : ℝ) / 4 := by
            have h1 : 2 * (k / 2 : ℕ) + k % 2 = k := Nat.div_add_mod k 2
            have h2 : k % 2 ≤ 1 := by omega
            have h3 : (2 : ℝ) * ((k / 2 : ℕ) : ℝ) + ((k % 2 : ℕ) : ℝ) = (k : ℝ) := by exact_mod_cast h1
            have h4 : ((k % 2 : ℕ) : ℝ) ≤ 1 := by exact_mod_cast h2
            have hk_real : (k : ℝ) ≥ 2 := by exact_mod_cast hk
            linarith
          have he2 : (E_seq (k / 2) : ℝ) ≥ 14 * ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ) := by
            calc (E_seq (k / 2) : ℝ)
              _ ≥ 14 * (1.02 : ℝ) ^ (k / 2 : ℕ) := he
              _ = 14 * (1.02 : ℝ) ^ ((k / 2 : ℕ) : ℝ) := by rw [hc1]
              _ ≥ 14 * (1.02 : ℝ) ^ ((k : ℝ) / 4) := by
                  have h_rpow_le : (1.02 : ℝ) ^ ((k : ℝ) / 4) ≤ (1.02 : ℝ) ^ ((k / 2 : ℕ) : ℝ) := by
                    apply Real.rpow_le_rpow_of_exponent_le (by norm_num) hle
                  gcongr
              _ = 14 * ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ) := by rw [← hc2]
          gcongr
          norm_num
      _ = (3 / 4 : ℝ) * (10 : ℝ) ^ E_seq (k / 2) := by rw [Real.rpow_natCast]
      _ = (3 / 4 : ℝ) * seq_N (k / 2) := rfl
      _ ≤ construct_a x k := construct_a_lower_bound x k
  · exact h_exp_pos
