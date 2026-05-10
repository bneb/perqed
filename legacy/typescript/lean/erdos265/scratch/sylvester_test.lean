import Mathlib

open Filter Topology Finset

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

noncomputable def R₁ (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N

theorem R1_from_waste (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha : (a k : ℝ) ≠ 0) :
    R₁ a S q₁ (k + 1) =
      (waste' a S k - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
  unfold R₁ waste' tail_sum'
  rw [Finset.prod_range_succ, Finset.sum_range_succ]
  have h1 : (a k : ℝ) * (1 / (a k : ℝ)) = 1 := mul_one_div_cancel ha
  calc
    (q₁ : ℝ) * ((∏ i ∈ Finset.range k, (a i : ℝ)) * (a k : ℝ)) * (S - (∑ i ∈ Finset.range k, 1 / (a i : ℝ) + 1 / (a k : ℝ)))
      = (q₁ : ℝ) * (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - (a k : ℝ) * (1 / (a k : ℝ))) := by ring
    _ = (q₁ : ℝ) * (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - 1) := by rw [h1]
    _ = ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by ring

lemma constant_R1_forces_Sylvester (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (M : ℕ) (R : ℝ)
    (ha_pos : ∀ m, (a m : ℝ) > 0)
    (hR_pos : R > 0)
    (h_const : ∀ m ≥ M, R₁ a S q₁ m = R) :
    ∀ k ≥ M, (a (k + 1) : ℝ) = (a k : ℝ) * ((a k : ℝ) - 1) + 1 := by
  intro k hk
  have hRk : R₁ a S q₁ k = R := h_const k hk
  have hRk1 : R₁ a S q₁ (k + 1) = R := h_const (k + 1) (by linarith)
  have hRk2 : R₁ a S q₁ (k + 2) = R := h_const (k + 2) (by linarith)
  have ha_neq : (a k : ℝ) ≠ 0 := ne_of_gt (ha_pos k)
  have ha1_neq : (a (k + 1) : ℝ) ≠ 0 := ne_of_gt (ha_pos (k + 1))
  
  have step1 := R1_from_waste a S q₁ k ha_neq
  have step2 := R1_from_waste a S q₁ (k + 1) ha1_neq
  
  unfold waste' at step1 step2
  have hw1 : (a k : ℝ) * tail_sum' a S k * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
    calc
      (a k : ℝ) * tail_sum' a S k * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) = 
      ((a k : ℝ) * tail_sum' a S k - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by ring
      _ = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by rw [← step1]
      
  -- Let P_k = (q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)
  -- a_k * tail_k * P_k = a_k * R1(k)
  -- Because R1(k) = P_k * tail_k
  have ht_P : R₁ a S q₁ k = ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) * tail_sum' a S k := by
    unfold R₁; ring
  have ha_R : (a k : ℝ) * R₁ a S q₁ k = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
    calc
      (a k : ℝ) * R₁ a S q₁ k = (a k : ℝ) * tail_sum' a S k * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by rw [ht_P]; ring
      _ = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := hw1
  
  rw [hRk, hRk1] at ha_R
  -- R * a_k = R + P_k
  -- P_k = R * (a_k - 1)
  have hPk : ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) = R * ((a k : ℝ) - 1) := by linarith
  
  -- Now same for k+1:
  have ht_P1 : R₁ a S q₁ (k + 1) = ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) * tail_sum' a S (k + 1) := by
    unfold R₁; ring
  have hw2 : (a (k + 1) : ℝ) * tail_sum' a S (k + 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by
    calc
      (a (k + 1) : ℝ) * tail_sum' a S (k + 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = 
      ((a (k + 1) : ℝ) * tail_sum' a S (k + 1) - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by ring
      _ = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by rw [← step2]
      
  have ha_R1 : (a (k + 1) : ℝ) * R₁ a S q₁ (k + 1) = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by
    calc
      (a (k + 1) : ℝ) * R₁ a S q₁ (k + 1) = (a (k + 1) : ℝ) * tail_sum' a S (k + 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by rw [ht_P1]; ring
      _ = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := hw2
      
  rw [hRk1, hRk2] at ha_R1
  have hPk1 : ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = R * ((a (k + 1) : ℝ) - 1) := by linarith
  
  -- We know P_{k+1} = P_k * a_k
  have hPk1_def : ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) * (a k : ℝ) := by
    rw [Finset.prod_range_succ]
    ring
    
  rw [hPk, hPk1] at hPk1_def
  -- R * (a_{k+1} - 1) = R * (a_k - 1) * a_k
  have h_div : (a (k + 1) : ℝ) - 1 = (a k : ℝ) * ((a k : ℝ) - 1) := by
    have hr : R ≠ 0 := ne_of_gt hR_pos
    calc
      (a (k + 1) : ℝ) - 1 = R * ((a (k + 1) : ℝ) - 1) / R := by rw [mul_div_cancel_left₀ _ hr]
      _ = R * ((a k : ℝ) - 1) * (a k : ℝ) / R := by rw [hPk1_def]
      _ = R * ((a k : ℝ) * ((a k : ℝ) - 1)) / R := by ring
      _ = (a k : ℝ) * ((a k : ℝ) - 1) := by rw [mul_div_cancel_left₀ _ hr]
      
  linarith
