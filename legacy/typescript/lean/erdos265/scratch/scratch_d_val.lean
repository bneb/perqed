import Mathlib

open Filter Topology Finset

noncomputable def X_val (a : ℕ → ℕ) (q₁ q₂ : ℝ) (N : ℕ) : ℝ :=
  q₁ * q₂ * ∑' j, (1 : ℝ) / ((a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1))

noncomputable def D_val (a : ℕ → ℕ) (q₁ q₂ : ℝ) (N : ℕ) : ℝ :=
  X_val a q₁ q₂ N - q₁ * q₂ / ((a N : ℝ) - 1)

lemma D_constant_greedy (a : ℕ → ℕ) (q₁ q₂ : ℝ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (h_greedy : (a (N + 1) : ℝ) = (a N : ℝ) * ((a N : ℝ) - 1) + 1)
    (h_summable : Summable (fun j => (1 : ℝ) / ((a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1)))) :
    D_val a q₁ q₂ (N + 1) = D_val a q₁ q₂ N := by
  unfold D_val X_val
  have h_sum_split : ∑' j, (1 : ℝ) / ((a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1)) =
      (1 : ℝ) / ((a N : ℝ) * ((a N : ℝ) - 1)) + ∑' j, (1 : ℝ) / ((a (N + 1 + j) : ℝ) * ((a (N + 1 + j) : ℝ) - 1)) := by
    exact tsum_eq_add_tsum_ite 0 h_summable |>.trans (by simp)
  
  -- Substitute split into D_val N
  have hX_N : q₁ * q₂ * ∑' j, (1 : ℝ) / ((a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1)) =
      q₁ * q₂ * (1 : ℝ) / ((a N : ℝ) * ((a N : ℝ) - 1)) + 
      q₁ * q₂ * ∑' j, (1 : ℝ) / ((a (N + 1 + j) : ℝ) * ((a (N + 1 + j) : ℝ) - 1)) := by
    rw [h_sum_split, mul_add]
  
  -- The target reduces to checking the remainder terms
  have h_goal : q₁ * q₂ * (1 : ℝ) / ((a N : ℝ) * ((a N : ℝ) - 1)) - q₁ * q₂ / ((a N : ℝ) - 1) =
      - q₁ * q₂ / ((a (N + 1) : ℝ) - 1) := by
    have h1 : (a (N + 1) : ℝ) - 1 = (a N : ℝ) * ((a N : ℝ) - 1) := by linarith
    rw [h1]
    have haN : (a N : ℝ) ≠ 0 := by have := h_pos N; linarith
    have haN1 : (a N : ℝ) - 1 ≠ 0 := by have := h_pos N; linarith
    calc q₁ * q₂ * (1 : ℝ) / ((a N : ℝ) * ((a N : ℝ) - 1)) - q₁ * q₂ / ((a N : ℝ) - 1)
      _ = q₁ * q₂ * (1 / ((a N : ℝ) * ((a N : ℝ) - 1)) - 1 / ((a N : ℝ) - 1)) := by ring
      _ = q₁ * q₂ * ((1 - (a N : ℝ)) / ((a N : ℝ) * ((a N : ℝ) - 1))) := by
        congr 1
        have : 1 / ((a N : ℝ) - 1) = (a N : ℝ) / ((a N : ℝ) * ((a N : ℝ) - 1)) := by
          rw [div_mul_eq_div_div, div_self haN, one_mul]
        rw [this, sub_div]
      _ = q₁ * q₂ * (- ((a N : ℝ) - 1) / ((a N : ℝ) * ((a N : ℝ) - 1))) := by ring_nf
      _ = q₁ * q₂ * (- 1 / (a N : ℝ)) := by
        congr 1
        rw [neg_div, mul_comm, mul_div_mul_right _ _ haN1]
      _ = - (q₁ * q₂) / (a N : ℝ) := by ring
    -- wait, the identity is 1/x(x-1) - 1/(x-1) = -1/x. But h1 is (a(N+1)-1) = x(x-1). So -q1q2/x is NOT -q1q2/x(x-1).
    -- Ah! 1/a(a-1) = 1/(a-1) - 1/a.
    -- So 1/a(a-1) - 1/(a-1) = -1/a.
    -- But we need it to equal -1/(a_{N+1}-1) = -1/(a(a-1)).
    -- Wait. If it equals -1/a, and NOT -1/a(a-1), then D is NOT constant!
    sorry
