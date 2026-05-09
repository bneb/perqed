import Mathlib
import erdos265.erdos265_strict_target
import erdos265.negative_resolution

open Filter Topology Metric Set Finset

/-!
# The Cancellation Bound via Residual Arithmetic

For an infinite sequence with ∑ 1/aₖ = p₁/q₁ (rational), define:
  R(N) := q₁ · ∏_{k<N} aₖ · tail(N)

This is a POSITIVE INTEGER in [1, q₁] (Liouville bound).

The recurrence R(N+1) = aₙ · R(N) - q₁ · ∏_{k<N} aₖ yields:
  aₙ = (R(N+1) + q₁ · P_N) / R(N)
  aₙ - 1 = (q₁ · P_N + R(N+1) - R(N)) / R(N)

Since R(N) ∈ {1,...,q₁}, this constrains aₖ-1 to specific residue classes,
creating divisibility structure that bounds the shifted partial sum denominator.
-/

-- ============================================================================
-- Definitions
-- ============================================================================

/-- Fast growth: a_{k+1} ≥ a_k² - a_k + 1 (Sylvester-speed or faster). -/
def FastGrowth (a : ℕ → ℕ) : Prop :=
  ∀ n, a (n + 1) ≥ (a n) ^ 2 - a n + 1

/-- The denominator of the N-th shifted partial sum ∑_{k≤N} 1/(aₖ-1). -/
noncomputable def shifted_partial_denom (a : ℕ → ℕ) (N : ℕ) : ℕ :=
  (∑ i ∈ Finset.range (N + 1), (1 : ℚ) / ((a i : ℚ) - 1)).den

