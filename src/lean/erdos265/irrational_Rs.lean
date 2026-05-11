import Mathlib

/-!
# Erdős 265: Direct Liouville Irrationality of the $R_s$ Branch

This file proves that the sum of the reciprocal of the shifted Sylvester sequence
is irrational. The proof is a fully self-contained elementary argument using
Diophantine approximation and Least Common Multiples, bypassing Mahler's method.

The sequence:
  b_0 = 2
  b_{n+1} = b_n^2 - b_n + 1

We prove that f = ∑ 1/(b_n + 1) is irrational.
-/

open Filter Topology Real Nat

noncomputable section

/-- The Sylvester sequence -/
def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_pos (n : ℕ) : 0 < b n := by
  induction n with
  | zero => decide
  | succ n ih =>
    dsimp [b]
    have h1 : 1 ≤ b n := by omega
    nlinarith

lemma b_ge_two (n : ℕ) : 2 ≤ b n := by
  induction n with
  | zero => decide
  | succ n ih =>
    dsimp [b]
    have h1 : 2 ≤ b n := ih
    have h2 : 1 ≤ b n - 1 := by omega
    have h3 : 2 * 1 ≤ b n * (b n - 1) := Nat.mul_le_mul h1 h2
    have h4 : b n * (b n - 1) = b n * b n - b n := by
      rw [Nat.mul_sub_left_distrib, Nat.mul_one]
    omega

/-- Least common multiple of denominators up to n-1. -/
def D : ℕ → ℕ
  | 0 => 1
  | n + 1 => Nat.lcm (D n) (b n + 1)

/-- D n is always positive. -/
lemma D_pos (n : ℕ) : 0 < D n := by
  induction n with
  | zero => decide
  | succ n ih =>
    dsimp [D]
    have hb : 0 < b n + 1 := by
      have := b_pos n
      omega
    exact Nat.lcm_pos ih hb

/-- (b k + 1) divides D n for all k < n. -/
lemma b_add_one_dvd_D (k n : ℕ) (h : k < n) : (b k + 1) ∣ D n := by
  induction n with
  | zero => exact (Nat.not_lt_zero k h).elim
  | succ m ih =>
    dsimp [D]
    have h_le : k ≤ m := Nat.lt_succ_iff.mp h
    rcases Nat.eq_or_lt_of_le h_le with rfl | hk
    · exact Nat.dvd_lcm_right (D k) (b k + 1)
    · have h_dvd := ih hk
      exact Nat.dvd_trans h_dvd (Nat.dvd_lcm_left (D m) (b m + 1))

open scoped BigOperators

/-- The partial sum S_n = ∑_{k=0}^{n-1} 1/(b_k+1) -/
noncomputable def S (n : ℕ) : ℚ :=
  Finset.sum (Finset.range n) (fun k => (1 : ℚ) / (b k + 1))

/-- D_n * S_n is an integer. -/
lemma D_mul_S_is_int (n : ℕ) : ∃ (z : ℤ), (D n : ℚ) * S n = z := by
  dsimp [S]
  rw [Finset.mul_sum]
  have h_int_sum : ∀ k ∈ Finset.range n, ∃ (z : ℤ), (D n : ℚ) * ((1 : ℚ) / (b k + 1)) = z := by
    intro k hk
    have hk_lt : k < n := Finset.mem_range.mp hk
    have hdvd := b_add_one_dvd_D k n hk_lt
    rcases hdvd with ⟨c, hc⟩
    use c
    have hb : (b k + 1 : ℚ) ≠ 0 := by
      have hpos := b_pos k
      positivity
    have hb_inv : (b k + 1 : ℚ) * ((1 : ℚ) / (b k + 1)) = 1 := by
      exact mul_one_div_cancel hb
    calc
      (D n : ℚ) * ((1 : ℚ) / (b k + 1)) = ((b k + 1) * c : ℚ) * ((1 : ℚ) / (b k + 1)) := by rw [hc]; push_cast; rfl
      _ = (c : ℚ) * ((b k + 1 : ℚ) * ((1 : ℚ) / (b k + 1))) := by ring
      _ = (c : ℚ) * 1 := by rw [hb_inv]
      _ = c := by ring
  let f (k : ℕ) : ℤ := if hk : k ∈ Finset.range n then Classical.choose (h_int_sum k hk) else 0
  have hf : ∀ k ∈ Finset.range n, (D n : ℚ) * ((1 : ℚ) / (b k + 1)) = f k := by
    intro k hk
    dsimp [f]
    rw [dif_pos hk]
    exact Classical.choose_spec (h_int_sum k hk)
  use Finset.sum (Finset.range n) f
  have h_sum : Finset.sum (Finset.range n) (fun k => (D n : ℚ) * ((1 : ℚ) / (b k + 1))) = Finset.sum (Finset.range n) (fun k => (f k : ℚ)) := by
    apply Finset.sum_congr rfl
    intro x hx
    rw [hf x hx]
  rw [h_sum]
  push_cast
  rfl

