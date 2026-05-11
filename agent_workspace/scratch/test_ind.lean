import Mathlib

def foo (n : ℕ) : ℕ :=
  match n with
  | 0 => 0
  | n + 1 => n

lemma test (n : ℕ) : foo n = foo n := by
  induction n with
  | zero => rfl
  | succ m ih =>
    rfl
