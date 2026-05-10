import Mathlib

open BigOperators

noncomputable def A_val (a : ℕ → ℕ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))

noncomputable def L_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  A_val a q₁ q₂ N / ((a N : ℝ) * ((a N : ℝ) - 1))

noncomputable def U_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  A_val a q₁ q₂ N / ((a N : ℝ) - 1)

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  0 -- placeholder

noncomputable def E_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  C_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ N
  
-- We want to prove:
-- E_M > U_M eventually.