/-- The residual integer R₁(N) = q · ∏_{k<N} aₖ · tail(N). -/
noncomputable def R₁ (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

-- ============================================================================
-- Section 1.5: The Integer Residual Bridge
-- ============================================================================

/-- The partial product of the sequence. -/
def P_N (a : ℕ → ℕ) (N : ℕ) : ℕ := ∏ i ∈ Finset.range N, a i

/-- The integer version of the residual R₁.
    Notice that P_N / a_i is an integer since a_i is a factor of P_N for i < N. -/
def R₁_int (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℤ :=
  p * (P_N a N : ℤ) - (q : ℤ) * ∑ i ∈ Finset.range N, ((P_N a N) / a i : ℤ)

/-- The integer residual perfectly matches the real residual. -/
lemma R₁_eq_R₁_int (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) (h_pos : ∀ i, a i > 0) (hq : q > 0) :
    R₁ a p q N = (R₁_int a p q N : ℝ) := by
  unfold R₁
  have hq_ne_zero : (q : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt hq)
  calc
    (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (↑p / ↑q - ∑ i ∈ Finset.range N, 1 / (a i : ℝ))
    _ = (q : ℝ) * (↑p / ↑q - ∑ i ∈ Finset.range N, 1 / (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
    _ = (↑p - (q : ℝ) * ∑ i ∈ Finset.range N, 1 / (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
      congr 1
      rw [mul_sub, mul_div_cancel₀ (p : ℝ) hq_ne_zero]
    _ = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) - (q : ℝ) * (∑ i ∈ Finset.range N, 1 / (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
    _ = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) - (q : ℝ) * ∑ i ∈ Finset.range N, ((∏ j ∈ Finset.range N, (a j : ℝ)) / (a i : ℝ)) := by
      rw [mul_assoc]
      congr 2
      rw [sum_mul]
      congr 1
      ext i
      ring
    _ = (R₁_int a p q N : ℝ) := by
      sorry -- Needs proof that the integer division P_N / a_i casts exactly to Real division.

-- ============================================================================
-- Section 2: Residual recurrence and bounds
-- ============================================================================

/-- R₁ satisfies the recurrence: R₁(N+1) = aₙ · R₁(N) - q · ∏_{k<N} aₖ. -/
theorem R₁_recurrence (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i > 0) :
    R₁ a p q (N + 1) =
      (a N : ℝ) * R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by
  unfold R₁
  rw [prod_range_succ, sum_range_succ]
  have haN : (a N : ℝ) ≠ 0 := by
    have := h_pos N
    norm_cast
    omega
  calc
    (q : ℝ) * ((∏ x ∈ Finset.range N, (a x : ℝ)) * (a N : ℝ)) *
        (↑p / ↑q - (∑ x ∈ Finset.range N, 1 / (a x : ℝ) + 1 / (a N : ℝ)))
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * ((a N : ℝ) * (1 / (a N : ℝ))) := by ring
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * 1 := by rw [mul_one_div_cancel haN]
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by ring

/-- R₁(N) is a positive integer when ∑ 1/aₖ = p/q and tail > 0. -/
theorem R₁_is_pos_integer (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (hq : q > 0)
    (h_pos : ∀ i, a i > 0)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q))
    (N : ℕ) (h_tail : ∑' k, (1 : ℝ) / (a (k + N) : ℝ) > 0) :
    ∃ (Z : ℕ), Z ≥ 1 ∧ R₁ a p q N = (Z : ℝ) := by
  have h_tail_sum : HasSum (fun k => (1 : ℝ) / (a (k + N) : ℝ)) 
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) := by
    -- From sum splitting
    sorry
  have h_tail_eq : ↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ) = ∑' k, (1 : ℝ) / (a (k + N) : ℝ) := by
    exact h_tail_sum.tsum_eq.symm
    
  have h_R1_tail : R₁ a p q N = (q : ℝ) * (P_N a N : ℝ) * (∑' k, (1 : ℝ) / (a (k + N) : ℝ)) := by
    unfold R₁ P_N
    rw [h_tail_eq]
    push_cast
    ring
    
  have h_R1_pos : R₁ a p q N > 0 := by
    rw [h_R1_tail]
    have hq_pos : (q : ℝ) > 0 := by exact_mod_cast hq
    have hP_pos : (P_N a N : ℝ) > 0 := by
      unfold P_N
      exact_mod_cast Finset.prod_pos (fun i _ => by have := h_pos i; omega)
    exact mul_pos (mul_pos hq_pos hP_pos) h_tail
    
  have h_eq_int := R₁_eq_R₁_int a p q N h_pos hq
  have h_int_pos : R₁_int a p q N > 0 := by exact_mod_cast (h_eq_int.symm ▸ h_R1_pos : (R₁_int a p q N : ℝ) > 0)
  
  use (R₁_int a p q N).toNat
  constructor
  · sorry -- exact_mod_cast h_int_pos
  · sorry -- rw [h_eq_int]; exact_mod_cast Int.toNat_of_nonneg (le_of_lt h_int_pos)

/-- R₁(N) ≤ q under fast growth (tail ≤ 1/∏aₖ). -/
theorem R₁_le_q (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (hq : q > 0)
    (h_pos : ∀ i, a i ≥ 2)
    (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q))
    (N : ℕ) :
    R₁ a p q N ≤ (q : ℝ) := by
  -- R₁ = q * P_N * tail, and strict_tail_bound says P_N * tail ≤ 1
  have h_tail_sum : HasSum (fun k => (1 : ℝ) / (a (k + N) : ℝ)) 
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) := by
    sorry -- HasSum shift (shared sorry)
  have h_tail_eq : ↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ) = ∑' k, (1 : ℝ) / (a (k + N) : ℝ) := by
    exact h_tail_sum.tsum_eq.symm
  have h_R1_eq : R₁ a p q N = (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' k, (1 : ℝ) / (a (k + N) : ℝ)) := by
    unfold R₁
    rw [h_tail_eq]
    ring
  rw [h_R1_eq]
  have h_bound := strict_tail_bound a N h_fast h_pos
  have hq_pos : (q : ℝ) ≥ 1 := by exact_mod_cast hq
  calc (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' k, 1 / (a (k + N) : ℝ))
      ≤ (q : ℝ) * 1 := by exact mul_le_mul_of_nonneg_left h_bound (by linarith)
    _ = (q : ℝ) := by ring

-- ============================================================================
-- Section 2: The algebraic constraint on aₙ - 1
-- ============================================================================

/-- Key algebraic identity: aₙ - 1 = (q·P_N + R₁(N+1) - R₁(N)) / R₁(N).
    This shows R₁(N) divides q·P_N + R₁(N+1) - R₁(N) (over ℤ). -/
theorem a_sub_one_eq (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i > 0) (hR : R₁ a p q N ≠ 0) :
    (a N : ℝ) - 1 =
      ((q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) +
       R₁ a p q (N + 1) - R₁ a p q N) / R₁ a p q N := by
  have h_rec := R₁_recurrence a p q N h_pos
  -- From recurrence: R₁(N+1) = a_N * R₁(N) - q * P_N
  -- So: a_N * R₁(N) = R₁(N+1) + q * P_N
  -- So: a_N = (R₁(N+1) + q * P_N) / R₁(N)
  -- So: a_N - 1 = (R₁(N+1) + q * P_N - R₁(N)) / R₁(N)
  field_simp
  linarith

-- ============================================================================
-- Section 3: R₁ Monotonicity and Sylvester Convergence
-- ============================================================================

/-- From the fast growth tail bound, R₁(N) is monotonically decreasing.
    Specifically, R₁(N+1) - R₁(N) = R₁(N) * c_N - q * P_N ≤ 0. -/
theorem R₁_monotone_decreasing (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q)) (hq : q > 0) :
    R₁ a p q (N + 1) ≤ R₁ a p q N := by
  -- We know sum_N^inf 1/a_k = p/q - sum_0^{N-1} 1/a_k
  have h_tail_sum : HasSum (fun k => (1 : ℝ) / (a (k + N) : ℝ)) 
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) := by
    sorry -- Standard HasSum shift
    
  have h_tail_eq : ↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ) = ∑' k, (1 : ℝ) / (a (k + N) : ℝ) := by
    exact h_tail_sum.tsum_eq.symm

  -- Use tail_tsum_bound from negative_resolution
  have h_tail_bound := tail_tsum_bound a N h_fast h_pos
  
  -- Rewrite R₁ using tail sum
  have h_R1_eq : R₁ a p q N = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' k, (1 : ℝ) / (a (k + N) : ℝ) := by
    unfold R₁
    rw [h_tail_eq]
    
  -- Bound R₁
  have h_prod_pos : (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) > 0 := by
    apply mul_pos
    · exact_mod_cast hq
    · apply prod_pos
      intro i _
      have : (a i : ℝ) ≥ 2 := by exact_mod_cast h_pos i
      linarith
      
  have h_R1_le : R₁ a p q N ≤ (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1)) := by
    rw [h_R1_eq]
    exact mul_le_mul_of_nonneg_left h_tail_bound (le_of_lt h_prod_pos)
    
  -- Rearrange to R₁ * (a_N - 1) <= q * P_N
  have haN : (a N : ℝ) - 1 > 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
    
  have h_R1_mul : R₁ a p q N * ((a N : ℝ) - 1) ≤ (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
    have h1 : R₁ a p q N * ((a N : ℝ) - 1) ≤ ((q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1) := by
      exact mul_le_mul_of_nonneg_right h_R1_le (le_of_lt haN)
    have h2 : ((q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1) = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
      calc
        ((q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1)
        _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1) * ((a N : ℝ) - 1)) := by ring
        _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * 1 := by
          congr 1
          exact div_mul_cancel₀ 1 (ne_of_gt haN)
        _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
    linarith
    
  -- Now substitute into the recurrence
  have h_rec := R₁_recurrence a p q N (fun i => by
    have := h_pos i
    omega
  )
  
  calc
    R₁ a p q (N + 1) = (a N : ℝ) * R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := h_rec
    _ = R₁ a p q N * ((a N : ℝ) - 1) + R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by ring
    _ ≤ (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) + R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by linarith [h_R1_mul]
    _ = R₁ a p q N := by ring

/-- Helper: A monotonically decreasing sequence of natural numbers is eventually constant. -/
lemma nat_decreasing_eventually_constant (f : ℕ → ℕ) (hf : ∀ n, f (n + 1) ≤ f n) :
    ∃ N₀, ∀ n ≥ N₀, f (n + 1) = f n := by
  have H : ∃ M, ∃ N₀, ∀ n ≥ N₀, f n = M := by
    let S := { m | ∃ n, f n = m }
    have hS_ne : S.Nonempty := ⟨f 0, 0, rfl⟩
    let M := sInf S
    have hM : M ∈ S := Nat.sInf_mem hS_ne
    rcases hM with ⟨N₀, hN₀⟩
    use M, N₀
    intro n hn
    have h_le : f n ≤ f N₀ := by
      induction' hn with k hk ih
      · rfl
      · exact le_trans (hf k) ih
    have h_M_le : M ≤ f n := Nat.sInf_le ⟨n, rfl⟩
    linarith
  rcases H with ⟨M, N₀, hN₀⟩
  use N₀
  intro n hn
  have hn1 : n + 1 ≥ N₀ := by omega
  rw [hN₀ n hn, hN₀ (n + 1) hn1]

/-- Since R₁_int > 0 (as the tail sum is strictly positive), R₁ can be typed as ℕ. -/
def R₁_nat (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℕ := (R₁_int a p q N).toNat

/-- Since R₁(N) is a sequence of positive integers that is monotonically
    decreasing, it must eventually be constant. -/
theorem R₁_eventually_constant (a : ℕ → ℕ) (p : ℤ) (q : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q)) (hq : q > 0) :
    ∃ (N₀ : ℕ), ∀ N ≥ N₀, R₁ a p q (N + 1) = R₁ a p q N := by
  have h_mono_real : ∀ N, R₁ a p q (N + 1) ≤ R₁ a p q N := fun N => R₁_monotone_decreasing a p q N h_pos h_fast h_sum hq
  -- We use the integer bridge
  have h_pos_gt0 : ∀ i, a i > 0 := fun i => by 
    have := h_pos i
    omega
  have h_nat_mono : ∀ N, R₁_nat a p q (N + 1) ≤ R₁_nat a p q N := by
    intro N
    sorry -- Follows from R₁_monotone_decreasing and R₁_eq_R₁_int
  rcases nat_decreasing_eventually_constant (R₁_nat a p q) h_nat_mono with ⟨N₀, hN₀⟩
  use N₀
  intro N hN
  have h_nat_eq := hN₀ N hN
  sorry

/-- If R₁(N) is constant for N ≥ N₀, the sequence must exactly satisfy
    the Sylvester recurrence a_{k+1} = a_k^2 - a_k + 1 for k ≥ N₀. -/
theorem eventually_sylvester (a : ℕ → ℕ) (p : ℤ) (q : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q)) (hq : q > 0) :
    ∃ (N₀ : ℕ), ∀ N ≥ N₀, a (N + 1) = (a N)^2 - a N + 1 := by
  rcases R₁_eventually_constant a p q h_pos h_fast h_sum hq with ⟨N₀, h_const⟩
  use N₀
  intro N hN
  have hN1 : N + 1 ≥ N₀ := by omega
  have h_eqN := h_const N hN
  have h_eqN1 := h_const (N + 1) hN1
  
  have h_recN := R₁_recurrence a p q N (fun i => by
    have := h_pos i
    omega
  )
  have h_recN1 := R₁_recurrence a p q (N + 1) (fun i => by
    have := h_pos i
    omega
  )
  
  -- From h_recN and h_eqN: R(N) = a_N R(N) - q P_N
  have h_relN : (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) = R₁ a p q N * ((a N : ℝ) - 1) := by
    calc
      (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) = (a N : ℝ) * R₁ a p q N - R₁ a p q (N + 1) := by linarith [h_recN]
      _ = (a N : ℝ) * R₁ a p q N - R₁ a p q N := by rw [h_eqN]
      _ = R₁ a p q N * ((a N : ℝ) - 1) := by ring
      
  -- From h_recN1 and h_eqN1: R(N+1) = a_{N+1} R(N+1) - q P_{N+1}
  have h_relN1 : (q : ℝ) * ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by
    calc
      (q : ℝ) * ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = (a (N + 1) : ℝ) * R₁ a p q (N + 1) - R₁ a p q (N + 2) := by linarith [h_recN1]
      _ = (a (N + 1) : ℝ) * R₁ a p q N - R₁ a p q N := by 
        have hn2 : N + 2 = N + 1 + 1 := by omega
        rw [hn2, h_eqN1, h_eqN]
      _ = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by ring
      
  -- P_{N+1} = P_N * a_N
  have h_P_step : ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := by
    rw [Finset.prod_range_succ]
    
  -- Substitute h_P_step into h_relN1
  have h_subst : (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by
    calc
      (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = (q : ℝ) * ∏ i ∈ Finset.range (N + 1), (a i : ℝ) := by rw [← h_P_step]
      _ = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := h_relN1
      
  -- Rewrite LHS using h_relN
  have h_lhs : (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) := by
    calc
      (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = ((q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := by ring
      _ = (R₁ a p q N * ((a N : ℝ) - 1)) * (a N : ℝ) := by rw [h_relN]
      _ = R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) := by ring
      
  -- Combine
  have h_combine : R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by
    calc
      R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) = (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) := h_lhs.symm
      _ = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := h_subst
      
  -- Cancel R₁
  have h_cancel : ((a N : ℝ) - 1) * (a N : ℝ) = (a (N + 1) : ℝ) - 1 := by
    -- From h_combine: R₁ * (a_N - 1) * a_N = R₁ * (a_{N+1} - 1)
    -- We need R₁ ≠ 0 to cancel. From h_relN: q * P_N = R₁ * (a_N - 1),
    -- and q * P_N > 0, so R₁ > 0.
    have hq_pos : (q : ℝ) > 0 := by exact_mod_cast hq
    have hP_pos : (∏ i ∈ Finset.range N, (a i : ℝ)) > 0 := by
      apply Finset.prod_pos; intro i _; have := h_pos i; exact_mod_cast (show (a i : ℕ) > 0 by omega)
    have hqP_pos : (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) > 0 := mul_pos hq_pos hP_pos
    have haN_gt1 : (a N : ℝ) - 1 > 0 := by
      have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
      linarith
    have hR1_pos : R₁ a p q N > 0 := by
      have := h_relN; -- q * P_N = R₁ * (a_N - 1)
      nlinarith
    have hR1_ne : R₁ a p q N ≠ 0 := ne_of_gt hR1_pos
    have := h_combine -- R₁ * (a_N - 1) * a_N = R₁ * (a_{N+1} - 1)
    have h_eq : R₁ a p q N * (((a N : ℝ) - 1) * (a N : ℝ)) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by linarith
    exact mul_left_cancel₀ hR1_ne h_eq
    
  -- Final algebraic shuffle
  have h_final : (a (N + 1) : ℝ) = (a N : ℝ)^2 - (a N : ℝ) + 1 := by
    calc
      (a (N + 1) : ℝ) = ((a N : ℝ) - 1) * (a N : ℝ) + 1 := by linarith [h_cancel]
      _ = (a N : ℝ)^2 - (a N : ℝ) + 1 := by ring
      
  -- Cast from ℝ to ℕ: need a_N^2 ≥ a_N for Nat subtraction
  have haN_ge2 := h_pos N
  -- Goal: a (N + 1) = (a N)^2 - a N + 1 in ℕ
  -- h_final: (a (N + 1) : ℝ) = (a N : ℝ)^2 - (a N : ℝ) + 1
  -- Strategy: cast to ℤ where subtraction is total
  have haN_ge1 : 1 ≤ a N := by omega
  have haN_sq_ge : a N ≤ (a N)^2 := le_self_pow₀ (by omega) (by omega)
  have h_cast : (a (N + 1) : ℤ) = (a N : ℤ)^2 - (a N : ℤ) + 1 := by exact_mod_cast h_final
  zify [haN_sq_ge]
  exact h_cast

-- ============================================================================
-- Section 4: Irrationality and Final Resolution
-- ============================================================================

/-- A sequence that eventually satisfies the Sylvester recurrence
    has an irrational shifted sum ∑ 1/(a_k - 1). -/
theorem shifted_sum_irrational_of_eventually_sylvester (a : ℕ → ℕ)
    (h_pos : ∀ n, a n ≥ 2)
    (h_sylv : ∃ N₀, ∀ N ≥ N₀, a (N + 1) = (a N)^2 - a N + 1) :
    ¬ ∃ (r : ℚ), HasSum (fun n => 1 / ((a n : ℝ) - 1)) (↑r) := by
  rintro ⟨r, h_sum⟩
  rcases h_sylv with ⟨N₀, h_eq⟩
  
  -- Define the shifted sequence
  let b (n : ℕ) := a (n + N₀)
  
  have hb_pos : ∀ n, b n ≥ 2 := fun n => h_pos (n + N₀)
  have hb_sylv : ∀ n, b (n + 1) = (b n)^2 - b n + 1 := by
    intro n
    have hn_eq : n + 1 + N₀ = n + N₀ + 1 := by omega
    change a (n + 1 + N₀) = a (n + N₀)^2 - a (n + N₀) + 1
    rw [hn_eq]
    exact h_eq (n + N₀) (by omega)
    
  -- The tail sum of `a` is the infinite sum of `b`
  have h_tail_sum : HasSum (fun n => 1 / ((b n : ℝ) - 1)) (↑r - ∑ i ∈ Finset.range N₀, 1 / ((a i : ℝ) - 1)) := by
    -- Standard HasSum shift
    sorry
    
  have h_tail_rat : ∃ q : ℚ, ↑q = (↑r : ℝ) - ∑ i ∈ Finset.range N₀, 1 / ((a i : ℝ) - 1) := by
    -- The finite sum is rational, r is rational
    sorry
    
  rcases h_tail_rat with ⟨q, hq⟩
  
  have h_sum_b : ∑' n, 1 / ((b n : ℝ) - 1) = ↑q := by
    rw [hq]
    exact h_tail_sum.tsum_eq
    
  exact sylvester_shifted_irrational b hb_pos hb_sylv ⟨q, h_sum_b⟩

/-- No fast-growing sequence can be an Erdős 265 sequence. -/
theorem no_fast_growing_erdos265 (a : ℕ → ℕ)
    (h_pos : ∀ n, a n ≥ 2)
    (h_mono : StrictMono a)
    (h_fast : FastGrowth a)
    (h_erdos : Erdos265_Sequence a) :
    False := by
  rcases h_erdos with ⟨_, _, ⟨r₁, h_sum1⟩, ⟨r₂, h_sum2⟩⟩
  -- r₁ is a rational p/q
  let p : ℤ := r₁.num
  let q : ℕ := r₁.den
  have hq : q > 0 := r₁.pos
  have h_sum1_pq : HasSum (fun n => 1 / (a n : ℝ)) (p / q) := by
    have : (r₁ : ℝ) = (p / q : ℝ) := by
      push_cast
      exact Rat.cast_def r₁
    rw [← this]
    exact h_sum1
  
  have h_sylv := eventually_sylvester a p q h_pos h_fast h_sum1_pq hq
  -- Apply irrationality of the shifted Sylvester sum to contradict the rational assumption
  have h_rat : ∃ (r : ℚ), HasSum (fun n => 1 / ((a n : ℝ) - 1)) (↑r) := ⟨r₂, h_sum2⟩
  exact shifted_sum_irrational_of_eventually_sylvester a h_pos h_sylv h_rat

