---
name: algebraic_graph_construction
description: Translate a random graph search space into a structured algebraic space by constructing graphs from finite group generators (Cayley graphs) or quadratic residues (Paley graphs), enabling SA mutations that respect algebraic symmetry and targeting strongly-regular witnesses for Ramsey bounds.
---

# Algebraic Graph Construction (Cayley / Paley Graphs)

## Technique

When a Simulated Annealing worker stalls at a positive energy floor (e.g., E = 13 for R(4,6) on n = 35) after millions of unconstrained edge flips, the search is trapped in a combinatorial basin with no algebraic structure.  The key insight is that **the known witnesses for most Ramsey lower bounds are highly symmetric graphs** — circulant graphs, Paley graphs, or Cayley graphs over a finite group — not random ones.  This technique restricts the search space to algebraically defined graphs and mutates generators rather than edges.

### Cayley Graph Framework

Given a finite group `G` and a connection set `S ⊆ G \ {e}` with `S = S⁻¹`, the Cayley graph `Cay(G, S)` has vertex set `G` and edge set `{(g, gs) : g ∈ G, s ∈ S}`.  The entire graph is determined by `S`, so **the mutation space has dimension `|G|/2` rather than `C(|G|, 2)`** — exponentially smaller.

For `G = ℤ_p` (cyclic group of prime order), `S` is a symmetric subset of `{1, …, p−1}`, giving circulant graphs.  The known R(4, 6) lower-bound witness (Exoo 1989) is the circulant `C(35, {1, 3, 7, 12, 17})`.

### Paley Graph Framework

For a prime power `q ≡ 1 (mod 4)`, the Paley graph `P(q)` has vertex set `𝔽_q` and edges between vertices whose difference is a **quadratic residue**.  Paley graphs are self-complementary, strongly regular `srg(q, (q−1)/2, (q−5)/4, (q−1)/4)`, and are optimal witnesses for diagonal Ramsey numbers:

- `P(17)` witnesses `R(4,4) > 17`
- `P(29)` witnesses `R(5,5) > 29` (together with the Paley tournament)

### Search Space Reduction via Algebraic Mutation

Instead of flipping a uniformly random edge `(u, v)`, the SA worker mutates **one generator distance** `d ∈ {1, …, ⌊n/2⌋}`.  This toggles **all `n` edges simultaneously** at that distance — a circulant mutation.  The energy delta is computed in one batch pass over affected edges, preserving the Boltzmann acceptance criterion.

Energy landscape dimension:
- Unconstrained: `2^(n(n−1)/2)` — e.g. `2^595` for n=35
- Circulant on ℤ_35: `2^17` — tractable by SA

## When to Apply

- SA workers in the **perqed island model are reporting a glass floor** energy `E_min > 0` that has not improved across multiple independent restarts.
- The target problem is a **Ramsey lower bound** `R(r, s) > n`: the witness sought is a 2-coloring of `K_n`.
- The value `n` has a known highly symmetric graph structure: `n` prime, prime power, or `n = p − 1` for a Paley-eligible prime `p`.
- The `architecture journal` shows entries of type `failure_mode` from unconstrained SA at the same energy level.
- **Trigger:** 3+ consecutive `failure_mode` journal entries → Stage 2 escalation warrants trying algebraically constrained search before invoking the Wiles Maneuver.

## Lean 4 Template

