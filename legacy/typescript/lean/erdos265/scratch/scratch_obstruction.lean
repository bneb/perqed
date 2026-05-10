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
  sorry

lemma universal_balance_contradiction (X Y : ℤ) (hX : X ≥ 2) :
    Y^2 - Y ≠ X^2 - X + 1 := by
  sorry

theorem erdos_265_algebraic_obstruction (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) 
    (hq1 : (q₁ : ℝ) > 0)
    (hq2 : (q₂ : ℝ) > 0)
    (h_C_const : ∃ c : ℝ, ∀ M ≥ N, C_val a p₁ p₂ q₁ q₂ M = c) :
    False := by
  rcases h_C_const with ⟨c, hc⟩
  
  have h_CN := hc N (by rfl)
  have h_CN1 := hc (N + 1) (by linarith)
  have h_CN2 := hc (N + 2) (by linarith)
  
  have h_recur1 := C_recurrence_exact a p₁ p₂ q₁ q₂ N h_pos
  have h_recur2 := C_recurrence_exact a p₁ p₂ q₁ q₂ (N + 1) h_pos
  
  rw [h_CN, h_CN1] at h_recur1
  rw [h_CN1, h_CN2] at h_recur2
  
  set P_1_N := ∏ i ∈ Finset.range N, (a i : ℝ)
  set P_2_N := ∏ i ∈ Finset.range N, ((a i : ℝ) - 1)
  set X_R := (a N : ℝ) * ((a N : ℝ) - 1)
  set Y_R := (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1)
  
  have h_P1_pos : P_1_N > 0 := by
    apply Finset.prod_pos
    intro i hi
    have h1 := h_pos i
    linarith
  have h_P2_pos : P_2_N > 0 := by
    apply Finset.prod_pos
    intro i hi
    have h1 := h_pos i
    linarith
    
  have h_A_pos : (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N > 0 := by positivity
  
  have h_eq1 : c = X_R * c - (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N := h_recur1
  
  have hP1_succ : (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) = P_1_N * (a N : ℝ) := Finset.prod_range_succ _ _
  have hP2_succ : (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = P_2_N * ((a N : ℝ) - 1) := Finset.prod_range_succ _ _
  
  have h_eq2_sub : (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) * (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = 
    ((q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N) * X_R := by
    rw [hP1_succ, hP2_succ]
    ring
    
  have h_eq2 : c = Y_R * c - ((q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N) * X_R := by
    rw [h_eq2_sub] at h_recur2
    exact h_recur2
    
  have h_A : (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N = X_R * c - c := by linarith
  have h_A2 : ((q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N) * X_R = Y_R * c - c := by linarith
  
  have h_subst : (X_R * c - c) * X_R = Y_R * c - c := by rw [←h_A, h_A2]
  
  have h_c_ne_0 : c ≠ 0 := by
    intro hc0
    rw [hc0] at h_A
    have h_0 : (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N = 0 := by linarith
    linarith
    
  have h_alg : (X_R - 1) * X_R * c = (Y_R - 1) * c := by
    calc
      (X_R - 1) * X_R * c = (X_R * c - c) * X_R := by ring
      _ = Y_R * c - c := h_subst
      _ = (Y_R - 1) * c := by ring
      
  have h_XY : (X_R - 1) * X_R = Y_R - 1 := by
    exact mul_right_cancel₀ h_c_ne_0 h_alg
    
  have h_XY_eq : Y_R = X_R^2 - X_R + 1 := by
    calc
      Y_R = (X_R - 1) * X_R + 1 := by linarith
      _ = X_R^2 - X_R + 1 := by ring
      
  let X_Z : ℤ := (a N : ℤ) * ((a N : ℤ) - 1)
  let Y_Z : ℤ := (a (N + 1) : ℤ)
  
  have h_X_eq : X_R = (X_Z : ℝ) := by
    dsimp only [X_Z]
    push_cast
    rfl
  have h_Y_eq : Y_R = (Y_Z : ℝ)^2 - (Y_Z : ℝ) := by
    dsimp only [Y_Z]
    push_cast
    ring
      
  have h_XY_Z_real : (Y_Z : ℝ)^2 - (Y_Z : ℝ) = (X_Z : ℝ)^2 - (X_Z : ℝ) + 1 := by
    rw [←h_Y_eq, ←h_X_eq]
    exact h_XY_eq
    
  have h_XY_Z : Y_Z^2 - Y_Z = X_Z^2 - X_Z + 1 := by
    exact_mod_cast h_XY_Z_real
    
  have h_X_Z_ge_2 : X_Z ≥ 2 := by
    have ha_pos : (a N : ℤ) ≥ 2 := by
      have h1 := h_pos N
      norm_cast at h1
      exact_mod_cast h1
    nlinarith
    
  have h_contra := universal_balance_contradiction X_Z Y_Z h_X_Z_ge_2
  exact h_contra h_XY_Z
