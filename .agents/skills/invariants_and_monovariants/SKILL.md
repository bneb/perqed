---
name: invariants_and_monovariants
description: Identify a quantity that is preserved (invariant) or monotonically changes (monovariant) under all allowed operations, then use it to restrict reachable states or prove termination.
---

# Invariants and Monovariants

## Technique

An **invariant** is a property or quantity that remains constant under every step of a process. If state S₀ has invariant value I₀ and the target state S* has invariant value I*, then S* is reachable from S₀ only if I₀ = I*. Contrapositive: if I₀ ≠ I*, the target is unreachable.

A **monovariant** is a quantity that strictly increases (or decreases) under each step. Since the domain is finite (or well-ordered), the process must terminate. Combined with an invariant, monovariants give tight reachability and termination proofs.

In graph theory: parity arguments (number of odd-degree vertices is always even) are invariants. In algorithm analysis: a measure function decreasing at each step is a monovariant. In combinatorial game theory: Nim-values and Sprague-Grundy theory are invariant-based.

## When to Apply

- The goal is to prove a state is **unreachable** from an initial state (invariant is different).
- A process terminates and you need a termination proof (decreasing monovariant).
- The problem is a parity argument: something is even/odd or ≡ k (mod m) throughout.
- A combinatorial game or rewriting system needs a progress measure.
- The ARCHITECT's context shows an SA energy landscape where the proof needs "why we can't decrease below E=k."

## Lean 4 Template

```lean
import Mathlib

-- Invariant: some function f is preserved by one step
structure Invariant {State : Type*} (step : State → State) (f : State → α) : Prop where
  preserved : ∀ s, f (step s) = f s

-- Monovariant: strictly decreasing under each step (termination)
-- In Lean, use `termination_by` with a natural number measure
def process (s : [STATE]) : [OUTPUT] :=
  if [TERMINATE_CONDITION] then [BASE]
  else process ([NEXT_STATE s])
  termination_by [MEASURE_FUNCTION s]
  decreasing_by [PROVE_DECREASE]

-- Parity invariant example template  
theorem parity_invariant (n : ℕ) (steps : ℕ → ℕ → ℕ) 
    (h_parity : ∀ s, (steps s 1) % 2 = s % 2) :
    ∀ k, (steps n k) % 2 = n % 2 := by
  intro k
  induction k with
  | zero => rfl
  | succ k ih => rw [h_parity]; exact ih

-- Graph parity: sum of degrees is even (invariant under edge addition)
theorem sum_degrees_even (G : SimpleGraph V) [Fintype V] [DecidableRel G.Adj] :
    Even (∑ v : V, G.degree v) := by
  rw [SimpleGraph.sum_degrees_eq_twice_card_edges]
  exact even_two_mul _

-- Checkerboard coloring invariant (unreachability)
theorem checkerboard_invariant [GRID_SETUP] :
    [MOVES_PRESERVE_COLOR] → [TARGET_UNREACHABLE] := by
  intro h
  [INVARIANT_ARGUMENT]
```

## Worked Example

Proving a 2×2 grid tiling is impossible using a coloring invariant:

```lean
import Mathlib

-- Color a checkerboard. Each domino covers one black and one white square.
-- If the number of black and white squares differs, tiling is impossible.
theorem mutilated_board_impossible :
    ¬ ∃ (tiling : List (Fin 2 × Fin 2)), 
      [COVERS_MUTILATED_BOARD tiling] := by
  -- Invariant: each domino covers 1 black + 1 white cell
  -- Mutilated board: 2 whites, 0 blacks → impossible
  sorry
```

## DAG Node Config Template

```json
{
  "id": "apply_invariant",
  "kind": "skill_apply",
  "label": "Identify preserved quantity to restrict reachable states",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/invariants_and_monovariants/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Combinatorics.SimpleGraph.Degree`, `Mathlib.Order.WellFounded`.
- Berlekamp, Conway, Guy. *Winning Ways for Your Mathematical Plays.* (Sprague-Grundy theory).
- Bezem, Coquand, Huet. *The Calculus of Constructions* (type-theoretic monovariants).
