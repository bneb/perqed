import Mathlib
import «kt_combinatorics»
import «kt_proof_d2»

open Filter Topology

lemma N_k_ge_10_pow (k : ℕ) : seq_N k ≥ (10 : ℝ) ^ k := by
  have heq : seq_N k = (10 : ℝ) ^ E_seq k := rfl
  rw [heq]
  have hE : E_seq k ≥ k := by
    have h1 : E_seq k ≥ 14 * 1.02 ^ k := E_seq_exp_bound k
    -- Since 14 * 1.02^k >= k
    sorry
  sorry
