import Lean
import Lean.Meta
import Lean.Util.CollectAxioms
import Perqed

open Lean Meta

/-- Compute canonical SHA-256 hash of specification file using python3/shasum -/
def computeCanonicalSpecHash (specFilePath : String) : IO String := do
  let script := "import sys, hashlib, re
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    text = f.read()
# Strip block comments
text = re.sub(r'(?s)/-.*?-/', '', text)
# Strip line comments
text = re.sub(r'--[^\\n\\r]*', '', text)
lines = [line.strip() for line in text.splitlines() if line.strip()]
canonical = '\\n'.join(lines)
print(hashlib.sha256(canonical.encode('utf-8')).hexdigest(), end='')
"
  let out ← IO.Process.output {
    cmd := "python3",
    args := #["-c", script, specFilePath]
  }
  if out.exitCode != 0 then
    throw (IO.userError s!"Failed to hash spec file '{specFilePath}': {out.stderr}")
  return out.stdout.trimAscii.toString

/-- Hardened Verification Gate with Cryptographic Hash-Lock & Transitive Axiom Closure -/
def runAudit (proofDecl : Name) (frozenSpecDecl : Name) (specFilePath : Option String) (expectedHash : Option String) : MetaM Bool := do
  let env ← getEnv
  
  -- 0. Cryptographic Statement Hash-Lock Check
  if let (some specPath, some expHash) := (specFilePath, expectedHash) then
    IO.println s!"[AUDIT] Verifying cryptographic hash-lock for spec file: {specPath}"
    let computedHash ← computeCanonicalSpecHash specPath
    if computedHash != expHash then
      IO.eprintln "================================================================================"
      IO.eprintln "❌ AUDIT REJECTED: SPECIFICATION HASH MISMATCH!"
      IO.eprintln s!"  Expected Frozen Hash: {expHash}"
      IO.eprintln s!"  Computed File Hash:   {computedHash}"
      IO.eprintln "  The specification statement has been altered after the cryptographic lock was created."
      IO.eprintln "================================================================================"
      return false
    IO.println s!"✅ HASH-LOCK VERIFIED: File '{specPath}' matches frozen hash {expHash}"

  -- 1. Check if declarations exist in kernel environment
  let some candInfo := env.find? proofDecl
    | do
      IO.eprintln s!"AUDIT REJECTED: Candidate declaration '{proofDecl}' not found in environment."
      return false

  let some targetInfo := env.find? frozenSpecDecl
    | do
      IO.eprintln s!"AUDIT REJECTED: Frozen specification '{frozenSpecDecl}' not found in environment."
      return false

  -- 2. Transitive Axiom Closure Check
  let axioms ← Lean.collectAxioms proofDecl
  let allowedAxioms : List Name := [`Classical.choice, `Quot.sound, `propext]
  
  IO.println s!"[AUDIT] Checking declaration '{proofDecl}' against spec '{frozenSpecDecl}'"
  IO.println s!"[AUDIT] Axioms used: {axioms.toList}"

  for ax in axioms do
    if ax == `sorryAx then
      IO.eprintln "❌ AUDIT REJECTED: Proof relies on 'sorryAx' (incomplete proof)."
      return false
    if ax == `Lean.ofReduceBool then
      IO.eprintln "❌ AUDIT REJECTED: Proof relies on unchecked native_decide (Lean.ofReduceBool)."
      return false
    if !allowedAxioms.contains ax then
      IO.eprintln s!"❌ AUDIT REJECTED: Custom/unauthorized axiom detected: {ax}"
      return false
  
  -- 3. Exact Definitional / Signature Compatibility Check
  let candType := candInfo.type
  let targetType := targetInfo.type

  let directEq ← isDefEq candType targetType
  let isEq ← if directEq then
    pure true
  else
    forallTelescope targetType fun targetFvars _ => do
      let app := mkAppN (mkConst frozenSpecDecl) targetFvars
      let quantified ← mkForallFVars targetFvars app
      isDefEq quantified candType

  if !isEq then
    IO.eprintln "❌ AUDIT REJECTED: Theorem conclusion does not match frozen specification."
    IO.eprintln s!"  Candidate Type: {candType}"
    IO.eprintln s!"  Expected Type:  {targetType} (or application of {frozenSpecDecl})"
    return false

  IO.println s!"✅ ALL AUDIT GATES PASSED: Declaration '{proofDecl}' is sound, unpolluted, matches frozen target '{frozenSpecDecl}'."
  return true

def stringToName (s : String) : Name :=
  s.splitOn "." |>.foldl (fun acc part => if part.isEmpty then acc else Name.mkStr acc part) Name.anonymous

structure ParsedAuditArgs where
  proofName : Name
  specName : Name
  specFilePath : Option String
  expectedHash : Option String

def parseAuditArgs (args : List String) : ParsedAuditArgs :=
  let rec loop (rem : List String) (acc : ParsedAuditArgs) : ParsedAuditArgs :=
    match rem with
    | "--" :: rest => loop rest acc
    | "--proof" :: p :: rest => loop rest { acc with proofName := stringToName p }
    | "--spec" :: s :: rest => loop rest { acc with specName := stringToName s }
    | "--spec-file" :: f :: rest => loop rest { acc with specFilePath := some f }
    | "--expected-hash" :: h :: rest => loop rest { acc with expectedHash := some h }
    | p :: s :: rest => loop rest { acc with proofName := stringToName p, specName := stringToName s }
    | _ => acc
  loop args {
    proofName := `Perqed.Proofs.nat_add_right_id,
    specName := `Perqed.Spec.nat_add_right_id,
    specFilePath := none,
    expectedHash := none
  }

unsafe def main (args : List String) : IO UInt32 := do
  initSearchPath (← findSysroot)
  let parsed := parseAuditArgs args
  let env ← importModules #[{ module := `Perqed }] {} 0
  let coreContext : Core.Context := { fileName := "<cold_audit>", fileMap := FileMap.ofString "" }
  let coreState : Core.State := { env := env }
  
  let result ← (runAudit parsed.proofName parsed.specName parsed.specFilePath parsed.expectedHash).toIO coreContext coreState
  match result with
  | (true, _) => return 0
  | (false, _) => return 1
