/-
  TorusTopologyM6.lean -- Zero-Sorry Prop-Valued Hamiltonian Decomposition (m=6)

  Architecture (identical to m=4):
    1. Custom Decidable instance for forall over Torus6
    2. Pure Prop definitions (isTorusEdge, isHamiltonianCycle, etc.)
    3. Payload decoded into three successor functions
    4. Each sub-property proved individually by decide
    5. Final theorem assembles the sub-proofs

  Witness discovered via Simulated Annealing in 99.51 seconds.
-/

set_option autoImplicit false

-- ============================================================
-- 1. Decidable Quantification over Torus Vertices
-- ============================================================

abbrev Torus6 := Fin 6 × Fin 6 × Fin 6

instance instDecForallTorus6 {P : Torus6 → Prop}
    [inst : ∀ v, Decidable (P v)] :
    Decidable (∀ v : Torus6, P v) :=
  if h : ∀ x : Fin 6, ∀ y : Fin 6, ∀ z : Fin 6, P (x, y, z)
  then .isTrue (fun v => h v.1 v.2.1 v.2.2)
  else .isFalse (fun h' => h (fun x y z => h' (x, y, z)))

-- ============================================================
-- 2. Mathematical Specification
-- ============================================================

def applyN (f : Torus6 → Torus6) : Nat → Torus6 → Torus6
  | 0, x => x
  | n + 1, x => applyN f n (f x)

def root : Torus6 := ((0 : Fin 6), (0 : Fin 6), (0 : Fin 6))

def isTorusEdge (u v : Torus6) : Prop :=
  v = (u.1 + 1, u.2.1, u.2.2) ∨
  v = (u.1, u.2.1 + 1, u.2.2) ∨
  v = (u.1, u.2.1, u.2.2 + 1)

instance instDecIsTorusEdge (u v : Torus6) : Decidable (isTorusEdge u v) :=
  inferInstanceAs (Decidable (_ ∨ _ ∨ _))

def isHamiltonianCycle (f : Torus6 → Torus6) : Prop :=
  (∀ x y : Torus6, f x = f y → x = y) ∧
  (applyN f 216 root = root) ∧
  (∀ k : Fin 215, applyN f (k.val + 1) root ≠ root)

def IsHamiltonianDecomposition (g0 g1 g2 : Torus6 → Torus6) : Prop :=
  (∀ u : Torus6, isTorusEdge u (g0 u)) ∧
  (∀ u : Torus6, isTorusEdge u (g1 u)) ∧
  (∀ u : Torus6, isTorusEdge u (g2 u)) ∧
  (∀ u : Torus6, g0 u ≠ g1 u) ∧
  (∀ u : Torus6, g0 u ≠ g2 u) ∧
  (∀ u : Torus6, g1 u ≠ g2 u) ∧
  isHamiltonianCycle g0 ∧
  isHamiltonianCycle g1 ∧
  isHamiltonianCycle g2

-- ============================================================
-- 3. Payload and Successor Functions
-- ============================================================

def permDir : Fin 6 → Fin 3 → Fin 3
  | 0, 0 => 0 | 0, 1 => 1 | 0, 2 => 2
  | 1, 0 => 0 | 1, 1 => 2 | 1, 2 => 1
  | 2, 0 => 1 | 2, 1 => 0 | 2, 2 => 2
  | 3, 0 => 2 | 3, 1 => 0 | 3, 2 => 1
  | 4, 0 => 1 | 4, 1 => 2 | 4, 2 => 0
  | 5, 0 => 2 | 5, 1 => 1 | 5, 2 => 0

def stepDir (v : Torus6) : Fin 3 → Torus6
  | 0 => (v.1 + 1, v.2.1, v.2.2)
  | 1 => (v.1, v.2.1 + 1, v.2.2)
  | 2 => (v.1, v.2.1, v.2.2 + 1)

def vIdx (v : Torus6) : Nat :=
  v.1.val * 36 + v.2.1.val * 6 + v.2.2.val

