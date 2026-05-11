import Mathlib
import src.lean.erdos265.residual_growth_bound

open Filter Topology

def Erdos265_Sequence (a : ℕ → ℕ) : Prop :=
  StrictMono a ∧
  (∀ k, a k ≥ 2) ∧
  (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
  (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂)

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

theorem erdos_265 :
    ∀ a : ℕ → ℕ, Erdos265_Sequence a →
      limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  intro a h_seq
  by_contra h_contra
  push_neg at h_contra
  
  rcases h_seq with ⟨h_mono, h_ge2, ⟨q1, h_sum1⟩, ⟨q2, h_sum2⟩⟩
  
  -- Apply limsupGtOneImpliesResidualBounded to a
  have h_bound1 : ∃ B : ℕ, ∀ k, tailResidual a q1.num.toNat q1.den k ≤ (B : ℤ) := by sorry
  -- Wait, HasSum needs to match the exact definition with num/denom. 
  
  sorry