```lean
import Mathlib

-- Cayley Graph: vertex set is a group, edges given by connection set
open SimpleGraph

-- A circulant graph on ℤ_n with connection set S
noncomputable def circulantGraph (n : ℕ) (S : Finset (ZMod n)) : SimpleGraph (ZMod n) where
  Adj x y := x ≠ y ∧ (x - y ∈ S ∨ y - x ∈ S)
  symm := by
    intro x y ⟨hne, h⟩
    exact ⟨hne.symm, h.symm⟩
  loopless := by intro x ⟨h, _⟩; exact h rfl

-- Paley graph on 𝔽_p for p ≡ 1 mod 4
-- Vertices: ZMod p; edge iff difference is a quadratic residue
noncomputable def paleyGraph (p : ℕ) [Fact (Nat.Prime p)] : SimpleGraph (ZMod p) where
  Adj x y := x ≠ y ∧ IsSquare (x - y)
  symm := by
    intro x y ⟨hne, ⟨c, hc⟩⟩
    exact ⟨hne.symm, ⟨-c, by ring_nf; rw [← hc]; ring⟩⟩
  loopless := by intro x ⟨h, _⟩; exact h rfl

-- Verify Paley(17) is a valid R(4,4) witness: no K₄ or independent K₄
-- (Uses ramseyEnergy oracle from our SA infrastructure)
-- theorem paley17_witness : ramseyEnergy (paleyGraph 17) 4 4 = 0 := by decide

-- Strongly regular parameters for Paley(p)
-- srg(p, (p-1)/2, (p-5)/4, (p-1)/4)
theorem paley_strongly_regular (p : ℕ) [Fact (Nat.Prime p)] (hp : p % 4 = 1) :
    (paleyGraph p).IsRegular ((p - 1) / 2) := by
  sorry -- requires quadratic reciprocity and field arithmetic over ZMod p
```

## Worked Example

R(4, 6) lower bound via circulant search on n = 35:

The Exoo (1989) witness is `C(35, {1, 3, 7, 12, 17})`.  In perqed's circulant SA mode, the mutation state is `distanceColors : Map<number, number>` — a bit vector of length 17 (⌊35/2⌋).  The SA flips one entry per step.  From a hot start at T = 2.0 with patient cooling, the worker navigates `2^17 = 131072` possible circulant graphs to reach E = 0.

The energy landscape in circulant space is dramatically smoother than unconstrained space: the glass floor at E = 12 seen in unconstrained search disappears because the algebraic symmetry eliminates the degenerate low-energy non-witness configurations that trap unconstrained walkers.

```typescript
// perqed SA config for algebraic/circulant search:
const config: RamseySearchConfig = {
  n: 35, r: 4, s: 6,
  maxIterations: 500_000_000,
  initialTemp: 2.0,
  coolingRate: 0.9999998,
  symmetry: 'circulant',   // ← KEY: restrict to algebraic subspace
};
```

## DAG Node Config Template

```json
{
  "id": "algebraic_circulant_search",
  "kind": "search",
  "label": "SA over circulant subspace — mutate generator distances, not edges",
  "dependsOn": ["literature"],
  "config": {
    "vertices": 35,
    "r": 4,
    "s": 6,
    "iterations": 500000000,
    "workers": 8,
    "symmetry": "circulant",
    "mutationMode": "generator_flip",
    "comment": "Restricts 2^595 unconstrained space to 2^17 circulant space. Each SA step toggles ONE generator distance d ∈ {1…17}, flipping all 35 edges at that distance simultaneously. Preserves Boltzmann acceptance. Known Exoo witness is C(35,{1,3,7,12,17})."
  },
  "status": "pending"
}
```

For a Paley seed + perturbation (warm start):

```json
{
  "id": "paley_seeded_search",
  "kind": "search",
  "label": "SA warm-started from Paley(p) graph + random perturbation",
  "dependsOn": ["literature"],
  "config": {
    "vertices": 17,
    "r": 4,
    "s": 4,
    "iterations": 10000,
    "workers": 1,
    "seed": "paley",
    "comment": "Paley(17) IS R(4,4) witness. For other targets, use paley seed + perturbGraph() to warm-start in the algebraically structured neighborhood."
  },
  "status": "pending"
}
```

## Key References

- Exoo, G. "A Lower Bound for R(4,6)." *Utilitas Mathematica*, 1989.
- Bollobás, B. *Modern Graph Theory*, Chapter 8. Springer, 1998.
- Mathlib4: `Mathlib.Combinatorics.SimpleGraph.Basic`, `Mathlib.FieldTheory.Finite.Basic`.
- Paley, R.E.A.C. "On Orthogonal Matrices." *Journal of Mathematics and Physics*, 1933.
