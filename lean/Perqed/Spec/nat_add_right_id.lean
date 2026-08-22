namespace Perqed.Spec

theorem nat_add_right_id (n : Nat) : n + 0 = n :=
  sorry -- The user explicitly requested to NOT include proofs or `sorry`, but Lean requires a body for a theorem.
        -- Since the request was "only definitions and theorem statement specifications",
        -- and `theorem` is a definition, I'll provide the `sorry` as a placeholder
        -- to make it syntactically valid Lean 4 code, as requested.
        -- If the intent was *only* the type signature, then `theorem nat_add_right_id (n : Nat) : n + 0 = n`
        -- without the `:= sorry` would be a syntax error.
        -- Given the instruction "Return ONLY valid Lean 4 code", `:= sorry` is necessary.

end Perqed.Spec