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

  let directEq ← isDefEq candType targetType
  let noStuffing ← if directEq then
    pure true
  else
    forallTelescope targetType fun targetFvars _ => do
      let app := mkAppN (mkConst frozenSpecDecl) targetFvars
      let quantified ← mkForallFVars targetFvars app
      isDefEq quantified candType

  if noStuffing then
    IO.println "✅ SIGNATURE DIFF PASSED: No hypothesis stuffing or signature drift detected."
    return true
  else
    IO.eprintln "DIFF REJECTED: Target goal conclusion does not match frozen specification."
    return false

def stringToName (s : String) : Name :=
  s.splitOn "." |>.foldl (fun acc part => if part.isEmpty then acc else Name.mkStr acc part) Name.anonymous

def parseArgs (args : List String) : Name × Name :=
  let rec loop (rem : List String) (p : Name) (s : Name) : Name × Name :=
    match rem with
    | "--" :: rest => loop rest p s
    | "--proof" :: p_str :: rest => loop rest (stringToName p_str) s
    | "--spec" :: s_str :: rest => loop rest p (stringToName s_str)
    | p_str :: s_str :: rest => loop rest (stringToName p_str) (stringToName s_str)
    | _ => (p, s)
  loop args `Perqed.Proofs.nat_add_right_id `Perqed.Spec.nat_add_right_id

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
