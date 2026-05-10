import Mathlib

lemma no_integer_solution (x y : ℤ) (hx : x > 1) :
    y^2 - y ≠ x^2 - x + 1 := by
  intro h
  have h1 : x^2 - x < x^2 - x + 1 := by linarith
  have h2 : x^2 - x + 1 < (x + 1)^2 - (x + 1) := by
    calc
      x^2 - x + 1 < x^2 + x := by linarith
      _ = (x^2 + 2*x + 1) - x - 1 := by ring
      _ = (x + 1)^2 - (x + 1) := by ring
  
  -- So y^2 - y is strictly between x^2 - x and (x+1)^2 - (x+1)
  -- Since the function f(z) = z^2 - z is strictly increasing for z ≥ 1,
  -- y cannot be an integer.
  sorry
