import Lake
open Lake DSL

package «agent_workspace» where
  -- add package configuration options here

@[default_target]
lean_lib «agent_workspace» where
  srcDir := "."
  roots := #[`problem_statement, `residual_growth_bound, `erdos265_main, `dual_constraint_collapse, `sylvester_irrational, `universal_balance, `subgreedy_bounds, `fundamental_inequality, `subgreedy_asymptotics]

require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "v4.6.0"
