import Mathlib

open Topology
open scoped BigOperators

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

def D : ℕ → ℕ
  | 0 => 1
  | n + 1 => Nat.lcm (D n) (b n + 1)

lemma D_pos (n : ℕ) : 0 < D n := by
  induction n with
  | zero => decide
  | succ n ih =>
    dsimp [D]
    have hb : 0 < b n + 1 := by
      have := b_pos n
      omega
    exact Nat.lcm_pos ih hb

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

noncomputable def S (n : ℕ) : ℚ :=
  Finset.sum (Finset.range n) (fun k => (1 : ℚ) / (b k + 1))

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

lemma beta_term_pos (k : ℕ) : (0 : ℝ) < 1 / (b k + 1) := by
  have hk : (0 : ℝ) < b k := by
    have h2 := b_ge_two k
    exact_mod_cast (by linarith : 0 < b k)
  positivity

lemma beta_term_lt (k : ℕ) : (1 : ℝ) / (b k + 1) < (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) := by
  rw [b_telescope k]
  have hk : (0 : ℝ) < b k := by
    have h2 := b_ge_two k
    exact_mod_cast (by linarith : 0 < b k)
  have hk1 : (0 : ℝ) < b k + 1 := by linarith
  rw [div_lt_div_iff hk1 hk]
  linarith

lemma sum_range_shifted_strict_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => (1 : ℝ) / (b (k + n) + 1)) ≤ (1 : ℝ) / (b n - 1) - (1 : ℝ) / (b (N + n) - 1) := by
  induction' N with N ih
  · simp
  · rw [Finset.sum_range_succ]
    have h_lt := beta_term_lt (N + n)
    have h_eq : N + n + 1 = N + 1 + n := by omega
    rw [h_eq] at h_lt
    linarith

lemma sum_range_shifted_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => (1 : ℝ) / (b (k + n) + 1)) ≤ (1 : ℝ) / (b n - 1) := by
  have h_strict := sum_range_shifted_strict_bound n N
  have hb := b_ge_two (N + n)
  have hb_real : (2 : ℝ) ≤ b (N + n) := by exact_mod_cast hb
  have hd_pos : (0 : ℝ) < b (N + n) - 1 := by linarith
  have h_pos : (0 : ℝ) < 1 / (b (N + n) - 1) := by positivity
  linarith

lemma beta_n_summable (n : ℕ) : Summable (fun k => (1 : ℝ) / (b (k + n) + 1)) := by
  apply summable_of_sum_range_le (c := (1 : ℝ) / (b n - 1))
  · intro k
    exact le_of_lt (beta_term_pos (k + n))
  · exact sum_range_shifted_bound n

noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' (k : ℕ), (1 : ℝ) / (b (k + n) + 1)

lemma beta_n_pos (n : ℕ) : 0 < beta_n n := by
  have h_summable := beta_n_summable n
  exact tsum_pos h_summable (fun k => le_of_lt (beta_term_pos (k + n))) 0 (beta_term_pos (0 + n))

lemma beta_n_le (n : ℕ) : beta_n n ≤ (1 : ℝ) / (b n - 1) := by
  have h := beta_n_summable n
  exact tsum_le_of_sum_range_le h (sum_range_shifted_bound n)

