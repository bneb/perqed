import Mathlib

open Filter Topology Finset

noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

noncomputable def R_shift_sc (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (R_shift_sc a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
  (q₂ : ℝ) * (R₁_sc a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))

noncomputable def L_val (a : ℕ → ℕ) (q₁ q₂ : ℝ) (N : ℕ) : ℝ :=
  q₁ * q₂ * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))

noncomputable def U_val (a : ℕ → ℕ) (q₁ q₂ : ℝ) (N : ℕ) : ℝ :=
  q₁ * q₂ * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) - 1)

noncomputable def E_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  C_val a p₁ p₂ q₁ q₂ N - L_val a q₁ q₂ N

lemma U_recurrence_greedy (a : ℕ → ℕ) (q₁ q₂ : ℝ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (h_greedy : (a (N + 1) : ℝ) = (a N : ℝ) * ((a N : ℝ) - 1) + 1) :
    U_val a q₁ q₂ (N + 1) = U_val a q₁ q₂ N * ((a N : ℝ) - 1) := by
  unfold U_val
  have h_prod1 : ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := 
    prod_range_succ _ _
  have h_prod2 : ∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1) = (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1) := 
    prod_range_succ _ _
  rw [h_prod1, h_prod2]
  have haN_real : (a N : ℝ) ≠ 0 := by have := h_pos N; linarith
  have haN1_real : (a N : ℝ) - 1 ≠ 0 := by have := h_pos N; linarith
  

  have h_denom : (a (N + 1) : ℝ) - 1 = (a N : ℝ) * ((a N : ℝ) - 1) := by linarith
  rw [h_denom]
  
  -- q₁ * q₂ * (P1 * a_N) * (P2 * (a_N - 1)) / (a_N * (a_N - 1)) = q₁ * q₂ * P1 * P2 / (a_N - 1) * (a_N - 1)
  have h_left : q₁ * q₂ * ((∏ i ∈ range N, (a i : ℝ)) * ↑(a N)) * ((∏ i ∈ range N, (↑(a i) - 1)) * (↑(a N) - 1)) / (↑(a N) * (↑(a N) - 1)) =
    q₁ * q₂ * (∏ i ∈ range N, (a i : ℝ)) * (∏ i ∈ range N, (↑(a i) - 1)) := by
    calc q₁ * q₂ * ((∏ i ∈ range N, (a i : ℝ)) * ↑(a N)) * ((∏ i ∈ range N, (↑(a i) - 1)) * (↑(a N) - 1)) / (↑(a N) * (↑(a N) - 1))
      _ = (q₁ * q₂ * (∏ i ∈ range N, (a i : ℝ)) * (∏ i ∈ range N, (↑(a i) - 1))) * (↑(a N) * (↑(a N) - 1)) / (↑(a N) * (↑(a N) - 1)) := by ring
      _ = q₁ * q₂ * (∏ i ∈ range N, (a i : ℝ)) * (∏ i ∈ range N, (↑(a i) - 1)) := by
        exact mul_div_cancel_right₀ _ (mul_ne_zero haN_real haN1_real)
        
  have h_right : q₁ * q₂ * (∏ i ∈ range N, ↑(a i)) * (∏ i ∈ range N, (↑(a i) - 1)) / (↑(a N) - 1) * (↑(a N) - 1) =
    q₁ * q₂ * (∏ i ∈ range N, (a i : ℝ)) * (∏ i ∈ range N, (↑(a i) - 1)) := by
    exact div_mul_cancel₀ _ haN1_real
    
  rw [h_left, h_right]

lemma C_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    C_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N - 
      (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
  sorry

lemma E_recurrence_greedy (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (h_greedy : (a (N + 1) : ℝ) = (a N : ℝ) * ((a N : ℝ) - 1) + 1) :
    E_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N - L_val a q₁ q₂ (N + 1) := by
  sorry
