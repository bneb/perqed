import Mathlib

open Filter Topology Metric Finset Real

noncomputable section

def φ1r (n : ℕ) : ℝ := 1 / (n : ℝ)
def φ2r (n : ℕ) : ℝ := 1 / ((n : ℝ) - 1)
def φvr (n : ℕ) : ℝ × ℝ := (φ1r n, φ2r n)

-- ============================================================================
-- VERIFIED: Sup-norm of φvr
-- ============================================================================

lemma φvr_norm_eq (L : ℕ) (hL : 2 ≤ L) : ‖φvr L‖ = 1 / ((L : ℝ) - 1) := by
  have hL_pos : (0 : ℝ) < L := by exact_mod_cast (show 0 < L by omega)
  have hL1_pos : (0 : ℝ) < (L : ℝ) - 1 := by
    have : (L : ℝ) ≥ 2 := by exact_mod_cast hL
    linarith
  simp only [φvr, φ1r, φ2r, Prod.norm_def]
  rw [show ‖(1 : ℝ) / (L : ℝ)‖ = 1 / L by rw [Real.norm_eq_abs, abs_of_pos (by positivity)]]
  rw [show ‖(1 : ℝ) / ((L : ℝ) - 1)‖ = 1 / ((L : ℝ) - 1) by
    rw [Real.norm_eq_abs, abs_of_pos (by positivity)]]
  exact max_eq_right (one_div_le_one_div_of_le hL1_pos (by linarith))

-- ============================================================================
-- HELPER: Subset sum as indicator sum
-- ============================================================================

/-- Sum over subset equals indicator sum over superset -/
lemma sum_subset_indicator (S B : Finset ℕ) (hBS : B ⊆ S) (f : ℕ → ℝ) :
    ∑ n ∈ B, f n = ∑ n ∈ S, if n ∈ B then f n else 0 := by
  rw [← Finset.sum_filter]
  congr 1
  ext x; simp only [Finset.mem_filter]
  exact ⟨fun hx => ⟨hBS hx, hx⟩, fun ⟨_, hx⟩ => hx⟩

-- ============================================================================
-- HELPER: Splitting sums at the last element
-- ============================================================================

lemma sum_Ico_split_last' (f : ℕ → ℝ) (L R : ℕ) (hLR : L < R) :
    ∑ n ∈ Finset.Ico L R, f n = ∑ n ∈ Finset.Ico L (R - 1), f n + f (R - 1) := by
  have hle : L ≤ R - 1 := by omega
  have heq : R - 1 + 1 = R := by omega
  calc ∑ n ∈ Finset.Ico L R, f n
      _ = ∑ n ∈ Finset.Ico L (R - 1 + 1), f n := by rw [heq]
      _ = ∑ n ∈ Finset.Ico L (R - 1), f n + f (R - 1) := Finset.sum_Ico_succ_top hle f

-- ============================================================================
-- SECTION 1: 1D Greedy Rounding
-- ============================================================================

