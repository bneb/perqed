import Mathlib

open Filter Topology Finset

/-!
# Erdős Problem 265: The Kovač-Tao Affirmative Construction

This file formalizes the "Floor" of the Erdős 265 problem. 
We implement the Iterative Approximation framework from Kovač and Tao (2024).
-/

-- ============================================================================
-- Section 1: Banach Space Fixed Point (Prop 1)
-- ============================================================================

/-- 
Kovač-Tao Proposition 1: Banach Space Iterative Approximation.
If T is a contraction on a Banach space, it has a unique fixed point.
-/
lemma kovac_tao_prop_1 {X : Type*} [NormedAddCommGroup X] [NormedSpace ℝ X] [CompleteSpace X]
  (T : X →L[ℝ] X) (v : X) (h_rho : spectralRadius ℝ T < 1) :
  ∃! x : X, T x + v = x := by
  -- Use the Contraction Mapping Theorem / Banach Fixed Point Theorem
  -- Mathlib provides this via `exists_fixed_point_of_spectralRadius_lt_one` 
  -- or we can use the Neumann Series directly.
  
  let I : X →L[ℝ] X := ContinuousLinearMap.id ℝ X
  -- If spectralRadius T < 1, then (I - T) is invertible.
  -- In Mathlib: `ContinuousLinearMap.isUnit_id_sub_of_spectralRadius_lt_one`
  -- Wait, name might be slightly different in this version.
  
  -- Let's use the explicit existence from Mathlib's fixed point library if available,
  -- or the Units of the algebra.
  have h_inv : IsUnit (I - T) := sorry -- placeholder for correct lemma name
  
  let A := I - T
  let x := h_inv.unit.inv v
  
  use x
  constructor
  · -- Prove Tx + v = x
    have h1 : A x = v := by
      dsimp [x, A]
      simp only [IsUnit.unit_spec, Units.inv_mul_cancel_right]
    -- (I - T) x = v  =>  x - Tx = v  =>  x = Tx + v
    rw [ContinuousLinearMap.sub_apply, ContinuousLinearMap.id_apply] at h1
    rw [← h1]
    ring
  · -- Uniqueness
    intro y hy
    have h2 : A y = v := by
      rw [show A = I - T from rfl]
      rw [ContinuousLinearMap.sub_apply, ContinuousLinearMap.id_apply]
      rw [← hy]
      ring
    -- A is injective because it is a Unit
    exact h_inv.unit.inj (by rw [IsUnit.unit_spec, h2]; rfl)

-- ============================================================================
-- Section 2: The "Lossy" Recurrence
-- ============================================================================

/-- 
The "Twilight Zone" Sequence:
a_{n+1} = a_n^2 - 2*a_n + 4.
-/
def lossy_a : ℕ → ℕ
  | 0 => 4
  | n + 1 => (lossy_a n) ^ 2 - 2 * (lossy_a n) + 4

lemma lossy_a_pos (n : ℕ) : lossy_a n ≥ 4 := by
  induction' n with n ih
  · rfl
  · dsimp [lossy_a]
    -- a_n^2 - 2a_n + 4 = (a_n - 1)^2 + 3
    have h1 : (lossy_a n - 1) ^ 2 ≥ 9 := by 
      have : lossy_a n - 1 ≥ 3 := by omega
      nlinarith
    omega

lemma lossy_a_growth (n : ℕ) : lossy_a (n + 1) < lossy_a n ^ 2 - lossy_a n + 1 := by
  dsimp [lossy_a]
  have h := lossy_a_pos n
  -- (a_n^2 - 2a_n + 4) < (a_n^2 - a_n + 1)
  -- 3 < a_n
  omega

-- ============================================================================
-- Section 3: The Asymptotic Ceiling Verification
-- ============================================================================

/-- 
Verification that the sequence grows fast enough but avoids the collapse wall.
-/
theorem construction_validity : ∃ (a : ℕ → ℕ),
  (∀ n, a n < a (n + 1)) ∧
  (∀ n, a (n + 1) < a n ^ 2 - a n + 1) ∧ 
  (limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / (2 ^ n : ℝ))) atTop > 1) := by
  use lossy_a
  refine ⟨?_, lossy_a_growth, ?_⟩
  · intro n
    rw [lossy_a]
    have := lossy_a_pos n
    nlinarith
  · -- Double-exponential growth proof
    sorry
