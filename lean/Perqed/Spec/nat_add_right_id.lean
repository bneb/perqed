namespace Perqed.Spec

theorem nat_add_right_id (n : Nat) : n + 0 = n := by
  -- The proof for this theorem is omitted as per instructions.
  -- In Lean's `Nat` type, `n + 0 = n` is `Nat.add_zero`.
  -- This is a fundamental property of natural numbers.
  exact Nat.add_zero n

end Perqed.Spec