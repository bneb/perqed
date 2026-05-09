import Mathlib

open Filter Topology Finset

def S_seq (a : ℕ → ℕ) (n : ℕ) : ℚ := ∑ i ∈ range n, (1 / (a i : ℚ))
def R_tail (q : ℚ) (a : ℕ → ℕ) (n : ℕ) : ℚ := q - S_seq a n
def D_seq (q : ℚ) (a : ℕ → ℕ) (n : ℕ) : ℕ := q.den * (∏ i ∈ range n, a i)

lemma hD_pos (a : ℕ → ℕ) (h_pos : ∀ n, a n ≥ 2) (q : ℚ) (n : ℕ) : (D_seq q a n : ℚ) > 0 := by
  dsimp [D_seq]
  have hq : (0 : ℚ) < q.den := by exact_mod_cast q.den_pos
  have hprod : (0 : ℚ) < ∏ i ∈ range n, (a i : ℚ) := by
    apply prod_pos; intro i _; have := h_pos i; norm_cast; linarith
  exact_mod_cast mul_pos hq hprod

lemma h_rational (a : ℕ → ℕ) (h_pos : ∀ n, a n ≥ 2) (q : ℚ) (n : ℕ) :
  ∃ k : ℤ, R_tail q a n = k / (D_seq q a n : ℚ) := by
  induction' n with n ih
  · use q.num
    dsimp [R_tail, S_seq, D_seq]
    simp only [sub_zero, mul_one]
    exact (Rat.num_div_den q).symm 
  · rcases ih with ⟨k_n, hk_n⟩
    use k_n * (a n : ℤ) - (D_seq q a n : ℤ)
    have hS : S_seq a (n + 1) = S_seq a n + 1 / (a n : ℚ) := by dsimp [S_seq]; rw [sum_range_succ]
    have hR : R_tail q a (n + 1) = R_tail q a n - 1 / (a n : ℚ) := by dsimp [R_tail]; rw [hS]; ring
    have hD : (D_seq q a (n + 1) : ℚ) = (D_seq q a n : ℚ) * (a n : ℚ) := by dsimp [D_seq]; rw [prod_range_succ]; push_cast; ring
    rw [hR, hk_n, hD]
    have ha_ne : (a n : ℚ) ≠ 0 := by have := h_pos n; norm_cast; linarith
    have hD_ne : (D_seq q a n : ℚ) ≠ 0 := (hD_pos a h_pos q n).ne'
    push_cast; field_simp [hD_ne, ha_ne]

lemma hk_pos_lem (a : ℕ → ℕ) (h_pos : ∀ n, a n ≥ 2) (q : ℚ) (h_sum : HasSum (fun n => (1 : ℝ) / (a n : ℝ)) (q : ℝ)) (n : ℕ)
  (k : ℕ → ℤ) (hk_def : ∀ n, R_tail q a n = (k n : ℚ) / (D_seq q a n : ℚ)) :
  k n > 0 := by
  have h_lim_S : Tendsto (fun N => (S_seq a N : ℝ)) atTop (𝓝 (q : ℝ)) := by
    have := h_sum.tendsto_sum_nat
    have h_eq : (fun n => (S_seq a n : ℝ)) = (fun n => ∑ i ∈ range n, 1 / (a i : ℝ)) := by
      ext m; simp only [S_seq]; push_cast; rfl
    rw [h_eq]; exact this
  have h_lim_diff : Tendsto (fun N => (S_seq a N : ℝ) - (S_seq a n : ℝ)) atTop (𝓝 ((q : ℝ) - (S_seq a n : ℝ))) := 
    Tendsto.sub h_lim_S tendsto_const_nhds
  have h_diff_pos : ∀ N > n, (S_seq a N : ℝ) - (S_seq a n : ℝ) ≥ 1 / (a n : ℝ) := by
    intro N hN
    induction' hN with M hM ih
    · dsimp [S_seq]; rw [sum_range_succ]; push_cast; ring
    · have hS_succ : S_seq a (M + 1) = S_seq a M + 1 / (a M : ℚ) := by dsimp [S_seq]; rw [sum_range_succ]
      have h1 : (S_seq a (M + 1) : ℝ) - (S_seq a n : ℝ) = (S_seq a M : ℝ) - (S_seq a n : ℝ) + 1 / (a M : ℝ) := by 
        rw [hS_succ]; push_cast; ring
      rw [h1]
      have h_a_M : (a M : ℝ) ≥ 2 := by exact_mod_cast (h_pos M)
      have h2 : 1 / (a M : ℝ) > 0 := by linarith
      linarith
  have h_limit_ge : (q : ℝ) - (S_seq a n : ℝ) ≥ 1 / (a n : ℝ) := by
    have h_eventual_ge : ∀ᶠ N in atTop, (S_seq a N : ℝ) - (S_seq a n : ℝ) ≥ 1 / (a n : ℝ) := by
      apply eventually_atTop.mpr; use (n + 1); intro N hN; exact h_diff_pos N hN
    exact ge_of_tendsto h_lim_diff h_eventual_ge
  have hR_real : (R_tail q a n : ℝ) = (q : ℝ) - (S_seq a n : ℝ) := by dsimp [R_tail]; push_cast; rfl
  have hR_pos_real : (R_tail q a n : ℝ) > 0 := by
    have h_an_pos : (a n : ℝ) ≥ 2 := by exact_mod_cast (h_pos n)
    have : 1 / (a n : ℝ) > 0 := by linarith
    linarith
  have hR_pos : R_tail q a n > 0 := by exact_mod_cast hR_pos_real
  have hD0 : (D_seq q a n : ℚ) > 0 := hD_pos a h_pos q n
  have hk_eq : (k n : ℚ) = R_tail q a n * D_seq q a n := by rw [hk_def n]; field_simp [hD0.ne']
  have hk_q_pos : (k n : ℚ) > 0 := by rw [hk_eq]; exact mul_pos hR_pos hD0
  exact_mod_cast hk_q_pos
