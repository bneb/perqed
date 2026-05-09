import Mathlib
import «kt_proof_d2»
import «affirmative_proof_core»

lemma sumset_has_interior_draft :
    ∃ (U : Set (ℝ × ℝ)), IsOpen U ∧ U.Nonempty ∧ 
    ∀ x ∈ U, ∃ (a : ℕ → ℕ), StrictMono a ∧ (∀ k, a k ≥ 2) ∧
      (∃ β : ℝ, β > 1 ∧ Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop) ∧
      HasSum (fun k => (f₁ (a k), f₂ (a k))) x := by
  -- define U
  let U : Set (ℝ × ℝ) := {x | |x.1 - C_total.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
                              |x.2 - C_total.2| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)}
  use U
  constructor
  · -- IsOpen U
    sorry
  constructor
  · -- U.Nonempty (contains C_total)
    sorry
  · -- for all x in U
    intro x hx
    -- x is the target sum. We need to shift it to get the residual offset.
    let x_offset := (x.1 - C_total.1, x.2 - C_total.2)
    use construct_a x_offset
    constructor
    · exact construct_a_strict_mono x_offset
    constructor
    · exact construct_a_ge_2 x_offset
    constructor
    · use (1.02 : ℝ) ^ (1 / 4 : ℝ)
      constructor
      · sorry -- β > 1
      · exact construct_a_growth x_offset
    · -- HasSum
      have hx_offset : |x_offset.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
                       |x_offset.2| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3) := hx
      -- we proved construct_a_has_sum for the offset!
      have h_sum := construct_a_has_sum x_offset hx_offset
      -- h_sum gives sum to (x_offset.1 + C_total.1, x_offset.2 + C_total.2)
      -- which is exactly x!
      have heq : (x_offset.1 + C_total.1, x_offset.2 + C_total.2) = x := by
        ext
        · dsimp [x_offset]; ring
        · dsimp [x_offset]; ring
      rw [heq] at h_sum
      exact h_sum
