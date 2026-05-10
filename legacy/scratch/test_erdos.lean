import Mathlib

open Filter Topology Finset

def a (n : ℕ) : ℕ := Nat.choose (n + 3) 2

lemma a_strict_mono (n : ℕ) : a n < a (n + 1) := by
  dsimp [a]
  have h : Nat.choose (n + 4) 2 = Nat.choose (n + 3) 1 + Nat.choose (n + 3) 2 := Nat.choose_succ_succ (n + 3) 1
  rw [h]
  have h2 : Nat.choose (n + 3) 1 = n + 3 := Nat.choose_one_right (n + 3)
  rw [h2]
  omega

lemma a_step (n : ℕ) : a (n + 1) = a n + n + 3 := by
  dsimp [a]
  have h : Nat.choose (n + 4) 2 = Nat.choose (n + 3) 1 + Nat.choose (n + 3) 2 := Nat.choose_succ_succ (n + 3) 1
  rw [h]
  have h2 : Nat.choose (n + 3) 1 = n + 3 := Nat.choose_one_right (n + 3)
  rw [h2]
  omega

lemma a_val (n : ℕ) : (a n : ℝ) = ((n:ℝ) + 2) * ((n:ℝ) + 3) / 2 := by
  induction' n with n ih
  · simp [a]
  · rw [a_step]
    push_cast
    rw [ih]
    ring

lemma a_pos (n : ℕ) : a n ≥ 1 := by
  induction' n with n ih
  · simp [a]
  · have h1 : a n < a (n + 1) := a_strict_mono n
    omega

lemma a_minus_one_val (n : ℕ) : (a n : ℝ) - 1 = ((n : ℝ) + 1) * ((n : ℝ) + 4) / 2 := by
  rw [a_val n]
  ring

noncomputable def f (n : ℕ) : ℝ := 2 / ((n : ℝ) + 2)

lemma sum_1_a_partial (N : ℕ) : ∑ i ∈ range N, (1 : ℝ) / (a i) = f 0 - f N := by
  have h1 : ∀ i, (1 : ℝ) / (a i) = f i - f (i + 1) := by
    intro i
    dsimp [f]
    rw [a_val i]
    have hcast : (↑(i + 1) : ℝ) + 2 = (i : ℝ) + 3 := by push_cast; ring
    rw [hcast]
    have h2 : (i : ℝ) + 2 ≠ 0 := by positivity
    have h3 : (i : ℝ) + 3 ≠ 0 := by positivity
    have hd1 : 2 / ((i:ℝ) + 2) - 2 / ((i:ℝ) + 3) = (2 * ((i:ℝ) + 3) - ((i:ℝ) + 2) * 2) / (((i:ℝ) + 2) * ((i:ℝ) + 3)) := by
      exact div_sub_div _ _ h2 h3
    rw [hd1]
    have hn : (2 * ((i:ℝ) + 3) - ((i:ℝ) + 2) * 2) / (((i:ℝ) + 2) * ((i:ℝ) + 3)) = 2 / (((i:ℝ) + 2) * ((i:ℝ) + 3)) := by ring
    rw [hn]
    exact one_div_div (((i:ℝ) + 2) * ((i:ℝ) + 3)) 2
  rw [sum_congr rfl (fun i _ => h1 i)]
  have hrev : ∑ i ∈ range N, (f i - f (i + 1)) = -(∑ i ∈ range N, (f (i + 1) - f i)) := by
    rw [← sum_neg_distrib]
    apply sum_congr rfl
    intro x _
    ring
  rw [hrev, sum_range_sub]
  ring

noncomputable def g (n : ℕ) : ℝ := (2 / 3) / ((n : ℝ) + 1)