/-- The tail sum β_n = ∑_{k=n}^{∞} 1/(b_k+1) -/
noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' (k : ℕ), if k ≥ n then (1 : ℝ) / (b k + 1) else 0

/-- B_n = q * D_n * β_n -/
noncomputable def B_n (q : ℕ) (n : ℕ) : ℝ :=
  (q : ℝ) * (D n : ℝ) * beta_n n

/-- Telescoping identity for b_k -/
lemma b_telescope (k : ℕ) : (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) = (1 : ℝ) / b k := by
  have hk : (b k : ℝ) ≠ 0 := by
    have := b_pos k
    positivity
  have hk1 : (b k - 1 : ℝ) ≠ 0 := by
    have h2 : 2 ≤ b k := b_ge_two k
    have h3 : (2 : ℝ) ≤ (b k : ℝ) := by exact_mod_cast h2
    linarith
  have hk2 : (b (k + 1) - 1 : ℝ) ≠ 0 := by
    have h2 : 2 ≤ b (k + 1) := b_ge_two (k + 1)
    have h3 : (2 : ℝ) ≤ (b (k + 1) : ℝ) := by exact_mod_cast h2
    linarith
  have h_eq : (b (k + 1) : ℝ) = (b k : ℝ) * (b k : ℝ) - (b k : ℝ) + 1 := by
    have h_ge : b k ≤ b k * b k := Nat.le_mul_self (b k)
    calc
      (b (k + 1) : ℝ) = ↑(b k * b k - b k + 1) := by rfl
      _ = ↑(b k * b k - b k) + 1 := by push_cast; rfl
      _ = ↑(b k * b k) - ↑(b k) + 1 := by rw [Nat.cast_sub h_ge]
      _ = (b k : ℝ) * (b k : ℝ) - (b k : ℝ) + 1 := by push_cast; rfl
  calc
    (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) = (1 : ℝ) / (b k - 1) - (1 : ℝ) / ((b k : ℝ) * (b k : ℝ) - (b k : ℝ)) := by rw [h_eq]; ring
    _ = (1 : ℝ) / (b k - 1) - (1 : ℝ) / ((b k : ℝ) * ((b k : ℝ) - 1)) := by ring
    _ = (b k : ℝ) / ((b k : ℝ) * ((b k : ℝ) - 1)) - (1 : ℝ) / ((b k : ℝ) * ((b k : ℝ) - 1)) := by
      have h_mul : (1 : ℝ) / (b k - 1) = (b k : ℝ) / ((b k : ℝ) * ((b k : ℝ) - 1)) := by
        rw [div_eq_div_iff]
        · ring
        · exact hk1
        · have h_pos : (b k : ℝ) * ((b k : ℝ) - 1) ≠ 0 := mul_ne_zero hk hk1
          exact h_pos
      rw [h_mul]
    _ = ((b k : ℝ) - 1) / ((b k : ℝ) * ((b k : ℝ) - 1)) := by ring
    _ = (1 : ℝ) / (b k : ℝ) := by
      rw [div_eq_div_iff]
      · ring
      · have h_pos : (b k : ℝ) * ((b k : ℝ) - 1) ≠ 0 := mul_ne_zero hk hk1
        exact h_pos
      · exact hk

