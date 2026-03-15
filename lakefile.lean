import Lake
open Lake DSL

package perqed where
  leanOptions := #[
    ⟨`autoImplicit, false⟩
  ]

@[default_target]
lean_lib KnuthTorusM4 where
  srcDir := "src/lean"
  roots := #[`KnuthTorusM4]
