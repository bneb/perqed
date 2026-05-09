import Mathlib

set_option maxHeartbeats 1000000

open Filter Topology Metric Set Matrix

/-!
# Kovač-Tao Proof Decomposition (d=2 case)

This file decomposes the proof of Theorem 2.8 from arXiv:2406.17593 
(specialized to d=2) into agent-tractable sub-lemmas.

## Dependency Graph
```
  [A1] f1_linearization     [B1] vandermonde_2d_det
  [A2] f2_linearization          |
       |    |                    v
       |    |              [B2] vandermonde_2d_inv_int
       v    v                    |
  [C] linearization_2d          |
       |                        |
       +----------+-------------+
                  |
                  v
       [D] lattice_rounding_2d
                  |
                  v
       [E] approximation_lemma_2d
                  |
                  v
       [F] iterative_covering_2d
                  |
                  v
       [G] kovac_tao_d2  (→ erdos_265)
```

Each sub-lemma is designed to be:
- Self-contained (minimal dependencies)
- Small enough for MCTS (< 20 lines of proof)
- Clearly typed so the agent knows what to produce
-/

-- ============================================================================
-- DEFINITIONS
-- ============================================================================

/-- f₁(x) = 1/x -/
noncomputable def f₁ (x : ℝ) : ℝ := 1 / x

/-- f₂(x) = 1/(x(x+1)) = 1/x - 1/(x+1) -/
noncomputable def f₂ (x : ℝ) : ℝ := 1 / (x * (x + 1))

-- ============================================================================
-- HELPER: Exact algebraic identity for f₁ error
-- ============================================================================

/-- The exact error of the linear approximation to 1/x at N: n²/(N²(N+n)) -/
lemma f1_error_exact (N n : ℝ) (hN : N ≠ 0) (hNn : N + n ≠ 0) :
    f₁ (N + n) - f₁ N + n / N ^ 2 = n ^ 2 / (N ^ 2 * (N + n)) := by
  unfold f₁; field_simp; ring

/-- For nonzero integers, 1 ≤ n² (used to convert |n| bounds to n² bounds) -/
lemma int_abs_le_sq (n : ℤ) (hn : n ≠ 0) : (1 : ℝ) ≤ (n : ℝ) ^ 2 := by
  have h1 : (1 : ℤ) ≤ |n| := Int.one_le_abs hn
  have h2 : (1 : ℝ) ≤ |(n : ℝ)| := by exact_mod_cast h1
  calc (1 : ℝ) = 1 ^ 2 := by ring
    _ ≤ |(n : ℝ)| ^ 2 := sq_le_sq' (by linarith) h2
    _ = (n : ℝ) ^ 2 := sq_abs _

/-- For nonzero integers, |n| ≤ n² -/
lemma int_abs_le_sq' (n : ℤ) (hn : n ≠ 0) : |(n : ℝ)| ≤ (n : ℝ) ^ 2 := by
  have h1 : (1 : ℝ) ≤ |(n : ℝ)| := by exact_mod_cast Int.one_le_abs hn
  nlinarith [sq_abs (n : ℝ)]

-- ============================================================================
-- [A1] f₁ LINEARIZATION  ✅ VERIFIED
-- ============================================================================

/-- 
Lemma 7.1 (i=1): |1/(N+n) - 1/N + n/N²| ≤ 2n²/N³ when |n| ≤ N/8.
Proof: exact error is n²/(N²(N+n)), and N+n ≥ N/2 gives the bound.
-/
lemma f1_linearization (N : ℝ) (n : ℤ) (hN : N > 0) (hn : (|n| : ℝ) ≤ N / 8) :
    |f₁ (N + (n : ℝ)) - f₁ N + (n : ℝ) / N ^ 2| ≤ 2 * (n : ℝ) ^ 2 / N ^ 3 := by
  have hn' : |(n : ℝ)| ≤ N / 8 := by exact_mod_cast hn
  have hNn : N + (n : ℝ) > 0 := by linarith [(abs_le.mp hn').1]
  rw [f1_error_exact N n (ne_of_gt hN) (ne_of_gt hNn)]
  have hN2Nn : N ^ 2 * (N + (n : ℝ)) > 0 := by positivity
  rw [abs_of_nonneg (div_nonneg (sq_nonneg _) (le_of_lt hN2Nn))]
  have h2 : N ^ 3 / 2 ≤ N ^ 2 * (N + (n : ℝ)) := by
    nlinarith [(abs_le.mp hn').1, sq_nonneg N]
  calc (n : ℝ) ^ 2 / (N ^ 2 * (N + (n : ℝ)))
      ≤ (n : ℝ) ^ 2 / (N ^ 3 / 2) :=
        div_le_div_of_nonneg_left (sq_nonneg _) (by positivity) h2
    _ = 2 * (n : ℝ) ^ 2 / N ^ 3 := by ring

-- ============================================================================
-- [A2] f₂ LINEARIZATION  ✅ VERIFIED
-- Strategy: Cross-multiply into a single fraction, extract exact polynomial
--   numerator via ring, then bound numerator ≤ 8n²N³ and denominator ≥ N⁷/4.
-- ============================================================================

/-- Exact polynomial decomposition of the f₂ linearization error numerator -/
lemma f2_exact_numerator (N : ℝ) (n : ℤ) :
    N ^ 4 * (N + 1) - N ^ 3 * (N + (n : ℝ)) * (N + (n : ℝ) + 1) +
    2 * (n : ℝ) * N * (N + 1) * (N + (n : ℝ)) * (N + (n : ℝ) + 1) =
    (n : ℝ) ^ 2 * (3 * N ^ 3 + 2 * (n : ℝ) * N ^ 2 + 6 * N ^ 2 + 2 * (n : ℝ) * N + 2 * N) +
    (n : ℝ) * (3 * N ^ 3 + 2 * N ^ 2) := by
  ring

/--
Lemma 7.1 (i=2): |f₂(N+n) - f₂(N) + 2n/N³| ≤ 32n²/N⁴ when N ≥ 16 and |n| ≤ N/8.
Proof: combine all terms into a single fraction. The numerator is exactly
n²·(3N³+2nN²+6N²+2nN+2N) + n·(3N³+2N²), bounded by 8n²N³.
The denominator N³·(N+n)(N+n+1)·N(N+1) ≥ N⁷/4.
So the ratio ≤ 8n²N³/(N⁷/4) = 32n²/N⁴.
-/
lemma f2_linearization (N : ℝ) (n : ℤ) (hN : N ≥ 16) (hn : |(n : ℝ)| ≤ N / 8) :
    |f₂ (N + (n : ℝ)) - f₂ N + 2 * (n : ℝ) / N ^ 3| ≤ 32 * (n : ℝ) ^ 2 / N ^ 4 := by
  by_cases hn0 : n = 0
  · simp [hn0, f₂]
  · have hN_pos : N > 0 := by linarith
    have hn_lo := (abs_le.mp hn).1
    have hn_hi := (abs_le.mp hn).2
    have hNn_pos : N + (n : ℝ) > 0 := by linarith
    have hNn1_pos : N + (n : ℝ) + 1 > 0 := by linarith
    have hN1_pos : N + 1 > 0 := by linarith
    have hD1 : (N + (n : ℝ)) * (N + (n : ℝ) + 1) > 0 := by positivity
    have hD2 : N * (N + 1) > 0 := by positivity
    have hD3 : N ^ 3 > 0 := by positivity
    have hD : N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1)) > 0 := by positivity
    -- Write as single fraction
    unfold f₂
    have heq : 1 / ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) - 1 / (N * (N + 1)) + 2 * (n : ℝ) / N ^ 3 =
        (N ^ 4 * (N + 1) - N ^ 3 * (N + (n : ℝ)) * (N + (n : ℝ) + 1) +
         2 * (n : ℝ) * N * (N + 1) * (N + (n : ℝ)) * (N + (n : ℝ) + 1)) /
        (N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1))) := by
      have : N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1)) =
             ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1)) * N ^ 3 := by ring
      rw [this]
      rw [div_sub_div _ _ (ne_of_gt hD1) (ne_of_gt hD2)]
      rw [div_add_div _ _ (ne_of_gt (by positivity : ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1)) > 0)) (ne_of_gt hD3)]
      congr 1; ring
    -- Numerator bound: |P| ≤ 8n²N³
    have hn_sq : |(n : ℝ)| ≤ (n : ℝ) ^ 2 := int_abs_le_sq' n hn0
    have h_inner_pos : 3 * N ^ 3 + 2 * (n : ℝ) * N ^ 2 + 6 * N ^ 2 + 2 * (n : ℝ) * N + 2 * N ≥ 0 := by
      nlinarith [sq_nonneg N]
    have h_inner_bound : 3 * N ^ 3 + 2 * (n : ℝ) * N ^ 2 + 6 * N ^ 2 + 2 * (n : ℝ) * N + 2 * N ≤ 4 * N ^ 3 := by
      nlinarith [sq_nonneg N]
    have h_linear_bound : 3 * N ^ 3 + 2 * N ^ 2 ≤ 4 * N ^ 3 := by nlinarith
    have hP : |N ^ 4 * (N + 1) - N ^ 3 * (N + (n : ℝ)) * (N + (n : ℝ) + 1) +
               2 * (n : ℝ) * N * (N + 1) * (N + (n : ℝ)) * (N + (n : ℝ) + 1)|
              ≤ 8 * (n : ℝ) ^ 2 * N ^ 3 := by
      rw [f2_exact_numerator]
      calc |(n : ℝ) ^ 2 * (3 * N ^ 3 + 2 * (n : ℝ) * N ^ 2 + 6 * N ^ 2 + 2 * (n : ℝ) * N + 2 * N) +
            (n : ℝ) * (3 * N ^ 3 + 2 * N ^ 2)|
        _ ≤ |(n : ℝ) ^ 2 * (3 * N ^ 3 + 2 * (n : ℝ) * N ^ 2 + 6 * N ^ 2 + 2 * (n : ℝ) * N + 2 * N)| +
            |(n : ℝ) * (3 * N ^ 3 + 2 * N ^ 2)| := abs_add_le _ _
        _ = (n : ℝ) ^ 2 * (3 * N ^ 3 + 2 * (n : ℝ) * N ^ 2 + 6 * N ^ 2 + 2 * (n : ℝ) * N + 2 * N) +
            |(n : ℝ)| * (3 * N ^ 3 + 2 * N ^ 2) := by
            rw [abs_mul, abs_of_nonneg (sq_nonneg _), abs_of_nonneg h_inner_pos,
                abs_mul, abs_of_nonneg (by positivity : (0 : ℝ) ≤ 3 * N ^ 3 + 2 * N ^ 2)]
        _ ≤ (n : ℝ) ^ 2 * (4 * N ^ 3) + (n : ℝ) ^ 2 * (4 * N ^ 3) := by
            apply add_le_add
            · exact mul_le_mul_of_nonneg_left h_inner_bound (sq_nonneg _)
            · exact le_trans (mul_le_mul_of_nonneg_right hn_sq (by positivity))
                (mul_le_mul_of_nonneg_left h_linear_bound (sq_nonneg _))
        _ = 8 * (n : ℝ) ^ 2 * N ^ 3 := by ring
    -- Denominator lower bound: D ≥ N⁷/4
    have hD_ge : N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1)) ≥ (N ^ 7) / 4 := by
      have h1 : (N + (n : ℝ)) * (N + (n : ℝ) + 1) ≥ (N / 2) * (N / 2) := by
        apply mul_le_mul <;> linarith
      have h2 : N * (N + 1) ≥ N * N := by
        exact mul_le_mul_of_nonneg_left (by linarith) (le_of_lt hN_pos)
      calc N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1))
        _ ≥ N ^ 3 * ((N / 2) * (N / 2)) * (N * N) := by
            apply mul_le_mul (mul_le_mul_of_nonneg_left h1 (by positivity)) h2 (by positivity) (by positivity)
        _ = N ^ 7 / 4 := by ring
    -- Final: |P|/D ≤ 8n²N³/(N⁷/4) = 32n²/N⁴
    rw [heq, abs_div, abs_of_nonneg (le_of_lt hD)]
    calc |N ^ 4 * (N + 1) - N ^ 3 * (N + (n : ℝ)) * (N + (n : ℝ) + 1) + 2 * (n : ℝ) * N * (N + 1) * (N + (n : ℝ)) * (N + (n : ℝ) + 1)| / (N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1)))
      _ ≤ (8 * (n : ℝ) ^ 2 * N ^ 3) / (N ^ 3 * ((N + (n : ℝ)) * (N + (n : ℝ) + 1)) * (N * (N + 1))) :=
          div_le_div_of_nonneg_right hP (by positivity)
      _ ≤ (8 * (n : ℝ) ^ 2 * N ^ 3) / (N ^ 7 / 4) :=
          div_le_div_of_nonneg_left (by positivity) (by positivity) hD_ge
      _ = 32 * (n : ℝ) ^ 2 / N ^ 4 := by
          rw [show N ^ 7 = N ^ 3 * N ^ 4 from by ring]
          field_simp; ring

