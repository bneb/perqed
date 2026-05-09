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
lemma nesting_condition_coord1 (Nk Nk1 : ℝ) (hNk : Nk ≥ 3 * 10^13) (hNk1_lo : Nk1 ≥ Nk) (hNk1_up : Nk1 ^ 10 ≤ Nk ^ 11) :
    50 / Nk ^ 2 ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 2) := by
  have hk_pos : Nk > 0 := by linarith
  have hk1_pos : Nk1 > 0 := by linarith
  have h_goal : 10000 * Nk1 ^ 3 ≤ Nk ^ 4 := by
    have h1 : (10000 * Nk1 ^ 3) ^ 10 ≤ (Nk ^ 4) ^ 10 := by
      calc (10000 * Nk1 ^ 3) ^ 10 = 10000 ^ 10 * (Nk1 ^ 10) ^ 3 := by ring
        _ ≤ 10000 ^ 10 * (Nk ^ 11) ^ 3 := by gcongr
        _ = 10000 ^ 10 * Nk ^ 33 := by ring
        _ ≤ Nk ^ 7 * Nk ^ 33 := by
          gcongr
          calc (10000 : ℝ) ^ 10 = ((10 : ℝ) ^ 4) ^ 10 := by norm_num
            _ = (10 : ℝ) ^ 40 := by norm_num
            _ ≤ (3 * 10 ^ 13 : ℝ) ^ 7 := by norm_num
            _ ≤ Nk ^ 7 := by gcongr
        _ = (Nk ^ 4) ^ 10 := by ring
    exact le_of_pow_le_pow_left₀ (by norm_num) (by positivity) h1
  have h_sqrt : 100 * Nk1 ^ 2 ≤ Nk ^ 2 * Real.sqrt Nk1 := by
    have hsq : (100 * Nk1 ^ 2) ^ 2 ≤ (Nk ^ 2 * Real.sqrt Nk1) ^ 2 := by
      calc (100 * Nk1 ^ 2) ^ 2 = 10000 * Nk1 ^ 4 := by ring
        _ = (10000 * Nk1 ^ 3) * Nk1 := by ring
        _ ≤ Nk ^ 4 * Nk1 := by gcongr
        _ = (Nk ^ 2) ^ 2 * (Real.sqrt Nk1) ^ 2 := by
          rw [Real.sq_sqrt (by positivity)]
          ring
        _ = (Nk ^ 2 * Real.sqrt Nk1) ^ 2 := by ring
    exact le_of_pow_le_pow_left₀ (by norm_num) (by positivity) hsq
  rw [div_le_div_iff₀ (by positivity) (by positivity)]
  calc 50 * (2 * Nk1 ^ 2) = 100 * Nk1 ^ 2 := by ring
    _ ≤ Nk ^ 2 * Real.sqrt Nk1 := h_sqrt
    _ = Real.sqrt Nk1 * Nk ^ 2 := mul_comm _ _

-- ============================================================================
-- Sub-lemma (F2b): Nesting condition for coordinate 2
-- 300/Nk^3 ≤ √Nk1/(2*Nk1^3)
-- Requires Nk ≥ 3*10^13 (larger threshold than coord 1 due to cubic growth)
-- ============================================================================

