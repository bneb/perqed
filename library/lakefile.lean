import Lake
open Lake DSL

package «perqed_library» where
  -- Settings applied to both it and its dependencies
  leanOptions := #[
    ⟨`pp.unicode.fun, true⟩, -- nicer `λ`
    ⟨`pp.proofs.withType, false⟩
  ]

require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "v4.6.0"

@[default_target]
lean_lib «Perqed» where
  -- add library configuration options here