-- ============================================================================
-- [A2'] f₂ PARTIAL FRACTION IDENTITY
-- Difficulty: 🟢 Easy (pure algebra)
-- Strategy: Field_simp + ring, or direct computation.
-- This is a helper that makes [A2] tractable by reducing f₂ to f₁.
-- ============================================================================

/-- f₂(x) = f₁(x) - f₁(x+1) when x ≠ 0 and x+1 ≠ 0 -/
lemma f2_eq_f1_diff (x : ℝ) (hx : x ≠ 0) (hx1 : x + 1 ≠ 0) :
    f₂ x = f₁ x - f₁ (x + 1) := by
  unfold f₂ f₁
  field_simp
  ring

-- ============================================================================
-- [B1] VANDERMONDE DETERMINANT (d=2)
-- Difficulty: 🟢 Easy (finite computation)
-- Strategy: native_decide, norm_num, or unfold + simp.
-- ============================================================================

/--
The 2×2 Vandermonde matrix V = [[1^0, 1^1], [2^0, 2^1]] = [[1, 1], [1, 2]]
has det(V) = 2 - 1 = 1.
-/
lemma vandermonde_2d_det : 
    (vandermonde (![1, 2] : Fin 2 → ℤ)).det = 1 := by
  simp [vandermonde, det_fin_two]

-- ============================================================================
-- [B2] VANDERMONDE INVERSE HAS INTEGER ENTRIES (d=2)
-- Difficulty: 🟢 Easy (follows from [B1] since det = ±1)
-- Strategy: Since det = 1, adjugate = inverse, and adjugate has ℤ entries.
--           Concretely, V⁻¹ = [[2, -1], [-1, 1]].
-- ============================================================================

/--
Since det(V) = 1, the inverse V⁻¹ has integer entries.
Explicitly: V⁻¹ = [[2, -1], [-1, 1]].
This means V·ℤ² = ℤ²: the Vandermonde map is a ℤ-module isomorphism.
-/
lemma vandermonde_2d_inv_int :
    ∃ (W : Matrix (Fin 2) (Fin 2) ℤ), 
      (vandermonde (![1, 2] : Fin 2 → ℤ)) * W = 1 ∧
      W * (vandermonde (![1, 2] : Fin 2 → ℤ)) = 1 := by
  refine ⟨!![2, -1; -1, 1], ?_, ?_⟩ <;> {
    ext i j
    fin_cases i <;> fin_cases j <;>
    simp [vandermonde, mul_apply, Fin.sum_univ_two, Matrix.cons_val_zero,
          Matrix.cons_val_one]
  }

-- ============================================================================
-- [C] LINEARIZATION AT ARBITRARY BASE
-- Note: A1 works at any positive base. A2 requires base ≥ 16.
-- The paper's construction uses bases j·N for j=1,...,d.
-- For d=2: base N (for n₁) and base 2N (for n₂).
-- A1/A2 can be applied directly at each base — no separate [C] needed.
-- ============================================================================

-- ============================================================================
-- [D] LATTICE ROUNDING (d=2)
-- Difficulty: 🟡 Medium (integer arithmetic + rounding)
-- Strategy: Given target (p₁, p₂) in a box, compute (n₁, n₂) = V⁻¹ · round(...)
--           and verify the bounds.
-- 
-- This is the KEY sub-lemma. It says: for any real target perturbation
-- within the "reachable box," we can find integers n₁, n₂ such that
-- V·(n₁, n₂) is close to the scaled target.
-- ============================================================================

/--
Given a target perturbation (p₁, p₂) with |pᵢ| ≤ M/(2N^{i+1}),
there exist integers n₁, n₂ with |nᵢ| ≤ 2M such that:
  |p₁ + (1·n₁ + 1·n₂)/N² | ≤ 3/(2N²)  
  |p₂ + (1·n₁ + 2·n₂)/N³ | ≤ 3/(2N³)

Proof: V⁻¹ = [[2,-1],[-1,1]], apply to scaled targets, round to integers.
-/
lemma lattice_rounding_2d (N M : ℝ) (hN : N ≥ 1) (hM : M ≥ 1) 
    (p₁ p₂ : ℝ) (hp₁ : |p₁| ≤ M / (2 * N ^ 2)) (hp₂ : |p₂| ≤ M / (2 * N ^ 3)) :
    ∃ (n₁ n₂ : ℤ), 
      (|n₁| : ℝ) ≤ 2 * M ∧ (|n₂| : ℝ) ≤ 2 * M ∧
      |p₁ + (n₁ + n₂ : ℝ) / N ^ 2| ≤ 3 / (2 * N ^ 2) ∧
      |p₂ + (n₁ + 2 * n₂ : ℝ) / N ^ 3| ≤ 3 / (2 * N ^ 3) := by
  have hN_pos : N > 0 := by linarith
  have hN2_pos : N ^ 2 > 0 := by positivity
  have hN3_pos : N ^ 3 > 0 := by positivity
  set q₁ := -p₁ * N ^ 2
  set q₂ := -p₂ * N ^ 3
  have hq₁ : |q₁| ≤ M / 2 := by
    simp only [q₁, abs_neg, abs_mul, abs_of_nonneg (le_of_lt hN2_pos)]
    calc |p₁| * N ^ 2 ≤ M / (2 * N ^ 2) * N ^ 2 :=
          mul_le_mul_of_nonneg_right hp₁ (le_of_lt hN2_pos)
      _ = M / 2 := by field_simp
  have hq₂ : |q₂| ≤ M / 2 := by
    simp only [q₂, abs_neg, abs_mul, abs_of_nonneg (le_of_lt hN3_pos)]
    calc |p₂| * N ^ 3 ≤ M / (2 * N ^ 3) * N ^ 3 :=
          mul_le_mul_of_nonneg_right hp₂ (le_of_lt hN3_pos)
      _ = M / 2 := by field_simp
  set m₂ := -q₁ + q₂
  set m₁ := 2 * q₁ - q₂
  have hm₁ : |m₁| ≤ 3 * M / 2 := by
    calc |2 * q₁ - q₂| ≤ |2 * q₁| + |-(q₂)| := by
          rw [show 2 * q₁ - q₂ = 2 * q₁ + (-q₂) from by ring]; exact abs_add_le _ _
      _ = |2 * q₁| + |q₂| := by rw [abs_neg]
      _ = 2 * |q₁| + |q₂| := by rw [abs_mul, abs_of_nonneg (by norm_num : (0:ℝ) ≤ 2)]
      _ ≤ 2 * (M / 2) + M / 2 := by linarith
      _ = 3 * M / 2 := by ring
  have hm₂ : |m₂| ≤ M := by
    calc |-q₁ + q₂| ≤ |-q₁| + |q₂| := abs_add_le _ _
      _ = |q₁| + |q₂| := by rw [abs_neg]
      _ ≤ M := by linarith
  use ⌊m₁ + 1/2⌋, ⌊m₂ + 1/2⌋
  set e₁ := (⌊m₁ + 1/2⌋ : ℝ) - m₁
  set e₂ := (⌊m₂ + 1/2⌋ : ℝ) - m₂
  have he₁ : |e₁| ≤ 1/2 := by
    have := Int.floor_le (m₁ + 1/2); have := Int.lt_floor_add_one (m₁ + 1/2)
    rw [abs_le]; constructor <;> linarith
  have he₂ : |e₂| ≤ 1/2 := by
    have := Int.floor_le (m₂ + 1/2); have := Int.lt_floor_add_one (m₂ + 1/2)
    rw [abs_le]; constructor <;> linarith
  have hn₁_eq : (⌊m₁ + 1/2⌋ : ℝ) = m₁ + e₁ := by simp [e₁]
  have hn₂_eq : (⌊m₂ + 1/2⌋ : ℝ) = m₂ + e₂ := by simp [e₂]
  have hm_sum : m₁ + m₂ = q₁ := by simp [m₁, m₂]; ring
  have hm_comb : m₁ + 2 * m₂ = q₂ := by simp [m₁, m₂]; ring
  refine ⟨?_, ?_, ?_, ?_⟩
  · calc (|⌊m₁ + 1/2⌋| : ℝ) ≤ |m₁| + |e₁| := by rw [hn₁_eq]; exact abs_add_le m₁ e₁
      _ ≤ 3 * M / 2 + 1/2 := by linarith
      _ ≤ 2 * M := by linarith
  · calc (|⌊m₂ + 1/2⌋| : ℝ) ≤ |m₂| + |e₂| := by rw [hn₂_eq]; exact abs_add_le m₂ e₂
      _ ≤ M + 1/2 := by linarith
      _ ≤ 2 * M := by linarith
  · have h_err₁ : |e₁ + e₂| ≤ 1 := by linarith [abs_add_le e₁ e₂]
    suffices p₁ + ((⌊m₁ + 1/2⌋ : ℝ) + (⌊m₂ + 1/2⌋ : ℝ)) / N ^ 2 = (e₁ + e₂) / N ^ 2 by
      rw [show (↑⌊m₁ + 1/2⌋ + ↑⌊m₂ + 1/2⌋ : ℝ) = (⌊m₁ + 1/2⌋ : ℝ) + (⌊m₂ + 1/2⌋ : ℝ) from by ring]
      rw [this, abs_div, abs_of_nonneg (le_of_lt hN2_pos)]
      rw [show (3 : ℝ) / (2 * N ^ 2) = (3 / 2) / N ^ 2 from by ring]
      exact div_le_div_of_nonneg_right (by linarith) (le_of_lt hN2_pos)
    rw [hn₁_eq, hn₂_eq]
    have : m₁ + e₁ + (m₂ + e₂) = q₁ + (e₁ + e₂) := by linarith [hm_sum]
    rw [this, show q₁ = -p₁ * N ^ 2 from rfl]
    field_simp; ring
  · have h_err₂ : |e₁ + 2 * e₂| ≤ 3 / 2 := by
      calc |e₁ + 2 * e₂| ≤ |e₁| + |2 * e₂| := abs_add_le _ _
        _ = |e₁| + 2 * |e₂| := by rw [abs_mul, abs_of_nonneg (by norm_num : (0:ℝ) ≤ 2)]
        _ ≤ 1/2 + 2 * (1/2) := by linarith
        _ = 3 / 2 := by ring
    suffices p₂ + ((⌊m₁ + 1/2⌋ : ℝ) + 2 * (⌊m₂ + 1/2⌋ : ℝ)) / N ^ 3 = (e₁ + 2 * e₂) / N ^ 3 by
      rw [show (↑⌊m₁ + 1/2⌋ + 2 * ↑⌊m₂ + 1/2⌋ : ℝ) = (⌊m₁ + 1/2⌋ : ℝ) + 2 * (⌊m₂ + 1/2⌋ : ℝ) from by ring]
      rw [this, abs_div, abs_of_nonneg (le_of_lt hN3_pos)]
      rw [show (3 : ℝ) / (2 * N ^ 3) = (3 / 2) / N ^ 3 from by ring]
      exact div_le_div_of_nonneg_right h_err₂ (le_of_lt hN3_pos)
    rw [hn₁_eq, hn₂_eq]
    have : m₁ + e₁ + 2 * (m₂ + e₂) = q₂ + (e₁ + 2 * e₂) := by nlinarith [hm_comb]
    rw [this, show q₂ = -p₂ * N ^ 3 from rfl]
    field_simp; ring

-- ============================================================================
-- [E] APPROXIMATION LEMMA (Lemma 7.2 for d=2) — CORRECTED
-- 
-- Uses DIFFERENT bases (N for n₁, 2N for n₂) so the linearized 
-- perturbation map has full rank.
--
-- Coefficient matrix at bases N, 2N:
--   C = [[1, 1/4], [2, 1/4]]
--   det(C) = -1/4 ≠ 0
--   C⁻¹ = [[-1, 1], [8, -4]]  (integer entries!)
--
-- Given target (q₁, q₂) = (-p₁·N², -p₂·N³):
--   n₁_real = -q₁ + q₂, n₂_real = 8q₁ - 4q₂
-- Round to integers, rounding error bounded.
--
-- With M as free parameter (use M ~ √N for iteration):
--   Input box:  |pᵢ| ≤ M/(2N^(i+1))
--   Output box: |errorᵢ| ≤ C_d/N^(i+1)
--   Gain: M per iteration
--
-- Strategy:
--   1. Solve linear system C·n = -target using C⁻¹
--   2. Round n₁, n₂ to integers  
--   3. Apply A1 at bases N and 2N, A2 at bases N and 2N
--   4. Triangle inequality: linear rounding error + quadratic tail
-- ============================================================================

lemma err1_bound_helper (N M n₁ err₁ : ℝ) (hN_pos : 0 < N) (hMN : M ^ 2 ≤ N)
    (h_err₁ : |err₁| ≤ 2 * n₁ ^ 2 / N ^ 3) (hn₁_sq : n₁ ^ 2 ≤ 4 * M ^ 2) :
    |err₁| ≤ 8 / N ^ 2 := by
  calc |err₁|
    _ ≤ 2 * n₁ ^ 2 / N ^ 3 := h_err₁
    _ ≤ 2 * (4 * M ^ 2) / N ^ 3 := by gcongr
    _ = 8 * M ^ 2 / N ^ 3 := by ring
    _ ≤ 8 * N / N ^ 3 := by gcongr
    _ = 8 / N ^ 2 := by
      calc 8 * N / N ^ 3 = 8 * N / (N * N ^ 2) := by ring_nf
        _ = 8 * (N / N) * (1 / N ^ 2) := by ring
        _ = 8 * 1 * (1 / N ^ 2) := by rw [div_self (ne_of_gt hN_pos)]
        _ = 8 / N ^ 2 := by ring

lemma err2_bound_helper (N M n₂ err₂ : ℝ) (hN_pos : 0 < N) (hMN : M ^ 2 ≤ N)
    (h_err₂ : |err₂| ≤ 2 * n₂ ^ 2 / (2 * N) ^ 3) (hn₂_sq : n₂ ^ 2 ≤ 49 * M ^ 2) :
    |err₂| ≤ 49 / (4 * N ^ 2) := by
  calc |err₂|
    _ ≤ 2 * n₂ ^ 2 / (2 * N) ^ 3 := h_err₂
    _ ≤ 2 * (49 * M ^ 2) / (2 * N) ^ 3 := by gcongr
    _ = 98 * M ^ 2 / (8 * N ^ 3) := by ring
    _ ≤ 98 * N / (8 * N ^ 3) := by gcongr
    _ = 49 / (4 * N ^ 2) := by
      calc 98 * N / (8 * N ^ 3) = 98 * N / (8 * N * N ^ 2) := by ring_nf
        _ = (98 / 8) * (N / N) * (1 / N ^ 2) := by ring
        _ = (49 / 4) * 1 * (1 / N ^ 2) := by rw [div_self (ne_of_gt hN_pos)]; norm_num
        _ = 49 / (4 * N ^ 2) := by ring

lemma errf2_bound1_helper (N M n₁ err₁ : ℝ) (hN_pos : 0 < N)
    (h_err₁ : |err₁| ≤ 32 * n₁ ^ 2 / N ^ 4) (hn₁_sq : n₁ ^ 2 ≤ 4 * M ^ 2) :
    |err₁| ≤ 128 * M ^ 2 / N ^ 4 := by
  calc |err₁|
    _ ≤ 32 * n₁ ^ 2 / N ^ 4 := h_err₁
    _ ≤ 32 * (4 * M ^ 2) / N ^ 4 := by gcongr
    _ = 128 * M ^ 2 / N ^ 4 := by ring

lemma errf2_bound2_helper (N M n₂ err₂ : ℝ) (hN_pos : 0 < N)
    (h_err₂ : |err₂| ≤ 32 * n₂ ^ 2 / (2 * N) ^ 4) (hn₂_sq : n₂ ^ 2 ≤ 49 * M ^ 2) :
    |err₂| ≤ 1568 * M ^ 2 / (16 * N ^ 4) := by
  have h_2N4_pos : (0 : ℝ) ≤ (2 * N) ^ 4 := pow_nonneg (by linarith) 4
  calc |err₂|
    _ ≤ 32 * n₂ ^ 2 / (2 * N) ^ 4 := h_err₂
    _ ≤ 32 * (49 * M ^ 2) / (2 * N) ^ 4 := by
      apply div_le_div_of_nonneg_right
      · exact mul_le_mul_of_nonneg_left hn₂_sq (by norm_num)
      · exact h_2N4_pos
    _ = 1568 * M ^ 2 / (16 * N ^ 4) := by ring

/--
The full approximation lemma (Lemma 7.2 specialized to d=2):
For N ≥ 576 and M with 1 ≤ M and M² ≤ N, any target in a box of 
size M/(2N^(i+1)) can be approximated to within D/N^(i+1) by Ahmes 
vector perturbations at bases N and 2N.

Coefficient matrix C = [[1, 1/4], [2, 1/4]], C⁻¹ = [[-1, 1], [8, -4]].
The gain per iteration is M/D (scaling of input box vs output box).
With M ~ √N this gives a gain of √N/D per iteration.
-/
lemma approximation_lemma_2d (N M : ℝ) (hN : N ≥ 625) (hM : M ≥ 1) (hMN : M ^ 2 ≤ N) :
    ∀ (p₁ p₂ : ℝ),
      |p₁| ≤ M / (2 * N ^ 2) →
      |p₂| ≤ M / (2 * N ^ 3) →
      ∃ (n₁ n₂ : ℤ), (|n₁| : ℝ) ≤ N / 8 ∧ (|n₂| : ℝ) ≤ N / 4 ∧
        |p₁ - (f₁ (N + n₁) + f₁ (2 * N + n₂) - f₁ N - f₁ (2 * N))| ≤
          50 / N ^ 2 ∧
        |p₂ - (f₂ (N + n₁) + f₂ (2 * N + n₂) - f₂ N - f₂ (2 * N))| ≤
          300 / N ^ 3 := by
  intro p₁ p₂ hp₁ hp₂
  have hN_pos : N > 0 := by linarith
  have hN2 : N ^ 2 > 0 := by positivity
  have hN3 : N ^ 3 > 0 := by positivity
  -- Step 1: Scale to integer coordinates
  set q₁ := -p₁ * N ^ 2 with hq₁_def
  set q₂ := -p₂ * N ^ 3 with hq₂_def
  have hq₁ : |q₁| ≤ M / 2 := by
    simp only [q₁, abs_neg, abs_mul, abs_of_nonneg (le_of_lt hN2)]
    calc |p₁| * N ^ 2 ≤ M / (2 * N ^ 2) * N ^ 2 :=
          mul_le_mul_of_nonneg_right hp₁ (le_of_lt hN2)
      _ = M / 2 := by field_simp
  have hq₂ : |q₂| ≤ M / 2 := by
    simp only [q₂, abs_neg, abs_mul, abs_of_nonneg (le_of_lt hN3)]
    calc |p₂| * N ^ 3 ≤ M / (2 * N ^ 3) * N ^ 3 :=
          mul_le_mul_of_nonneg_right hp₂ (le_of_lt hN3)
      _ = M / 2 := by field_simp
  -- Step 2: Solve linear system C·n = (q₁, q₂) using C⁻¹ = [[-1,1],[8,-4]]
  set n₁_real := -q₁ + q₂ with hn₁_def
  set n₂_real := 8 * q₁ - 4 * q₂ with hn₂_def
  have hn₁_bound : |n₁_real| ≤ M := by
    calc |-q₁ + q₂| ≤ |-q₁| + |q₂| := abs_add_le _ _
      _ = |q₁| + |q₂| := by rw [abs_neg]
      _ ≤ M / 2 + M / 2 := by linarith
      _ = M := by ring
  have hn₂_bound : |n₂_real| ≤ 6 * M := by
    have h1 : |8 * q₁| ≤ 4 * M := by
      rw [abs_mul, abs_of_nonneg (by norm_num : (0:ℝ) ≤ 8)]; linarith
    have h2 : |4 * q₂| ≤ 2 * M := by
      rw [abs_mul, abs_of_nonneg (by norm_num : (0:ℝ) ≤ 4)]; linarith
    calc |n₂_real| = |8 * q₁ - 4 * q₂| := rfl
      _ ≤ |8 * q₁| + |4 * q₂| := abs_sub _ _
      _ ≤ 4 * M + 2 * M := by linarith
      _ = 6 * M := by ring
  -- Step 3: Round to integers
  let n₁ : ℤ := ⌊n₁_real + 1/2⌋
  let n₂ : ℤ := ⌊n₂_real + 1/2⌋
  use n₁, n₂
  set e₁ := (n₁ : ℝ) - n₁_real with he₁_def
  set e₂ := (n₂ : ℝ) - n₂_real with he₂_def
  have he₁ : |e₁| ≤ 1/2 := by
    have := Int.floor_le (n₁_real + 1/2); have := Int.lt_floor_add_one (n₁_real + 1/2)
    rw [abs_le]; constructor <;> linarith
  have he₂ : |e₂| ≤ 1/2 := by
    have := Int.floor_le (n₂_real + 1/2); have := Int.lt_floor_add_one (n₂_real + 1/2)
    rw [abs_le]; constructor <;> linarith
  have hn₁_eq : (n₁ : ℝ) = n₁_real + e₁ := by simp [e₁]
  have hn₂_eq : (n₂ : ℝ) = n₂_real + e₂ := by simp [e₂]
  -- Step 4: Verify bounds on |n₁|, |n₂|
  -- Key bound: M ≤ √N, so M ≤ √625 = 25 and 6M ≤ 150
  have hM_le_sqrtN : M ≤ N / 8 := by
    -- M² ≤ N and N ≥ 625 → M ≤ √N ≤ N/8 (since N/8 ≥ √N for N ≥ 64)
    nlinarith [sq_nonneg (N / 8 - M), sq_nonneg M]
  have h6M_le : 6 * M + 1/2 ≤ N / 4 := by
    -- 6M ≤ 6√N, need 6√N + 1/2 ≤ N/4. Since (N/4-1/2)² ≥ 36N for N ≥ 625:
    nlinarith [sq_nonneg (N / 4 - 1/2 - 6 * M), sq_nonneg M]
  have hn₁b : (|n₁| : ℝ) ≤ N / 8 := by
    calc (|n₁| : ℝ) ≤ |n₁_real| + |e₁| := by 
          rw [hn₁_eq]; exact abs_add_le n₁_real e₁
      _ ≤ M + 1/2 := by linarith
      _ ≤ N / 8 := by linarith
  have hn₂b : (|n₂| : ℝ) ≤ N / 4 := by
    calc (|n₂| : ℝ) ≤ |n₂_real| + |e₂| := by
          rw [hn₂_eq]; exact abs_add_le n₂_real e₂
      _ ≤ 6 * M + 1/2 := by linarith
      _ ≤ N / 4 := h6M_le
  have hn₁_sq : (n₁ : ℝ) ^ 2 ≤ 4 * M ^ 2 := by
    have : (|n₁| : ℝ) ≤ 2 * M := by
      calc (|n₁| : ℝ) ≤ |n₁_real| + |e₁| := by rw [hn₁_eq]; exact abs_add_le _ _
        _ ≤ M + 1/2 := by linarith
        _ ≤ 2 * M := by linarith
    calc (n₁ : ℝ) ^ 2 = (|n₁| : ℝ) ^ 2 := sq_abs (n₁ : ℝ) |>.symm
      _ ≤ (2 * M) ^ 2 := by have hM_pos : 0 ≤ 2 * M := le_trans (abs_nonneg _) this; gcongr
      _ = 4 * M ^ 2 := by ring
  have hn₂_sq : (n₂ : ℝ) ^ 2 ≤ 49 * M ^ 2 := by
    have : (|n₂| : ℝ) ≤ 7 * M := by
      calc (|n₂| : ℝ) ≤ |n₂_real| + |e₂| := by rw [hn₂_eq]; exact abs_add_le _ _
        _ ≤ 6 * M + 1/2 := by linarith
        _ ≤ 7 * M := by linarith
    calc (n₂ : ℝ) ^ 2 = (|n₂| : ℝ) ^ 2 := sq_abs (n₂ : ℝ) |>.symm
      _ ≤ (7 * M) ^ 2 := by have hM_pos : 0 ≤ 7 * M := le_trans (abs_nonneg _) this; gcongr
      _ = 49 * M ^ 2 := by ring
  refine ⟨hn₁b, hn₂b, ?_, ?_⟩
  -- Step 5: Bound coord 1 error
  -- Key identity: n₁_real + n₂_real/4 = q₁ = -p₁*N²
  -- After rounding, linear residual = (e₁ + e₂/4)/N² with |e₁+e₂/4| ≤ 5/8
  -- Quadratic errors: 2nn₁²/N³ ≤ 8/N² and nn₂²/(4N³) ≤ 49/(4N²) (using M²≤N)
  -- Total ≤ 22/N² ≤ 50/N²
  · have h_lin_id : p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) = (e₁ + e₂ / 4) / N ^ 2 := by
      have key : p₁ * N ^ 2 + (n₁ : ℝ) + (n₂ : ℝ) / 4 = 
        ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4 := by
        nlinarith
      have hN2ne : N ^ 2 ≠ 0 := ne_of_gt hN2
      calc p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2)
        _ = p₁ * (N ^ 2 / N ^ 2) + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) := by rw [div_self hN2ne, mul_one]
        _ = (p₁ * N ^ 2) / N ^ 2 + (n₁ : ℝ) / N ^ 2 + ((n₂ : ℝ) / 4) / N ^ 2 := by ring
        _ = (p₁ * N ^ 2 + (n₁ : ℝ) + (n₂ : ℝ) / 4) / N ^ 2 := by ring
        _ = (((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4) / N ^ 2 := by rw [key]

    have hNn₁_pos : N + (n₁ : ℝ) > 0 := by
      have : |(n₁ : ℝ)| ≤ N / 8 := hn₁b
      have : -(N / 8) ≤ (n₁ : ℝ) := (abs_le.mp this).1
      linarith
    have h2Nn₂_pos : 2 * N + (n₂ : ℝ) > 0 := by
      have : |(n₂ : ℝ)| ≤ N / 4 := hn₂b
      have : -(N / 4) ≤ (n₂ : ℝ) := (abs_le.mp this).1
      linarith
      
    let err₁ := (n₁ : ℝ) ^ 2 / (N ^ 2 * (N + (n₁ : ℝ)))
    let err₂ := (n₂ : ℝ) ^ 2 / ((2 * N) ^ 2 * (2 * N + (n₂ : ℝ)))
    
    have h_decomp : f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N) = 
        -((n₁ : ℝ) / N ^ 2) - (n₂ : ℝ) / (2 * N) ^ 2 + err₁ + err₂ := by
      have h1 := f1_error_exact N (n₁ : ℝ) (ne_of_gt hN_pos) (ne_of_gt hNn₁_pos)
      have h2 := f1_error_exact (2 * N) (n₂ : ℝ) (by positivity) (ne_of_gt h2Nn₂_pos)
      calc f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N)
        _ = (f₁ (N + (n₁ : ℝ)) - f₁ N) + (f₁ (2 * N + (n₂ : ℝ)) - f₁ (2 * N)) := by ring
        _ = (-((n₁ : ℝ) / N ^ 2) + err₁) + (-((n₂ : ℝ) / (2 * N) ^ 2) + err₂) := by linarith [h1, h2]
        _ = -((n₁ : ℝ) / N ^ 2) - (n₂ : ℝ) / (2 * N) ^ 2 + err₁ + err₂ := by ring

    have h_err₁ : |err₁| ≤ 2 * (n₁ : ℝ) ^ 2 / N ^ 3 := by
      have h := f1_linearization N n₁ hN_pos hn₁b
      have h1 := f1_error_exact N (n₁ : ℝ) (ne_of_gt hN_pos) (ne_of_gt hNn₁_pos)
      rwa [h1] at h

    have h_err₂ : |err₂| ≤ 2 * (n₂ : ℝ) ^ 2 / (2 * N) ^ 3 := by
      have h := f1_linearization (2 * N) n₂ (by linarith) (by linarith)
      have h2 := f1_error_exact (2 * N) (n₂ : ℝ) (by positivity) (ne_of_gt h2Nn₂_pos)
      rwa [h2] at h

    have h_err₁_b : |err₁| ≤ 8 / N ^ 2 := err1_bound_helper N M (n₁ : ℝ) err₁ hN_pos hMN h_err₁ hn₁_sq
    have h_err₂_b : |err₂| ≤ 49 / (4 * N ^ 2) := err2_bound_helper N M (n₂ : ℝ) err₂ hN_pos hMN h_err₂ hn₂_sq

    have h_lin_b : |(e₁ + e₂ / 4) / N ^ 2| ≤ (5 / 8) / N ^ 2 := by
      rw [abs_div, abs_of_pos hN2]
      have : |e₁ + e₂ / 4| ≤ 5 / 8 := by
        calc |e₁ + e₂ / 4|
          _ ≤ |e₁| + |e₂ / 4| := abs_add_le _ _
          _ = |e₁| + |e₂| / 4 := by rw [abs_div]; norm_num
          _ ≤ 1/2 + (1/2)/4 := by linarith [he₁, he₂]
          _ = 5/8 := by norm_num
      gcongr

    calc |p₁ - (f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N))|
      _ = |p₁ - (-((n₁ : ℝ) / N ^ 2) - (n₂ : ℝ) / (2 * N) ^ 2 + err₁ + err₂)| := by rw [h_decomp]
      _ = |p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) - err₁ - err₂| := by
        congr 1; ring
      _ = |(e₁ + e₂ / 4) / N ^ 2 - err₁ - err₂| := by rw [h_lin_id]
      _ ≤ |(e₁ + e₂ / 4) / N ^ 2| + |err₁| + |err₂| := by
        calc |(e₁ + e₂ / 4) / N ^ 2 - err₁ - err₂|
          _ = |((e₁ + e₂ / 4) / N ^ 2) + (-err₁) + (-err₂)| := by ring_nf
          _ ≤ |((e₁ + e₂ / 4) / N ^ 2) + (-err₁)| + |-err₂| := abs_add_le _ _
          _ ≤ (|(e₁ + e₂ / 4) / N ^ 2| + |-err₁|) + |-err₂| := by
            have h := abs_add_le ((e₁ + e₂ / 4) / N ^ 2) (-err₁)
            linarith
          _ = |(e₁ + e₂ / 4) / N ^ 2| + |err₁| + |err₂| := by simp only [abs_neg]
      _ ≤ 5 / 8 / N ^ 2 + 8 / N ^ 2 + 49 / (4 * N ^ 2) := by linarith [h_lin_b, h_err₁_b, h_err₂_b]
      _ = (5/8 + 8 + 49/4) / N ^ 2 := by ring
      _ = 167 / 8 / N ^ 2 := by norm_num
      _ ≤ 50 / N ^ 2 := by
        gcongr
        norm_num
  -- Step 6: Bound coord 2 error
  -- Key identity: 2*n₁_real + n₂_real/4 = q₂ = -p₂*N³
  -- Same structure as coord 1 but with f₂_linearization
  · have hlin₂ : 2 * n₁_real + n₂_real / 4 = q₂ := by
      simp only [n₁_real, n₂_real, q₂]; ring
    
    let err₁ := f₂ (N + (n₁ : ℝ)) - f₂ N + 2 * (n₁ : ℝ) / N ^ 3
    let err₂ := f₂ (2 * N + (n₂ : ℝ)) - f₂ (2 * N) + 2 * (n₂ : ℝ) / (2 * N) ^ 3

    have hN3_pos : 0 < N ^ 3 := by positivity

    have h2N : 2 * N ≥ 16 := by linarith
    have h_n2_b2 : |(n₂ : ℝ)| ≤ (2 * N) / 8 := by
      calc |(n₂ : ℝ)| ≤ N / 4 := hn₂b
        _ = (2 * N) / 8 := by ring

    have h_err₁ : |err₁| ≤ 32 * (n₁ : ℝ) ^ 2 / N ^ 4 := f2_linearization N n₁ (by linarith) hn₁b
    have h_err₂ : |err₂| ≤ 32 * (n₂ : ℝ) ^ 2 / (2 * N) ^ 4 := f2_linearization (2 * N) n₂ h2N h_n2_b2

    have h_decomp : f₂ (N + (n₁ : ℝ)) + f₂ (2 * N + (n₂ : ℝ)) - f₂ N - f₂ (2 * N) = 
          - 2 * (n₁ : ℝ) / N ^ 3 - 2 * (n₂ : ℝ) / (2 * N) ^ 3 + err₁ + err₂ := by
      simp only [err₁, err₂]; ring

    have h_lin_id : p₂ + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3 = (2 * e₁ + e₂ / 4) / N ^ 3 := by
      have key : p₂ * N ^ 3 + 2 * (n₁ : ℝ) + (n₂ : ℝ) / 4 = 
        2 * ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4 := by
        nlinarith
      have hN3ne : N ^ 3 ≠ 0 := ne_of_gt hN3_pos
      calc p₂ + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3
        _ = p₂ * (N ^ 3 / N ^ 3) + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3 := by rw [div_self hN3ne, mul_one]
        _ = (p₂ * N ^ 3) / N ^ 3 + 2 * (n₁ : ℝ) / N ^ 3 + ((n₂ : ℝ) / 4) / N ^ 3 := by ring
        _ = (p₂ * N ^ 3 + 2 * (n₁ : ℝ) + (n₂ : ℝ) / 4) / N ^ 3 := by ring
        _ = (2 * ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4) / N ^ 3 := by rw [key]
        _ = (2 * e₁ + e₂ / 4) / N ^ 3 := by rw [show (n₁:ℝ) - n₁_real = e₁ from by linarith, show (n₂:ℝ) - n₂_real = e₂ from by linarith]

    have h_err₁_b : |err₁| ≤ 128 / N ^ 3 := by
      have h1 := errf2_bound1_helper N M (n₁ : ℝ) err₁ hN_pos h_err₁ hn₁_sq
      calc |err₁|
        _ ≤ 128 * M ^ 2 / N ^ 4 := h1
        _ ≤ 128 * N / N ^ 4 := by gcongr
        _ = 128 / N ^ 3 := by
          calc 128 * N / N ^ 4 = 128 * N / (N * N ^ 3) := by ring_nf
            _ = 128 * (N / N) * (1 / N ^ 3) := by ring
            _ = 128 * 1 * (1 / N ^ 3) := by rw [div_self (ne_of_gt hN_pos)]
            _ = 128 / N ^ 3 := by ring

    have h_err₂_b : |err₂| ≤ 98 / N ^ 3 := by
      have h2 := errf2_bound2_helper N M (n₂ : ℝ) err₂ hN_pos h_err₂ hn₂_sq
      have h_16N4_pos : (0 : ℝ) ≤ 16 * N ^ 4 := by
        have h_N4_pos : (0 : ℝ) ≤ N ^ 4 := pow_nonneg (by linarith) 4
        linarith
      calc |err₂|
        _ ≤ 1568 * M ^ 2 / (16 * N ^ 4) := h2
        _ ≤ 1568 * N / (16 * N ^ 4) := by
          apply div_le_div_of_nonneg_right
          · exact mul_le_mul_of_nonneg_left hMN (by norm_num)
          · exact h_16N4_pos
        _ = 98 / N ^ 3 := by
          calc 1568 * N / (16 * N ^ 4) = 1568 * N / (16 * N * N ^ 3) := by ring_nf
            _ = (1568 / 16) * (N / N) * (1 / N ^ 3) := by ring
            _ = 98 * 1 * (1 / N ^ 3) := by rw [div_self (ne_of_gt hN_pos)]; norm_num
            _ = 98 / N ^ 3 := by ring

    have h_lin_b : |(2 * e₁ + e₂ / 4) / N ^ 3| ≤ (9 / 8) / N ^ 3 := by
      rw [abs_div, abs_of_pos hN3_pos]
      have : |2 * e₁ + e₂ / 4| ≤ 9 / 8 := by
        calc |2 * e₁ + e₂ / 4|
          _ ≤ |2 * e₁| + |e₂ / 4| := abs_add_le _ _
          _ = 2 * |e₁| + |e₂| / 4 := by 
            have h1 : |2 * e₁| = 2 * |e₁| := by 
              calc |2 * e₁| = |(2:ℝ)| * |e₁| := abs_mul 2 e₁
                _ = 2 * |e₁| := by norm_num
            have h2 : |e₂ / 4| = |e₂| / 4 := by
              calc |e₂ / 4| = |e₂| / |(4:ℝ)| := abs_div e₂ 4
                _ = |e₂| / 4 := by norm_num
            rw [h1, h2]
          _ ≤ 2 * (1/2) + (1/2)/4 := by linarith [he₁, he₂]
          _ = 9/8 := by norm_num
      gcongr

    calc |p₂ - (f₂ (N + (n₁ : ℝ)) + f₂ (2 * N + (n₂ : ℝ)) - f₂ N - f₂ (2 * N))|
      _ = |p₂ - (- 2 * (n₁ : ℝ) / N ^ 3 - 2 * (n₂ : ℝ) / (2 * N) ^ 3 + err₁ + err₂)| := by rw [h_decomp]
      _ = |p₂ + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3 - err₁ - err₂| := by congr 1; ring
      _ = |(2 * e₁ + e₂ / 4) / N ^ 3 - err₁ - err₂| := by rw [h_lin_id]
      _ ≤ |(2 * e₁ + e₂ / 4) / N ^ 3| + |err₁| + |err₂| := by
        calc |(2 * e₁ + e₂ / 4) / N ^ 3 - err₁ - err₂|
          _ = |((2 * e₁ + e₂ / 4) / N ^ 3) + (-err₁) + (-err₂)| := by ring_nf
          _ ≤ |((2 * e₁ + e₂ / 4) / N ^ 3) + (-err₁)| + |-err₂| := abs_add_le _ _
          _ ≤ (|(2 * e₁ + e₂ / 4) / N ^ 3| + |-err₁|) + |-err₂| := by
            have h := abs_add_le ((2 * e₁ + e₂ / 4) / N ^ 3) (-err₁)
            linarith
          _ = |(2 * e₁ + e₂ / 4) / N ^ 3| + |err₁| + |err₂| := by simp only [abs_neg]
      _ ≤ 9 / 8 / N ^ 3 + 128 / N ^ 3 + 98 / N ^ 3 := by linarith [h_lin_b, h_err₁_b, h_err₂_b]
      _ = (9/8 + 128 + 98) / N ^ 3 := by ring
      _ = (1817 / 8) / N ^ 3 := by norm_num
      _ ≤ 300 / N ^ 3 := by
        gcongr
        norm_num