lemma greedy_1d_rounding (L R : ℕ) (hLR : L ≤ R) (hL : 1 < L)
    (t : ℕ → ℝ) (ht : ∀ n, t n ∈ Set.Icc 0 1) :
    ∃ (B : Finset ℕ), B ⊆ Ico L R ∧
      |∑ n ∈ Ico L R, (t n - if n ∈ B then (1 : ℝ) else 0) / (n : ℝ)| ≤ 1 / (L : ℝ) := by
  induction h : (R - L) generalizing R with
  | zero =>
    refine ⟨∅, empty_subset _, ?_⟩
    have hRL : R = L := by omega
    subst hRL; simp
  | succ k ih =>
    have hLR_strict : L < R := by omega
    obtain ⟨B₀, hB₀_sub, hB₀_err⟩ := ih (R - 1) (by omega) (by omega)
    set d := ∑ n ∈ Ico L (R - 1), (t n - if n ∈ B₀ then (1:ℝ) else 0) / ↑n with d_def
    set m := R - 1 with m_def
    have hm_pos : (0 : ℝ) < (m : ℝ) := by exact_mod_cast (show 0 < m by omega)
    have hm_ge_L : (L : ℝ) ≤ (m : ℝ) := by exact_mod_cast (show L ≤ m by omega)
    have hL_pos : (0 : ℝ) < (L : ℝ) := by exact_mod_cast (show 0 < L by omega)
    have hm_not_B₀ : m ∉ B₀ := fun hc => by have := mem_Ico.mp (hB₀_sub hc); omega
    -- Step bounds
    have hstep_nn : t m / (m : ℝ) ≥ 0 := div_nonneg (ht m).1 hm_pos.le
    have hstep_le : t m / (m : ℝ) ≤ 1 / (L : ℝ) :=
      le_trans (div_le_div_of_nonneg_right (ht m).2 hm_pos.le) (one_div_le_one_div_of_le hL_pos hm_ge_L)
    have hstep_inc_le : (t m - 1) / (m : ℝ) ≤ 0 :=
      div_nonpos_of_nonpos_of_nonneg (by linarith [(ht m).2]) hm_pos.le
    have hstep_inc_ge : (t m - 1) / (m : ℝ) ≥ -(1 / (L : ℝ)) := by
      have h1 : -1 / (m : ℝ) ≤ (t m - 1) / (m : ℝ) :=
        div_le_div_of_nonneg_right (by linarith [(ht m).1]) hm_pos.le
      have h2 : 1 / (m : ℝ) ≤ 1 / (L : ℝ) := one_div_le_one_div_of_le hL_pos hm_ge_L
      -- -(1/L) ≤ -(1/m) ≤ -1/m ≤ (t m - 1)/m
      have h3 : -(1 / (L : ℝ)) ≤ -(1 / (m : ℝ)) := by linarith
      have h4 : -(1 / (m : ℝ)) = -1 / (m : ℝ) := by ring
      linarith
    -- Split sum
    have hIco_expand : ∀ (f : ℕ → ℝ),
        ∑ n ∈ Ico L R, f n = ∑ n ∈ Ico L (R - 1), f n + f m :=
      fun f => sum_Ico_split_last' f L R hLR_strict
    rcases le_or_gt 0 d with hd_nn | hd_neg
    · -- d ≥ 0: include m → new debt = d + (t(m)-1)/m
      refine ⟨insert m B₀, fun x hx => ?_, ?_⟩
      · simp only [mem_insert] at hx
        rcases hx with rfl | hx
        · exact mem_Ico.mpr ⟨by omega, by omega⟩
        · exact mem_Ico.mpr ⟨(mem_Ico.mp (hB₀_sub hx)).1,
            Nat.lt_of_lt_of_le (mem_Ico.mp (hB₀_sub hx)).2 (by omega)⟩
      · rw [hIco_expand]
        have h_sum_eq : ∑ n ∈ Ico L (R - 1),
            (t n - if n ∈ insert m B₀ then (1:ℝ) else 0) / ↑n = d := by
          apply sum_congr rfl; intro x hx
          have hxm : x ≠ m := by have := mem_Ico.mp hx; omega
          congr 1; congr 1; simp [hxm]
        have h_m_eq : (t m - if m ∈ insert m B₀ then (1:ℝ) else 0) / ↑m =
            (t m - 1) / ↑m := by simp
        rw [h_sum_eq, h_m_eq, abs_le]
        constructor
        · linarith [(abs_le.mp hB₀_err).1]
        · linarith [(abs_le.mp hB₀_err).2]
    · -- d < 0: exclude m → new debt = d + t(m)/m
      refine ⟨B₀, fun x hx => mem_Ico.mpr ⟨(mem_Ico.mp (hB₀_sub hx)).1,
        Nat.lt_of_lt_of_le (mem_Ico.mp (hB₀_sub hx)).2 (by omega)⟩, ?_⟩
      rw [hIco_expand]
      have h_m_eq : (t m - if m ∈ B₀ then (1:ℝ) else 0) / ↑m = t m / ↑m := by
        simp [hm_not_B₀]
      rw [h_m_eq, abs_le]
      constructor
      · linarith [(abs_le.mp hB₀_err).1]
      · linarith [(abs_le.mp hB₀_err).2]

-- ============================================================================
-- SECTION 2: Partial Fractions & Telescoping
-- ============================================================================

lemma pf_decomp (n : ℕ) (hn : 2 ≤ n) :
    (1 : ℝ) / ((n : ℝ) * ((n : ℝ) - 1)) = 1 / ((n : ℝ) - 1) - 1 / (n : ℝ) := by
  have h1 : (n : ℝ) > 0 := by exact_mod_cast (show 0 < n by omega)
  have h2 : (n : ℝ) - 1 > 0 := by
    have : (n : ℝ) ≥ 2 := by exact_mod_cast hn
    linarith
  field_simp [h1.ne', h2.ne']; ring

