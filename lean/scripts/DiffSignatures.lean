import Lean
import Lean.Meta
import Perqed

open Lean Meta

/-- Hypothesis & Signature Diff Gate -/
def runDiff (proofDecl : Name) (frozenSpecDecl : Name) : MetaM Bool := do
  let env ← getEnv
  
  let some candInfo := env.find? proofDecl
    | do
      IO.eprintln s!"DIFF REJECTED: Candidate declaration '{proofDecl}' not found in environment."
      return false

  let some targetInfo := env.find? frozenSpecDecl
    | do
      IO.eprintln s!"DIFF REJECTED: Frozen specification '{frozenSpecDecl}' not found in environment."
      return false

  let candType := candInfo.type
  let targetType := targetInfo.type

  IO.println s!"[DIFF] Analyzing signature of '{proofDecl}' against '{frozenSpecDecl}'"

  let noStuffing ← forallTelescope candType fun candFvars candBody => do
    forallTelescope targetType fun targetFvars targetBody => do
      -- Check if any hypotheses were injected into candidate that don't exist in spec
      if candFvars.size > targetFvars.size then
        IO.eprintln s!"DIFF REJECTED: Hypothesis stuffing detected! Candidate introduces {candFvars.size - targetFvars.size} extra parameter(s)."
        return false
      if candFvars.size < targetFvars.size then
        IO.eprintln s!"DIFF REJECTED: Candidate dropped required parameter(s) from specification."
        return false

      for i in [0:candFvars.size] do
        let cType ← inferType candFvars[i]!
        let tType ← inferType targetFvars[i]!
        if !(← isDefEq cType tType) then
          IO.eprintln s!"DIFF REJECTED: Parameter {i} type differs from frozen specification."
          return false

      let isEq ← isDefEq candBody targetBody
      let isAppOfTarget := match candBody.getAppFn with
        | Expr.const n _ => n == frozenSpecDecl
        | _ => false

      if !isEq && !isAppOfTarget then
        IO.eprintln "DIFF REJECTED: Target goal conclusion does not match frozen specification."
        return false

      return true

  if noStuffing then
    IO.println "✅ SIGNATURE DIFF PASSED: No hypothesis stuffing or signature drift detected."
    return true
  else
    return false

def parseArgs (args : List String) : Name × Name :=
  match args with
  | [p, s] => (p.toName, s.toName)
  | ["--proof", p, "--spec", s] => (p.toName, s.toName)
  | _ => (`Perqed.Proofs.nat_add_right_id, `Perqed.Spec.nat_add_right_id)

unsafe def main (args : List String) : IO UInt32 := do
  initSearchPath (← findSysroot)
  let (proofName, specName) := parseArgs args
  let env ← importModules #[{ module := `Perqed }] {} 0
  let coreContext : Core.Context := { fileName := "<diff>", fileMap := FileMap.ofString "" }
  let coreState : Core.State := { env := env }
  
  let result ← (runDiff proofName specName).toIO coreContext coreState
  match result with
  | (true, _) => return 0
  | (false, _) => return 1