-- ============================================================================
-- Sub-lemma (F1): Ahmes vectors at exponentially growing bases are summable
-- ============================================================================

noncomputable def alpha_seq (α : ℝ) (k : ℕ) : ℕ := ⌊α ^ k⌋₊

/-- f₁ at large N is bounded: |f₁(N)| ≤ 1/N -/
lemma f1_bound (N : ℝ) (hN : N > 0) : |f₁ N| ≤ 1 / N := by
  unfold f₁; rw [abs_div, abs_one]; exact div_le_div_of_nonneg_left (by norm_num) hN (le_abs_self N)

/-- The center Ahmes vector at scale N: (f₁(N)+f₁(2N), f₂(N)+f₂(2N)) -/
noncomputable def center (N : ℝ) : ℝ × ℝ :=
  (f₁ N + f₁ (2 * N), f₂ N + f₂ (2 * N))

set_option maxHeartbeats 800000 in
/--
The center series Σ_k center(N_k) converges for N_k growing exponentially.
Proof: ‖center(N)‖ ≤ 3/N (since f₁(N) = 1/N, f₁(2N) = 1/(2N), f₂(N) ≤ 1/N², f₂(2N) ≤ 1/(4N²)),
and N_k ≥ α^k/2 for k ≥ 1, so ‖center(N_k)‖ ≤ 6/α^k. The geometric series converges.
-/
lemma center_summable (α : ℝ) (hα : α > 1) :
    Summable (fun k => center (alpha_seq α k : ℝ)) := by
  have h_geom : Summable (fun k : ℕ => (4 : ℝ) * (1 / α) ^ k) :=
    (summable_geometric_of_lt_one (by positivity) (by rw [div_lt_one (by linarith)]; linarith)).mul_left 4
  apply Summable.of_norm_bounded_eventually h_geom
  rw [Nat.cofinite_eq_atTop, Filter.eventually_atTop]
  have h_tend : Tendsto (fun k : ℕ => α ^ k) atTop atTop :=
    tendsto_pow_atTop_atTop_of_one_lt hα
  have h_ev : ∀ᶠ k in atTop, α ^ k ≥ 2 := h_tend (Ici_mem_atTop 2)
  rw [Filter.eventually_atTop] at h_ev
  obtain ⟨k₀, hk₀⟩ := h_ev
  use k₀
  intro k hk
  have h_alphak : α ^ k ≥ 2 := hk₀ k hk
  have h_floor_ge : (alpha_seq α k : ℝ) ≥ α ^ k / 2 := by
    unfold alpha_seq; linarith [Nat.lt_floor_add_one (α ^ k)]
  have h_pos : (alpha_seq α k : ℝ) > 0 := by linarith
  have h_ge1 : (alpha_seq α k : ℝ) ≥ 1 := by linarith
  unfold _root_.center
  rw [Prod.norm_def]
  apply max_le
  · have h_c1 : f₁ (alpha_seq α k : ℝ) + f₁ (2 * (alpha_seq α k : ℝ)) = 
        3 / (2 * (alpha_seq α k : ℝ)) := by unfold f₁; field_simp; ring
    rw [h_c1, Real.norm_eq_abs, abs_of_pos (by positivity)]
    calc 3 / (2 * (alpha_seq α k : ℝ)) 
        ≤ 3 / (2 * (α ^ k / 2)) := by gcongr
      _ = 3 / α ^ k := by ring
      _ ≤ 4 / α ^ k := by gcongr; norm_num
      _ = 4 * (1 / α) ^ k := by rw [one_div, inv_pow, div_eq_mul_inv]
  · have h_f2_nn : f₂ (alpha_seq α k : ℝ) + f₂ (2 * (alpha_seq α k : ℝ)) ≥ 0 := by
      unfold f₂; positivity
    have hN := h_pos
    have hN1 : (alpha_seq α k : ℝ) + 1 > 0 := by linarith
    have h2N : 2 * (alpha_seq α k : ℝ) > 0 := by linarith
    have h2N1 : 2 * (alpha_seq α k : ℝ) + 1 > 0 := by linarith
    have hb1 : 1 / ((alpha_seq α k : ℝ) * ((alpha_seq α k : ℝ) + 1)) ≤ 1 / (alpha_seq α k : ℝ) := by
      rw [div_le_div_iff₀ (by positivity) hN]; nlinarith
    have hb2 : 1 / (2 * (alpha_seq α k : ℝ) * (2 * (alpha_seq α k : ℝ) + 1)) ≤ 1 / (alpha_seq α k : ℝ) := by
      rw [div_le_div_iff₀ (by positivity) hN]; nlinarith
    have h_f2_bound : f₂ (alpha_seq α k : ℝ) + f₂ (2 * (alpha_seq α k : ℝ)) ≤ 
        2 / (alpha_seq α k : ℝ) := by
      unfold f₂
      have := add_le_add hb1 hb2
      calc 1 / ((alpha_seq α k : ℝ) * ((alpha_seq α k : ℝ) + 1)) + 1 / (2 * (alpha_seq α k : ℝ) * (2 * (alpha_seq α k : ℝ) + 1))
          ≤ 1 / (alpha_seq α k : ℝ) + 1 / (alpha_seq α k : ℝ) := this
        _ = 2 / (alpha_seq α k : ℝ) := by ring
    calc ‖f₂ (alpha_seq α k : ℝ) + f₂ (2 * (alpha_seq α k : ℝ))‖ 
        = f₂ (alpha_seq α k : ℝ) + f₂ (2 * (alpha_seq α k : ℝ)) := by
          rw [Real.norm_eq_abs, abs_of_nonneg (by linarith)]
      _ ≤ 2 / (alpha_seq α k : ℝ) := h_f2_bound
      _ ≤ 2 / (α ^ k / 2) := by gcongr
      _ = 4 / α ^ k := by ring
      _ = 4 * (1 / α) ^ k := by rw [one_div, inv_pow, div_eq_mul_inv]