lemma sum_split (n : ℕ) : (∑' k, (1 : ℝ) / (b k + 1)) = (S n : ℝ) + beta_n n := by
  have h_summable := beta_n_summable 0
  have h_eq : (fun k => (1 : ℝ) / (b (k + 0) + 1)) = (fun k => (1 : ℝ) / (b k + 1)) := by
    ext k
    rfl
  rw [h_eq] at h_summable
  have h_S : (S n : ℝ) = Finset.sum (Finset.range n) (fun k => (1 : ℝ) / (b k + 1)) := by
    dsimp [S]
    push_cast
    rfl
  rw [h_S]
  exact (sum_add_tsum_nat_add n h_summable).symm

noncomputable def r (n : ℕ) : ℝ :=
  (D n : ℝ) / (b n : ℝ)

lemma eight_dvd_D (n : ℕ) (hn : n ≥ 3) : 8 ∣ D n := by
  have h_lt : 2 < n := hn
  have h_dvd := b_add_one_dvd_D 2 n h_lt
  have h_b2 : b 2 = 7 := rfl
  have h_8 : b 2 + 1 = 8 := by rw [h_b2]
  rwa [h_8] at h_dvd

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

theorem Rs_irrational : Irrational (∑' k : ℕ, (1 : ℝ) / (b k + 1)) := by
  intro h_rat
  rcases h_rat with ⟨q, hq_eq⟩
  
  have hB_pos : ∀ (n : ℕ), 0 < (q.den : ℝ) * (D n : ℝ) * beta_n n := by
    intro n
    have h1 : (0 : ℝ) < q.den := by exact_mod_cast q.den_pos
    have h2 : (0 : ℝ) < D n := by exact_mod_cast (D_pos n)
    have h3 : 0 < beta_n n := beta_n_pos n
    positivity
    
  have hB_bound : ∀ (n : ℕ), (q.den : ℝ) * (D n : ℝ) * beta_n n ≤ 2 * (q.den : ℝ) * r n := by
    intro n
    have hb : beta_n n ≤ 1 / (b n - 1 : ℝ) := beta_n_le n
    calc
      (q.den : ℝ) * (D n : ℝ) * beta_n n ≤ (q.den : ℝ) * (D n : ℝ) * (1 / (b n - 1 : ℝ)) := by
        apply mul_le_mul_of_nonneg_left hb
        have h1 : (0 : ℝ) < q.den := by exact_mod_cast q.den_pos
        have h2 : (0 : ℝ) < D n := by exact_mod_cast (D_pos n)
        positivity
      _ = (q.den : ℝ) * ((D n : ℝ) / (b n - 1 : ℝ)) := by ring
      _ ≤ (q.den : ℝ) * (2 * ((D n : ℝ) / (b n : ℝ))) := by
        apply mul_le_mul_of_nonneg_left
        · have hb2 : 2 ≤ b n := b_ge_two n
          have hb2_real : (2 : ℝ) ≤ b n := by exact_mod_cast hb2
          have hd_pos : (0 : ℝ) < D n := by exact_mod_cast (D_pos n)
          have h_mul_div : 2 * ((D n : ℝ) / (b n : ℝ)) = (2 * (D n : ℝ)) / (b n : ℝ) := by ring
          rw [h_mul_div]
          have h_pos1 : (0 : ℝ) < b n - 1 := by linarith
          have h_pos2 : (0 : ℝ) < b n := by linarith
          rw [div_le_div_iff h_pos1 h_pos2]
          nlinarith
        · have h1 : (0 : ℝ) < q.den := by exact_mod_cast q.den_pos
          positivity
      _ = 2 * (q.den : ℝ) * r n := by
        dsimp [r]
        ring
        
  have hB_lt_one : ∃ N, ∀ n ≥ N, (q.den : ℝ) * (D n : ℝ) * beta_n n < 1 := by
    have h_lim : Filter.Tendsto (fun n => 2 * (q.den : ℝ) * r n) Filter.atTop (𝓝 (2 * (q.den : ℝ) * 0)) := by
      exact Filter.Tendsto.const_mul (2 * (q.den : ℝ)) tendsto_r
    have h_lim_zero : Filter.Tendsto (fun n => 2 * (q.den : ℝ) * r n) Filter.atTop (𝓝 0) := by
      have h_zero : 2 * (q.den : ℝ) * 0 = 0 := mul_zero _
      rw [← h_zero]
      exact h_lim
    have h_met := Metric.tendsto_atTop.mp h_lim_zero 1 (by norm_num)
    rcases h_met with ⟨N, hN⟩
    use max N 1
    intro n hn
    have hnN : n ≥ N := le_trans (le_max_left N 1) hn
    have h1 := hB_bound n
    have h2 := hN n hnN
    rw [Real.dist_eq] at h2
    have h3 : 2 * (q.den : ℝ) * r n - 0 = 2 * (q.den : ℝ) * r n := sub_zero _
    rw [h3] at h2
    have h4 : 2 * (q.den : ℝ) * r n ≤ |2 * (q.den : ℝ) * r n| := le_abs_self _
    linarith
    
  have hB_int : ∀ (n : ℕ), ∃ z : ℤ, (q.den : ℝ) * (D n : ℝ) * beta_n n = (z : ℝ) := by
    intro n
    have h_sum_split : (∑' (k : ℕ), 1 / ((b k : ℝ) + 1)) = (S n : ℝ) + beta_n n := sum_split n
    have h_beta_eq : beta_n n = (q : ℝ) - (S n : ℝ) := by
      rw [← hq_eq] at h_sum_split
      linarith
    have h_B_eq : (q.den : ℝ) * (D n : ℝ) * beta_n n = (q.num : ℝ) * (D n : ℝ) - (q.den : ℝ) * ((D n : ℝ) * (S n : ℝ)) := by
      rw [h_beta_eq]
      have h_q_eq : (q : ℝ) * (q.den : ℝ) = (q.num : ℝ) := by exact_mod_cast q.mul_den_eq_num
      calc
        (q.den : ℝ) * (D n : ℝ) * ((q : ℝ) - S n) = (q.den : ℝ) * (D n : ℝ) * (q : ℝ) - (q.den : ℝ) * (D n : ℝ) * S n := by ring
        _ = (q : ℝ) * (q.den : ℝ) * (D n : ℝ) - (q.den : ℝ) * ((D n : ℝ) * S n) := by ring
        _ = (q.num : ℝ) * (D n : ℝ) - (q.den : ℝ) * ((D n : ℝ) * S n) := by rw [h_q_eq]
    rcases D_mul_S_is_int n with ⟨z, hz⟩
    use q.num * (D n : ℤ) - q.den * z
    push_cast
    rw [h_B_eq]
    congr 1
    have hz_real : (D n : ℝ) * (S n : ℝ) = (z : ℝ) := by exact_mod_cast hz
    rw [hz_real]
    
  rcases hB_lt_one with ⟨N, hN⟩
  let n := max N 1
  have hnN : n ≥ N := le_max_left N 1
  have h1 : 0 < (q.den : ℝ) * (D n : ℝ) * beta_n n := hB_pos n
  have h2 : (q.den : ℝ) * (D n : ℝ) * beta_n n < 1 := hN n hnN
  rcases hB_int n with ⟨z, hz⟩
  rw [hz] at h1 h2
  
  have h3 : 0 < z := by exact_mod_cast h1
  have h4 : z < 1 := by exact_mod_cast h2
  omega
