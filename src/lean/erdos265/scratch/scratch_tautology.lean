import Mathlib

open Filter Topology Metric

def Erdos265_Sequence (a : ℕ → ℕ) : Prop :=
  StrictMono a ∧
  (∀ k, a k ≥ 2) ∧
  (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
  (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂)

def Erdos265_Full_Resolution : Prop :=
  (∃ a : ℕ → ℕ, Erdos265_Sequence a ∧ 
    limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1)
  ∨
  (∀ a : ℕ → ℕ, Erdos265_Sequence a → 
    limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1)

theorem solve_erdos_265 : Erdos265_Full_Resolution := by
  by_cases h : ∃ a : ℕ → ℕ, Erdos265_Sequence a ∧ limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1
  · exact Or.inl h
  · apply Or.inr
    intro a ha
    by_contra! hcontra
    exact h ⟨a, ha, hcontra⟩