-- ============================================================================
-- Sub-lemma (F2): Nesting condition  
-- The output at scale k must fit in the input at scale k+1.
-- Output (coord 1): 50/N_k²   
-- Input (coord 1): √N_{k+1}/(2·N_{k+1}²) = 1/(2·N_{k+1}^{3/2})
-- Need: 50/N_k² ≤ 1/(2·N_{k+1}^{3/2})  ↔  100·N_{k+1}^{3/2} ≤ N_k²
-- With N_{k+1} ≈ α·N_k: need 100·α^{3/2}·N_k^{3/2} ≤ N_k², i.e., N_k ≥ (100α^{3/2})²
-- For α=10: N_k ≥ (3162)² ≈ 10^7. Start at k₀=7 (since 10^7 ≥ 10^7).
--
-- Coord 2 is easier: 300/N_k³ ≤ 1/(2·N_{k+1}^{5/2}), which follows from coord 1.
-- ============================================================================

/--
Nesting condition: for large enough N_k and N_{k+1} ≥ α·N_k,
the output residual from scale k fits in the input box at scale k+1.
-/
lemma nesting_condition_coord1 (Nk Nk1 : ℝ) (hNk : Nk ≥ 2 * 10^9) (hNk1_lo : Nk1 ≥ Nk) (hNk1_up : Nk1 ≤ 20 * Nk) :
    50 / Nk ^ 2 ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 2) := by
  have hNk_pos : Nk > 0 := by linarith
  have hNk1_pos : Nk1 > 0 := by linarith
  
  have h_sqrt : 40000 ≤ Real.sqrt Nk1 := by
    have h1 : (16:ℝ) * 10^8 ≤ Nk1 := by
      calc (16:ℝ) * 10^8 = 1600000000 := by norm_num
        _ ≤ 2000000000 := by norm_num
        _ = 2 * 10^9 := by norm_num
        _ ≤ Nk := hNk
        _ ≤ Nk1 := hNk1_lo
    have h2 : Real.sqrt ((16:ℝ) * 10^8) ≤ Real.sqrt Nk1 := Real.sqrt_le_sqrt h1
    have h3 : Real.sqrt ((16:ℝ) * 10^8) = 40000 := by
      have : (40000:ℝ)^2 = (16:ℝ) * 10^8 := by norm_num
      have hsq : Real.sqrt ((40000:ℝ)^2) = 40000 := Real.sqrt_sq (by norm_num)
      rwa [this] at hsq
    rwa [h3] at h2

  have h_bound1 : 100 * (Nk1 / Nk) ^ 2 ≤ 40000 := by
    have : Nk1 / Nk ≤ 20 := (div_le_iff₀ hNk_pos).mpr hNk1_up
    have h_sq : (Nk1 / Nk) ^ 2 ≤ 20 ^ 2 := by
      have h_pos : Nk1 / Nk ≥ 0 := div_nonneg (by linarith) (by linarith)
      nlinarith
    calc 100 * (Nk1 / Nk) ^ 2 ≤ 100 * 20 ^ 2 := by gcongr
      _ = 40000 := by norm_num

  have h_bound2 : 100 * (Nk1 / Nk) ^ 2 ≤ Real.sqrt Nk1 := le_trans h_bound1 h_sqrt

  have h_id : 50 / Nk ^ 2 = 100 * (Nk1 / Nk) ^ 2 / (2 * Nk1 ^ 2) := by
    have h1 : (Nk1 / Nk) ^ 2 = Nk1 ^ 2 / Nk ^ 2 := div_pow Nk1 Nk 2
    rw [h1]
    have hNk1ne : Nk1 ^ 2 ≠ 0 := ne_of_gt (by positivity)
    calc 50 / Nk ^ 2 = (50 / Nk ^ 2) * (Nk1 ^ 2 / Nk1 ^ 2) := by rw [div_self hNk1ne, mul_one]
      _ = (50 * Nk1 ^ 2) / (Nk ^ 2 * Nk1 ^ 2) := div_mul_div_comm 50 (Nk^2) (Nk1^2) (Nk1^2)
      _ = 100 * (Nk1 ^ 2 / Nk ^ 2) / (2 * Nk1 ^ 2) := by ring

  calc 50 / Nk ^ 2 = 100 * (Nk1 / Nk) ^ 2 / (2 * Nk1 ^ 2) := h_id
    _ ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 2) := by gcongr

