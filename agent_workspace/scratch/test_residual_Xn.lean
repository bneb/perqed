import Mathlib

open Filter Topology BigOperators

noncomputable section

def prefixProduct (seq : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prefixProduct seq n * seq n

lemma prefixProduct_pos (seq : ℕ → ℕ) (hPos : ∀ k, seq k > 0) : ∀ n, prefixProduct seq n > 0
  | 0 => by decide
  | n + 1 => mul_pos (prefixProduct_pos seq hPos n) (hPos n)

def tailResidual (seq : ℕ → ℕ) (num denom : ℕ) : ℕ → ℤ
  | 0 => (num : ℤ)
  | n + 1 => (seq n : ℤ) * tailResidual seq num denom n - 
             (denom : ℤ) * (prefixProduct seq n : ℤ)

lemma nonpos_of_tendsto_zero_and_nonincr (X : ℕ → ℝ) (h_tendsto : Tendsto X atTop (𝓝 0))
    (h_nonincr : ∀ n, X (n + 1) ≤ X n) :
    ∀ n, 0 ≤ X n := by
  intro n
  by_contra h_neg
  push_neg at h_neg
  have h_bound : ∀ m, n ≤ m → X m ≤ X n := by
    intro m
    induction m with
    | zero => 
      intro hn
      have : n = 0 := by omega
      subst this; exact le_refl _
    | succ p ih =>
      intro hn
      by_cases hp : n ≤ p
      · exact le_trans (h_nonincr p) (ih hp)
      · have : p + 1 = n := by omega
        subst this; exact le_refl _
  have h_eps : ∃ N, ∀ m ≥ N, |X m - 0| < -(X n) / 2 := by
    have h1 : -(X n) / 2 > 0 := by linarith
    have h2 := Metric.tendsto_atTop.mp h_tendsto (-(X n) / 2) h1
    exact h2
  rcases h_eps with ⟨N, hN⟩
  have h_max := max n N
  have h_max_n : n ≤ h_max := le_max_left n N
  have h_max_N : N ≤ h_max := le_max_right n N
  have h3 := hN h_max h_max_N
  have h4 := h_bound h_max h_max_n
  rw [sub_zero] at h3
  have h5 : X h_max < 0 := by linarith
  have h6 : |X h_max| = -(X h_max) := abs_of_neg h5
  rw [h6] at h3
  linarith

lemma tailResidual_eventually_nonincreasing (seq : ℕ → ℕ) (num denom : ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2) (hDenom : denom ≥ 1)
    (hTendstoRes : Tendsto (fun n => (tailResidual seq num denom n : ℝ) / (denom * prefixProduct seq n : ℝ)) atTop (𝓝 0))
    (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1) :
    ∀ n, tailResidual seq num denom (n + 1) ≤ tailResidual seq num denom n := by
  let X := fun n => 1 / ((seq n : ℝ) - 1) - (tailResidual seq num denom n : ℝ) / (denom * prefixProduct seq n : ℝ)
  
  have h_tendsto_X : Tendsto X atTop (𝓝 0) := by
    have h_tendsto_inv : Tendsto (fun n => 1 / ((seq n : ℝ) - 1)) atTop (𝓝 0) := sorry
    have : Tendsto X atTop (𝓝 (0 - 0)) := Tendsto.sub h_tendsto_inv hTendstoRes
    rw [sub_zero] at this
    exact this
    
  have h_nonincr : ∀ n, X (n + 1) ≤ X n := by
    intro n
    have ha : (seq n : ℝ) ≥ 2 := by exact_mod_cast hGe2 n
    have ha_succ : (seq (n + 1) : ℝ) ≥ (seq n : ℝ) * (seq n : ℝ) - (seq n : ℝ) + 1 := by exact_mod_cast hGreedy n
    have h_pos : ∀ k, seq k > 0 := by intro k; have := hGe2 k; omega
    have h_pn : (prefixProduct seq n : ℝ) > 0 := by exact_mod_cast prefixProduct_pos seq h_pos n
    have h_pn1 : (prefixProduct seq (n + 1) : ℝ) = (prefixProduct seq n : ℝ) * (seq n : ℝ) := by
      have : prefixProduct seq (n + 1) = prefixProduct seq n * seq n := rfl
      exact_mod_cast this
    
    have h_T_rec : (tailResidual seq num denom (n + 1) : ℝ) = (seq n : ℝ) * (tailResidual seq num denom n : ℝ) - (denom : ℝ) * (prefixProduct seq n : ℝ) := by
      have : tailResidual seq num denom (n + 1) = (seq n : ℤ) * tailResidual seq num denom n - (denom : ℤ) * (prefixProduct seq n : ℤ) := rfl
      exact_mod_cast this
    
    -- Now compute X n - X (n+1)
    sorry
  
  have h_X_nonpos := nonpos_of_tendsto_zero_and_nonincr X h_tendsto_X h_nonincr
  intro n
  have hXn := h_X_nonpos n
  -- X n >= 0 means 1/(a_n - 1) >= T_n / (denom * P_n)
  -- so T_n * (a_n - 1) <= denom * P_n
  -- so T_{n+1} <= T_n
  sorry

end
