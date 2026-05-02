import Lake
open Lake DSL

package perqed where
  leanOptions := #[
    ⟨`autoImplicit, false⟩
  ]

require repl from git "https://github.com/leanprover-community/repl"
require mathlib from git "https://github.com/leanprover-community/mathlib4"

@[default_target]
lean_lib VerifiedConstruction where
  srcDir := "src/lean"
  roots := #[`verified_analytic, `verified_growth, `verified_convergence, `verified_patch, `affirmative_proof_core]

lean_lib KnuthTorusM4 where
  srcDir := "src/lean"
  roots := #[`KnuthTorusM4]

lean_lib TorusTopology where
  srcDir := "src/lean"
  roots := #[`TorusTopology]

lean_lib TorusTopologyM6 where
  srcDir := "src/lean"
  roots := #[`TorusTopologyM6]