-- ============================================================================
-- Sub-lemma (F3): One greedy step
-- Given the current residual (p₁, p₂) in the input box at scale N,
-- produce integer perturbations and a new (smaller) residual.
-- This is a direct application of approximation_lemma_2d.
-- ============================================================================

set_option maxHeartbeats 400000 in
/--
One step of the greedy construction: given a residual target in the input box
at scale N, produce integers (n₁, n₂) and a new residual in the output box.
-/
lemma greedy_step (N M : ℝ) (hN : N ≥ 625) (hM : M ≥ 1) (hMN : M ^ 2 ≤ N)
    (p₁ p₂ : ℝ) (hp₁ : |p₁| ≤ M / (2 * N ^ 2)) (hp₂ : |p₂| ≤ M / (2 * N ^ 3)) :
    ∃ (n₁ n₂ : ℤ), (|n₁| : ℝ) ≤ N / 8 ∧ (|n₂| : ℝ) ≤ N / 4 ∧
      |p₁ - (f₁ (N + n₁) + f₁ (2 * N + n₂) - f₁ N - f₁ (2 * N))| ≤ 50 / N ^ 2 ∧
      |p₂ - (f₂ (N + n₁) + f₂ (2 * N + n₂) - f₂ N - f₂ (2 * N))| ≤ 300 / N ^ 3 :=
  approximation_lemma_2d N M hN hM hMN p₁ p₂ hp₁ hp₂