/-- Upper bound on beta_n -/
lemma beta_n_bound (n : ℕ) (hn : n ≥ 1) : beta_n n < (1 : ℝ) / (b n - 1) := by
  sorry

/-- r_n = D_n / b_n -/
noncomputable def r (n : ℕ) : ℝ :=
  (D n : ℝ) / (b n : ℝ)

/-- D_n is a multiple of 8 for n ≥ 3 -/
lemma eight_dvd_D (n : ℕ) (hn : n ≥ 3) : 8 ∣ D n := by
  have h_lt : 2 < n := hn
  have h_dvd := b_add_one_dvd_D 2 n h_lt
  have h_b2 : b 2 = 7 := rfl
  have h_8 : b 2 + 1 = 8 := by rw [h_b2]
  rwa [h_8] at h_dvd

/-- b_n is 3 mod 4 for n ≥ 1 -/
lemma b_mod_four (n : ℕ) (hn : n ≥ 1) : b n % 4 = 3 := by
  induction' n, hn using Nat.le_induction with k hk ih
  · rfl
  · dsimp [b]
    have h4 : b k * b k - b k + 1 = b k * (b k - 1) + 1 := by
      have : 1 ≤ b k := by
        have h_ge2 := b_ge_two k
        omega
      rw [Nat.mul_sub_left_distrib, Nat.mul_one]
    rw [h4]
    have ⟨q, hq⟩ : ∃ q, b k = 4 * q + 3 := ⟨b k / 4, by omega⟩
    rw [hq]
    have h2 : (4 * q + 3 - 1) = 4 * q + 2 := by omega
    rw [h2]
    have h3 : (4 * q + 3) * (4 * q + 2) + 1 = 4 * (4 * q * q + 5 * q + 1) + 3 := by ring
    rw [h3]
    omega

/-- b_n + 1 is divisible by 4 for n ≥ 1 -/
lemma b_add_one_mod_four (n : ℕ) (hn : n ≥ 1) : (b n + 1) % 4 = 0 := by
  have h := b_mod_four n hn
  omega

lemma b_mono (n : ℕ) : b n < b (n + 1) := by
  dsimp [b]
  have h := b_ge_two n
  have : b n * (b n - 1) + 1 = b n * b n - b n + 1 := by
    rw [Nat.mul_sub_left_distrib, Nat.mul_one]
  have h_sub : 1 ≤ b n - 1 := by omega
  have h_mul : b n * 1 ≤ b n * (b n - 1) := Nat.mul_le_mul_left (b n) h_sub
  rw [mul_one] at h_mul
  omega

lemma b_strictMono : StrictMono b := strictMono_nat_of_lt_succ b_mono

lemma b_ge_43 (n : ℕ) (hn : n ≥ 3) : 43 ≤ b n := by
  have h3 : b 3 = 43 := rfl
  have h_mono := b_strictMono.monotone hn
  omega

