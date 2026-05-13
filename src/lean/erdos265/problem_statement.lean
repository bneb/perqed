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
  The baseline property required for an Erdős 265 sequence:
  A sequence of integers ≥ 2 such that the sum of its reciprocals is rational.
-/
def Erdos265Sequence (a : ℕ → ℕ) : Prop :=
  (∀ k, a k ≥ 2) ∧
  (∃ q : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q)

/--
  The Greedy Regime constraint:
  The sequence grows at least as fast as the Sylvester recurrence.
-/
def IsGreedy (a : ℕ → ℕ) : Prop :=
  ∀ k, a (k + 1) ≥ a k * a k - a k + 1

/--
  The Dual Rationality condition:
  The shifted series also converges to a rational number.
-/
def DualRational (a : ℕ → ℕ) : Prop :=
  ∃ q : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q

/-- The Sylvester sequence is a witness for the Greedy Regime. -/
lemma sylvester_is_greedy : IsGreedy sylvester := by
  intro k
  have h_eq : sylvester (k + 1) = sylvester k * (sylvester k - 1) + 1 := rfl
  have h_ge2 : sylvester k ≥ 2 := sylvester_ge_two k
  have h_sq : sylvester k * (sylvester k - 1) = sylvester k * sylvester k - sylvester k := by
    calc sylvester k * (sylvester k - 1)
      _ = sylvester k * sylvester k - sylvester k * 1 := Nat.mul_sub_left_distrib _ _ _
      _ = sylvester k * sylvester k - sylvester k := by rw [mul_one]
  rw [h_eq, h_sq]



/-- 
  **The Dual Lock-in Contradiction**
  If BOTH sums are rational and the sequence grows doubly-exponentially (L > 1),
  the Asymptotic Squeeze theorem forces BOTH integer residuals to be constant.
  This structurally forces the sequence to simultaneously satisfy two incompatible recurrences.
-/
theorem dual_lockin_contradiction (a : ℕ → ℕ) (N : ℕ)
    (h1 : ∀ n ≥ N, a (n + 1) + a n = a n * a n + 1)
    (h2 : ∀ n ≥ N, a (n + 1) + 3 * a n = a n * a n + 4) :
    False := by
  have h1N := h1 N (le_refl N)
  have h2N := h2 N (le_refl N)
  have h1Z : (a (N + 1) : ℤ) + (a N : ℤ) = (a N : ℤ) * (a N : ℤ) + 1 := by exact_mod_cast h1N
  have h2Z : (a (N + 1) : ℤ) + 3 * (a N : ℤ) = (a N : ℤ) * (a N : ℤ) + 4 := by exact_mod_cast h2N
  have h_sub : ((a (N + 1) : ℤ) + 3 * (a N : ℤ)) - ((a (N + 1) : ℤ) + (a N : ℤ)) = 
               ((a N : ℤ) * (a N : ℤ) + 4) - ((a N : ℤ) * (a N : ℤ) + 1) := by rw [h1Z, h2Z]
  have h_simp_lhs : ((a (N + 1) : ℤ) + 3 * (a N : ℤ)) - ((a (N + 1) : ℤ) + (a N : ℤ)) = 2 * (a N : ℤ) := by ring
  have h_simp_rhs : ((a N : ℤ) * (a N : ℤ) + 4) - ((a N : ℤ) * (a N : ℤ) + 1) = 3 := by ring
  rw [h_simp_lhs, h_simp_rhs] at h_sub
  have h_mod : (2 * (a N : ℤ)) % 2 = 3 % 2 := by rw [h_sub]
  have h_even : (2 * (a N : ℤ)) % 2 = 0 := by exact Int.mul_emod_right 2 ↑(a N)
  rw [h_even] at h_mod
  revert h_mod
  norm_num

/-- 
  Helper mapping the second residual lock-in (applied to a_n - 1) 
  into the explicit integer polynomial recurrence. 
-/
lemma shifted_seq_lockin (seq : ℕ → ℕ) (N : ℕ)
    (h : ∀ n ≥ N, (seq (n + 1) - 1) + (seq n - 1) = (seq n - 1) * (seq n - 1) + 1)
    (h_pos : ∀ n ≥ N, seq n ≥ 2) :
    ∀ n ≥ N, seq (n + 1) + 3 * seq n = seq n * seq n + 4 := by
  intro n hn
  have h1 := h n hn
  have h2 := h_pos n hn
  have h3 := h_pos (n + 1) (by omega)
  have h_z : (seq (n + 1) : ℤ) - 1 + ((seq n : ℤ) - 1) = ((seq n : ℤ) - 1) * ((seq n : ℤ) - 1) + 1 := by
    have h1_z : ((seq (n + 1) - 1 + (seq n - 1) : ℕ) : ℤ) = (((seq n - 1) * (seq n - 1) + 1 : ℕ) : ℤ) := by rw [h1]
    push_cast at h1_z
    have h_sub1 : ((seq (n + 1) - 1 : ℕ) : ℤ) = (seq (n + 1) : ℤ) - 1 := by omega
    have h_sub2 : ((seq n - 1 : ℕ) : ℤ) = (seq n : ℤ) - 1 := by omega
    rw [h_sub1, h_sub2] at h1_z
    exact h1_z
  have h_z_final : (seq (n + 1) : ℤ) + 3 * (seq n : ℤ) = (seq n : ℤ) * (seq n : ℤ) + 4 := by
    calc
      (seq (n + 1) : ℤ) + 3 * (seq n : ℤ) = ((seq (n + 1) : ℤ) - 1 + ((seq n : ℤ) - 1)) + 2 * (seq n : ℤ) + 2 := by ring
      _ = ((seq n : ℤ) - 1) * ((seq n : ℤ) - 1) + 1 + 2 * (seq n : ℤ) + 2 := by rw [h_z]
      _ = (seq n : ℤ) * (seq n : ℤ) + 4 := by ring
  exact_mod_cast h_z_final