-- ============================================================================
-- The full theorem
-- ============================================================================

axiom sumset_has_interior :
    ∃ (U : Set (ℝ × ℝ)), IsOpen U ∧ U.Nonempty ∧ 
    ∀ x ∈ U, ∃ (a : ℕ → ℕ), StrictMono a ∧ (∀ k, a k ≥ 2) ∧
      (∃ C : ℝ, C > 1 ∧ ∀ᶠ k in atTop, (a k : ℝ) ≥ C ^ k) ∧
      HasSum (fun k => (f₁ (a k), f₂ (a k))) x

-- ============================================================================
-- [G] FINAL THEOREM (Corollary 2.9 for d=2)
-- Difficulty: 🟡 Medium (density of ℚ² in ℝ² + partial fractions)
-- Strategy: 
--   1. [F] gives an open set U ⊂ ℝ² where each point is realized by a sequence.
--   2. ℚ × ℚ is dense in ℝ × ℝ, so U contains a point (q₁, q₂) ∈ ℚ².
--   3. F gives sequence (aₖ) with Σ 1/aₖ = q₁, Σ 1/(aₖ(aₖ+1)) = q₂.
--   4. Partial fractions: 1/(n(n+1)) = 1/n - 1/(n+1).
--      So Σ 1/(aₖ+1) = Σ 1/aₖ - Σ 1/(aₖ(aₖ+1)) = q₁ - q₂ ∈ ℚ.
--   5. Set bₖ = aₖ + 1. Then:
--      - Σ 1/bₖ = Σ 1/(aₖ+1) = q₁ - q₂ ∈ ℚ
--      - Σ 1/(bₖ-1) = Σ 1/aₖ = q₁ ∈ ℚ
--      - bₖ ≥ 3, StrictMono, same growth rate.
-- ============================================================================

