---
name: geometric_flow_homotopy
description: Deform geometric objects continuously or via a PDE-driven flow (Ricci flow, mean curvature flow) to canonical forms, proving topological or geometric theorems by studying the flow's long-time behavior.
---

# Geometric Flow / Homotopy

## Technique

Geometric flows evolve a Riemannian metric (or submanifold) in the direction of a geometric quantity — curvature, mean curvature, Ricci curvature — to "improve" the geometry toward a canonical form. The Ricci flow `∂g/∂t = -2 Ric(g)` was Hamilton's tool for uniformizing 3-manifold geometry; with Perelman's surgery, it proved the Poincaré conjecture.

Homotopy is the discrete/topological version: a continuous deformation `H : X × [0,1] → Y` with `H(x,0) = f(x)` and `H(x,1) = g(x)` shows `f ≃ g`. If such an `H` exists, `f` and `g` induce the same maps on homotopy groups and homology.

In theorem proving, these arguments are used to: show two spaces are homotopy equivalent (same topological invariants), deform a problematic map to a simpler one, or use the fundamental theorem of the topology of surfaces (classification via Euler characteristic and orientability).

## When to Apply

- The goal is to show that two topological spaces are homotopy equivalent.
- A path-connectedness or simply-connected argument is needed.
- The fundamental group π₁(X) needs to be computed via the Seifert-van Kampen theorem.
- A geometric flow argument (Ricci flow) is invoked for a 3-manifold topology result.
- The ARCHITECT's context shows a problem about deformation retracts or nullhomotopic maps.
- A simplicial map needs to be shown homotopic to another via an explicit homotopy.

## Lean 4 Template

```lean
import Mathlib

-- Basic homotopy between two paths
#check Path.Homotopy        -- path homotopy in mathlib4
#check ContinuousMap.Homotopy  -- homotopy between continuous maps

-- Homotopy equivalence between spaces
theorem homotopy_equiv_example :
    TopologicalSpace.HomotopyEquiv (Metric.ball (0 : ℝ) 1) ({(0 : ℝ)}) := by
  exact (Metric.nonempty_iff_ne_empty.mpr (by norm_num)).homotopyEquivBall 0 1

-- Fundamental group via Seifert-van Kampen
-- π₁(U ∪ V) ≅ π₁(U) *_{π₁(U∩V)} π₁(V) (amalgamated product)
#check FundamentalGroup

-- Path-based arguments: show a loop is contractible
theorem loop_contractible {X : Type*} [TopologicalSpace X] [PathConnectedSpace X]
    (γ : Path (x₀ : X) x₀) : ∃ H : Path.Homotopy γ (Path.refl x₀), True := by
  -- Only possible if X is simply connected
  sorry

-- Deformation retract: A ↪ X with r : X → A, r ∘ ι = id, ι ∘ r ≃ id
structure DeformationRetract (X A : Type*) [TopologicalSpace X] [TopologicalSpace A]
    (ι : A → X) where
  retract : X → A
  id_retract : ∀ a, retract (ι a) = a
  homotopy : ContinuousMap.Homotopy (ι ∘ retract) id

-- Ricci flow (requires differential geometry library — sketch)
-- ∂g_{ij}/∂t = -2 R_{ij}
-- Under Ricci flow with surgery, every compact 3-manifold without boundary
-- and with finite fundamental group converges to spherical space form
theorem poincare_conjecture_sketch :
    ∀ M : [Compact3Manifold], [SimplyConnected M] → M ≃ₜ [Sphere 3] := by
  sorry  -- Perelman 2002-2003; full formalization ongoing
```

## Worked Example

The punctured plane is homotopy equivalent to the circle:

```lean
import Mathlib

-- ℝ² \ {0} ≃ S¹ (deformation retract by normalization)
-- The retract map: r(x) = x / ‖x‖ is the deformation retract
example : Equiv (({0}ᶜ : Set (EuclideanSpace ℝ (Fin 2)))) (Metric.sphere (0 : EuclideanSpace ℝ (Fin 2)) 1) := by
  exact (homeomorphPuncturedPlaneCircle).toEquiv  -- mathlib4 analogue
```

## DAG Node Config Template

```json
{
  "id": "apply_geometric_flow",
  "kind": "skill_apply",
  "label": "Deform geometric object via homotopy or flow to canonical form",
  "dependsOn": ["literature", "[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/geometric_flow_homotopy/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Topology.Homotopy.Basic`, `Mathlib.Topology.FundamentalGroup`.
- Hamilton, Richard. "Three-manifolds with positive Ricci curvature." *JDG*, 1982.
- Perelman, Grigori. arXiv:math/0211159, 0303109, 0307245 (Poincaré conjecture proofs).
