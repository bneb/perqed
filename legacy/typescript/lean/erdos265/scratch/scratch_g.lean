import Mathlib

open Filter Topology Metric Set

noncomputable def f₁ (x : ℝ) : ℝ := 1 / x
noncomputable def f₂ (x : ℝ) : ℝ := 1 / (x * (x + 1))

theorem sumset_has_interior : ∃ (α : ℝ), α > 2 ∧
    ∃ (U : Set (ℝ × ℝ)), IsOpen U ∧ U.Nonempty ∧ 
    ∀ x ∈ U, ∃ (a : ℕ → ℕ), StrictMono a ∧ (∀ k, a k ≥ 2) ∧
      HasSum (fun k => (f₁ (a k), f₂ (a k))) x := sorry

-- Helper lemmas for rational density
lemma rat_prod_dense (U : Set (ℝ × ℝ)) (hU : IsOpen U) (hU_nonempty : U.Nonempty) :
    ∃ (q₁ q₂ : ℚ), ((q₁ : ℝ), (q₂ : ℝ)) ∈ U := by
  have hdense : DenseRange (fun (q : ℚ × ℚ) => ((q.1 : ℝ), (q.2 : ℝ))) := 
    DenseRange.prod Rat.denseRange_cast Rat.denseRange_cast
  have ⟨q, hq⟩ := hdense.exists_mem_open hU hU_nonempty
  exact ⟨q.1, q.2, hq⟩

-- Helper lemma for sum decomposition
lemma has_sum_shift (a : ℕ → ℕ) (ha_pos : ∀ k, a k ≥ 2) (q₁ q₂ : ℝ) 
    (h₁ : HasSum (fun k => 1 / (a k : ℝ)) q₁)
    (h₂ : HasSum (fun k => 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) q₂) :
    HasSum (fun k => 1 / ((a k : ℝ) + 1)) (q₁ - q₂) := by
  have h_sub := HasSum.sub h₁ h₂
  have h_eq : (fun k => 1 / (a k : ℝ) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) = 
              (fun k => 1 / ((a k : ℝ) + 1)) := by
    ext k
    have ha1 : (a k : ℝ) ≠ 0 := by 
      have := ha_pos k
      norm_cast
      linarith
    have ha2 : (a k : ℝ) + 1 ≠ 0 := by
      have := ha_pos k
      norm_cast
      linarith
    calc 1 / (a k : ℝ) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1))
      _ = ((a k : ℝ) + 1) / ((a k : ℝ) * ((a k : ℝ) + 1)) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1)) := by
        congr 1
        rw [div_mul_eq_div_div, mul_comm, ←div_mul_eq_div_div, div_self ha2, one_mul]
      _ = ((a k : ℝ) + 1 - 1) / ((a k : ℝ) * ((a k : ℝ) + 1)) := by rw [sub_div]
      _ = (a k : ℝ) / ((a k : ℝ) * ((a k : ℝ) + 1)) := by ring_nf
      _ = 1 / ((a k : ℝ) + 1) := by
        rw [div_mul_eq_div_div, div_self ha1, one_mul]
  rw [←h_eq]
  exact h_sub

-- Helper lemma for sum decomposition
lemma has_sum_shift (a : ℕ → ℕ) (q₁ q₂ : ℝ) 
    (h₁ : HasSum (fun k => 1 / (a k : ℝ)) q₁)
    (h₂ : HasSum (fun k => 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) q₂) :
    HasSum (fun k => 1 / ((a k : ℝ) + 1)) (q₁ - q₂) := by
  have h_sub := HasSum.sub h₁ h₂
  have h_eq : (fun k => 1 / (a k : ℝ) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) = 
              (fun k => 1 / ((a k : ℝ) + 1)) := by
    ext k
    have ha : (a k : ℝ) ≠ 0 := sorry
    have ha1 : (a k : ℝ) + 1 ≠ 0 := sorry
    calc 1 / (a k : ℝ) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1))
      _ = ((a k : ℝ) + 1 - 1) / ((a k : ℝ) * ((a k : ℝ) + 1)) := by
        rw [sub_div]
        congr 1
        rw [div_mul_eq_div_div, mul_comm, ←div_mul_eq_div_div, div_self ha1, one_mul]
      _ = 1 / ((a k : ℝ) + 1) := by
        sorry
  rw [←h_eq]
  exact h_sub

theorem kovac_tao_d2 : ∃ (β : ℝ) (a : ℕ → ℕ),
    β > 1 ∧ StrictMono a ∧ (∀ k, a k ≥ 2) ∧
    Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop ∧
    (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
    (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) := by
  rcases sumset_has_interior with ⟨α, hα, U, hU_open, hU_nonempty, hU_prop⟩
  -- Get rational point
  have ⟨q₁, q₂, hq⟩ := rat_prod_dense U hU_open hU_nonempty
  -- Get sequence
  rcases hU_prop (↑q₁, ↑q₂) hq with ⟨a, h_mono, h_ge2, h_sum⟩
  
  -- The sum decomposes into two real HasSum
  have h_sum1 : HasSum (fun k => f₁ (a k)) ↑q₁ := h_sum.fst
  have h_sum2 : HasSum (fun k => f₂ (a k)) ↑q₂ := h_sum.snd

  -- Shift the sequence b_k = a_k + 1
  use α, fun k => a k + 1
  refine ⟨by linarith, ?_, ?_, ?_, ?_, ?_⟩
  · intro x y hxy; exact add_lt_add_right (h_mono hxy) 1
  · intro k; linarith [h_ge2 k]
  · sorry -- Growth condition for a_k + 1
  · -- Sum of 1/b_k = 1/(a_k + 1) = q₁ - q₂
    use q₁ - q₂
    push_cast
    have : ∀ k, f₁ (a k) = 1 / (a k : ℝ) := fun k => rfl
    have : ∀ k, f₂ (a k) = 1 / ((a k : ℝ) * ((a k : ℝ) + 1)) := fun k => rfl
    apply has_sum_shift a ↑q₁ ↑q₂ h_sum1 h_sum2
  · -- Sum of 1/(b_k - 1) = 1/a_k = q₁
    use q₁
    push_cast
    have h_eq : (fun k => 1 / ((a k : ℝ) + 1 - 1)) = fun k => 1 / (a k : ℝ) := by
      ext k; congr 1; ring
    rw [h_eq]
    exact h_sum1
