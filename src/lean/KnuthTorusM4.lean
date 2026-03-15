/-
  Knuth's Claude's Cycles — m=4 Directed Torus Hamiltonian Decomposition
  Perqed AI Math Prover — Sprint 27/28 Formal Verification

  Theorem: The 4×4×4 directed torus graph (64 vertices, 192 arcs)
  admits a decomposition into exactly 3 directed Hamiltonian cycles.

  The witness payload was discovered by Simulated Annealing with
  energy-proportional reheating (restart 12, 92.96s on Apple M4).
-/

def payload : Array Nat := #[
  3,1,5,4,3,0,0,5,0,5,0,4,2,0,4,5,
  4,5,1,0,0,4,5,0,4,0,5,0,2,3,5,2,
  5,4,2,5,4,1,2,0,4,4,0,1,0,5,3,0,
  5,5,4,5,2,2,0,3,1,0,4,1,5,0,1,4
]

def colorDirection (permIdx : Nat) (color : Nat) : Nat :=
  match permIdx, color with
  | 0, 0 => 0 | 0, 1 => 1 | 0, _ => 2
  | 1, 0 => 0 | 1, 2 => 1 | 1, _ => 2
  | 2, 1 => 0 | 2, 0 => 1 | 2, _ => 2
  | 3, 1 => 0 | 3, 2 => 1 | 3, _ => 2
  | 4, 2 => 0 | 4, 0 => 1 | 4, _ => 2
  | 5, 2 => 0 | 5, 1 => 1 | 5, _ => 2
  | _, _ => 0

def successor (v : Nat) (color : Nat) : Nat :=
  let i := v / 16
  let j := (v / 4) % 4
  let k := v % 4
  let perm := payload[v]!
  let dir := colorDirection perm color
  match dir with
  | 0 => ((i + 1) % 4) * 16 + j * 4 + k
  | 1 => i * 16 + ((j + 1) % 4) * 4 + k
  | _ => i * 16 + j * 4 + ((k + 1) % 4)

/-- Walk exactly n steps. -/
def walk (v : Nat) (color : Nat) : Nat → Nat
  | 0 => v
  | n + 1 => walk (successor v color) color n

/-- Check if target vertex is visited in the first `fuel` steps of the orbit. -/
def inOrbit (color : Nat) (target : Nat) (fuel : Nat) : Bool :=
  match fuel with
  | 0 => false
  | n + 1 => walk 0 color (64 - fuel) == target || inOrbit color target n

/-- Check all 64 vertices appear in the orbit using countdown fuel. -/
def allInOrbit (color : Nat) (remaining : Nat) : Bool :=
  match remaining with
  | 0 => true
  | n + 1 => inOrbit color n 64 && allInOrbit color n

/-- A color is Hamiltonian iff: 64 steps return to start AND all vertices visited. -/
def isHamiltonian (color : Nat) : Bool :=
  walk 0 color 64 == 0 && allInOrbit color 64

def isValidDecomposition : Bool :=
  isHamiltonian 0 && isHamiltonian 1 && isHamiltonian 2

#eval isValidDecomposition

--//-- SFT_STATE_START
-- payload : Array Nat  (64-element witness from SA)
-- successor : Nat → Nat → Nat  (3D torus transition)
-- isValidDecomposition : Bool  (all 3 colors Hamiltonian)
-- ⊢ isValidDecomposition = true
--//-- SFT_STATE_END
--//-- SFT_TACTIC
set_option maxRecDepth 131072 in
set_option maxHeartbeats 4000000 in
theorem claude_cycles_m4_valid : isValidDecomposition = true := by decide
