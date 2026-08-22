import Lean
import Lean.Meta
import Lean.Util.CollectAxioms
import Mathlib

open Lean Meta

/-- Official Lean 4 Palomar Comparator Script (Terence Tao / Lean FRO Standard)
    Verifies:
    1. challenge.lean and solution.lean typecheck definitionally (isDefEq)
    2. Transitive axiom closure does not contain cheat axioms (`sorryAx`, `Lean.ofReduceBool`)
    3. Proof term is sorry-free
-/

def runComparator (challengeModule : Name) (solutionModule : Name) (challengeDecl : Name) (solutionDecl : Name) : MetaM Bool := do
  let env ← getEnv

  let some chalInfo := env.find? challengeDecl
    | do
      IO.eprintln s!"[COMPARATOR ERROR] Challenge declaration '{challengeDecl}' not found."
      return false

  let some solInfo := env.find? solutionDecl
    | do
      IO.eprintln s!"[COMPARATOR ERROR] Solution declaration '{solutionDecl}' not found."
      return false

  -- 1. Transitive Axiom Closure Check
  let axioms ← Lean.collectAxioms solutionDecl
  let allowedAxioms : List Name := [`Classical.choice, `Quot.sound, `propext]

  IO.println s!"[COMPARATOR] Auditing Palomar solution '{solutionDecl}' against challenge '{challengeDecl}'"
  IO.println s!"[COMPARATOR] Axiom set: {axioms.toList}"

  for ax in axioms do
    if ax == `sorryAx then
      IO.eprintln "❌ COMPARATOR REJECTED: Solution contains 'sorryAx' (incomplete proof)."
      return false
    if ax == `Lean.ofReduceBool then
      IO.eprintln "❌ COMPARATOR REJECTED: Solution contains unchecked native_decide (Lean.ofReduceBool)."
      return false
    if !allowedAxioms.contains ax then
      IO.eprintln s!"❌ COMPARATOR REJECTED: Unauthorized custom axiom: {ax}"
      return false

  -- 2. Definitional Equality Check between Challenge and Solution Type
  let isEq ← isDefEq chalInfo.type solInfo.type
  if !isEq then
    IO.eprintln "❌ COMPARATOR REJECTED: Solution type is not definitionally equal to Challenge type."
    IO.eprintln s!"  Challenge Type: {chalInfo.type}"
    IO.eprintln s!"  Solution Type:  {solInfo.type}"
    return false

  IO.println "✅ PALOMAR COMPARATOR VERIFIED: Challenge and Solution are definitionally equal and sound."
  return true

unsafe def main (args : List String) : IO UInt32 := do
  initSearchPath (← findSysroot)
  let challengeDecl := match args.get? 0 with
    | some s => s.toName
    | none => `Perqed.Spec.nat_add_right_id
  let solutionDecl := match args.get? 1 with
    | some s => s.toName
    | none => `Perqed.Proofs.nat_add_right_id

  let env ← importModules #[{ module := `Perqed }, { module := `Mathlib }] {} 0
  let coreContext : Core.Context := { fileName := "<palomar_comparator>", fileMap := FileMap.ofString "" }
  let coreState : Core.State := { env := env }

  let (res, _) ← (runComparator `Perqed.Spec `Perqed.Proofs challengeDecl solutionDecl).toIO coreContext coreState
  if res then
    return 0
  else
    return 1
