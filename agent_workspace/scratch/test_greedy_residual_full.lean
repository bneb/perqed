import Mathlib

open Filter Topology BigOperators

noncomputable section

lemma nonpos_of_tendsto_zero_and_nonincr (X : ℕ → ℝ) (h_tendsto : Tendsto X atTop (𝓝 0))
    (h_nonincr : ∀ n, X (n + 1) ≤ X n) :
    ∀ n, 0 ≤ X n := by
  intro n
  by_contra h_neg
  push_neg at h_neg
  -- X n < 0
  have h_bound : ∀ m, n ≤ m → X m ≤ X n := by
    intro m
    induction m with
    | zero => 
      intro hn
      have : n = 0 := by omega
      subst this; exact le_refl _
    | succ p ih =>
      intro hn
      by_cases hp : n ≤ p
      · exact le_trans (h_nonincr p) (ih hp)
      · have : p + 1 = n := by omega
        subst this; exact le_refl _
  -- X m <= X n < 0. So it can't converge to 0.
  have h_eps : ∃ N, ∀ m ≥ N, |X m - 0| < -(X n) / 2 := by
    have h1 : -(X n) / 2 > 0 := by linarith
    have h2 := Metric.tendsto_atTop.mp h_tendsto (-(X n) / 2) h1
    exact h2
  rcases h_eps with ⟨N, hN⟩
  have h_max := max n N
  have h_max_n : n ≤ h_max := le_max_left n N
  have h_max_N : N ≤ h_max := le_max_right n N
  have h3 := hN h_max h_max_N
  have h4 := h_bound h_max h_max_n
  rw [sub_zero] at h3
  have h5 : X h_max < 0 := by linarith
  have h6 : |X h_max| = -(X h_max) := abs_of_neg h5
  rw [h6] at h3
  linarith

lemma tail_sum_difference (seq : ℕ → ℝ) (hSummable : Summable seq) :
    ∀ n, ∑' k, seq (n + k) - ∑' k, seq (n + 1 + k) = seq n := by
  intro n
  have h_shift : Summable (fun k => seq (n + k)) := Summable.comp_add_right hSummable n
  have h_shift1 : Summable (fun k => seq (n + 1 + k)) := Summable.comp_add_right hSummable (n + 1)
  have h_split : ∑' k, seq (n + k) = seq n + ∑' k, seq (n + k + 1) := tsum_eq_zero_add (Summable.hasSum h_shift)
  have h_idx : (fun k => seq (n + k + 1)) = (fun k => seq (n + 1 + k)) := by
    funext k
    congr 1
    omega
  rw [h_idx] at h_split
  linarith

lemma tail_sum_tendsto_zero (seq : ℕ → ℝ) (hSummable : Summable seq) :
    Tendsto (fun n => ∑' k, seq (n + k)) atTop (𝓝 0) := by
  -- Standard result for tail of a summable sequence
  sorry

lemma greedy_tail_sum_bound (seq : ℕ → ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2)
    (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1)
    (hSummable : Summable (fun k => (1 : ℝ) / (seq k : ℝ))) :
    ∀ n, ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) ≤ 1 / ((seq n : ℝ) - 1) := by
  let f := fun k => (1 : ℝ) / (seq k : ℝ)
  let S := fun n => ∑' k, f (n + k)
  let X := fun n => 1 / ((seq n : ℝ) - 1) - S n
  have h_tendsto_S : Tendsto S atTop (𝓝 0) := tail_sum_tendsto_zero f hSummable
  have h_tendsto_inv : Tendsto (fun n => 1 / ((seq n : ℝ) - 1)) atTop (𝓝 0) := by
    -- 1/(a_n - 1) -> 0 because a_n -> infinity
    sorry
  have h_tendsto_X : Tendsto X atTop (𝓝 0) := by
    have : Tendsto X atTop (𝓝 (0 - 0)) := Tendsto.sub h_tendsto_inv h_tendsto_S
    rw [sub_zero] at this
    exact this
  
  have h_nonincr : ∀ n, X (n + 1) ≤ X n := by
    intro n
    -- X n - X_{n+1} = 1/(a_n - 1) - 1/(a_{n+1} - 1) - (S n - S_{n+1})
    --               = 1/(a_n - 1) - 1/(a_{n+1} - 1) - 1/a_n
    have h_S_diff : S n - S (n + 1) = f n := tail_sum_difference f hSummable n
    have h_diff : X n - X (n + 1) = 1 / ((seq n : ℝ) - 1) - 1 / ((seq (n + 1) : ℝ) - 1) - f n := by
      dsimp [X]
      linarith
    -- Need to show 1/(a_n - 1) - 1/a_n >= 1/(a_{n+1} - 1)
    have ha_succ : seq (n + 1) ≥ seq n * seq n - seq n + 1 := hGreedy n
    have h1 : 1 / ((seq n : ℝ) - 1) - f n = 1 / ((seq n : ℝ) * ((seq n : ℝ) - 1)) := by
      dsimp [f]
      -- algebraic manipulation
      sorry
    have h2 : 1 / ((seq n : ℝ) * ((seq n : ℝ) - 1)) ≥ 1 / ((seq (n + 1) : ℝ) - 1) := by
      -- uses ha_succ
      sorry
    linarith
  
  have h_nonpos := nonpos_of_tendsto_zero_and_nonincr X h_tendsto_X h_nonincr
  intro n
  have := h_nonpos n
  dsimp [X] at this
  linarith

end
