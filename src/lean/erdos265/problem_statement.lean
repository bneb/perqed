import Mathlib

/-!
# Erdős 265: Formal Problem Statement and Definitions

This file defines the Sylvester sequence and formally states the Erdős 265
Ceiling Conjecture, providing the ground truth that all other files must
connect back to.

## The Sylvester Sequence
  s₀ = 2, s₁ = 3, s₂ = 7, s₃ = 43, s₄ = 1807, ...
  s_{n+1} = s_n · (s_n - 1) + 1

## Erdős 265 Ceiling Conjecture
  limsup (s_k)^{1/2^k} ≤ e    (where e = exp 1)

Equivalently (via the Sylvester–Erdős identity):
  ∑_{k=0}^∞ 1/s_k is irrational.
-/

open Filter Topology

noncomputable section

/-- The Sylvester sequence: s₀ = 2, s_{n+1} = s_n(s_n - 1) + 1 -/
def sylvester : ℕ → ℕ
  | 0 => 2
  | n + 1 => sylvester n * (sylvester n - 1) + 1

/-- The Sylvester sequence starts at 2. -/
@[simp] lemma sylvester_zero : sylvester 0 = 2 := rfl

/-- First few values. -/
@[simp] lemma sylvester_one : sylvester 1 = 3 := by native_decide
@[simp] lemma sylvester_two : sylvester 2 = 7 := by native_decide
@[simp] lemma sylvester_three : sylvester 3 = 43 := by native_decide
@[simp] lemma sylvester_four : sylvester 4 = 1807 := by native_decide

/-- Every term of the Sylvester sequence is ≥ 2. -/
lemma sylvester_ge_two (n : ℕ) : sylvester n ≥ 2 := by
  induction n with
  | zero => simp [sylvester]
  | succ n ih =>
    simp only [sylvester]
    have h1 : sylvester n ≥ 2 := ih
    have h2 : sylvester n - 1 ≥ 1 := by omega
    have h3 : sylvester n * (sylvester n - 1) ≥ 2 * 1 := Nat.mul_le_mul h1 h2
    omega

/-- 
  The baseline properties required for an Erdős 265 sequence:
  A strictly increasing sequence of integers ≥ 2 such that
  both ∑ 1/aₖ and ∑ 1/(aₖ - 1) converge to rational numbers.
-/
def Erdos265_Sequence (a : ℕ → ℕ) : Prop :=
  StrictMono a ∧
  (∀ k, a k ≥ 2) ∧
  (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
  (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂)

/--
  **Erdős 265 Ceiling Conjecture (Formal Statement)**

  Every Erdős 265 sequence satisfies limsup a_k^{1/2^k} ≤ 1.

  **Status**: Open. This is the target theorem. All other files in this
  directory contribute partial results toward this goal.
-/
theorem erdos_265 :
    ∀ a : ℕ → ℕ, Erdos265_Sequence a →
      limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  sorry

end
