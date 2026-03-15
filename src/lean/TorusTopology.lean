/-
  TorusTopology.lean -- Zero-Sorry Prop-Valued Hamiltonian Decomposition

  Architecture:
    1. Custom Decidable instance for forall over Torus4
    2. Pure Prop definitions (isTorusEdge, isHamiltonianCycle, etc.)
    3. Payload decoded into three successor functions
    4. Each sub-property proved individually by native_decide
    5. Final theorem assembles the sub-proofs
-/

set_option autoImplicit false

-- ============================================================
-- 1. Decidable Quantification over Torus Vertices
-- ============================================================

abbrev Torus4 := Fin 4 × Fin 4 × Fin 4

instance instDecForallTorus4 {P : Torus4 → Prop}
    [inst : ∀ v, Decidable (P v)] :
    Decidable (∀ v : Torus4, P v) :=
  if h : ∀ x : Fin 4, ∀ y : Fin 4, ∀ z : Fin 4, P (x, y, z)
  then .isTrue (fun v => h v.1 v.2.1 v.2.2)
  else .isFalse (fun h' => h (fun x y z => h' (x, y, z)))

-- ============================================================
-- 2. Mathematical Specification
-- ============================================================

def applyN (f : Torus4 → Torus4) : Nat → Torus4 → Torus4
  | 0, x => x
  | n + 1, x => applyN f n (f x)

def root : Torus4 := ((0 : Fin 4), (0 : Fin 4), (0 : Fin 4))

def isTorusEdge (u v : Torus4) : Prop :=
  v = (u.1 + 1, u.2.1, u.2.2) ∨
  v = (u.1, u.2.1 + 1, u.2.2) ∨
  v = (u.1, u.2.1, u.2.2 + 1)

instance instDecIsTorusEdge (u v : Torus4) : Decidable (isTorusEdge u v) :=
  inferInstanceAs (Decidable (_ ∨ _ ∨ _))

def isHamiltonianCycle (f : Torus4 → Torus4) : Prop :=
  (∀ x y : Torus4, f x = f y → x = y) ∧
  (applyN f 64 root = root) ∧
  (∀ k : Fin 63, applyN f (k.val + 1) root ≠ root)

def IsHamiltonianDecomposition (g0 g1 g2 : Torus4 → Torus4) : Prop :=
  (∀ u : Torus4, isTorusEdge u (g0 u)) ∧
  (∀ u : Torus4, isTorusEdge u (g1 u)) ∧
  (∀ u : Torus4, isTorusEdge u (g2 u)) ∧
  (∀ u : Torus4, g0 u ≠ g1 u) ∧
  (∀ u : Torus4, g0 u ≠ g2 u) ∧
  (∀ u : Torus4, g1 u ≠ g2 u) ∧
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

def stepDir (v : Torus4) : Fin 3 → Torus4
  | 0 => (v.1 + 1, v.2.1, v.2.2)
  | 1 => (v.1, v.2.1 + 1, v.2.2)
  | 2 => (v.1, v.2.1, v.2.2 + 1)

def vIdx (v : Torus4) : Nat :=
  v.1.val * 16 + v.2.1.val * 4 + v.2.2.val

def payload : Array (Fin 6) := #[
  3,1,5,4,3,0,0,5,0,5,0,4,2,0,4,5,
  4,5,1,0,0,4,5,0,4,0,5,0,2,3,5,2,
  5,4,2,5,4,1,2,0,4,4,0,1,0,5,3,0,
  5,5,4,5,2,2,0,3,1,0,4,1,5,0,1,4]

def succColor (c : Fin 3) (v : Torus4) : Torus4 :=
  stepDir v (permDir (payload.getD (vIdx v) 0) c)

def f0 : Torus4 → Torus4 := succColor 0
def f1 : Torus4 → Torus4 := succColor 1
def f2 : Torus4 → Torus4 := succColor 2

-- ============================================================
-- 4. Sub-Proofs (each by native_decide on a decidable sub-goal)
-- ============================================================

-- Edge validity: each color produces valid torus edges
set_option maxHeartbeats 4000000 in
theorem edges_f0 : ∀ u : Torus4, isTorusEdge u (f0 u) := by native_decide

set_option maxHeartbeats 4000000 in
theorem edges_f1 : ∀ u : Torus4, isTorusEdge u (f1 u) := by native_decide

set_option maxHeartbeats 4000000 in
theorem edges_f2 : ∀ u : Torus4, isTorusEdge u (f2 u) := by native_decide

-- Disjointness: no two colors agree at any vertex
set_option maxHeartbeats 4000000 in
theorem disj_01 : ∀ u : Torus4, f0 u ≠ f1 u := by native_decide

set_option maxHeartbeats 4000000 in
theorem disj_02 : ∀ u : Torus4, f0 u ≠ f2 u := by native_decide

set_option maxHeartbeats 4000000 in
theorem disj_12 : ∀ u : Torus4, f1 u ≠ f2 u := by native_decide

-- Injectivity: each color function is injective
set_option maxHeartbeats 40000000 in
theorem inj_f0 : ∀ x y : Torus4, f0 x = f0 y → x = y := by native_decide

set_option maxHeartbeats 40000000 in
theorem inj_f1 : ∀ x y : Torus4, f1 x = f1 y → x = y := by native_decide

set_option maxHeartbeats 40000000 in
theorem inj_f2 : ∀ x y : Torus4, f2 x = f2 y → x = y := by native_decide

-- Orbit closes at exactly 64 steps
set_option maxRecDepth 131072 in
set_option maxHeartbeats 4000000 in
theorem orbit_f0 : applyN f0 64 root = root := by native_decide

set_option maxRecDepth 131072 in
set_option maxHeartbeats 4000000 in
theorem orbit_f1 : applyN f1 64 root = root := by native_decide

set_option maxRecDepth 131072 in
set_option maxHeartbeats 4000000 in
theorem orbit_f2 : applyN f2 64 root = root := by native_decide

-- No shorter orbit (prevents sub-tours)
set_option maxRecDepth 131072 in
set_option maxHeartbeats 40000000 in
theorem no_short_f0 : ∀ k : Fin 63, applyN f0 (k.val + 1) root ≠ root := by native_decide

set_option maxRecDepth 131072 in
set_option maxHeartbeats 40000000 in
theorem no_short_f1 : ∀ k : Fin 63, applyN f1 (k.val + 1) root ≠ root := by native_decide

set_option maxRecDepth 131072 in
set_option maxHeartbeats 40000000 in
theorem no_short_f2 : ∀ k : Fin 63, applyN f2 (k.val + 1) root ≠ root := by native_decide

-- ============================================================
-- 5. The Final Theorem (Zero Sorry)
-- ============================================================

theorem torus_m4_valid : IsHamiltonianDecomposition f0 f1 f2 :=
  ⟨edges_f0, edges_f1, edges_f2, disj_01, disj_02, disj_12,
   ⟨inj_f0, orbit_f0, no_short_f0⟩,
   ⟨inj_f1, orbit_f1, no_short_f1⟩,
   ⟨inj_f2, orbit_f2, no_short_f2⟩⟩
