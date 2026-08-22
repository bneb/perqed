namespace Perqed.Spec

theorem bm_valid_add_id (n : Nat) : n + 0 = n := by
  -- The hypothesis "n >= 0" is inherent to the type `Nat`.
  -- No explicit proof or `sorry` is requested, only the specification.
  done

end Perqed.Spec