import Lake
open Lake DSL

package «perqed» {
  -- add package configuration options here
}

require mathlib from git "https://github.com/leanprover-community/mathlib4" @ "v4.30.0-rc2"

lean_lib «VerifiedConstruction» {
  srcDir := "src/lean"
  roots := #[
    `verified_analytic,
    `verified_growth,
    `verified_convergence,
    `verified_patch,
    `kt_combinatorics,
    `affirmative_proof_core
  ]
}

@[default_target]
lean_exe «perqed» {
  root := `src.Main
}