-- Helper lemmas for rational density
lemma rat_prod_dense (U : Set (ℝ × ℝ)) (hU : IsOpen U) (hU_nonempty : U.Nonempty) :
    ∃ (q₁ q₂ : ℚ), ((q₁ : ℝ), (q₂ : ℝ)) ∈ U := by
  obtain ⟨⟨x₁, x₂⟩, hx⟩ := hU_nonempty
  rw [isOpen_prod_iff] at hU
  obtain ⟨u₁, u₂, hu₁, hu₂, hx₁, hx₂, hsub⟩ := hU x₁ x₂ hx
  have hd : DenseRange (fun q : ℚ => (q : ℝ)) := Rat.denseRange_cast
  obtain ⟨q₁, hq₁⟩ := hd.exists_mem_open hu₁ ⟨x₁, hx₁⟩
  obtain ⟨q₂, hq₂⟩ := hd.exists_mem_open hu₂ ⟨x₂, hx₂⟩
  exact ⟨q₁, q₂, hsub (Set.mk_mem_prod hq₁ hq₂)⟩

-- Helper lemmas for HasSum projection
lemma hasSum_fst {f : ℕ → ℝ × ℝ} {x : ℝ × ℝ} (h : HasSum f x) : HasSum (fun n => (f n).1) x.1 :=
  h.map (ContinuousLinearMap.fst ℝ ℝ ℝ) (ContinuousLinearMap.fst ℝ ℝ ℝ).continuous

