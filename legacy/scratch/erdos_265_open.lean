import Mathlib

open Filter Topology Finset

def IsErdos265Seq (a : ℕ → ℕ) : Prop :=
  (∀ n, a n < a (n + 1)) ∧
  (∃ q₁ : ℚ, Tendsto (fun N => ∑ i ∈ range N, (1 : ℝ) / (a i : ℝ)) atTop (𝓝 (q₁ : ℝ))) ∧
  (∃ q₂ : ℚ, Tendsto (fun N => ∑ i ∈ range N, (1 : ℝ) / ((a i : ℝ) - 1)) atTop (𝓝 (q₂ : ℝ)))

def Erdos265_OpenQuestion : Prop :=
  ∃ (a : ℕ → ℕ), IsErdos265Seq a ∧ limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / (2 ^ n : ℝ))) atTop > 1