def payload : Array (Fin 6) := #[
  0,3,3,2,5,5,1,4,1,3,2,5,0,1,4,1,0,5,
  1,4,5,3,0,3,2,2,3,3,5,3,1,5,1,0,4,1,
  0,0,3,4,1,4,3,1,0,5,1,0,1,5,2,4,3,4,
  3,1,2,4,2,4,3,2,0,1,2,3,1,2,4,1,4,4,
  4,0,3,4,3,1,0,4,4,4,4,0,1,0,1,0,3,2,
  2,3,3,5,4,3,5,1,2,0,5,0,3,1,2,5,3,0,
  1,5,5,0,0,1,3,3,3,3,4,4,1,1,1,0,0,4,
  5,3,3,3,0,5,4,5,1,5,2,5,2,3,3,0,2,0,
  1,1,4,1,0,2,5,0,5,3,1,5,2,2,1,4,3,2,
  0,5,0,4,1,4,3,2,4,3,1,3,0,2,4,3,1,5,
  2,1,2,4,3,2,4,1,0,4,4,1,3,2,1,0,5,0,
  4,1,5,2,5,1,3,3,0,2,5,2,5,5,2,0,1,1]

def succColor (c : Fin 3) (v : Torus6) : Torus6 :=
  stepDir v (permDir (payload.getD (vIdx v) 0) c)

def f0 : Torus6 → Torus6 := succColor 0
def f1 : Torus6 → Torus6 := succColor 1
def f2 : Torus6 → Torus6 := succColor 2

-- ============================================================
-- 4. Sub-Proofs (each by decide on a decidable sub-goal)
-- ============================================================

-- Edge validity: each color produces valid torus edges
set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem edges_f0 : ∀ u : Torus6, isTorusEdge u (f0 u) := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem edges_f1 : ∀ u : Torus6, isTorusEdge u (f1 u) := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem edges_f2 : ∀ u : Torus6, isTorusEdge u (f2 u) := by decide

-- Disjointness: no two colors agree at any vertex
set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem disj_01 : ∀ u : Torus6, f0 u ≠ f1 u := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem disj_02 : ∀ u : Torus6, f0 u ≠ f2 u := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem disj_12 : ∀ u : Torus6, f1 u ≠ f2 u := by decide

-- Injectivity: each color function is injective
-- 216² = 46,656 pairs — needs significant heartbeats
set_option maxRecDepth 524288 in
set_option maxHeartbeats 400000000 in
theorem inj_f0 : ∀ x y : Torus6, f0 x = f0 y → x = y := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 400000000 in
theorem inj_f1 : ∀ x y : Torus6, f1 x = f1 y → x = y := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 400000000 in
theorem inj_f2 : ∀ x y : Torus6, f2 x = f2 y → x = y := by decide

-- Orbit closes at exactly 216 steps
set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem orbit_f0 : applyN f0 216 root = root := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem orbit_f1 : applyN f1 216 root = root := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 16000000 in
theorem orbit_f2 : applyN f2 216 root = root := by decide

-- No shorter orbit (prevents sub-tours)
set_option maxRecDepth 524288 in
set_option maxHeartbeats 400000000 in
theorem no_short_f0 : ∀ k : Fin 215, applyN f0 (k.val + 1) root ≠ root := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 400000000 in
theorem no_short_f1 : ∀ k : Fin 215, applyN f1 (k.val + 1) root ≠ root := by decide

set_option maxRecDepth 524288 in
set_option maxHeartbeats 400000000 in
theorem no_short_f2 : ∀ k : Fin 215, applyN f2 (k.val + 1) root ≠ root := by decide

-- ============================================================
-- 5. The Final Theorem (Zero Sorry)
-- ============================================================

theorem torus_m6_valid : IsHamiltonianDecomposition f0 f1 f2 :=
  ⟨edges_f0, edges_f1, edges_f2, disj_01, disj_02, disj_12,
   ⟨inj_f0, orbit_f0, no_short_f0⟩,
   ⟨inj_f1, orbit_f1, no_short_f1⟩,
   ⟨inj_f2, orbit_f2, no_short_f2⟩⟩