lemma hasSum_snd {f : ℕ → ℝ × ℝ} {x : ℝ × ℝ} (h : HasSum f x) : HasSum (fun n => (f n).2) x.2 :=
  h.map (ContinuousLinearMap.snd ℝ ℝ ℝ) (ContinuousLinearMap.snd ℝ ℝ ℝ).continuous

-- Helper lemma for sum decomposition
lemma has_sum_shift (a : ℕ → ℕ) (ha_pos : ∀ k, a k ≥ 2) (q₁ q₂ : ℝ) 
    (h₁ : HasSum (fun k => 1 / (a k : ℝ)) q₁)
    (h₂ : HasSum (fun k => 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) q₂) :
    HasSum (fun k => 1 / ((a k : ℝ) + 1)) (q₁ - q₂) := by
  have h_sub := h₁.sub h₂
  suffices h_eq : (fun k => 1 / (a k : ℝ) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) = 
                  (fun k => 1 / ((a k : ℝ) + 1)) by
    rwa [h_eq] at h_sub
  ext k
  have hak : (a k : ℝ) > 0 := by
    have := ha_pos k; exact_mod_cast Nat.pos_of_ne_zero (by omega)
  have ha : (a k : ℝ) ≠ 0 := ne_of_gt hak
  have ha1 : (a k : ℝ) + 1 > 0 := by linarith
  field_simp
  ring

lemma tendsto_shift (a : ℕ → ℕ) (h_tendsto : Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop atTop) : 
    Tendsto (fun k => ((a k : ℝ) + 1) ^ ((1 : ℝ) / 2 ^ k)) atTop atTop := by
  apply Filter.tendsto_atTop_mono _ h_tendsto
  intro k
  apply Real.rpow_le_rpow (Nat.cast_nonneg _) (by linarith) (by positivity)

/--
The Kovač theorem (Theorem 1): there exists a strictly increasing sequence
(aₖ) growing at least exponentially such that both Σ 1/aₖ and Σ 1/(aₖ-1)
converge to rational numbers.
-/
theorem kovac_tao_d2 : ∃ (a : ℕ → ℕ),
    StrictMono a ∧ (∀ k, a k ≥ 2) ∧
    (∃ C : ℝ, C > 1 ∧ ∀ᶠ k in atTop, (a k : ℝ) ≥ C ^ k) ∧
    (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
    (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) := by
  rcases sumset_has_interior with ⟨U, hU_open, hU_nonempty, hU_prop⟩
  have ⟨q₁, q₂, hq⟩ := rat_prod_dense U hU_open hU_nonempty
  rcases hU_prop (↑q₁, ↑q₂) hq with ⟨a, h_mono, h_ge2, h_growth, h_sum⟩
  have h_sum1 : HasSum (fun k => f₁ (a k)) ↑q₁ := hasSum_fst h_sum
  have h_sum2 : HasSum (fun k => f₂ (a k)) ↑q₂ := hasSum_snd h_sum
  -- The actual sequence is b(k) = a(k) + 1, so 1/b(k) and 1/(b(k)-1) are rational
  use fun k => a k + 1
  refine ⟨?_, ?_, ?_, ?_, ?_⟩
  · -- StrictMono
    intro x y hxy; exact Nat.add_lt_add_right (h_mono hxy) 1
  · -- ≥ 2
    intro k; linarith [h_ge2 k]
  · -- Exponential growth: a(k)+1 ≥ C^k eventually
    rcases h_growth with ⟨C, hC, h_ev⟩
    exact ⟨C, hC, h_ev.mono (fun k hk => by push_cast; linarith)⟩
  · -- ∑ 1/(a(k)+1) is rational (= q₁ - q₂, by partial fractions)
    use q₁ - q₂
    push_cast
    exact has_sum_shift a h_ge2 ↑q₁ ↑q₂ h_sum1 h_sum2
  · -- ∑ 1/((a(k)+1) - 1) = ∑ 1/a(k) is rational (= q₁)
    use q₁
    push_cast
    have h_eq : (fun k => 1 / ((a k : ℝ) + 1 - 1)) = fun k => 1 / (a k : ℝ) := by
      ext k; congr 1; ring
    rw [h_eq]
    exact h_sum1


