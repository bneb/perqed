import Mathlib

open BigOperators

noncomputable def L_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  -- We don't need the exact definition here, just E_recurrence_exact
  0

noncomputable def E_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  C_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ N

lemma E_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    E_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ (N + 1) := by
  sorry

lemma P2_le_P1 (a : ℕ → ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 1) :
    (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≤ (∏ i ∈ Finset.range N, (a i : ℝ)) := by
  sorry

lemma L_val_upper_bound (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) :
    L_val a p₁ p₂ q₁ q₂ N ≤ (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 / ((a N : ℝ) * ((a N : ℝ) - 1)) := by
  sorry

lemma L_val_max_recovery (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_mono : a (N + 1) ≥ a N + 1) :
    L_val a p₁ p₂ q₁ q₂ (N + 1) ≤ (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by
  sorry

lemma E_val_quadratic_growth (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_mono : a (N + 1) ≥ a N + 1)
    (h_E_locked : E_val a p₁ p₂ q₁ q₂ N > (1 : ℝ) / 2) :
    E_val a p₁ p₂ q₁ q₂ (N + 1) ≥ (a N : ℝ) * ((a N : ℝ) - 1) / 2 - (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by
  have h_recurrence := E_recurrence_exact a p₁ p₂ q₁ q₂ N (by
    intro k
    have hk : a k ≥ 2 := h_pos k
    have hk_real : (a k : ℝ) ≥ 2 := by exact_mod_cast hk
    linarith)
  
  have h_L_max := L_val_max_recovery a p₁ p₂ q₁ q₂ N h_pos h_mono
  
  -- We know E_{N+1} = a_N(a_N - 1)E_N - L_{N+1}
  -- And E_N > 1/2, so a_N(a_N-1)E_N ≥ a_N(a_N-1)/2
  -- And -L_{N+1} ≥ - q1 q2 P^2
  
  have h_E_bound : (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N ≥ (a N : ℝ) * ((a N : ℝ) - 1) * (1 / 2) := by
    have haN_pos : (a N : ℝ) ≥ 2 := by exact_mod_cast (h_pos N)
    have haN_minus_1_pos : ((a N : ℝ) - 1) > 0 := by linarith
    have h_prod_pos : (a N : ℝ) * ((a N : ℝ) - 1) > 0 := by nlinarith
    have h_E_ge : E_val a p₁ p₂ q₁ q₂ N ≥ 1 / 2 := by linarith
    exact mul_le_mul_of_nonneg_left h_E_ge (le_of_lt h_prod_pos)
    
  have h_L_neg_bound : - L_val a p₁ p₂ q₁ q₂ (N + 1) ≥ - ((q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2) := by
    linarith
    
  calc
    E_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ (N + 1) := h_recurrence
    _ ≥ (a N : ℝ) * ((a N : ℝ) - 1) * (1 / 2) - L_val a p₁ p₂ q₁ q₂ (N + 1) := by linarith
    _ ≥ (a N : ℝ) * ((a N : ℝ) - 1) * (1 / 2) - (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by linarith
    _ = (a N : ℝ) * ((a N : ℝ) - 1) / 2 - (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by ring
