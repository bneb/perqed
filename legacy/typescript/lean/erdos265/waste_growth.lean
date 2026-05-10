import Mathlib

open Filter Topology Finset

/-!
# The Waste-Growth Tradeoff

Core insight from numerical experiments on Erdős 265:
- If waste ratio w = a·tail ≥ 1+δ (bounded away from 1), growth is exponential
- Exponential growth gives limsup a_k^{1/2^k} = 1
- So limsup > 1 requires waste → 1 (greedy), but greedy forces Sylvester
-/

noncomputable def tail_sum (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

lemma tail_step (a : ℕ → ℕ) (S : ℝ) (N : ℕ) :
    tail_sum a S (N + 1) = tail_sum a S N - 1 / (a N : ℝ) := by
  unfold tail_sum; rw [sum_range_succ]; ring

noncomputable def waste (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum a S N

-- Note: bounded waste gives a LOWER bound on tail(N+1), not upper.
-- tail(N+1) ≥ tail(N) · δ/(1+δ), so tail decays SLOWLY when waste is large.
-- This means a_N = waste/tail grows at most exponentially.

/-- Bounded waste forces tail to decay slowly (geometric lower bound). -/
lemma tail_lower_bound (a : ℕ → ℕ) (S : ℝ) (N : ℕ)
    (δ : ℝ) (hδ : δ > 0)
    (h_tail_pos : tail_sum a S N > 0)
    (h_waste : waste a S N ≥ 1 + δ) :
    tail_sum a S (N + 1) ≥ tail_sum a S N * (δ / (1 + δ)) := by
  rw [tail_step]
  unfold waste at h_waste
  have haN_pos : (a N : ℝ) > 0 := by nlinarith
  -- 1/a_N ≤ tail/(1+δ), so tail - 1/a_N ≥ tail·δ/(1+δ)
  have : 1 / (a N : ℝ) ≤ tail_sum a S N / (1 + δ) := by
    rw [div_le_div_iff₀ haN_pos (by linarith : (1 : ℝ) + δ > 0)]
    linarith
  have : tail_sum a S N * (δ / (1 + δ)) = tail_sum a S N - tail_sum a S N / (1 + δ) := by
    field_simp; ring
  linarith

/-- The consequence: a_N grows at most exponentially when waste ≥ 1+δ.
    log(a_N) ≤ log(w_max) + N·log((1+δ)/δ) - log(tail(0))
    So log(a_N)/2^N → 0, meaning limsup a_k^{1/2^k} = 1. -/
theorem exponential_growth_bound (a : ℕ → ℕ) (S : ℝ) (N : ℕ)
    (δ W : ℝ) (hδ : δ > 0) (hW : W > 0)
    (h_tail0 : tail_sum a S 0 > 0)
    (h_waste_lb : ∀ k, k < N → waste a S k ≥ 1 + δ)
    (h_waste_ub : ∀ k, k < N → waste a S k ≤ W)
    (h_tail_pos : ∀ k, k ≤ N → tail_sum a S k > 0) :
    (a N : ℝ) ≤ W / (tail_sum a S 0 * (δ / (1 + δ)) ^ N) := by
  sorry -- Induction on N using tail_lower_bound

/-- The contrapositive: limsup > 1 forces waste → 1 along a subsequence.
    If waste ≥ 1+ε for all k ≥ M, then tail decays geometrically (by
    tail_lower_bound), giving at most exponential growth. But α^(2^k)
    grows doubly exponentially, a contradiction. -/
theorem fast_growth_forces_greedy (a : ℕ → ℕ) (S : ℝ)
    (h_pos : ∀ i, a i ≥ 2) (h_mono : StrictMono a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) S)
    (α : ℝ) (hα : α > 1)
    (h_fast : ∀ M, ∃ k ≥ M, (a k : ℝ) ≥ α ^ (2 ^ k : ℝ)) :
    ∀ ε > 0, ∀ M, ∃ k ≥ M, waste a S k < 1 + ε := by
  intro ε hε M
  -- Proof by contradiction: assume waste ≥ 1+ε for all k ≥ M
  by_contra h_all
  push_neg at h_all
  -- h_all : ∀ k ≥ M, waste a S k ≥ 1 + ε
  -- From tail_lower_bound applied repeatedly:
  -- tail(k) ≥ tail(M) · (ε/(1+ε))^(k-M) for all k ≥ M
  -- So a_k = waste_k / tail(k) ≤ w_max / (tail(M) · (ε/(1+ε))^(k-M))
  -- This is at most exponential in k.
  -- But h_fast gives a_k ≥ α^(2^k) along a subsequence,
  -- which is doubly exponential. Contradiction for large k.
  sorry