/-- Exact telescoping: Σ_{n ∈ Ico L R} 1/(n(n-1)) = 1/(L-1) - 1/(R-1) -/
lemma w_sum_eq (L R : ℕ) (hL : 2 ≤ L) (hLR : L ≤ R) :
    ∑ n ∈ Ico L R, (1 : ℝ) / ((n : ℝ) * ((n : ℝ) - 1)) =
    1 / ((L : ℝ) - 1) - 1 / ((R : ℝ) - 1) := by
  induction h_diff : (R - L) generalizing R with
  | zero =>
    have hRL : R = L := by omega
    subst hRL; simp
  | succ k ih =>
    have hLR_strict : L < R := by omega
    rw [sum_Ico_split_last' _ L R hLR_strict]
    have hRm1_ge : R - 1 ≥ 2 := by omega
    have prev := ih (R - 1) (by omega) (by omega)
    rw [prev, pf_decomp (R - 1) hRm1_ge]
    have hRm1_cast : ((R - 1 : ℕ) : ℝ) = (R : ℝ) - 1 := by
      rw [Nat.cast_sub (by omega : 1 ≤ R)]; simp
    rw [hRm1_cast]; ring

lemma w_sum_le (L R : ℕ) (hL : 2 ≤ L) (hLR : L ≤ R) :
    ∑ n ∈ Ico L R, (1 : ℝ) / ((n : ℝ) * ((n : ℝ) - 1)) ≤ 1 / ((L : ℝ) - 1) := by
  rw [w_sum_eq L R hL hLR]
  have hR1_pos : (0 : ℝ) < (R : ℝ) - 1 := by
    have : (R : ℝ) ≥ 2 := by exact_mod_cast (show R ≥ 2 by omega)
    linarith
  linarith [div_pos one_pos hR1_pos]

-- ============================================================================
-- SECTION 3: Main Theorem
-- ============================================================================

theorem discrete_rounding_bound_proved (L R : ℕ) (hL : 2 < L) (hLR : L ≤ R)
    (t : ℕ → ℝ) (ht : ∀ n, t n ∈ Set.Icc 0 1) :
    ∃ (B : Finset ℕ), B ⊆ Ico L R ∧
      ‖(∑ n ∈ Ico L R, t n • φvr n) - ∑ n ∈ B, φvr n‖ ≤ 2 * ‖φvr L‖ := by
  obtain ⟨B, hB_sub, hB_1d⟩ := greedy_1d_rounding L R hLR (by omega) t ht
  refine ⟨B, hB_sub, ?_⟩
  have hL_pos : (0 : ℝ) < (L : ℝ) := by exact_mod_cast (show 0 < L by omega)
  have hL1_pos : (0 : ℝ) < (L : ℝ) - 1 := by
    have : (L : ℝ) ≥ 3 := by exact_mod_cast hL
    linarith
  set δ : ℕ → ℝ := fun n => t n - if n ∈ B then (1:ℝ) else 0 with δ_def
  have hδ_bound : ∀ n, |δ n| ≤ 1 := fun n => by
    simp only [δ]; split_ifs with h
    · rw [abs_le]; constructor <;> linarith [(ht n).1, (ht n).2]
    · rw [abs_le]; constructor <;> linarith [(ht n).1, (ht n).2]
  have hx_err : |∑ n ∈ Ico L R, δ n / ↑n| ≤ 1 / ↑L := hB_1d
  -- Component projections via sum_subset_indicator
  have h_err_fst : ((∑ n ∈ Ico L R, t n • φvr n) - ∑ n ∈ B, φvr n).1 =
      ∑ n ∈ Ico L R, δ n / ↑n := by
    change (∑ n ∈ Ico L R, t n • φvr n).1 - (∑ n ∈ B, φvr n).1 =
      ∑ n ∈ Ico L R, δ n / ↑n
    rw [Prod.fst_sum, Prod.fst_sum]
    show (∑ n ∈ Ico L R, (t n • φvr n).1) - (∑ n ∈ B, (φvr n).1) =
      ∑ n ∈ Ico L R, δ n / ↑n
    simp only [φvr, φ1r, smul_eq_mul, Prod.smul_fst]
    rw [sum_subset_indicator (Ico L R) B hB_sub (fun n => (1:ℝ) / ↑n)]
    rw [← Finset.sum_sub_distrib]
    apply Finset.sum_congr rfl; intro x _; simp only [δ]; split_ifs <;> ring
  have h_err_snd : ((∑ n ∈ Ico L R, t n • φvr n) - ∑ n ∈ B, φvr n).2 =
      ∑ n ∈ Ico L R, δ n / ((n : ℝ) - 1) := by
    change (∑ n ∈ Ico L R, t n • φvr n).2 - (∑ n ∈ B, φvr n).2 =
      ∑ n ∈ Ico L R, δ n / ((n : ℝ) - 1)
    rw [Prod.snd_sum, Prod.snd_sum]
    show (∑ n ∈ Ico L R, (t n • φvr n).2) - (∑ n ∈ B, (φvr n).2) =
      ∑ n ∈ Ico L R, δ n / ((n : ℝ) - 1)
    simp only [φvr, φ2r, smul_eq_mul, Prod.smul_snd]
    rw [sum_subset_indicator (Ico L R) B hB_sub (fun n => (1:ℝ) / ((n:ℝ) - 1))]
    rw [← Finset.sum_sub_distrib]
    apply Finset.sum_congr rfl; intro x _; simp only [δ]; split_ifs <;> ring
  -- y-error decomposition: δ(n)/(n-1) = δ(n)/n + δ(n)/(n(n-1))
  have h_y_split : ∀ n ∈ Ico L R,
      δ n / ((n : ℝ) - 1) = δ n / ↑n + δ n / ((n : ℝ) * ((n : ℝ) - 1)) := by
    intro n hn
    have hn_pos : (n : ℝ) > 0 := by
      exact_mod_cast (show 0 < n by have := (mem_Ico.mp hn).1; omega)
    have hn1_pos : (n : ℝ) - 1 > 0 := by
      have : n ≥ L := (mem_Ico.mp hn).1
      have : (n : ℝ) ≥ ↑L := Nat.cast_le.mpr this
      linarith
    field_simp [hn_pos.ne', hn1_pos.ne']; ring
  -- w-error bound
  have hw_err : |∑ n ∈ Ico L R, δ n / ((n : ℝ) * ((n : ℝ) - 1))| ≤ 1 / ((L : ℝ) - 1) := by
    calc |∑ n ∈ Ico L R, δ n / (↑n * (↑n - 1))|
        _ ≤ ∑ n ∈ Ico L R, |δ n / (↑n * (↑n - 1))| := Finset.abs_sum_le_sum_abs _ _
        _ ≤ ∑ n ∈ Ico L R, 1 / ((n : ℝ) * ((n : ℝ) - 1)) := by
            apply sum_le_sum; intro n hn
            have hn_pos : (n : ℝ) > 0 := by
              exact_mod_cast (show 0 < n by have := (mem_Ico.mp hn).1; omega)
            have hn1_pos : (n : ℝ) - 1 > 0 := by
              have : n ≥ L := (mem_Ico.mp hn).1
              have : (n : ℝ) ≥ ↑L := Nat.cast_le.mpr this
              linarith
            rw [abs_div, abs_of_pos (mul_pos hn_pos hn1_pos)]
            exact div_le_div_of_nonneg_right (hδ_bound n) (by positivity)
        _ ≤ 1 / ((L : ℝ) - 1) := w_sum_le L R (by omega) hLR
  -- y-error total
  have hy_err : |∑ n ∈ Ico L R, δ n / ((n : ℝ) - 1)| ≤ 1 / ↑L + 1 / ((L : ℝ) - 1) := by
    rw [show (∑ n ∈ Ico L R, δ n / ((n : ℝ) - 1)) =
        ∑ n ∈ Ico L R, (δ n / ↑n + δ n / (↑n * (↑n - 1))) from
      Finset.sum_congr rfl h_y_split]
    rw [Finset.sum_add_distrib]
    exact le_trans (abs_add_le _ _) (add_le_add hx_err hw_err)
  -- Norm bound
  rw [φvr_norm_eq L (by omega)]
  have h1L_le : 1 / (L : ℝ) ≤ 1 / ((L : ℝ) - 1) :=
    one_div_le_one_div_of_le hL1_pos (by linarith)
  simp only [Prod.norm_def]
  apply max_le
  · calc ‖((∑ n ∈ Ico L R, t n • φvr n) - ∑ n ∈ B, φvr n).1‖
        _ = |∑ n ∈ Ico L R, δ n / ↑n| := by rw [h_err_fst, Real.norm_eq_abs]
        _ ≤ 1 / ↑L := hx_err
        _ ≤ 1 / ((L:ℝ) - 1) := h1L_le
        _ ≤ 2 * (1 / ((L:ℝ) - 1)) := by linarith [div_pos one_pos hL1_pos]
  · calc ‖((∑ n ∈ Ico L R, t n • φvr n) - ∑ n ∈ B, φvr n).2‖
        _ = |∑ n ∈ Ico L R, δ n / ((n : ℝ) - 1)| := by rw [h_err_snd, Real.norm_eq_abs]
        _ ≤ 1 / ↑L + 1 / ((L:ℝ) - 1) := hy_err
        _ ≤ 2 * (1 / ((L:ℝ) - 1)) := by linarith

end
