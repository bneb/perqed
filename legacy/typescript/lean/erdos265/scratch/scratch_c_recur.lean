import Mathlib

open BigOperators Finset

noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

noncomputable def R_shift_sc (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (R_shift_sc a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
  (q₂ : ℝ) * (R₁_sc a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))

lemma C_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    C_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N - 
      (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
  unfold C_val R_shift_sc R₁_sc
  
  have hP1 : (∏ i ∈ range (N + 1), (a i : ℝ)) = (∏ i ∈ range N, (a i : ℝ)) * (a N : ℝ) := prod_range_succ _ _
  have hP2 : (∏ i ∈ range (N + 1), ((a i : ℝ) - 1)) = (∏ i ∈ range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1) := prod_range_succ _ _
  
  have hS1 : (∑ i ∈ range (N + 1), (1 : ℝ) / (a i : ℝ)) = (∑ i ∈ range N, (1 : ℝ) / (a i : ℝ)) + 1 / (a N : ℝ) := sum_range_succ _ _
  have hS2 : (∑ i ∈ range (N + 1), (1 : ℝ) / ((a i : ℝ) - 1)) = (∑ i ∈ range N, (1 : ℝ) / ((a i : ℝ) - 1)) + 1 / ((a N : ℝ) - 1) := sum_range_succ _ _
  
  set P1 := ∏ i ∈ range N, (a i : ℝ)
  set P2 := ∏ i ∈ range N, ((a i : ℝ) - 1)
  set S1 := ∑ i ∈ range N, (1 : ℝ) / (a i : ℝ)
  set S2 := ∑ i ∈ range N, (1 : ℝ) / ((a i : ℝ) - 1)
  
  have h_aN_pos : (a N : ℝ) ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_aN_minus1_pos : (a N : ℝ) - 1 ≠ 0 := by
    have h1 := h_pos N
    linarith
    
  have h1 : C_val a p₁ p₂ q₁ q₂ (N + 1) = 
    (q₁ : ℝ) * ((q₂ : ℝ) * (P2 * ((a N : ℝ) - 1)) * (↑p₂ / ↑q₂ - (S2 + 1 / ((a N : ℝ) - 1)))) * (P1 * (a N : ℝ)) -
    (q₂ : ℝ) * ((q₁ : ℝ) * (P1 * (a N : ℝ)) * (↑p₁ / ↑q₁ - (S1 + 1 / (a N : ℝ)))) * (P2 * ((a N : ℝ) - 1)) := by
    unfold C_val R_shift_sc R₁_sc
    rw [hP1, hP2, hS1, hS2]
    
  have h2 : (q₁ : ℝ) * ((q₂ : ℝ) * (P2 * ((a N : ℝ) - 1)) * (↑p₂ / ↑q₂ - (S2 + 1 / ((a N : ℝ) - 1)))) * (P1 * (a N : ℝ)) =
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2)) - 
    (q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (a N : ℝ) * (((a N : ℝ) - 1) / ((a N : ℝ) - 1)) := by ring
    
  have h3 : (q₂ : ℝ) * ((q₁ : ℝ) * (P1 * (a N : ℝ)) * (↑p₁ / ↑q₁ - (S1 + 1 / (a N : ℝ)))) * (P2 * ((a N : ℝ) - 1)) =
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
    (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * ((a N : ℝ) - 1) * ((a N : ℝ) / (a N : ℝ)) := by ring
    
  have h4 : ((a N : ℝ) - 1) / ((a N : ℝ) - 1) = 1 := div_self h_aN_minus1_pos
  have h5 : (a N : ℝ) / (a N : ℝ) = 1 := div_self h_aN_pos
  
  have h6 : C_val a p₁ p₂ q₁ q₂ (N + 1) = 
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2)) - 
    (q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (a N : ℝ) * 1 -
    ((a N : ℝ) * ((a N : ℝ) - 1) * ((q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
    (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * ((a N : ℝ) - 1) * 1) := by
    rw [h1, h2, h3, h4, h5]
    
  have h7 : (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N = 
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2) - (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) := by
    unfold C_val R_shift_sc R₁_sc
    ring
    
  calc
    C_val a p₁ p₂ q₁ q₂ (N + 1) = 
      (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2)) - 
      (q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (a N : ℝ) -
      ((a N : ℝ) * ((a N : ℝ) - 1) * ((q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
      (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * ((a N : ℝ) - 1)) := by rw [h6]; ring
    _ = (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2) - (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
        (q₁ : ℝ) * (q₂ : ℝ) * P1 * P2 := by ring
    _ = (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N - (q₁ : ℝ) * (q₂ : ℝ) * P1 * P2 := by rw [←h7]
