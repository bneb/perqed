import Mathlib

open Complex Polynomial

noncomputable section

def phi_real (x : ℝ) : ℝ := x^2 / (1 - x + x^2)

lemma phi_real_lt (x : ℝ) (h0 : 0 < x) (h1 : x < 1) : phi_real x < x := by
  unfold phi_real
  have h_denom : 0 < 1 - x + x^2 := by
    calc
      1 - x + x^2 = (x - 1/2)^2 + 3/4 := by ring
      _ > 0 := by positivity
  rw [div_lt_iff h_denom]
  have h1 : 0 < 1 - x := by linarith
  have h2 : 0 < (1 - x)^2 := by positivity
  have h_diff : 0 < x * (1 - x)^2 := by positivity
  have h_eq : x * (1 - x)^2 = x * (1 - x + x^2) - x^2 := by ring
  linarith

def pole_seq : ℕ → ℝ
| 0 => 1/3
| (n + 1) => phi_real (pole_seq n)

lemma pole_seq_pos (n : ℕ) : 0 < pole_seq n := by
  induction n with
  | zero => norm_num [pole_seq]
  | succ n ih =>
      unfold pole_seq
      unfold phi_real
      have h_denom : 0 < 1 - pole_seq n + (pole_seq n)^2 := by
        calc
          1 - pole_seq n + (pole_seq n)^2 = (pole_seq n - 1/2)^2 + 3/4 := by ring
          _ > 0 := by positivity
      positivity

lemma pole_seq_lt_one (n : ℕ) : pole_seq n < 1 := by
  induction n with
  | zero => norm_num [pole_seq]
  | succ n ih =>
      unfold pole_seq
      have hp := pole_seq_pos n
      have hlt := phi_real_lt (pole_seq n) hp ih
      linarith

lemma pole_seq_strict_anti : StrictAnti pole_seq := by
  apply strictAnti_nat_of_succ_lt
  intro n
  have hp := pole_seq_pos n
  have hlt := pole_seq_lt_one n
  exact phi_real_lt (pole_seq n) hp hlt

end