set_option maxHeartbeats 800000 in
lemma nesting_condition_coord2 (Nk Nk1 : ℝ) (hNk : Nk ≥ 3 * 10^13) 
    (hNk1_lo : Nk1 ≥ Nk) (hNk1_up : Nk1 ^ 10 ≤ Nk ^ 11) :
    300 / Nk ^ 3 ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 3) := by
  have hk_pos : Nk > 0 := by linarith
  have hk1_pos : Nk1 > 0 := by linarith
  have h_goal : 360000 * Nk1 ^ 5 ≤ Nk ^ 6 := by
    have h1 : (360000 * Nk1 ^ 5) ^ 2 ≤ (Nk ^ 6) ^ 2 := by
      calc (360000 * Nk1 ^ 5) ^ 2 = 360000 ^ 2 * (Nk1 ^ 10) := by ring
        _ ≤ 360000 ^ 2 * Nk ^ 11 := by gcongr
        _ = 360000 ^ 2 * Nk ^ 11 := by ring
        _ ≤ Nk * Nk ^ 11 := by
          gcongr
          calc (360000 : ℝ) ^ 2 = 129600000000 := by norm_num
            _ ≤ 3 * 10^13 := by norm_num
            _ ≤ Nk := hNk
        _ = (Nk ^ 6) ^ 2 := by ring
    exact le_of_pow_le_pow_left₀ (by norm_num) (by positivity) h1
  have h_sqrt : 600 * Nk1 ^ 3 ≤ Nk ^ 3 * Real.sqrt Nk1 := by
    have hsq : (600 * Nk1 ^ 3) ^ 2 ≤ (Nk ^ 3 * Real.sqrt Nk1) ^ 2 := by
      calc (600 * Nk1 ^ 3) ^ 2 = 360000 * Nk1 ^ 6 := by ring
        _ = (360000 * Nk1 ^ 5) * Nk1 := by ring
        _ ≤ Nk ^ 6 * Nk1 := by gcongr
        _ = (Nk ^ 3) ^ 2 * (Real.sqrt Nk1) ^ 2 := by
          rw [Real.sq_sqrt (by positivity)]
          ring
        _ = (Nk ^ 3 * Real.sqrt Nk1) ^ 2 := by ring
    exact le_of_pow_le_pow_left₀ (by norm_num) (by positivity) hsq
  rw [div_le_div_iff₀ (by positivity) (by positivity)]
  calc 300 * (2 * Nk1 ^ 3) = 600 * Nk1 ^ 3 := by ring
    _ ≤ Nk ^ 3 * Real.sqrt Nk1 := h_sqrt
    _ = Real.sqrt Nk1 * Nk ^ 3 := mul_comm _ _

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
-- Sub-lemma (F4): One step composition
-- Chains the greedy step with the nesting conditions.
-- ============================================================================

