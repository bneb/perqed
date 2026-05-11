import Mathlib
import erdos265.problem_statement
import erdos265.residual_growth_bound

/-!
# Erdős 265: The Final Assembly

This file contains the final assembly of the Erdős 265 Ceiling Conjecture.
By bridging the greedy forces theorem with the shifted sequence logic, we 
establish that the sequence must simultaneously lock into two contradictory 
algebraic recurrences.
-/

open Filter Topology

/--
  **MISSING BRIDGE LEMMA**: Dual greedy forces dual Sylvester recurrence
  
  Applying the primary greedy lock-in to the shifted sequence c_k = a_{k+1} - 1.
-/
theorem greedy_forces_dual_sylvester_recurrence (a : ℕ → ℕ) (q : ℚ)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q)
    (hGreedy : ∀ k, a (k + 1) ≥ a k * a k - a k + 1) :
    ∃ N : ℕ, ∀ n ≥ N,
      (a (n + 1) - 1) + (a n - 1) = (a n - 1) * (a n - 1) + 1 := by
  let c := fun k => a (k + 1) - 1
  
  have hc_ge2 : ∀ k, c k ≥ 2 := by
    intro k
    have ha2_k := hGe2 k
    have hG_k := hGreedy k
    have h1 : a k * a k ≥ 2 * a k := Nat.mul_le_mul_right (a k) ha2_k
    change a (k + 1) - 1 ≥ 2
    generalize a k * a k = S at *
    generalize a (k + 1) = ak1 at *
    generalize a k = ak at *
    have h2 : S - ak ≥ ak := by omega
    have h3 : ak1 ≥ ak + 1 := by omega
    omega
    
  have hc_greedy : ∀ k, c (k + 1) ≥ c k * c k - c k + 1 := by
    intro k
    have ha2_k := hGe2 k
    have hG_k := hGreedy k
    have h1 : a k * a k ≥ 2 * a k := Nat.mul_le_mul_right (a k) ha2_k
    have ha_k1_ge3 : a (k + 1) ≥ 3 := by
      generalize a k * a k = S at *
      generalize a (k + 1) = ak1 at *
      generalize a k = ak at *
      have h2 : S - ak ≥ ak := by omega
      have h3 : ak1 ≥ ak + 1 := by omega
      omega
    have h_ck_val : c k = a (k + 1) - 1 := rfl
    have h_ck1_val : c (k + 1) = a (k + 2) - 1 := rfl
    have hG_k1 := hGreedy (k + 1)
    
    have h_sq_sub : (a (k + 1) - 1) * (a (k + 1) - 1) = a (k + 1) * a (k + 1) - 2 * a (k + 1) + 1 := by
      have h : (((a (k + 1) - 1) * (a (k + 1) - 1) : ℕ) : ℤ) = ((a (k + 1) * a (k + 1) - 2 * a (k + 1) + 1 : ℕ) : ℤ) := by
        have h_sub : ((a (k + 1) - 1 : ℕ) : ℤ) = (a (k + 1) : ℤ) - 1 := by exact Int.coe_nat_sub (by omega)
        have h_sub2 : ((a (k + 1) * a (k + 1) - 2 * a (k + 1) : ℕ) : ℤ) = (a (k + 1) : ℤ) * (a (k + 1) : ℤ) - 2 * (a (k + 1) : ℤ) := by
          have h_mul_le : a (k + 1) * a (k + 1) ≥ 2 * a (k + 1) := Nat.mul_le_mul_right (a (k + 1)) (by omega)
          rw [Int.coe_nat_sub h_mul_le]
          push_cast; rfl
        push_cast; rw [h_sub, h_sub2]; ring
      exact_mod_cast h
      
    have h_mul_lb : a (k + 1) * a (k + 1) ≥ 3 * a (k + 1) := Nat.mul_le_mul_right (a (k + 1)) ha_k1_ge3
    
    rw [h_ck_val, h_ck1_val]
    revert hG_k1 h_sq_sub h_mul_lb ha_k1_ge3
    generalize a (k + 1) * a (k + 1) = S
    generalize a (k + 1) = A
    generalize a (k + 2) = ak2
    intro ha_k1_ge3 h_mul_lb h_sq_sub hG_k1
    rw [h_sq_sub]
    omega
    
  have hc_sum : HasSum (fun k => (1 : ℝ) / (c k : ℝ)) ↑(q - 1 / ((a 0 : ℚ) - 1)) := by
    have h_iff := hasSum_nat_add_iff 1 (f := fun k => (1 : ℝ) / ((a k : ℝ) - 1)) (a := ↑q - (1 : ℝ) / ((a 0 : ℝ) - 1))
    have h_sum_zero : (Finset.range 1).sum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) = (1 : ℝ) / ((a 0 : ℝ) - 1) := Finset.sum_range_one _
    rw [h_sum_zero] at h_iff
    have h_eq : (q : ℝ) - (1 : ℝ) / ((a 0 : ℝ) - 1) + (1 : ℝ) / ((a 0 : ℝ) - 1) = (q : ℝ) := sub_add_cancel (q : ℝ) _
    rw [h_eq] at h_iff
    have h_q_sub : (↑(q - 1 / ((a 0 : ℚ) - 1)) : ℝ) = (q : ℝ) - (1 : ℝ) / ((a 0 : ℝ) - 1) := by push_cast; rfl
    rw [h_q_sub]
    have h_c_def : (fun (k : ℕ) => 1 / (c k : ℝ)) = fun n => 1 / ((a (n + 1) : ℝ) - 1) := by
      ext n
      have : c n = a (n + 1) - 1 := rfl
      have h_pos : a (n + 1) ≥ 1 := by
        have := hGe2 (n + 1)
        omega
      rw [this, Nat.cast_sub h_pos]
      push_cast; rfl
    rw [h_c_def]
    exact h_iff.mpr hSum
    
  rcases greedy_forces_sylvester_recurrence c (q - 1 / ((a 0 : ℚ) - 1)) hc_ge2 hc_sum hc_greedy with ⟨N, hN⟩
  use N + 1
  intro n hn
  have h_n_sub_1 : n - 1 ≥ N := by omega
  have h_c := hN (n - 1) h_n_sub_1
  have h_idx1 : n - 1 + 1 = n := by omega
  rw [h_idx1] at h_c
  have h_cn : c n = a (n + 1) - 1 := rfl
  have h_cn_1 : c (n - 1) = a n - 1 := by
    have : c (n - 1) = a (n - 1 + 1) - 1 := rfl
    rw [h_idx1] at this
    exact this
  rw [h_cn, h_cn_1] at h_c
  exact h_c

