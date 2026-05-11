import Lake
open Lake DSL

package «perqed_proofs» where
  -- add package configuration options here

@[default_target]
lean_lib «PerqedProofs» where
  -- add library configuration options here

lean_lib VerifiedVault where
  srcDir := "verified_lib"

require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "v4.6.0"
lean_lib erdos265 where
  srcDir := "../src/lean"