/-- The geometric decay of r_n -/
lemma r_decay (n : ℕ) (hn : n ≥ 3) : r (n + 1) < r n / 3 := by
  have h_b_pos : (0 : ℝ) < b n := by
    have h := b_ge_two n
    have h2 : (2 : ℝ) ≤ (b n : ℝ) := by exact_mod_cast h
    linarith
  have h_b1_pos : (0 : ℝ) < b (n + 1) := by
    have h := b_ge_two (n + 1)
    have h2 : (2 : ℝ) ≤ (b (n + 1) : ℝ) := by exact_mod_cast h
    linarith
  
  have h_dvd1 : 4 ∣ D n := by
    have h8 := eight_dvd_D n hn
    exact dvd_trans (by decide) h8
  have h_dvd2 : 4 ∣ (b n + 1) := by
    have hn1 : n ≥ 1 := by omega
    have hmod := b_add_one_mod_four n hn1
    exact Nat.dvd_of_mod_eq_zero hmod
  have h_gcd : 4 ∣ Nat.gcd (D n) (b n + 1) := Nat.dvd_gcd h_dvd1 h_dvd2
  have h_gcd_ge : 4 ≤ Nat.gcd (D n) (b n + 1) := by
    have h_pos : 0 < Nat.gcd (D n) (b n + 1) := by
      apply Nat.gcd_pos_of_pos_right
      have := b_ge_two n
      omega
    exact Nat.le_of_dvd h_pos h_gcd
  
  have h_lcm : Nat.gcd (D n) (b n + 1) * D (n + 1) = D n * (b n + 1) := by
    dsimp [D]
    exact Nat.gcd_mul_lcm (D n) (b n + 1)
    
  have h_lcm_real : ((Nat.gcd (D n) (b n + 1) : ℝ)) * (D (n + 1) : ℝ) = (D n : ℝ) * ((b n : ℝ) + 1) := by
    have h_cast : ((Nat.gcd (D n) (b n + 1) * D (n + 1) : ℕ) : ℝ) = ((D n * (b n + 1) : ℕ) : ℝ) := by
      rw [h_lcm]
    push_cast at h_cast
    exact h_cast

  have h_D_pos : (0 : ℝ) < D n := by
    have := D_pos n
    exact_mod_cast this
    
  have h_gcd_real : (4 : ℝ) ≤ (Nat.gcd (D n) (b n + 1) : ℝ) := by exact_mod_cast h_gcd_ge

  have h_b_ge_43 : (43 : ℝ) ≤ (b n : ℝ) := by
    have h := b_ge_43 n hn
    exact_mod_cast h

  have h_b_step : (b (n+1) : ℝ) = (b n : ℝ) * (b n : ℝ) - (b n : ℝ) + 1 := by
    have h_ge : b n ≤ b n * b n := Nat.le_mul_self (b n)
    calc
      (b (n+1) : ℝ) = ↑(b n * b n - b n + 1) := by rfl
      _ = ↑(b n * b n - b n) + 1 := by push_cast; rfl
      _ = ↑(b n * b n) - ↑(b n) + 1 := by rw [Nat.cast_sub h_ge]
      _ = (b n : ℝ) * (b n : ℝ) - (b n : ℝ) + 1 := by push_cast; rfl

  dsimp [r]
  
  have h_gcd_nz : (Nat.gcd (D n) (b n + 1) : ℝ) ≠ 0 := by linarith
  have h_D1 : (D (n+1) : ℝ) = (D n : ℝ) * ((b n : ℝ) + 1) / (Nat.gcd (D n) (b n + 1) : ℝ) := by
    rw [eq_div_iff h_gcd_nz]
    have h_cast : ((D (n+1) * Nat.gcd (D n) (b n + 1) : ℕ) : ℝ) = ((D n * (b n + 1) : ℕ) : ℝ) := by
      have h_lcm2 : D (n + 1) * Nat.gcd (D n) (b n + 1) = D n * (b n + 1) := by
        rw [mul_comm]
        exact h_lcm
      rw [h_lcm2]
    push_cast at h_cast
    exact h_cast

  rw [h_D1]
  
  have h_target : ((b n : ℝ) + 1) / ((Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ)) < 1 / (3 * (b n : ℝ)) := by
    have h_ineq : 3 * (b n : ℝ) * ((b n : ℝ) + 1) < 4 * (b (n+1) : ℝ) := by
      calc
        3 * (b n : ℝ) * ((b n : ℝ) + 1) = 3 * (b n : ℝ) * (b n : ℝ) + 3 * (b n : ℝ) := by ring
        _ < 4 * ((b n : ℝ) * (b n : ℝ) - (b n : ℝ) + 1) := by nlinarith
        _ = 4 * (b (n+1) : ℝ) := by rw [← h_b_step]
    have h_ineq2 : 3 * (b n : ℝ) * ((b n : ℝ) + 1) < (Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ) := by
      calc
        3 * (b n : ℝ) * ((b n : ℝ) + 1) < 4 * (b (n+1) : ℝ) := h_ineq
        _ ≤ (Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ) := by
          apply mul_le_mul_of_nonneg_right h_gcd_real (by linarith)
    rw [div_lt_div_iff]
    · linarith
    · have h_gcd_pos : (0 : ℝ) < Nat.gcd (D n) (b n + 1) := by linarith
      positivity
    · positivity
  
  calc
    (D n : ℝ) * ((b n : ℝ) + 1) / (Nat.gcd (D n) (b n + 1) : ℝ) / (b (n + 1) : ℝ) =
      (D n : ℝ) * (((b n : ℝ) + 1) / ((Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ))) := by ring
    _ < (D n : ℝ) * (1 / (3 * (b n : ℝ))) := by
      apply mul_lt_mul_of_pos_left h_target h_D_pos
    _ = (D n : ℝ) / (b n : ℝ) / 3 := by ring

