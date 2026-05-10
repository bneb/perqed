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

noncomputable def L_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))

noncomputable def E_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  C_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ N

lemma C_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    C_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N - 
      (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
  sorry

lemma E_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    E_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ (N + 1) := by
  unfold E_val
  rw [C_recurrence_exact a p₁ p₂ q₁ q₂ N h_pos]
  
  -- We want to show:
  -- a_N(a_N-1) C_N - q_1 q_2 P_1 P_2 - L_{N+1} = a_N(a_N-1) (C_N - L_N) - L_{N+1}
  -- This reduces to: a_N(a_N-1) L_N = q_1 q_2 P_1 P_2
  -- By definition of L_N, L_N = q_1 q_2 P_1 P_2 / (a_N(a_N-1)).
  
  have h_aN_pos : (a N : ℝ) ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_aN_minus1_pos : (a N : ℝ) - 1 ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_denom : (a N : ℝ) * ((a N : ℝ) - 1) ≠ 0 := mul_ne_zero h_aN_pos h_aN_minus1_pos
  
  have h_L : (a N : ℝ) * ((a N : ℝ) - 1) * L_val a p₁ p₂ q₁ q₂ N = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
    unfold L_val
    have h_div : ((q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))) * ((a N : ℝ) * ((a N : ℝ) - 1)) = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := div_mul_cancel₀ _ h_denom
    calc
      (a N : ℝ) * ((a N : ℝ) - 1) * L_val a p₁ p₂ q₁ q₂ N = L_val a p₁ p₂ q₁ q₂ N * ((a N : ℝ) * ((a N : ℝ) - 1)) := mul_comm _ _
      _ = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := h_div
      
  linarith