lemma sum_1_a_minus_one_partial (N : ℕ) : 
  ∑ i ∈ range N, (1 : ℝ) / ((a i : ℝ) - 1) = 
  g 0 + g 1 + g 2 - g N - g (N + 1) - g (N + 2) := by
  have h1 : ∀ i, (1 : ℝ) / ((a i : ℝ) - 1) = g i - g (i + 3) := by
    intro i
    dsimp [g]
    rw [a_minus_one_val i]
    have hcast : (↑(i + 3) : ℝ) + 1 = (i : ℝ) + 4 := by push_cast; ring
    rw [hcast]
    have h2 : (i : ℝ) + 1 ≠ 0 := by positivity
    have h3 : (i : ℝ) + 4 ≠ 0 := by positivity
    have hd1 : (2 / 3) / ((i:ℝ) + 1) - (2 / 3) / ((i:ℝ) + 4) = ((2 / 3) * ((i:ℝ) + 4) - ((i:ℝ) + 1) * (2 / 3)) / (((i:ℝ) + 1) * ((i:ℝ) + 4)) := by
      exact div_sub_div _ _ h2 h3
    rw [hd1]
    have hn : ((2 / 3) * ((i:ℝ) + 4) - ((i:ℝ) + 1) * (2 / 3)) / (((i:ℝ) + 1) * ((i:ℝ) + 4)) = 2 / (((i:ℝ) + 1) * ((i:ℝ) + 4)) := by ring
    rw [hn]
    exact one_div_div (((i:ℝ) + 1) * ((i:ℝ) + 4)) 2
  rw [sum_congr rfl (fun i _ => h1 i)]
  have hsplit : ∀ i, g i - g (i + 3) = (g i - g (i + 1)) + (g (i + 1) - g (i + 2)) + (g (i + 2) - g (i + 3)) := by
    intro i; ring
  rw [sum_congr rfl (fun i _ => hsplit i)]
  rw [sum_add_distrib, sum_add_distrib]
  
  have hrev1 : ∑ i ∈ range N, (g i - g (i + 1)) = -(∑ i ∈ range N, (g (i + 1) - g i)) := by
    rw [← sum_neg_distrib]
    apply sum_congr rfl; intro x _; ring
  have hrev2 : ∑ i ∈ range N, (g (i + 1) - g (i + 2)) = -(∑ i ∈ range N, (g (i + 2) - g (i + 1))) := by
    rw [← sum_neg_distrib]
    apply sum_congr rfl; intro x _; ring
  have hrev3 : ∑ i ∈ range N, (g (i + 2) - g (i + 3)) = -(∑ i ∈ range N, (g (i + 3) - g (i + 2))) := by
    rw [← sum_neg_distrib]
    apply sum_congr rfl; intro x _; ring
    
  rw [hrev1, hrev2, hrev3]
  
  have hsub1 : ∑ i ∈ range N, (g (i + 1) - g i) = g N - g 0 := sum_range_sub g N
  have hsub2 : ∑ i ∈ range N, (g (i + 2) - g (i + 1)) = g (N + 1) - g 1 := sum_range_sub (fun i => g (i + 1)) N
  have hsub3 : ∑ i ∈ range N, (g (i + 3) - g (i + 2)) = g (N + 2) - g 2 := sum_range_sub (fun i => g (i + 2)) N
  
  rw [hsub1, hsub2, hsub3]
  ring

lemma tendsto_f : Tendsto f atTop (𝓝 0) := by
  have h1 : f = fun n => 2 / ((n + 2 : ℕ) : ℝ) := by
    ext n
    dsimp [f]
    push_cast
    rfl
  rw [h1]
  have h2 := tendsto_const_div_atTop_nhds_zero_nat (2 : ℝ)
  have h3 := tendsto_add_atTop_nat 2
  exact h2.comp h3

lemma tendsto_g : Tendsto g atTop (𝓝 0) := by
  have h1 : g = fun n => (2 / 3) / ((n + 1 : ℕ) : ℝ) := by
    ext n
    dsimp [g]
    push_cast
    rfl
  rw [h1]
  have h2 := tendsto_const_div_atTop_nhds_zero_nat (2 / 3 : ℝ)
  have h3 := tendsto_add_atTop_nat 1
  exact h2.comp h3

theorem erdos_265 : ∃ (A : ℕ → ℕ),
  (∀ n, A n < A (n + 1)) ∧
  (∃ q₁ : ℚ, Tendsto (fun N => ∑ i ∈ range N, (1 : ℝ) / (A i : ℝ)) atTop (𝓝 (q₁ : ℝ))) ∧
  (∃ q₂ : ℚ, Tendsto (fun N => ∑ i ∈ range N, (1 : ℝ) / ((A i : ℝ) - 1)) atTop (𝓝 (q₂ : ℝ))) := by
  use a
  refine ⟨a_strict_mono, ?_, ?_⟩
  · use 1
    have h1 : ((1 : ℚ) : ℝ) = 1 := by norm_cast
    rw [h1]
    have hs : (fun N => ∑ i ∈ range N, (1 : ℝ) / (a i : ℝ)) = fun N => f 0 - f N := by
      ext N
      exact sum_1_a_partial N
    rw [hs]
    have hl : Tendsto (fun N => f 0 - f N) atTop (𝓝 (f 0 - 0)) := Tendsto.sub tendsto_const_nhds tendsto_f
    have hz : f 0 - 0 = 1 := by
      unfold f
      norm_num
    rwa [hz] at hl
  · use (11 / 9)
    have h1 : ((11 / 9 : ℚ) : ℝ) = 11 / 9 := by norm_num
    rw [h1]
    have hs : (fun N => ∑ i ∈ range N, (1 : ℝ) / ((a i : ℝ) - 1)) = fun N => g 0 + g 1 + g 2 - g N - g (N + 1) - g (N + 2) := by
      ext N
      exact sum_1_a_minus_one_partial N
    rw [hs]
    have hl : Tendsto (fun N => g 0 + g 1 + g 2 - g N - g (N + 1) - g (N + 2)) atTop (𝓝 (g 0 + g 1 + g 2 - 0 - 0 - 0)) := by
      have t1 : Tendsto (fun N => g N) atTop (𝓝 0) := tendsto_g
      have t2 : Tendsto (fun N => g (N + 1)) atTop (𝓝 0) := tendsto_g.comp (tendsto_add_atTop_nat 1)
      have t3 : Tendsto (fun N => g (N + 2)) atTop (𝓝 0) := tendsto_g.comp (tendsto_add_atTop_nat 2)
      exact Tendsto.sub (Tendsto.sub (Tendsto.sub tendsto_const_nhds t1) t2) t3
    have hz : g 0 + g 1 + g 2 - 0 - 0 - 0 = 11 / 9 := by
      unfold g
      norm_num
    rwa [hz] at hl

