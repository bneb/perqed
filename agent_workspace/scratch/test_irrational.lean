import Mathlib.Analysis.SpecificLimits.Basic
import Mathlib.Data.Real.Irrational
import Mathlib.Algebra.BigOperators.Basic
import Mathlib.Algebra.BigOperators.Ring

open Topology
open scoped BigOperators

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

def D : ℕ → ℕ
  | 0 => 1
  | n + 1 => Nat.lcm (D n) (b n + 1)

noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' k, if k ≥ n then (1 : ℝ) / (b k + 1) else 0

noncomputable def r (n : ℕ) : ℝ :=
  (D n : ℝ) / (b n : ℝ)

lemma D_pos (n : ℕ) : 0 < D n := sorry
lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry
lemma beta_n_pos (n : ℕ) : 0 < beta_n n := sorry
lemma beta_n_bound (n : ℕ) (hn : n ≥ 1) : beta_n n < (1 : ℝ) / (b n - 1) := sorry
lemma tendsto_r : Filter.Tendsto r Filter.atTop (𝓝 0) := sorry
lemma D_mul_S_is_int (n : ℕ) : ∃ z : ℤ, (D n : ℚ) * (∑ k ∈ Finset.range n, (1 : ℚ) / (b k + 1)) = z := sorry
lemma sum_split (n : ℕ) : (∑' k, (1 : ℝ) / (b k + 1)) = (∑ k ∈ Finset.range n, (1 : ℝ) / (b k + 1)) + beta_n n := sorry

theorem Rs_irrational : Irrational (∑' k, (1 : ℝ) / (b k + 1)) := by
  intro h_rat
  rcases h_rat with ⟨q, hq_eq⟩
  have ⟨num, den, h_den, h_q_eq⟩ : ∃ num den : ℤ, den > 0 ∧ (q : ℝ) = (num : ℝ) / (den : ℝ) := sorry
  
  let B (n : ℕ) : ℝ := (den : ℝ) * (D n : ℝ) * beta_n n
  
  have hB_pos : ∀ n, 0 < B n := by
    intro n
    have h1 : (0 : ℝ) < den := by exact_mod_cast h_den
    have h2 : (0 : ℝ) < D n := by exact_mod_cast (D_pos n)
    have h3 : 0 < beta_n n := beta_n_pos n
    positivity
    
  have hB_bound : ∀ n ≥ 1, B n < 2 * (den : ℝ) * r n := by
    intro n hn
    have hb : beta_n n < 1 / (b n - 1 : ℝ) := beta_n_bound n hn
    calc
      B n = (den : ℝ) * (D n : ℝ) * beta_n n := rfl
      _ < (den : ℝ) * (D n : ℝ) * (1 / (b n - 1 : ℝ)) := by
        apply mul_lt_mul_of_pos_left hb
        have h1 : (0 : ℝ) < den := by exact_mod_cast h_den
        have h2 : (0 : ℝ) < D n := by exact_mod_cast (D_pos n)
        positivity
      _ = (den : ℝ) * ((D n : ℝ) / (b n - 1 : ℝ)) := by ring
      _ ≤ (den : ℝ) * (2 * ((D n : ℝ) / (b n : ℝ))) := by
        sorry
      _ = 2 * (den : ℝ) * r n := by
        dsimp [r]
        ring
        
  have hB_lt_one : ∃ N, ∀ n ≥ N, B n < 1 := by
    sorry
    
  have hB_int : ∀ n, ∃ z : ℤ, B n = (z : ℝ) := by
    sorry
    
  rcases hB_lt_one with ⟨N, hN⟩
  let n := max N 1
  have hn1 : n ≥ 1 := le_max_right N 1
  have hnN : n ≥ N := le_max_left N 1
  
  have h1 : 0 < B n := hB_pos n
  have h2 : B n < 1 := hN n hnN
  rcases hB_int n with ⟨z, hz⟩
  rw [hz] at h1 h2
  
  have h3 : 0 < z := by exact_mod_cast h1
  have h4 : z < 1 := by exact_mod_cast h2
  omega
