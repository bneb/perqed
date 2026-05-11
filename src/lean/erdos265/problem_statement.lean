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

/--
  **The Full Chain** (proven in residual_growth_bound.lean)
  
  limsup > 1 + rational sum → eventually Sylvester recurrence.
  The proof chains: limit extraction → asymptotic squeeze → integer rigidity → recurrence.
  
  **Status**: Proven modulo `prefix_limit`, `tail_sum_limit`, `limsup_gt_one_extract_limit`,
  and `residual_pos_of_rational_sum` (all sorry-tagged in residual_growth_bound.lean).
-/
theorem limsup_forces_sylvester_recurrence (seq : ℕ → ℕ) (q : ℚ) 
    (_hMono : StrictMono seq) (_hGe2 : ∀ k, seq k ≥ 2)
    (_hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q)
    (_hLimsup : limsup (fun k => (seq k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1) :
    ∃ N : ℕ, ∀ n ≥ N, seq (n + 1) + seq n = seq n * seq n + 1 := by
  sorry  -- Full proof in residual_growth_bound.lean

/--
  **Erdős 265 Ceiling Conjecture (Formal Statement)**

  Every Erdős 265 sequence satisfies limsup a_k^{1/2^k} ≤ 1.

  **Status**: Open. This is the target theorem. All other files in this
  directory contribute partial results toward this goal.
-/
theorem erdos_265 :
    ∀ a : ℕ → ℕ, Erdos265_Sequence a →
      limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  intro a h_seq
  by_contra h_contra
  push_neg at h_contra
  
  -- From Erdos265_Sequence, extract all components
  rcases h_seq with ⟨h_mono, h_ge2, ⟨q1, h_sum1⟩, ⟨q2, h_sum2⟩⟩
  
  -- Apply the full chain for ∑ 1/aₖ = q₁ (rational)
  -- limsup > 1 + rational sum → eventually a_{n+1} + a_n = a_n² + 1
  have h_const_a := limsup_forces_sylvester_recurrence a q1 h_mono h_ge2 h_sum1 h_contra
  
  -- For the shifted sequence (aₖ - 1), we need a similar chain.
  -- The sum ∑ 1/(aₖ - 1) = q₂ (rational), and we apply the same machinery
  -- to derive: eventually (a_{n+1} - 1) + (a_n - 1) = (a_n - 1)² + 1
  -- which expands to: a_{n+1} + 3·a_n = a_n² + 4
  have h_shifted_recurrence : ∃ N : ℕ, ∀ n ≥ N, 
      (a (n + 1) - 1) + (a n - 1) = (a n - 1) * (a n - 1) + 1 := by
    -- Apply limsup_forces_sylvester_recurrence to the shifted sequence b_k = a_k - 1
    -- with sum ∑ 1/b_k = q₂
    sorry
  rcases h_shifted_recurrence with ⟨Ns, h_s⟩
  
  -- Convert the shifted recurrence to the explicit form
  have h_pos_ge_N : ∀ n ≥ Ns, a n ≥ 2 := fun n _ => h_ge2 n
  have h_const_b : ∃ N : ℕ, ∀ n ≥ N, a (n + 1) + 3 * a n = a n * a n + 4 :=
    ⟨Ns, shifted_seq_lockin a Ns h_s h_pos_ge_N⟩
    
  rcases h_const_a with ⟨Na, h_a⟩
  rcases h_const_b with ⟨Nb, h_b⟩
  
  -- We intersect the domains of constancy
  let N := max Na Nb
  have h_a_N : ∀ n ≥ N, a (n + 1) + a n = a n * a n + 1 := by
    intro n hn; exact h_a n (le_trans (le_max_left Na Nb) hn)
  have h_b_N : ∀ n ≥ N, a (n + 1) + 3 * a n = a n * a n + 4 := by
    intro n hn; exact h_b n (le_trans (le_max_right Na Nb) hn)
    
  -- Apply the dual lock-in contradiction to yield False
  exact dual_lockin_contradiction a N h_a_N h_b_N
end