lemma one_step_composition (N N' : ℝ) (hN : N ≥ 3 * 10^13)
    (hN_bound1 : N' ≥ N) (hN_bound2 : N' ^ 10 ≤ N ^ 11)
    (p₁ p₂ : ℝ) (hp₁ : |p₁| ≤ Real.sqrt N / (2 * N ^ 2)) 
    (hp₂ : |p₂| ≤ Real.sqrt N / (2 * N ^ 3)) :
    ∃ (n₁ n₂ : ℤ), (|n₁| : ℝ) ≤ N / 8 ∧ (|n₂| : ℝ) ≤ N / 4 ∧
      |p₁ - (f₁ (N + n₁) + f₁ (2 * N + n₂) - f₁ N - f₁ (2 * N))| ≤ Real.sqrt N' / (2 * N' ^ 2) ∧
      |p₂ - (f₂ (N + n₁) + f₂ (2 * N + n₂) - f₂ N - f₂ (2 * N))| ≤ Real.sqrt N' / (2 * N' ^ 3) := by
  have hM : Real.sqrt N ≥ 1 := by
    have h1 : N ≥ 1 := by linarith
    exact Real.one_le_sqrt.mpr h1
  have hMN : (Real.sqrt N) ^ 2 ≤ N := by
    rw [Real.sq_sqrt (by linarith)]
  have hN625 : N ≥ 625 := by linarith
  rcases greedy_step N (Real.sqrt N) hN625 hM hMN p₁ p₂ hp₁ hp₂ with ⟨n₁, n₂, hn₁, hn₂, h_res1, h_res2⟩
  use n₁, n₂
  refine ⟨hn₁, hn₂, ?_, ?_⟩
  · exact le_trans h_res1 (nesting_condition_coord1 N N' hN hN_bound1 hN_bound2)
  · exact le_trans h_res2 (nesting_condition_coord2 N N' hN hN_bound1 hN_bound2)

-- ============================================================================
-- Sub-lemma (F5): Recursive sequence construction
-- Defines the sequence a_k iteratively using one_step_composition.
-- ============================================================================

def E_seq : ℕ → ℕ
| 0 => 14
| (k + 1) => (11 * E_seq k) / 10

lemma E_seq_ge_14 (k : ℕ) : E_seq k ≥ 14 := by
  induction' k with k ih
  · exact rfl.ge
  · unfold E_seq
    have h : 11 * 14 ≤ 11 * E_seq k := Nat.mul_le_mul_left 11 ih
    have h2 : (11 * 14) / 10 ≤ (11 * E_seq k) / 10 := Nat.div_le_div_right h
    exact le_trans (by norm_num) h2

lemma E_seq_mono (k : ℕ) : E_seq k + 1 ≤ E_seq (k + 1) := by
  have heq : E_seq (k + 1) = (11 * E_seq k) / 10 := rfl
  have h1 : E_seq k ≥ 14 := E_seq_ge_14 k
  rw [heq]
  omega

lemma E_seq_step_bound (k : ℕ) : 100 * E_seq (k + 1) ≥ 102 * E_seq k := by
  have h1 : E_seq (k + 1) = (11 * E_seq k) / 10 := rfl
  have h2 : E_seq k ≥ 14 := E_seq_ge_14 k
  rw [h1]
  omega

lemma E_seq_exp_bound (k : ℕ) : (14 : ℝ) * (1.02 : ℝ) ^ k ≤ (E_seq k : ℝ) := by
  induction' k with k ih
  · simp
    have h : E_seq 0 = 14 := rfl
    exact_mod_cast h.ge
  · have h1 : 100 * E_seq (k + 1) ≥ 102 * E_seq k := E_seq_step_bound k
    have h2 : (E_seq (k + 1) : ℝ) ≥ 1.02 * (E_seq k : ℝ) := by
      have h3 : (100 : ℝ) * (E_seq (k + 1) : ℝ) ≥ (102 : ℝ) * (E_seq k : ℝ) := by exact_mod_cast h1
      linarith
    calc (14 : ℝ) * (1.02 : ℝ) ^ (k + 1) = (14 : ℝ) * (1.02 : ℝ) ^ k * 1.02 := by ring
      _ ≤ (E_seq k : ℝ) * 1.02 := by gcongr
      _ = 1.02 * (E_seq k : ℝ) := by ring
      _ ≤ (E_seq (k + 1) : ℝ) := h2

noncomputable def seq_N (k : ℕ) : ℝ := (10 : ℝ) ^ E_seq k

lemma seq_N_bound0 (k : ℕ) : seq_N k ≥ 3 * 10^13 := by
  unfold seq_N
  have h1 : E_seq k ≥ 14 := E_seq_ge_14 k
  calc 3 * 10^13 ≤ 10^14 := by norm_num
    _ = (10 : ℝ) ^ 14 := by norm_num
    _ ≤ (10 : ℝ) ^ E_seq k := by
      apply pow_le_pow_right₀ (by norm_num) h1

lemma seq_N_bound1 (k : ℕ) : seq_N (k + 1) ≥ seq_N k := by
  unfold seq_N
  have h1 : E_seq k ≤ E_seq (k + 1) := by
    have : E_seq k + 1 ≤ E_seq (k + 1) := E_seq_mono k
    omega
  apply pow_le_pow_right₀ (by norm_num) h1

lemma seq_N_bound2 (k : ℕ) : seq_N (k + 1) ^ 10 ≤ seq_N k ^ 11 := by
  unfold seq_N
  have h1 : ((10 : ℝ) ^ E_seq (k + 1)) ^ 10 = (10 : ℝ) ^ (10 * E_seq (k + 1)) := by
    rw [← pow_mul]
    congr 1
    ring
  have h2 : ((10 : ℝ) ^ E_seq k) ^ 11 = (10 : ℝ) ^ (11 * E_seq k) := by
    rw [← pow_mul]
    congr 1
    ring
  rw [h1, h2]
  have heq : E_seq (k + 1) = (11 * E_seq k) / 10 := rfl
  have h_le : 10 * E_seq (k + 1) ≤ 11 * E_seq k := by
    rw [heq]
    exact Nat.mul_div_le _ _
  apply pow_le_pow_right₀ (by norm_num) h_le

lemma seq_N_bound3 (k : ℕ) : seq_N (k + 1) ≥ 3 * seq_N k := by
  unfold seq_N
  have h1 : E_seq k + 1 ≤ E_seq (k + 1) := E_seq_mono k
  calc 3 * (10 : ℝ) ^ E_seq k ≤ 10 * (10 : ℝ) ^ E_seq k := by gcongr; norm_num
    _ = (10 : ℝ) ^ (E_seq k + 1) := by ring
    _ ≤ (10 : ℝ) ^ E_seq (k + 1) := by
      apply pow_le_pow_right₀ (by norm_num) h1

/-- The greedy sequence of residuals and perturbations -/
noncomputable def construct_n (x : ℝ × ℝ) : ℕ → (ℝ × ℝ) × (ℤ × ℤ)
| 0 => (x, (0, 0))
| (k + 1) => 
  let p_k := (construct_n x k).1
  let N := seq_N k
  let N1 := seq_N (k + 1)
  if h : |p_k.1| ≤ Real.sqrt N / (2 * N ^ 2) ∧ |p_k.2| ≤ Real.sqrt N / (2 * N ^ 3) then
    let n1 := Classical.choose (one_step_composition N N1 (seq_N_bound0 k) (seq_N_bound1 k) (seq_N_bound2 k) p_k.1 p_k.2 h.1 h.2)
    let n2 := Classical.choose (Classical.choose_spec (one_step_composition N N1 (seq_N_bound0 k) (seq_N_bound1 k) (seq_N_bound2 k) p_k.1 p_k.2 h.1 h.2))
    let new_p1 := p_k.1 - (f₁ (N + n1) + f₁ (2 * N + n2) - f₁ N - f₁ (2 * N))
    let new_p2 := p_k.2 - (f₂ (N + n1) + f₂ (2 * N + n2) - f₂ N - f₂ (2 * N))
    ((new_p1, new_p2), (n1, n2))
  else
    ((0, 0), (0, 0))

lemma construct_n_bounds (x : ℝ × ℝ) (k : ℕ) : 
    (|(construct_n x (k + 1)).2.1| : ℝ) ≤ seq_N k / 8 ∧ 
    (|(construct_n x (k + 1)).2.2| : ℝ) ≤ seq_N k / 4 := by
  unfold construct_n
  dsimp only
  split_ifs with h
  · have h_exists := one_step_composition (seq_N k) (seq_N (k + 1)) (seq_N_bound0 k) (seq_N_bound1 k) (seq_N_bound2 k) (construct_n x k).1.1 (construct_n x k).1.2 h.1 h.2
    have h_spec := Classical.choose_spec (Classical.choose_spec h_exists)
    exact ⟨h_spec.1, h_spec.2.1⟩
  · have h0 : (0 : ℝ) ≤ seq_N k := by
      unfold seq_N
      positivity
    exact ⟨by linarith, by linarith⟩

/-- The actual sequence a_k of integers -/
noncomputable def construct_a (x : ℝ × ℝ) (k : ℕ) : ℕ :=
  if k % 2 = 0 then
    ⌊seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.1⌋₊
  else
    ⌊2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2⌋₊

lemma floor_lt_floor_of_add_one_le {x y : ℝ} (hx : 0 ≤ x) (h : x + 1 ≤ y) : ⌊x⌋₊ < ⌊y⌋₊ := by
  have h1 : (⌊x⌋₊ : ℝ) ≤ x := Nat.floor_le hx
  apply Nat.le_floor
  push_cast
  linarith

lemma construct_a_strict_mono (x : ℝ × ℝ) : StrictMono (construct_a x) := by
  apply strictMono_nat_of_lt_succ
  intro k
  unfold construct_a
  have hk_mod : k % 2 = 0 ∨ k % 2 = 1 := by omega
  rcases hk_mod with heq | heq
  · -- case k is even
    have heq1 : (k + 1) % 2 = 1 := by omega
    have hdiv1 : (k + 1) / 2 = k / 2 := by omega
    rw [if_pos heq, if_neg (by omega)]
    rw [hdiv1]
    have h_bound := construct_n_bounds x (k / 2)
    have hn1_upper : (construct_n x (k / 2 + 1)).2.1 ≤ seq_N (k / 2) / 8 := le_trans (le_abs_self _) h_bound.1
    have hn1_lower : (construct_n x (k / 2 + 1)).2.1 ≥ - (seq_N (k / 2) / 8) := neg_le_of_abs_le h_bound.1
    have hn2_lower : (construct_n x (k / 2 + 1)).2.2 ≥ - (seq_N (k / 2) / 4) := neg_le_of_abs_le h_bound.2
    have hN : seq_N (k / 2) ≥ 3 * 10^13 := seq_N_bound0 (k / 2)
    have hl : seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.1 ≤ 9 / 8 * seq_N (k / 2) := by linarith
    have hr : 2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2 ≥ 7 / 4 * seq_N (k / 2) := by linarith
    have h_gap : 9 / 8 * seq_N (k / 2) + 1 ≤ 7 / 4 * seq_N (k / 2) := by linarith
    have hx : 0 ≤ seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.1 := by linarith
    apply floor_lt_floor_of_add_one_le
    · exact hx
    · linarith
  · -- case k is odd
    have heq1 : (k + 1) % 2 = 0 := by omega
    have hdiv1 : (k + 1) / 2 = k / 2 + 1 := by omega
    rw [if_neg (by omega), if_pos heq1]
    rw [hdiv1]
    have h_bound := construct_n_bounds x (k / 2)
    have h_bound_next := construct_n_bounds x (k / 2 + 1)
    have hn2_upper : (construct_n x (k / 2 + 1)).2.2 ≤ seq_N (k / 2) / 4 := le_trans (le_abs_self _) h_bound.2
    have hn2_lower : (construct_n x (k / 2 + 1)).2.2 ≥ - (seq_N (k / 2) / 4) := neg_le_of_abs_le h_bound.2
    have hn1_next_lower : (construct_n x (k / 2 + 2)).2.1 ≥ - (seq_N (k / 2 + 1) / 8) := neg_le_of_abs_le h_bound_next.1
    have hN : seq_N (k / 2) ≥ 3 * 10^13 := seq_N_bound0 (k / 2)
    have hN_rel : seq_N (k / 2 + 1) ≥ 3 * seq_N (k / 2) := seq_N_bound3 (k / 2)
    have hl : 2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2 ≤ 9 / 4 * seq_N (k / 2) := by linarith
    have hr : seq_N (k / 2 + 1) + (construct_n x (k / 2 + 2)).2.1 ≥ 21 / 8 * seq_N (k / 2) := by linarith
    have h_gap : 9 / 4 * seq_N (k / 2) + 1 ≤ 21 / 8 * seq_N (k / 2) := by linarith
    have hx : 0 ≤ 2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2 := by linarith
    apply floor_lt_floor_of_add_one_le
    · exact hx
    · linarith

lemma construct_a_ge_2 (x : ℝ × ℝ) (k : ℕ) : construct_a x k ≥ 2 := by
  unfold construct_a
  split_ifs
  · have h_bound := construct_n_bounds x (k / 2)
    have h_n1_le := h_bound.1
    have h_N : seq_N (k / 2) ≥ 3 * 10^13 := seq_N_bound0 (k / 2)
    apply Nat.le_floor
    have : (construct_n x (k / 2 + 1)).2.1 ≥ - (seq_N (k / 2) / 8) := by
      exact neg_le_of_abs_le h_n1_le
    calc (2:ℝ) ≤ 7 / 8 * (3 * 10^13) := by norm_num
      _ ≤ 7 / 8 * seq_N (k / 2) := by gcongr
      _ = seq_N (k / 2) - seq_N (k / 2) / 8 := by ring
      _ ≤ seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.1 := by linarith
  · have h_bound := construct_n_bounds x (k / 2)
    have h_n2_le := h_bound.2
    have h_N : seq_N (k / 2) ≥ 3 * 10^13 := seq_N_bound0 (k / 2)
    apply Nat.le_floor
    have : (construct_n x (k / 2 + 1)).2.2 ≥ - (seq_N (k / 2) / 4) := neg_le_of_abs_le h_n2_le
    calc (2:ℝ) ≤ 7 / 4 * (3 * 10^13) := by norm_num
      _ ≤ 7 / 4 * seq_N (k / 2) := by gcongr
      _ = 2 * seq_N (k / 2) - seq_N (k / 2) / 4 := by ring
      _ ≤ 2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2 := by linarith

lemma construct_a_lower_bound (x : ℝ × ℝ) (k : ℕ) : 
  (construct_a x k : ℝ) ≥ (3 / 4 : ℝ) * seq_N (k / 2) := by
  have hk_mod : k % 2 = 0 ∨ k % 2 = 1 := by omega
  unfold construct_a
  rcases hk_mod with heq | heq
  · rw [if_pos heq]
    have h_bound := construct_n_bounds x (k / 2)
    have hn1_lower : (construct_n x (k / 2 + 1)).2.1 ≥ - (seq_N (k / 2) / 8) := neg_le_of_abs_le h_bound.1
    have h_floor : (⌊seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.1⌋₊ : ℝ) > seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.1 - 1 := Nat.sub_one_lt_floor _
    have hN : seq_N (k / 2) ≥ 3 * 10^13 := seq_N_bound0 (k / 2)
    linarith
  · rw [if_neg (by omega)]
    have h_bound := construct_n_bounds x (k / 2)
    have hn2_lower : (construct_n x (k / 2 + 1)).2.2 ≥ - (seq_N (k / 2) / 4) := neg_le_of_abs_le h_bound.2
    have h_floor : (⌊2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2⌋₊ : ℝ) > 2 * seq_N (k / 2) + (construct_n x (k / 2 + 1)).2.2 - 1 := Nat.sub_one_lt_floor _
    have hN : seq_N (k / 2) ≥ 3 * 10^13 := seq_N_bound0 (k / 2)
    linarith

lemma tendsto_fractional_base (β : ℝ) (hβ : β > 1) : 
  Tendsto (fun k : ℕ => (3 / 4 : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop (𝓝 1) := by
  have h1 : Tendsto (fun k : ℕ => ((1 : ℝ) / β ^ k)) atTop (𝓝 0) := by
    have hb : Tendsto (fun k : ℕ => β ^ k) atTop atTop := tendsto_pow_atTop_atTop_of_one_lt hβ
    have hc : Tendsto (fun k : ℕ => (β ^ k)⁻¹) atTop (𝓝 0) := tendsto_inv_atTop_zero.comp hb
    exact hc.congr (fun n => (one_div (β ^ n)).symm)
  have h2 : Tendsto (fun x : ℝ => (3 / 4 : ℝ) ^ x) (𝓝 0) (𝓝 1) := by
    have hzero : (3 / 4 : ℝ) ^ (0 : ℝ) = 1 := Real.rpow_zero _
    rw [← hzero]
    exact ContinuousAt.tendsto (Continuous.continuousAt (Real.continuous_const_rpow (by norm_num)))
  exact Tendsto.comp h2 h1

lemma tendsto_exponential_domination (c β : ℝ) (hc : c > β) (hβ : β > 1) :
  Tendsto (fun k : ℕ => ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k)) atTop atTop := by
  have heq : (fun k : ℕ => ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k)) = fun k : ℕ => (10 : ℝ) ^ (14 * (c / β) ^ k) := by
    ext k
    rw [← Real.rpow_mul (by norm_num)]
    congr 1
    calc 14 * c ^ k * (1 / β ^ k) = 14 * (c ^ k / β ^ k) := by ring
      _ = 14 * (c / β) ^ k := by rw [div_pow]
  rw [heq]
  have h_gt_1 : c / β > 1 := by
    have hpos : β > 0 := by linarith
    exact (one_lt_div hpos).mpr hc
  have h1 : Tendsto (fun k : ℕ => (c / β) ^ k) atTop atTop := tendsto_pow_atTop_atTop_of_one_lt h_gt_1
  have h2 : Tendsto (fun k : ℕ => 14 * (c / β) ^ k) atTop atTop := Tendsto.const_mul_atTop (by norm_num) h1
  have hlog : Real.log 10 > 0 := Real.log_pos (by norm_num)
  have heq2 : (fun k : ℕ => (10 : ℝ) ^ (14 * (c / β) ^ k)) = fun k : ℕ => Real.exp (14 * (c / β) ^ k * Real.log 10) := by
    ext k
    rw [Real.rpow_def_of_pos (by norm_num)]
    congr 1
    ring
  rw [heq2]
  exact Real.tendsto_exp_atTop.comp (Tendsto.atTop_mul_const hlog h2)

lemma k_div_2_bound (k : ℕ) : ((k / 2 : ℕ) : ℝ) ≥ (k : ℝ) / 2 - 1 / 2 := by
  have h1 : 2 * (k / 2 : ℕ) + k % 2 = k := Nat.div_add_mod k 2
  have h2 : k % 2 ≤ 1 := by
    have hlt : k % 2 < 2 := Nat.mod_lt k (by norm_num)
    omega
  have h3 : (2 : ℝ) * ((k / 2 : ℕ) : ℝ) + ((k % 2 : ℕ) : ℝ) = (k : ℝ) := by exact_mod_cast h1
  have h4 : ((k % 2 : ℕ) : ℝ) ≤ 1 := by exact_mod_cast h2
  linarith

lemma construct_a_growth (x : ℝ × ℝ) : 
  ∃ β : ℝ, β > 1 ∧ Tendsto (fun k => (construct_a x k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop := by
  let c := (1.02 : ℝ) ^ (1 / 4 : ℝ)
  let β := (1.02 : ℝ) ^ (1 / 8 : ℝ)
  use β
  have hβ : β > 1 := by
    dsimp [β]
    rw [← Real.rpow_zero (1.02 : ℝ)]
    apply Real.rpow_lt_rpow_of_exponent_lt (by norm_num) (by norm_num)
  refine ⟨hβ, ?_⟩
  have hc : c > β := by
    dsimp [c, β]
    apply Real.rpow_lt_rpow_of_exponent_lt (by norm_num) (by norm_num)
  have h_base := tendsto_fractional_base β hβ
  have h_exp := tendsto_exponential_domination c β hc hβ
  
  have h_base_eventually : ∀ᶠ k in atTop, (3 / 4 : ℝ) ^ ((1 : ℝ) / β ^ k) ≥ 1 / 2 := by
    have h_nhds : (1 / 2 : ℝ) < 1 := by norm_num
    have h_lt := (tendsto_order.mp h_base).1 (1 / 2) h_nhds
    filter_upwards [h_lt] with k hk
    exact hk.le

  have h_mul_bound : ∀ᶠ k in atTop, (1 / 2 : ℝ) * ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k) ≤ 
    ((3 / 4 : ℝ) ^ ((1 : ℝ) / β ^ k)) * ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k) := by
    filter_upwards [h_base_eventually] with k hk
    have h_exp_pos : ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k) ≥ 0 := by
      apply Real.rpow_nonneg
      positivity
    exact mul_le_mul_of_nonneg_right hk h_exp_pos

  have h_half_exp : Tendsto (fun k : ℕ => (1 / 2 : ℝ) * ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k)) atTop atTop :=
    Tendsto.const_mul_atTop (by norm_num) h_exp

  have h_mul_tendsto : Tendsto (fun k : ℕ => ((3 / 4 : ℝ) ^ ((1 : ℝ) / β ^ k)) * ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k)) atTop atTop :=
    tendsto_atTop_mono' atTop h_mul_bound h_half_exp
    
  have h_final_bound : ∀ᶠ k in atTop, ((3 / 4 : ℝ) ^ ((1 : ℝ) / β ^ k)) * ((10 : ℝ) ^ (14 * c ^ k)) ^ ((1 : ℝ) / β ^ k) ≤ (construct_a x k : ℝ) ^ ((1 : ℝ) / β ^ k) := by
    filter_upwards [eventually_ge_atTop 2] with k hk
    rw [← Real.mul_rpow (by norm_num) (by positivity)]
    have h_exp_pos : (1 : ℝ) / β ^ k ≥ 0 := by positivity
    apply Real.rpow_le_rpow (by positivity)
    · calc (3 / 4 : ℝ) * (10 : ℝ) ^ (14 * c ^ k)
        _ = (3 / 4 : ℝ) * (10 : ℝ) ^ (14 * c ^ (k : ℝ)) := by rw [Real.rpow_natCast]
        _ = (3 / 4 : ℝ) * (10 : ℝ) ^ (14 * ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ)) := by dsimp [c]
        _ ≤ (3 / 4 : ℝ) * (10 : ℝ) ^ (E_seq (k / 2) : ℝ) := by
            have he : (E_seq (k / 2) : ℝ) ≥ 14 * (1.02 : ℝ) ^ (k / 2 : ℕ) := E_seq_exp_bound (k / 2)
            have hc1 : (1.02 : ℝ) ^ (k / 2 : ℕ) = (1.02 : ℝ) ^ ((k / 2 : ℕ) : ℝ) := by
              rw [Real.rpow_natCast]
            have hc2 : ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ) = (1.02 : ℝ) ^ ((k : ℝ) / 4) := by
              rw [← Real.rpow_mul (by norm_num)]; congr 1; ring
            have hle : ((k / 2 : ℕ) : ℝ) ≥ (k : ℝ) / 4 := by
              have h1 : 2 * (k / 2 : ℕ) + k % 2 = k := Nat.div_add_mod k 2
              have h2 : k % 2 ≤ 1 := by omega
              have h3 : (2 : ℝ) * ((k / 2 : ℕ) : ℝ) + ((k % 2 : ℕ) : ℝ) = (k : ℝ) := by exact_mod_cast h1
              have h4 : ((k % 2 : ℕ) : ℝ) ≤ 1 := by exact_mod_cast h2
              have hk_real : (k : ℝ) ≥ 2 := by exact_mod_cast hk
              linarith
            have he2 : (E_seq (k / 2) : ℝ) ≥ 14 * ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ) := by
              calc (E_seq (k / 2) : ℝ)
                _ ≥ 14 * (1.02 : ℝ) ^ (k / 2 : ℕ) := he
                _ = 14 * (1.02 : ℝ) ^ ((k / 2 : ℕ) : ℝ) := by rw [hc1]
                _ ≥ 14 * (1.02 : ℝ) ^ ((k : ℝ) / 4) := by
                    have h_rpow_le : (1.02 : ℝ) ^ ((k : ℝ) / 4) ≤ (1.02 : ℝ) ^ ((k / 2 : ℕ) : ℝ) := by
                      apply Real.rpow_le_rpow_of_exponent_le (by norm_num) hle
                    gcongr
                _ = 14 * ((1.02 : ℝ) ^ (1 / 4 : ℝ)) ^ (k : ℝ) := by rw [← hc2]
            gcongr
            norm_num
        _ = (3 / 4 : ℝ) * (10 : ℝ) ^ E_seq (k / 2) := by rw [Real.rpow_natCast]
        _ = (3 / 4 : ℝ) * seq_N (k / 2) := rfl
        _ ≤ construct_a x k := construct_a_lower_bound x k
    · exact h_exp_pos

  exact tendsto_atTop_mono' atTop h_final_bound h_mul_tendsto

/-- The total center offset C_total -/
noncomputable def C_total : ℝ × ℝ := 
  (∑' k, (f₁ (seq_N k) + f₁ (2 * seq_N k)), ∑' k, (f₂ (seq_N k) + f₂ (2 * seq_N k)))

lemma f_pos1 (x : ℝ × ℝ) (k : ℕ) : 0 ≤ f₁ (construct_a x k) := by
  have h2 : construct_a x k ≥ 2 := construct_a_ge_2 x k
  unfold f₁
  positivity

lemma f_pos2 (x : ℝ × ℝ) (k : ℕ) : 0 ≤ f₂ (construct_a x k) := by
  have h2 : construct_a x k ≥ 2 := construct_a_ge_2 x k
  unfold f₂
  positivity

