import Mathlib
import Perqed.Erdos265.FundamentalInequality
import Perqed.Erdos265.ProblemStatement

open Filter Topology Real Finset

open scoped BigOperators

noncomputable section

lemma tight_term_bound (X : ℕ → ℝ) (h_X_ge2 : ∀ k, X k ≥ 2) (h_X_growth : ∀ k, X (k + 1) ≥ X k ^ 2 + X k) (k : ℕ) :
    1 / X k ≤ 1 / (X k - 1) - 1 / (X (k + 1) - 1) := by
  have hk : X k ≥ 2 := h_X_ge2 k
  have h_mono : X (k + 1) ≥ X k ^ 2 + X k := h_X_growth k
  
  have h_diff : 1 / (X k - 1) - 1 / X k = 1 / ((X k - 1) * X k) := by
    have h1 : X k - 1 ≠ 0 := by linarith
    have h2 : X k ≠ 0 := by linarith
    have : 1 / (X k - 1) - 1 / X k = (X k - (X k - 1)) / ((X k - 1) * X k) := by
      exact div_sub_div 1 1 h1 h2 |>.trans (by ring)
    have hd : X k - (X k - 1) = 1 := by ring
    rw [hd] at this
    exact this
    
  have h_bound2 : 1 / ((X k - 1) * X k) ≥ 1 / (X (k + 1) - 1) := by
    have h1 : (X k - 1) * X k > 0 := by nlinarith
    apply one_div_le_one_div_of_le h1
    have h_sq : (X k - 1) * X k = X k ^ 2 - X k := by ring
    rw [h_sq]
    linarith

  linarith

lemma tight_telescoping_sum_bound (X : ℕ → ℝ) (h_X_ge2 : ∀ k, X k ≥ 2) (h_X_growth : ∀ k, X (k + 1) ≥ X k ^ 2 + X k) (N K : ℕ) :
    ∑ k in range K, 1 / X (N + k) ≤ 1 / (X N - 1) - 1 / (X (N + K) - 1) := by
  induction' K with K ih
  · simp
  · rw [sum_range_succ]
    have h_term := tight_term_bound X h_X_ge2 h_X_growth (N + K)
    have : N + K + 1 = N + (K + 1) := by omega
    rw [this] at h_term
    linarith

/-- 
  **The Tight Telescoping Squeeze**
  Since $a_k \ge 2$ and $a_{k+1} \ge a_k(a_k-1) + 1$, we have $X_{k+1} \ge X_k^2 + X_k$.
  This permits a much tighter bound on the tail sum: $\sum_{k=N}^\infty 1/X_k \le 1/(X_N - 1)$.
  This restricts the envelope to $2^N$, crushing the $3^N$ hypothesis.
-/
lemma tight_tail_bound (X : ℕ → ℝ) (h_X_ge2 : ∀ k, X k ≥ 2) (h_X_growth : ∀ k, X (k + 1) ≥ X k ^ 2 + X k) (N : ℕ) :
    (∑' k, 1 / X (N + k)) ≤ 1 / (X N - 1) := by
  have h_nonneg : ∀ k, 1 / X (N + k) ≥ 0 := by
    intro k
    apply div_nonneg (by norm_num)
    have : X (N + k) ≥ 2 := h_X_ge2 (N + k)
    linarith
  have h_bound : ∀ K, ∑ k in range K, 1 / X (N + k) ≤ 1 / (X N - 1) := by
    intro K
    have h := tight_telescoping_sum_bound X h_X_ge2 h_X_growth N K
    have : 1 / (X (N + K) - 1) ≥ 0 := by
      apply div_nonneg (by norm_num)
      have : X (N + K) ≥ 2 := h_X_ge2 (N + K)
      linarith
    linarith
  exact tsum_le_of_sum_range_le h_nonneg h_bound
