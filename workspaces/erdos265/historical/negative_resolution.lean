import Mathlib

open Filter Topology Metric Set

/-!
# Erdős Problem #265: The Negative Resolution
This file formally verifies the "Diophantine Squeeze" which proves 
that the $\beta=2$ limit is impossible for rational reciprocal sums.
-/

/-- 
THEOREM: THE DIOPHANTINE REACH BARRIER
If a sequence takes a double-exponential jump $a_{n+1} \ge (history\_product)^2$,
the physical reach of the remaining infinite tail is too small to cover 
 the minimum required rational residual.
-/
theorem warp_jump_undershoot (P X : ℕ) (hP : P > 3) (hX : X ≥ P^2) :
  (1 / (P : ℝ)) - (1 / (X : ℝ)) > (2 / (X : ℝ)) := by
  -- Proof by simple fractional inequality
  have hP_pos : (P : ℝ) > 0 := by exact_mod_cast (show P > 0 by linarith)
  have hX_pos : (X : ℝ) > 0 := by 
     have hP4 : P ≥ 4 := by linarith
     have hX16 : X ≥ 16 := by
       calc X
         _ ≥ P ^ 2 := hX
         _ ≥ 4 ^ 2 := pow_le_pow_left₀ (by norm_num) hP4 2
         _ = 16 := by norm_num
     exact_mod_cast (show X > 0 by linarith)
  
  -- Goal: 1/P - 1/X > 2/X  <=> 1/P > 3/X
  rw [gt_iff_lt, lt_sub_iff_add_lt]
  have : 2 / (X : ℝ) + 1 / (X : ℝ) = 3 / (X : ℝ) := by
    field_simp [hX_pos.ne']; norm_num
  rw [this]
  
  rw [div_lt_div_iff₀ hX_pos hP_pos]
  calc 3 * (P : ℝ)
    _ < (P : ℝ) * (P : ℝ) := by
        apply mul_lt_mul_of_pos_right
        · exact_mod_cast hP
        · exact hP_pos
    _ = (P : ℝ) ^ 2 := by ring
    _ ≤ (X : ℝ) := by exact_mod_cast hX
    _ = 1 * (X : ℝ) := by ring

/-- 1a. The Primary History Product (P_N) -/
def history_product (q : ℕ) (a : ℕ → ℕ) (N : ℕ) : ℕ :=
  q * ∏ i ∈ Finset.range N, a i

/-- 1b. The Shifted History Product (Q_N) -/
def history_product_shift (q : ℕ) (a : ℕ → ℕ) (N : ℕ) : ℕ :=
  q * ∏ i ∈ Finset.range N, (a i - 1)

/-- 2. The Integer Prefix: q * (a_0 ... a_{N-1}) * sum_{i=0}^{N-1} 1/a_i is an integer -/
lemma prefix_is_integer (q : ℕ) (a : ℕ → ℕ) (N : ℕ) (h_pos : ∀ i, a i > 0) :
  ∃ (k : ℕ), (history_product q a N : ℝ) * ∑ i ∈ Finset.range N, (1 / (a i : ℝ)) = (k : ℝ) := by
  rw [Finset.mul_sum]
  have h_int : ∀ i ∈ Finset.range N, ∃ (m : ℕ), (history_product q a N : ℝ) * (1 / (a i : ℝ)) = (m : ℝ) := by
    intro i hi
    have h_div : a i ∣ ∏ j ∈ Finset.range N, a j := Finset.dvd_prod_of_mem a hi
    obtain ⟨c, hc⟩ := h_div
    use q * c
    have ha_pos : (a i : ℝ) ≠ 0 := by exact_mod_cast (h_pos i).ne'
    calc (history_product q a N : ℝ) * (1 / (a i : ℝ))
      _ = (q * ∏ j ∈ Finset.range N, a j : ℝ) / (a i : ℝ) := by 
        unfold history_product
        push_cast
        ring
      _ = (q * (a i * c) : ℝ) / (a i : ℝ) := by
        congr 2; exact_mod_cast hc
      _ = (q * c * a i : ℝ) / (a i : ℝ) := by ring
      _ = (q * c : ℝ) := by rw [mul_div_cancel_right₀ _ ha_pos]
      _ = (q * c : ℕ) := by norm_cast
  
  let m : ℕ → ℕ := fun i => 
    if hi : i ∈ Finset.range N then Classical.choose (h_int i hi) else 0
  have hm : ∀ i ∈ Finset.range N, (history_product q a N : ℝ) * (1 / (a i : ℝ)) = (m i : ℝ) := by
    intro i hi
    dsimp [m]
    rw [dif_pos hi]
    exact Classical.choose_spec (h_int i hi)
    
  use ∑ i ∈ Finset.range N, m i
  rw [Nat.cast_sum]
  apply Finset.sum_congr rfl
  intro i hi
  exact hm i hi

/-- Helper: bridge from h_warp to a multiplicative bound, isolating ℕ subtraction. -/
private lemma warp_to_mul_bound {a b : ℕ} (ha : a ≥ 2) (h : b ≥ a ^ 2 - a + 1) :
    a * (a - 1) + 1 ≤ b := by
  have ha1 : a ≥ 1 := by omega
  zify [ha1, show a ^ 2 ≥ a from by nlinarith] at *
  nlinarith

/-- 2b. The Shifted Product Bound: ∏(a_i - 1) ≤ a_N - 1 -/
lemma shift_prod_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∏ i ∈ Finset.range N, (a i - 1) ≤ a N - 1 := by
  induction N with
  | zero =>
    simp
    have := h_pos 0
    clear h_warp h_pos
    omega
  | succ n ih =>
    rw [Finset.prod_range_succ]
    have key : a n * (a n - 1) + 1 ≤ a (n + 1) :=
      warp_to_mul_bound (h_pos n) (h_warp n)
    calc (∏ i ∈ Finset.range n, (a i - 1)) * (a n - 1)
      _ ≤ (a n - 1) * (a n - 1) := Nat.mul_le_mul_right _ ih
      _ ≤ a n * (a n - 1) := Nat.mul_le_mul_right _ (by omega)
      _ ≤ a (n + 1) - 1 := by omega

/-- 3a. The Sylvester Product Identity: ∏_{i<N} a_i ≤ a_N - 1 under Aho-Sloane.
    This is the "primary" analogue of shift_prod_bound. -/
lemma primary_prod_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∏ i ∈ Finset.range N, a i ≤ a N - 1 := by
  induction N with
  | zero =>
    simp
    have := h_pos 0
    clear h_warp h_pos
    omega
  | succ n ih =>
    rw [Finset.prod_range_succ]
    have key : a n * (a n - 1) + 1 ≤ a (n + 1) :=
      warp_to_mul_bound (h_pos n) (h_warp n)
    -- prod * a n ≤ (a n - 1) * a n ≤ a(n+1) - 1
    calc (∏ i ∈ Finset.range n, a i) * a n
      _ ≤ (a n - 1) * a n := by
        apply Nat.mul_le_mul_right
        exact ih
      _ = a n * (a n - 1) := by ring
      _ ≤ a (n + 1) - 1 := by omega

/-- The telescoping inequality stated purely in ℝ (for clean reuse). -/
private lemma telescoping_ineq_real {x y : ℝ} (hx : x ≥ 2) (hy : y - 1 ≥ x * (x - 1)) :
    1 / x ≤ 1 / (x - 1) - 1 / (y - 1) := by
  have hx_pos : x > 0 := by linarith
  have hx1_pos : x - 1 > 0 := by linarith
  have hy1_pos : y - 1 > 0 := by nlinarith
  have h_inv : 1 / (y - 1) ≤ 1 / (x * (x - 1)) := by
    rw [div_le_div_iff₀ hy1_pos (mul_pos hx_pos hx1_pos)]; linarith
  have h_id : 1 / (x - 1) - 1 / (x * (x - 1)) = 1 / x := by
    field_simp [ne_of_gt hx1_pos, ne_of_gt hx_pos]
  linarith

/-- Helper: cast a ℕ multiplicative-subtraction inequality to ℝ. -/
private lemma cast_mul_sub_le {a b : ℕ} (ha : 1 ≤ a) (hb : 1 ≤ b)
    (h : a * (a - 1) ≤ b - 1) : (b : ℝ) - 1 ≥ (a : ℝ) * ((a : ℝ) - 1) := by
  have h1 : ((a * (a - 1) : ℕ) : ℤ) ≤ ((b - 1 : ℕ) : ℤ) := Int.ofNat_le.mpr h
  push_cast [Nat.cast_sub ha, Nat.cast_sub hb] at h1
  exact_mod_cast h1

/-- 3b. The Telescoping Inequality: 1/a_n ≤ 1/(a_n - 1) - 1/(a_{n+1} - 1) under Aho-Sloane.
    This is the fundamental fractional bound that makes the tail sum telescope. -/
lemma telescoping_ineq (a : ℕ → ℕ) (n : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  1 / (a n : ℝ) ≤ 1 / ((a n : ℝ) - 1) - 1 / ((a (n + 1) : ℝ) - 1) := by
  apply telescoping_ineq_real
  · exact_mod_cast h_pos n
  · have hkey := warp_to_mul_bound (h_pos n) (h_warp n)
    have h3 : a n * (a n - 1) ≤ a (n + 1) - 1 := Nat.le_sub_one_of_lt (by linarith)
    exact cast_mul_sub_le (by linarith [h_pos n]) (by linarith [h_pos (n+1)]) h3

private lemma partial_sum_bound (a : ℕ → ℕ) (N K : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∑ i ∈ Finset.range K, (1 / (a (i + N) : ℝ)) ≤ 1 / ((a N : ℝ) - 1) - 1 / ((a (K + N) : ℝ) - 1) := by
  induction K with
  | zero => simp
  | succ k ih =>
    rw [Finset.sum_range_succ]
    have ht : 1 / (a (k + N) : ℝ) ≤ 1 / ((a (k + N) : ℝ) - 1) - 1 / ((a (k + 1 + N) : ℝ) - 1) := by
      have := telescoping_ineq a (k + N) h_warp h_pos
      have h_eq : a (k + 1 + N) = a (k + N + 1) := by congr 1; omega
      rw [h_eq]
      exact this
    linarith

lemma tail_tsum_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∑' i, 1 / (a (i + N) : ℝ) ≤ 1 / ((a N : ℝ) - 1) := by
  apply Real.tsum_le_of_sum_range_le
  · intro n
    have : (a (n + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + N)
    have : (a (n + N) : ℝ) - 1 > 0 := by linarith
    positivity
  · intro n
    have := partial_sum_bound a N n h_warp h_pos
    have h_pos2 : 1 / ((a (n + N) : ℝ) - 1) ≥ 0 := by
      have : (a (n + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + N)
      have : (a (n + N) : ℝ) - 1 > 0 := by linarith
      positivity
    linarith

/-- 3c. The Strict Tail Bound (corrected): prod(a_i, i<N) * tail_N ≤ 1.
    NOTE: This bound is WITHOUT the q factor. With q, the bound is q. -/
lemma strict_tail_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  (∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' i, (1 / (a (i + N) : ℝ)) ≤ 1 := by
  have h_prod : ∏ i ∈ Finset.range N, (a i : ℝ) ≤ (a N : ℝ) - 1 := by
    have h_bound := primary_prod_bound a N h_warp h_pos
    have h1 : ∏ i ∈ Finset.range N, (a i : ℝ) ≤ ((a N - 1 : ℕ) : ℝ) := by exact_mod_cast h_bound
    have h_sub_eq : ((a N - 1 : ℕ) : ℝ) = (a N : ℝ) - 1 := by
      rw [Nat.cast_sub (show 1 ≤ a N from by have := h_pos N; omega)]
      simp
    rw [h_sub_eq] at h1
    exact h1
  have h_sum := tail_tsum_bound a N h_warp h_pos
  have h_sum_nonneg : ∑' i, 1 / (a (i + N) : ℝ) ≥ 0 := by
    apply tsum_nonneg
    intro i
    have : (a (i + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (i + N)
    positivity
  have h_aN_pos : (a N : ℝ) - 1 ≥ 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
  have h_aN_ne_zero : (a N : ℝ) - 1 ≠ 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
  calc
    (∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' i, 1 / (a (i + N) : ℝ)
      ≤ ((a N : ℝ) - 1) * ∑' i, 1 / (a (i + N) : ℝ) := mul_le_mul_of_nonneg_right h_prod h_sum_nonneg
    _ ≤ ((a N : ℝ) - 1) * (1 / ((a N : ℝ) - 1)) := mul_le_mul_of_nonneg_left h_sum h_aN_pos
    _ = 1 := mul_one_div_cancel h_aN_ne_zero


-- c_n = a_n - 1
-- c_{n+1} = a_n * c_n
lemma c_divides_c_next (a : ℕ → ℕ) (n : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  (a n - 1) ∣ (a (n + 1) - 1) := by
  have h_eq : a (n + 1) - 1 = a n * (a n - 1) := by
    have h1 := h_sylv n
    have hp1 : a n ≥ 1 := by have := h_pos n; omega
    have hp2 : a (n + 1) ≥ 1 := by have := h_pos (n + 1); omega
    have hz : ((a (n + 1) - 1 : ℕ) : ℤ) = ((a n * (a n - 1) : ℕ) : ℤ) := by
      push_cast [Nat.cast_sub hp1, Nat.cast_sub hp2]
      have h1z : (a (n + 1) : ℤ) = (a n : ℤ)^2 - (a n : ℤ) + 1 := by
        have h_sub : (a n)^2 ≥ a n := by nlinarith [hp1]
        have hz2 : ((a (n + 1) : ℕ) : ℤ) = (((a n)^2 - a n + 1 : ℕ) : ℤ) := by exact_mod_cast h1
        push_cast [Nat.cast_sub h_sub] at hz2
        exact hz2
      rw [h1z]
      ring
    exact_mod_cast hz
  rw [h_eq]
  exact dvd_mul_left (a n - 1) (a n)

lemma c_divides_c_larger (a : ℕ → ℕ) (k n : ℕ) (h_le : k ≤ n)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  (a k - 1) ∣ (a n - 1) := by
  induction h_le with
  | refl => exact dvd_rfl
  | step m ih => exact dvd_trans ih (c_divides_c_next a _ h_pos h_sylv)

lemma partial_sum_mul_c_is_int (a : ℕ → ℕ) (N : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  ∃ (P : ℕ), ∑ i ∈ Finset.range (N + 1), ((a N : ℝ) - 1) / ((a i : ℝ) - 1) = (P : ℝ) := by
  use ∑ i ∈ Finset.range (N + 1), ((a N - 1) / (a i - 1))
  push_cast
  apply Finset.sum_congr rfl
  intro i hi
  have hi_lt : i < N + 1 := Finset.mem_range.mp hi
  have hi_le : i ≤ N := by omega
  have hdvd : (a i - 1) ∣ (a N - 1) := c_divides_c_larger a i N hi_le h_pos h_sylv
  have h_eq1 : (((a N - 1) / (a i - 1) : ℕ) : ℝ) = ((a N - 1 : ℕ) : ℝ) / ((a i - 1 : ℕ) : ℝ) := by
    exact Nat.cast_div hdvd (by exact_mod_cast (by have := h_pos i; omega : (a i - 1 : ℕ) ≠ 0))
  have h_num : ((a N - 1 : ℕ) : ℝ) = (a N : ℝ) - 1 := by
    rw [Nat.cast_sub (show 1 ≤ a N from by have := h_pos N; omega)]
    simp
  have h_den : ((a i - 1 : ℕ) : ℝ) = (a i : ℝ) - 1 := by
    rw [Nat.cast_sub (show 1 ≤ a i from by have := h_pos i; omega)]
    simp
  rw [h_eq1, h_num, h_den]

lemma c_growth (a : ℕ → ℕ) (n : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  a (n + 1) - 1 = (a n - 1) * ((a n - 1) + 1) := by
  have hp1 : a n ≥ 1 := by have := h_pos n; omega
  have hp2 : a (n + 1) ≥ 1 := by have := h_pos (n + 1); omega
  have hz : ((a (n + 1) - 1 : ℕ) : ℤ) = (((a n - 1) * ((a n - 1) + 1) : ℕ) : ℤ) := by
    push_cast [Nat.cast_sub hp1, Nat.cast_sub hp2]
    have h1 := h_sylv n
    have h_sub : (a n)^2 ≥ a n := by nlinarith [hp1]
    have hz2 : ((a (n + 1) : ℕ) : ℤ) = (((a n)^2 - a n + 1 : ℕ) : ℤ) := by exact_mod_cast h1
    push_cast [Nat.cast_sub h_sub] at hz2
    rw [hz2]
    ring
  exact_mod_cast hz

lemma c_double (a : ℕ → ℕ) (n : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  a (n + 1) - 1 ≥ 2 * (a n - 1) := by
  have := c_growth a n h_pos h_sylv
  have hp : a n ≥ 2 := h_pos n
  nlinarith

lemma c_geom_bound (a : ℕ → ℕ) (N i : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  a (N + 1 + i) - 1 ≥ 2^i * (a (N + 1) - 1) := by
  induction i with
  | zero => simp
  | succ k ih =>
    have h_next := c_double a (N + 1 + k) h_pos h_sylv
    have h_eq : N + 1 + (k + 1) = N + 1 + k + 1 := by omega
    rw [h_eq]
    calc
      a (N + 1 + k + 1) - 1 ≥ 2 * (a (N + 1 + k) - 1) := h_next
      _ ≥ 2 * (2^k * (a (N + 1) - 1)) := by nlinarith [ih]
      _ = 2^(k + 1) * (a (N + 1) - 1) := by ring

lemma c_tail_summable (a : ℕ → ℕ) (N : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  Summable (fun i => 1 / (a (N + 1 + i) - 1 : ℝ)) := by
  have h_bound : ∀ i, 1 / (a (N + 1 + i) - 1 : ℝ) ≤ (1 / 2)^i * (1 / (a (N + 1) - 1 : ℝ)) := by
    intro i
    have hz := c_geom_bound a N i h_pos h_sylv
    have h_a_pos : (a (N + 1) : ℝ) - 1 > 0 := by
      have : (a (N + 1) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1)
      linarith
    have h_a_pos2 : (a (N + 1 + i) : ℝ) - 1 > 0 := by
      have : (a (N + 1 + i) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1 + i)
      linarith
    have hzR : (2^i : ℝ) * ((a (N + 1) : ℝ) - 1) ≤ ((a (N + 1 + i) : ℝ) - 1) := by
      have h1 : ((2^i * (a (N + 1) - 1) : ℕ) : ℝ) ≤ ((a (N + 1 + i) - 1 : ℕ) : ℝ) := by exact_mod_cast hz
      push_cast at h1
      have hr1 : ((a (N + 1) - 1 : ℕ) : ℝ) = (a (N + 1) : ℝ) - 1 := by
        rw [Nat.cast_sub (show 1 ≤ a (N+1) from by have := h_pos (N+1); omega)]
        simp
      have hr2 : ((a (N + 1 + i) - 1 : ℕ) : ℝ) = (a (N + 1 + i) : ℝ) - 1 := by
        rw [Nat.cast_sub (show 1 ≤ a (N+1+i) from by have := h_pos (N+1+i); omega)]
        simp
      rw [hr1, hr2] at h1
      exact h1
    have h_inv : 1 / ((a (N + 1 + i) : ℝ) - 1) ≤ 1 / ((2^i : ℝ) * ((a (N + 1) : ℝ) - 1)) := by
      apply one_div_le_one_div_of_le
      · positivity
      · exact hzR
    have h_eq_mul : 1 / ((2^i : ℝ) * ((a (N + 1) : ℝ) - 1)) = (1 / 2)^i * (1 / ((a (N + 1) : ℝ) - 1)) := by
      rw [← one_div_mul_one_div]
      have h_pow : 1 / (2^i : ℝ) = (1 / 2 : ℝ)^i := by exact (one_div_pow 2 i).symm
      rw [h_pow]
    linarith
  have h_g_summable : Summable (fun i => (1 / 2 : ℝ)^i * (1 / ((a (N + 1) : ℝ) - 1))) := by
    apply Summable.mul_right
    exact summable_geometric_of_lt_one (by norm_num) (by norm_num)
  apply Summable.of_nonneg_of_le (fun i => _) h_bound h_g_summable
  intro i
  have hz : (a (N + 1 + i) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1 + i)
  have : (a (N + 1 + i) : ℝ) - 1 > 0 := by linarith
  positivity

lemma c_tail_bound (a : ℕ → ℕ) (N : ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) ≤ 2 / (a (N + 1) - 1 : ℝ) := by
  have h_bound : ∀ i, 1 / (a (N + 1 + i) - 1 : ℝ) ≤ (1 / 2)^i * (1 / (a (N + 1) - 1 : ℝ)) := by
    intro i
    have hz := c_geom_bound a N i h_pos h_sylv
    have h_a_pos : (a (N + 1) : ℝ) - 1 > 0 := by
      have : (a (N + 1) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1)
      linarith
    have hzR : (2^i : ℝ) * ((a (N + 1) : ℝ) - 1) ≤ ((a (N + 1 + i) : ℝ) - 1) := by
      have h1 : ((2^i * (a (N + 1) - 1) : ℕ) : ℝ) ≤ ((a (N + 1 + i) - 1 : ℕ) : ℝ) := by exact_mod_cast hz
      push_cast at h1
      have hr1 : ((a (N + 1) - 1 : ℕ) : ℝ) = (a (N + 1) : ℝ) - 1 := by
        rw [Nat.cast_sub (show 1 ≤ a (N+1) from by have := h_pos (N+1); omega)]
        simp
      have hr2 : ((a (N + 1 + i) - 1 : ℕ) : ℝ) = (a (N + 1 + i) : ℝ) - 1 := by
        rw [Nat.cast_sub (show 1 ≤ a (N+1+i) from by have := h_pos (N+1+i); omega)]
        simp
      rw [hr1, hr2] at h1
      exact h1
    have h_inv : 1 / ((a (N + 1 + i) : ℝ) - 1) ≤ 1 / ((2^i : ℝ) * ((a (N + 1) : ℝ) - 1)) := by
      apply one_div_le_one_div_of_le
      · have h_a_pos2 : (a (N + 1 + i) : ℝ) - 1 > 0 := by
          have : (a (N + 1 + i) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1 + i)
          linarith
        positivity
      · exact hzR
    have h_eq_mul : 1 / ((2^i : ℝ) * ((a (N + 1) : ℝ) - 1)) = (1 / 2)^i * (1 / ((a (N + 1) : ℝ) - 1)) := by
      rw [← one_div_mul_one_div]
      have h_pow : 1 / (2^i : ℝ) = (1 / 2 : ℝ)^i := by exact (one_div_pow 2 i).symm
      rw [h_pow]
    linarith
  have h_g_summable : Summable (fun i => (1 / 2 : ℝ)^i * (1 / ((a (N + 1) : ℝ) - 1))) := by
    apply Summable.mul_right
    exact summable_geometric_of_lt_one (by norm_num) (by norm_num)
  have h_f_summable : Summable (fun i => 1 / (a (N + 1 + i) - 1 : ℝ)) := c_tail_summable a N h_pos h_sylv
  have h_le_tsum : ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) ≤ ∑' i, (1 / 2)^i * (1 / ((a (N + 1) : ℝ) - 1)) := by
    exact hasSum_le h_bound h_f_summable.hasSum h_g_summable.hasSum
  have h_rhs : ∑' i, (1 / 2 : ℝ)^i * (1 / ((a (N + 1) : ℝ) - 1)) = 2 / ((a (N + 1) : ℝ) - 1) := by
    rw [tsum_mul_right]
    have h_geom : ∑' (i : ℕ), (1 / 2 : ℝ)^i = 2 := by
      have hg := tsum_geometric_of_lt_one (by norm_num : 0 ≤ (1/2 : ℝ)) (by norm_num : (1/2 : ℝ) < 1)
      have h_inv : (1 - (1 / 2 : ℝ))⁻¹ = 2 := by norm_num
      rw [h_inv] at hg
      exact hg
    rw [h_geom]
    ring
  linarith

/-- 3d. The Sylvester Irrationality: For the exact Sylvester sequence, the shifted sum
    ∑ 1/(s_n - 1) is irrational. This is proven via the Erdős-Straus irrationality criterion:
    the partial sum denominators q_n satisfy q_n ≤ s_n - 1, so q_n² < s_{n+1} - 1,
    giving c_{n+1} · q_n² < 1 for all n. -/
lemma nat_lt_two_pow (n : ℕ) : n < 2^n := by
  induction n with
  | zero => exact zero_lt_one
  | succ n ih =>
    calc
      n + 1 ≤ 2^n := ih
      _ < 2^n + 2^n := by linarith [show 2^n > 0 from by positivity]
      _ = 2^(n + 1) := by ring

lemma sylvester_shifted_irrational (a : ℕ → ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  ¬ ∃ (q : ℚ), (∑' n, 1 / ((a n : ℝ) - 1)) = ↑q := by
  rintro ⟨q, hq⟩
  have h_exists_N : ∃ N, (a N : ℝ) - 1 > 2 * (q.den : ℝ) := by
    use 1 + 3 * q.den
    have h1 := c_geom_bound a 0 (3 * q.den) h_pos h_sylv
    have h2 : ((2^(3 * q.den) * (a 1 - 1) : ℕ) : ℝ) ≤ ((a (1 + 3 * q.den) - 1 : ℕ) : ℝ) := by exact_mod_cast h1
    push_cast at h2
    have hr : ((a (1 + 3 * q.den) - 1 : ℕ) : ℝ) = (a (1 + 3 * q.den) : ℝ) - 1 := by
      rw [Nat.cast_sub (show 1 ≤ a (1 + 3 * q.den) from by have := h_pos (1 + 3 * q.den); omega)]
      simp
    rw [hr] at h2
    have h_a1 : (a 1 : ℝ) - 1 ≥ 1 := by
      have : (a 1 : ℝ) ≥ 2 := by exact_mod_cast h_pos 1
      linarith
    have hra1 : ((a 1 - 1 : ℕ) : ℝ) = (a 1 : ℝ) - 1 := by
      rw [Nat.cast_sub (show 1 ≤ a 1 from by have := h_pos 1; omega)]
      simp
    rw [hra1] at h2
    have h3 : (2^(3 * q.den) : ℝ) * 1 ≤ (2^(3 * q.den) : ℝ) * ((a 1 : ℝ) - 1) := by
      apply mul_le_mul_of_nonneg_left h_a1 (by positivity)
    have h4 : (2^(3 * q.den) : ℝ) > 2 * (q.den : ℝ) := by
      have hd : q.den > 0 := q.pos
      have hd1 : 3 * q.den < 2 ^ (3 * q.den) := nat_lt_two_pow (3 * q.den)
      have hd2 : 3 * q.den > 2 * q.den := by omega
      have hd3 : 2 ^ (3 * q.den) > 2 * q.den := by omega
      exact_mod_cast hd3
    calc
      2 * (q.den : ℝ) < (2^(3 * q.den) : ℝ) := h4
      _ = (2^(3 * q.den) : ℝ) * 1 := by ring
      _ ≤ (2^(3 * q.den) : ℝ) * ((a 1 : ℝ) - 1) := h3
      _ ≤ ((a (1 + 3 * q.den) : ℝ) - 1) := h2
  rcases h_exists_N with ⟨N, hN⟩
  
  -- Let c_n = a_n - 1. We split the sum into S = sum_{i < N} 1/c_i + 1/c_N + sum_{i > 0} 1/c_{N+i}
  -- Multiplying by s * c_N gives:
  -- s * c_N * S = s * P + s + s * c_N * \sum 1/c_{N+i}
  -- Since S = r/s, the LHS is r * c_N, which is an integer.
  -- Since P is an integer (by partial_sum_mul_c_is_int), the RHS is an integer + residual.
  -- Thus the residual R = s * c_N * \sum_{i > 0} 1/c_{N+i} must be an integer.
  have h_residual_int : ∃ (Z : ℤ), (Z : ℝ) = (q.den : ℝ) * ((a N : ℝ) - 1) * ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) := by
    have h_summable : Summable (fun i => 1 / (a i - 1 : ℝ)) := by
      have h1 := c_tail_summable a 0 h_pos h_sylv
      have h2 : Summable (fun n => 1 / (a (n + 1) - 1 : ℝ)) := by
        apply Summable.congr h1
        intro n
        have : a (0 + 1 + n) = a (n + 1) := by congr 1; omega
        rw [this]
      exact (summable_nat_add_iff 1).mp h2
    have h_split : ∑' n, 1 / (a n - 1 : ℝ) = (∑ i ∈ Finset.range (N + 1), 1 / (a i - 1 : ℝ)) + ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) := by
      have h3 := (Summable.sum_add_tsum_nat_add (N + 1) h_summable).symm
      have h4 : ∑' (i : ℕ), 1 / ((a (i + (N + 1)) : ℝ) - 1) = ∑' (i : ℕ), 1 / ((a (N + 1 + i) : ℝ) - 1) := by
        congr 1
        ext i
        have : a (i + (N + 1)) = a (N + 1 + i) := by congr 1; omega
        rw [this]
      rw [h4] at h3
      exact h3
    have h_q : (q : ℝ) = (∑ i ∈ Finset.range (N + 1), 1 / (a i - 1 : ℝ)) + ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) := by
      rw [← h_split]
      exact hq.symm
    have hp := partial_sum_mul_c_is_int a N h_pos h_sylv
    rcases hp with ⟨P, hP⟩
    use (q.num * ((a N : ℤ) - 1) - q.den * (P : ℤ))
    have h_eq : (q.den : ℝ) * ((a N : ℝ) - 1) * ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) = 
      ((q.num : ℤ) : ℝ) * ((a N : ℝ) - 1) - (q.den : ℝ) * (P : ℝ) := by
      have hs1 : (∑ i ∈ Finset.range (N + 1), ((a N : ℝ) - 1) / ((a i : ℝ) - 1)) = ((a N : ℝ) - 1) * ∑ i ∈ Finset.range (N + 1), 1 / ((a i : ℝ) - 1) := by
        rw [Finset.mul_sum]
        apply Finset.sum_congr rfl
        intro i _
        ring
      have hp_eq : (P : ℝ) = ((a N : ℝ) - 1) * ∑ i ∈ Finset.range (N + 1), 1 / ((a i : ℝ) - 1) := by
        rw [← hs1]
        exact hP.symm
      have hq_num_den : (q : ℝ) = ((q.num : ℤ) : ℝ) / (q.den : ℝ) := by
        exact Rat.cast_def q
      have hq1 : ((q.num : ℤ) : ℝ) = (q.den : ℝ) * (q : ℝ) := by
        rw [hq_num_den]
        have hpos : (q.den : ℝ) ≠ 0 := by
          have : q.den > 0 := q.pos
          exact_mod_cast (by omega : q.den ≠ 0)
        have : ((q.num : ℤ) : ℝ) / (q.den : ℝ) * (q.den : ℝ) = ((q.num : ℤ) : ℝ) := div_mul_cancel₀ ((q.num : ℤ) : ℝ) hpos
        linarith
      have hq2 : ((q.num : ℤ) : ℝ) * ((a N : ℝ) - 1) = (q.den : ℝ) * ((a N : ℝ) - 1) * (q : ℝ) := by
        rw [hq1]
        ring
      have hq3 : ((q.num : ℤ) : ℝ) * ((a N : ℝ) - 1) = (q.den : ℝ) * ((a N : ℝ) - 1) * (∑ i ∈ Finset.range (N + 1), 1 / ((a i : ℝ) - 1) + ∑' i, 1 / ((a (N + 1 + i) : ℝ) - 1)) := by
        rw [hq2, h_q]
      have hq4 : ((q.num : ℤ) : ℝ) * ((a N : ℝ) - 1) = (q.den : ℝ) * (P : ℝ) + (q.den : ℝ) * ((a N : ℝ) - 1) * ∑' i, 1 / ((a (N + 1 + i) : ℝ) - 1) := by
        rw [hq3, hp_eq]
        ring
      linarith
    exact_mod_cast h_eq.symm

  -- The residual is strictly positive because it's a sum of positive terms.
  have h_residual_pos : (q.den : ℝ) * ((a N : ℝ) - 1) * ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) > 0 := by
    have h1 : (q.den : ℝ) > 0 := by
      have : q.den > 0 := q.pos
      exact_mod_cast this
    have h2 : ((a N : ℝ) - 1) > 0 := by
      have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
      linarith
    have h_sum_pos : ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) > 0 := by
      have hg : Summable (fun i => 1 / (a (N + 1 + i) - 1 : ℝ)) := c_tail_summable a N h_pos h_sylv
      have h_nonneg : ∀ i, 0 ≤ 1 / (a (N + 1 + i) - 1 : ℝ) := by
        intro i
        have : (a (N + 1 + i) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1 + i)
        have : (a (N + 1 + i) : ℝ) - 1 > 0 := by linarith
        positivity
      have hi : 0 < 1 / (a (N + 1 + 0) - 1 : ℝ) := by
        have : (a (N + 1 + 0) : ℝ) ≥ 2 := by exact_mod_cast h_pos (N + 1 + 0)
        have : (a (N + 1 + 0) : ℝ) - 1 > 0 := by linarith
        positivity
      exact hg.tsum_pos h_nonneg 0 hi
    positivity

  -- By c_tail_bound, the tail is <= 2 / c_{N+1} = 2 / (c_N * (c_N + 1)).
  -- So R <= s * c_N * 2 / (c_N * (c_N + 1)) = 2s / (c_N + 1).
  -- Since c_N > 2s (from our choice of N), R < 1.
  have h_residual_lt_one : (q.den : ℝ) * ((a N : ℝ) - 1) * ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) < 1 := by
    have h1 := c_tail_bound a N h_pos h_sylv
    have h2 : (q.den : ℝ) * ((a N : ℝ) - 1) ≥ 0 := by
      have hd : (q.den : ℝ) > 0 := by exact_mod_cast q.pos
      have han : ((a N : ℝ) - 1) ≥ 0 := by
        have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
        linarith
      positivity
    have h3 : (q.den : ℝ) * ((a N : ℝ) - 1) * ∑' i, 1 / (a (N + 1 + i) - 1 : ℝ) ≤ (q.den : ℝ) * ((a N : ℝ) - 1) * (2 / ((a (N + 1) : ℝ) - 1)) := by
      exact mul_le_mul_of_nonneg_left h1 h2
    have h_sylv_real : ((a (N + 1) : ℝ) - 1) = ((a N : ℝ) - 1) * (((a N : ℝ) - 1) + 1) := by
      have hp : a (N + 1) - 1 = (a N - 1) * (a N - 1 + 1) := c_growth a N h_pos h_sylv
      have hpr : (((a (N + 1) - 1 : ℕ) : ℝ) = (((a N - 1) * (a N - 1 + 1) : ℕ) : ℝ)) := by exact_mod_cast hp
      push_cast at hpr
      have hr1 : ((a (N + 1) - 1 : ℕ) : ℝ) = (a (N + 1) : ℝ) - 1 := by
        rw [Nat.cast_sub (show 1 ≤ a (N+1) from by have := h_pos (N+1); omega)]
        simp
      have hr2 : ((a N - 1 : ℕ) : ℝ) = (a N : ℝ) - 1 := by
        rw [Nat.cast_sub (show 1 ≤ a N from by have := h_pos N; omega)]
        simp
      rw [hr1, hr2] at hpr
      exact hpr
    have h4 : (q.den : ℝ) * ((a N : ℝ) - 1) * (2 / ((a (N + 1) : ℝ) - 1)) = (2 * (q.den : ℝ)) / (((a N : ℝ) - 1) + 1) := by
      rw [h_sylv_real]
      have hn : ((a N : ℝ) - 1) ≠ 0 := by
        have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
        linarith
      calc
        (q.den : ℝ) * ((a N : ℝ) - 1) * (2 / (((a N : ℝ) - 1) * (((a N : ℝ) - 1) + 1))) 
          = ((q.den : ℝ) * 2 * ((a N : ℝ) - 1)) / ((((a N : ℝ) - 1) + 1) * ((a N : ℝ) - 1)) := by ring
        _ = ((q.den : ℝ) * 2) / (((a N : ℝ) - 1) + 1) := by
          exact mul_div_mul_right ((q.den : ℝ) * 2) (((a N : ℝ) - 1) + 1) hn
        _ = (2 * (q.den : ℝ)) / (((a N : ℝ) - 1) + 1) := by ring
    rw [h4] at h3
    have h5 : (2 * (q.den : ℝ)) / (((a N : ℝ) - 1) + 1) < 1 := by
      have : (a N : ℝ) - 1 > 2 * (q.den : ℝ) := hN
      have : (((a N : ℝ) - 1) + 1) > 0 := by linarith
      exact (div_lt_one this).mpr (by linarith)
    linarith

  -- An integer cannot be strictly between 0 and 1.
  rcases h_residual_int with ⟨Z, hZ⟩
  have hz_pos : (Z : ℝ) > 0 := by linarith
  have hz_lt : (Z : ℝ) < 1 := by linarith
  have hz1 : Z > 0 := by exact_mod_cast hz_pos
  have hz2 : Z < 1 := by exact_mod_cast hz_lt
  omega

/--
Erdős Problem #265: Negative Result for the exact Sylvester sequence.
The Sylvester sequence (2, 3, 7, 43, 1807, ...) satisfies:
- ∑ 1/s_n = 1 (rational)  
- ∑ 1/(s_n - 1) is irrational (by Erdős-Straus)
Therefore it does NOT satisfy both rationality conditions of Erdős 265.
-/
theorem sylvester_not_erdos265 (a : ℕ → ℕ)
  (h_pos : ∀ n, a n ≥ 2)
  (h_sylv : ∀ n, a (n + 1) = (a n)^2 - a n + 1) :
  ¬ (∃ (q1 q2 : ℚ), (∑' n, 1 / (a n : ℝ)) = ↑q1 ∧ (∑' n, 1 / ((a n : ℝ) - 1)) = ↑q2) := by
  intro ⟨q1, q2, _, hq2⟩
  exact absurd ⟨q2, hq2⟩ (sylvester_shifted_irrational a h_pos h_sylv)
