import Perqed.Erdos265.UnconditionalCeiling

open Filter Topology Finset

-- NOTE: The authoritative proof of the Erdős 265 Ceiling Conjecture is now located in 
-- `CeilingProof.lean` using the Exact Integer Collapse strategy.
-- 
-- The greedy regime impossibility proofs are preserved below.

lemma hasSum_shift {f : ℕ → ℝ} {q : ℝ} (hSum : HasSum f q) :
    HasSum (fun k => f (k + 1)) (q - f 0) := by
  have h_iff := (hasSum_nat_add_iff 1 (f := f) (a := q - f 0)).symm
  have h_sum : Finset.sum (Finset.range 1) (fun i => f i) = f 0 := by simp
  have h_simp : q - f 0 + Finset.sum (Finset.range 1) (fun i => f i) = q := by
    rw [h_sum]
    ring
  rw [h_simp] at h_iff
  exact h_iff.mp hSum

/--
  **BRIDGE LEMMA**: Dual greedy forces dual Sylvester recurrence
  
  Applying the primary greedy lock-in to the shifted sequence c_k = a_{k+1} - 1.
-/
theorem greedy_forces_dual_sylvester_recurrence (a : ℕ → ℕ) (q : ℚ)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q)
    (hGreedy : IsGreedy a) :
    ∃ N : ℕ, ∀ n ≥ N,
      (a (n + 1) - 1) + (a n - 1) = (a n - 1) * (a n - 1) + 1 := by
  obtain ⟨c, hc_eq_def⟩ : ∃ f : ℕ → ℕ, f = fun k => a (k + 1) - 1 := ⟨_, rfl⟩
  
  have hc_ge2 : ∀ k, c k ≥ 2 := by
    intro k
    have hG := hGreedy k
    have hak := hGe2 k
    have h_sq : a k * a k ≥ a k + a k := by
      calc a k * a k
        _ ≥ 2 * a k := Nat.mul_le_mul_right (a k) hak
        _ = a k + a k := by clear hG hGreedy; omega
    have h_bound : a k * a k - a k ≥ a k := Nat.le_sub_of_add_le h_sq
    have h_ak1_ge : a (k + 1) ≥ 3 := by
      calc a (k + 1)
        _ ≥ a k * a k - a k + 1 := hG
        _ ≥ a k + 1 := Nat.add_le_add_right h_bound 1
        _ ≥ 2 + 1 := Nat.add_le_add_right hak 1
        _ = 3 := rfl
    have hc_def : c k = a (k + 1) - 1 := congr_fun hc_eq_def k
    clear hG hGreedy
    omega

  have hc_greedy : ∀ k, c (k + 1) ≥ c k * c k - c k + 1 := by
    intro k
    have hG := hGreedy (k + 1)
    have hc_ge_2 : c k ≥ 2 := hc_ge2 k
    
    have hac : a (k + 1) = c k + 1 := by
      have hc_def : c k = a (k + 1) - 1 := congr_fun hc_eq_def k
      have ha_ge2 : a (k + 1) ≥ 2 := hGe2 (k + 1)
      clear hG hGreedy; omega
      
    have hac1 : a (k + 2) = c (k + 1) + 1 := by
      have hc_def : c (k + 1) = a (k + 2) - 1 := congr_fun hc_eq_def (k + 1)
      have ha_ge2 : a (k + 2) ≥ 2 := hGe2 (k + 2)
      clear hG hGreedy; omega
      
    have h1 : a (k + 1) * a (k + 1) = c k * c k + 2 * c k + 1 := by
      rw [hac]
      ring
        
    have h2 : a (k + 1) * a (k + 1) - a (k + 1) = c k * c k + c k := by
      rw [h1, hac]
      have : c k * c k + 2 * c k + 1 = (c k * c k + c k) + (c k + 1) := by ring
      rw [this]
      exact Nat.add_sub_cancel (c k * c k + c k) (c k + 1)
      
    have h3 : a (k + 2) ≥ c k * c k + c k + 1 := by
      calc a (k + 2)
        _ ≥ a (k + 1) * a (k + 1) - a (k + 1) + 1 := hG
        _ = c k * c k + c k + 1 := by rw [h2]
        
    have h4 : c (k + 1) + 1 ≥ c k * c k + c k + 1 := by
      rw [← hac1]
      exact h3
      
    have h5 : c (k + 1) ≥ c k * c k + c k := by
      exact Nat.le_of_succ_le_succ h4
      
    have h6 : c k * c k + c k ≥ c k * c k - c k + 1 := by
      have h_sub : c k * c k ≥ c k := by
        have h_pos : c k ≥ 1 := by omega
        exact Nat.le_mul_of_pos_left (c k) h_pos
      have h_alg : c k * c k + c k = (c k * c k - c k + 1) + (2 * c k - 1) := by
        calc c k * c k + c k
          _ = c k * c k - c k + c k + c k := by rw [Nat.sub_add_cancel h_sub]
          _ = c k * c k - c k + 2 * c k := by ring
          _ = c k * c k - c k + 1 + (2 * c k - 1) := by
            have _h_2ck : 2 * c k ≥ 1 := by omega
            omega
      rw [h_alg]
      exact Nat.le_add_right (c k * c k - c k + 1) (2 * c k - 1)
      
    exact Nat.le_trans h6 h5

  obtain ⟨q_shift, h_q_shift⟩ : ∃ x : ℚ, x = q - (1 : ℚ) / ((a 0 : ℚ) - (1 : ℚ)) := ⟨_, rfl⟩

  have hc_sum : HasSum (fun k => (1 : ℝ) / (c k : ℝ)) ↑q_shift := by
    have h_eq : (fun k => (1 : ℝ) / (c k : ℝ)) = fun k => (1 : ℝ) / ((a (k + 1) : ℝ) - (1 : ℝ)) := by
      ext k
      have hc_def : c k = a (k + 1) - 1 := congr_fun hc_eq_def k
      have ha_ge1 : a (k + 1) ≥ 1 := by
        have : a (k + 1) ≥ 2 := hGe2 (k + 1)
        omega
      have h_cast_sub : (c k : ℝ) = (a (k + 1) : ℝ) - 1 := by
        have h_eq_nat : c k = a (k + 1) - 1 := hc_def
        zify [ha_ge1] at h_eq_nat
        exact_mod_cast h_eq_nat
      rw [h_cast_sub]
    rw [h_eq]
    
    have h_shift := hasSum_shift hSum
    have h_cast : (q_shift : ℝ) = (q : ℝ) - (1 : ℝ) / ((a 0 : ℝ) - (1 : ℝ)) := by
      have h_q_shift_eq : q_shift = q - (1 : ℚ) / ((a 0 : ℚ) - (1 : ℚ)) := h_q_shift
      rw [h_q_shift_eq]
      push_cast
      rfl
    rw [h_cast]
    exact h_shift

  have h_sylv : ∃ N : ℕ, ∀ n ≥ N, c (n + 1) + c n = c n * c n + 1 :=
    greedy_forces_sylvester_recurrence c q_shift hc_ge2 hc_sum hc_greedy

  obtain ⟨N, hN⟩ := h_sylv
  use N + 1
  intro n hn
  have hn_sub : n - 1 ≥ N := by clear hGreedy; omega
  have hN_apply := hN (n - 1) hn_sub
  have h_c_n1 : c (n - 1) = a n - 1 := by
    have h_def : c (n - 1) = a (n - 1 + 1) - 1 := congr_fun hc_eq_def (n - 1)
    have : n - 1 + 1 = n := by clear hGreedy; omega
    rw [this] at h_def
    exact h_def
  have h_c_n : c (n - 1 + 1) = a (n + 1) - 1 := by
    have h_def : c n = a (n + 1) - 1 := congr_fun hc_eq_def n
    have : n - 1 + 1 = n := by clear hGreedy; omega
    rw [this]
    exact h_def
  rw [← h_c_n, ← h_c_n1]
  exact hN_apply