/--
  **THE MAIN THEOREM**
  
  There is no sequence of integers that satisfies all conditions of the Erdős 265 
  Ceiling Conjecture (in the greedy regime).
-/
theorem no_erdos265_sequence (a : ℕ → ℕ) (h : Erdos265_Sequence a) : False := by
  obtain ⟨hGe2, hGreedy, ⟨q₁, hSum1⟩, ⟨q₂, hSum2⟩⟩ := h
  
  -- Primary lock-in: rational ∑ 1/aₖ → Sylvester recurrence
  rcases greedy_forces_sylvester_recurrence a q₁ hGe2 hSum1 hGreedy with ⟨N₁, hN₁⟩
  
  -- Dual lock-in: rational ∑ 1/(aₖ-1) → dual Sylvester recurrence
  rcases greedy_forces_dual_sylvester_recurrence a q₂ hGe2 hSum2 hGreedy with ⟨N₂, hN₂⟩
  
  -- Convert dual recurrence to explicit polynomial form
  have hDual : ∀ n ≥ N₂, a (n + 1) + 3 * a n = a n * a n + 4 :=
    fun n hn => shifted_seq_lockin a N₂ hN₂ (fun n _ => hGe2 n) n hn
    
  -- Combine at N = max N₁ N₂
  let N := max N₁ N₂
  exact dual_lockin_contradiction a N
    (fun n hn => hN₁ n (le_trans (le_max_left _ _) hn))
    (fun n hn => hDual n (le_trans (le_max_right _ _) hn))
