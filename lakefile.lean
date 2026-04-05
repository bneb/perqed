import Lake
open Lake DSL

package perqed where
  leanOptions := #[
    ⟨`autoImplicit, false⟩
  ]

require repl from git "https://github.com/leanprover-community/repl"

@[default_target]
lean_lib KnuthTorusM4 where
  srcDir := "src/lean"
  roots := #[`KnuthTorusM4]

lean_lib TorusTopology where
  srcDir := "src/lean"
  roots := #[`TorusTopology]

lean_lib TorusTopologyM6 where
  srcDir := "src/lean"
  roots := #[`TorusTopologyM6]