/--
  **THE GREEDY REGIME OBSTRUCTION**
  
  There is no sequence of integers that satisfies all conditions of the Erdős 265 
  Ceiling Conjecture AND resides in the greedy regime.
-/
theorem greedy_erdos265_impossible (a : ℕ → ℕ)
    (h : Erdos265Sequence a)
    (hGreedy : IsGreedy a)
    (hDual : DualRational a) : False := by
  obtain ⟨hGe2, ⟨q₁, hSum1⟩⟩ := h
  obtain ⟨q₂, hSum2⟩ := hDual
  
  -- Primary lock-in: rational ∑ 1/aₖ → Sylvester recurrence
  rcases greedy_forces_sylvester_recurrence a q₁ hGe2 hSum1 hGreedy with ⟨N₁, hN₁⟩
  
  -- Dual lock-in: rational ∑ 1/(aₖ-1) → dual Sylvester recurrence
  rcases greedy_forces_dual_sylvester_recurrence a q₂ hGe2 hSum2 hGreedy with ⟨N₂, hN₂⟩
  
  -- Convert dual recurrence to explicit polynomial form
  have hDualRec : ∀ n ≥ N₂, a (n + 1) + 3 * a n = a n * a n + 4 :=
    fun n hn => shifted_seq_lockin a N₂ hN₂ (fun n _ => hGe2 n) n hn
    
  -- Combine at N = max N₁ N₂
  let N := max N₁ N₂
  exact dual_lockin_contradiction a N
    (fun n hn => hN₁ n (le_trans (le_max_left _ _) hn))
    (fun n hn => hDualRec n (le_trans (le_max_right _ _) hn))
