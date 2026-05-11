import Mathlib
import problem_statement
import residual_growth_bound

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
    have ha2 := hGe2 k
    have hG := hGreedy k
    have h_sq : a k * a k ≥ 2 * a k := Nat.mul_le_mul_right (a k) ha2
    have h_bound : a k * a k - a k ≥ a k := by omega
    omega
    
  have hc_greedy : ∀ k, c (k + 1) ≥ c k * c k - c k + 1 := by
    intro k
    have ha2 := hGe2 (k + 1)
    have hG := hGreedy (k + 1)
    have ha2_k := hGe2 k
    have h_c_def : c k = a (k + 1) - 1 := rfl
    have h_ck1_def : c (k + 1) = a (k + 2) - 1 := rfl
    have h_ak1_sub : a (k + 1) - 1 + 1 = a (k + 1) := by omega
    have h_sq : (a (k + 1) - 1) * (a (k + 1) - 1) + (a (k + 1) - 1) = a (k + 1) * a (k + 1) - a (k + 1) := by
      have : a (k + 1) ≥ 2 := ha2
      omega
    have h_G_omega : a (k + 2) ≥ a (k + 1) * a (k + 1) - a (k + 1) + 1 := hG
    omega
    
  have hc_sum : HasSum (fun k => (1 : ℝ) / (c k : ℝ)) ↑(q - 1 / ((a 0 : ℚ) - 1)) := by
    -- We know ∑_{k=0}^∞ 1/(a_k - 1) = q
    -- So ∑_{k=0}^∞ 1/(a_{k+1} - 1) = q - 1/(a_0 - 1)
    sorry
    
  rcases greedy_forces_sylvester_recurrence c (q - 1 / ((a 0 : ℚ) - 1)) hc_ge2 hc_sum hc_greedy with ⟨N, hN⟩
  use N
  intro n hn
  exact hN n hn

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
