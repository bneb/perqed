/-
  TorusEvenGeneralized.lean -- The Generalized Even-m Conjecture

  This file formally expresses the theorem that the Directed Hamiltonian
  Torus Decomposition problem is solvable for all even m >= 8.

  While the specific witnesses for m=4 and m=6 are verified natively by
  the `decide` kernel in `TorusTopologyM4.lean` and `TorusTopologyM6.lean`,
  the generalized mathematical proof relies on Ho Boon Suan's closed-form
  splicing construction, which is empirically validated but currently lacks 
  a formalized Lean 4 tactic proof spanning all generic m.

  This file serves as the formal specification for future MCTS tactic searches.
-/

import Lean

set_option autoImplicit false

-- ============================================================
-- 1. Generalized Torus Definitions
-- ============================================================

abbrev Torus (m : Nat) := Fin m × Fin m × Fin m

def isTorusEdge {m : Nat} (u v : Torus m) : Prop :=
  v = (u.1 + 1, u.2.1, u.2.2) ∨
  v = (u.1, u.2.1 + 1, u.2.2) ∨
  v = (u.1, u.2.1, u.2.2 + 1)

def applyN {m : Nat} (f : Torus m → Torus m) : Nat → Torus m → Torus m
  | 0, x => x
  | n + 1, x => applyN f n (f x)

-- The origin vertex
def root {m : Nat} [NeZero m] : Torus m :=
  ((0 : Fin m), (0 : Fin m), (0 : Fin m))

-- ============================================================
-- 2. Hamiltonian Properties
-- ============================================================

/--
A function is a Hamiltonian cycle on the torus if it is injective,
visits every vertex (orbit closes at length m^3), and has no shorter cycles.
-/
def isHamiltonianCycle {m : Nat} [NeZero m] (f : Torus m → Torus m) : Prop :=
  (∀ x y : Torus m, f x = f y → x = y) ∧
  (applyN f (m * m * m) root = root) ∧
  (∀ k : Nat, 0 < k → k < (m * m * m) → applyN f k root ≠ root)

/--
A valid permutation assigns exactly 3 outgoing edges to each vertex,
which must be exactly the set of 3 coordinate-axis successors.
-/
def IsHamiltonianDecomposition {m : Nat} [NeZero m]
    (f0 f1 f2 : Torus m → Torus m) : Prop :=
  (∀ u : Torus m, isTorusEdge u (f0 u)) ∧
  (∀ u : Torus m, isTorusEdge u (f1 u)) ∧
  (∀ u : Torus m, isTorusEdge u (f2 u)) ∧
  (∀ u : Torus m, f0 u ≠ f1 u) ∧
  (∀ u : Torus m, f0 u ≠ f2 u) ∧
  (∀ u : Torus m, f1 u ≠ f2 u) ∧
  isHamiltonianCycle f0 ∧
  isHamiltonianCycle f1 ∧
  isHamiltonianCycle f2

-- ============================================================
-- 3. The Grand Open Conjecture
-- ============================================================

/--
Conjecture: For all even m ≥ 8, there exists a Directed Hamiltonian
Torus Decomposition of the m×m×m torus.

This corresponds to the closed-form construction empirically discovered
by GPT-5.4 Pro / Ho Boon Suan (March 2026), which formally resolves
Knuth's open problem for the remaining even sizes.

Proof status: Open for automated MCTS tactic search.
-/
theorem even_torus_decomposition_exists (m : Nat) (hm_even : m % 2 = 0) (hm_ge : m ≥ 8) :
    ∃ (f0 f1 f2 : Torus m → Torus m), IsHamiltonianDecomposition f0 f1 f2 := by
  -- Future work: Synthesize Ho Boon Suan's construction and prove
  -- structural properties via induction.
  sorry