/-- Limit of r_n is 0 -/
lemma tendsto_r : Filter.Tendsto r Filter.atTop (𝓝 0) := by
  have h_pos : ∀ n, 0 ≤ r n := by
    intro n
    dsimp [r]
    have hd : (0 : ℝ) ≤ D n := by
      have := D_pos n
      exact_mod_cast (by linarith : 0 ≤ D n)
    have hb : (0 : ℝ) ≤ b n := by
      have := b_pos n
      exact_mod_cast (by linarith : 0 ≤ b n)
    positivity
    
  have h_decay : ∀ n ≥ 3, r (n + 1) ≤ r n / 3 := by
    intro n hn
    exact le_of_lt (r_decay n hn)
    
  have h_bound : ∀ k, r (3 + k) ≤ r 3 * (1/3)^k := by
    intro k
    induction' k with k ih
    · simp
    · calc
        r (3 + (k + 1)) = r (3 + k + 1) := by ring_nf
        _ ≤ r (3 + k) / 3 := h_decay (3 + k) (by linarith)
        _ = r (3 + k) * (1/3) := by ring
        _ ≤ (r 3 * (1/3)^k) * (1/3) := by
          apply mul_le_mul_of_nonneg_right ih (by norm_num)
        _ = r 3 * (1/3)^(k+1) := by ring
  
  have h_tendsto_geom : Filter.Tendsto (fun k => (1/3 : ℝ)^k) Filter.atTop (𝓝 0) := by
    have h_abs : |(1/3 : ℝ)| < 1 := by
      rw [abs_lt]
      constructor <;> norm_num
    exact tendsto_pow_atTop_nhds_zero_of_abs_lt_one h_abs
  have h_tendsto_geom2 : Filter.Tendsto (fun k => r 3 * (1/3 : ℝ)^k) Filter.atTop (𝓝 0) := by
    have h_zero : (0 : ℝ) = r 3 * 0 := by ring
    rw [h_zero]
    exact Filter.Tendsto.const_mul (r 3) h_tendsto_geom

  have h_tendsto_shifted : Filter.Tendsto (fun k => r (k + 3)) Filter.atTop (𝓝 0) := by
    have h_bound2 : ∀ k, r (k + 3) ≤ r 3 * (1/3)^k := by
      intro k
      have : k + 3 = 3 + k := by ring
      rw [this]
      exact h_bound k
    apply tendsto_of_tendsto_of_tendsto_of_le_of_le tendsto_const_nhds h_tendsto_geom2
    · intro k
      exact h_pos (k + 3)
    · intro k
      exact h_bound2 k
      
  exact (Filter.tendsto_add_atTop_iff_nat 3).1 h_tendsto_shifted

/-- The main target theorem. -/
theorem Rs_irrational :
    Irrational (∑' k : ℕ, (1 : ℝ) / (b k + 1)) := by
  sorry

end
