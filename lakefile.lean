import Lake
open Lake DSL

package "perqed" where
  version := v!"0.2.0"
  keywords := #["math", "theorem-proving", "verification"]

lean_lib «Perqed» where
  srcDir := "lean"

@[default_target]
lean_exe "audit_spec" where
  root := `scripts.AuditSpec
  srcDir := "lean"
