---
name: homological_cohomological_arguments
description: Compute topological or algebraic invariants via chain complexes, homology groups, and cohomology rings to obstruct or establish existence of maps, sections, and global solutions.
---

# Homological / Cohomological Arguments

## Technique

Homology and cohomology attach algebraic invariants (groups, rings) to topological spaces or algebraic structures, capturing global features invisible to local analysis. The key functoriality: continuous maps induce group homomorphisms, so if two spaces have different homology groups, no homeomorphism between them can exist.

The long exact sequence of a pair `(X, A)` relates `H_n(A)`, `H_n(X)`, and `H_n(X, A)`, enabling computation by decomposing complex spaces into simpler pieces. The Mayer-Vietoris sequence does the same for open covers. Cup products in cohomology detect cup-length obstructions (a manifold requiring ≥ n open sets to cover has cup-length ≥ n-1).

In algebraic settings: Ext and Tor functors measure non-exactness; the derived category encodes the full homological complexity of a module category.

## When to Apply

- The goal is a topological impossibility: no continuous map with certain properties exists (fixed-point-free, retraction, etc.).
- Computing homotopy groups or proving spaces are not homotopy equivalent.
- A sequence is exact (kernel = image at each position) — derive vanishing or non-vanishing from surrounding groups.
- The ARCHITECT's context shows a topology problem where local contractibility doesn't imply global triviality.
- Brouwer's fixed point theorem proof (if not using the elementary approach): `H_n(Sⁿ) ≠ 0`.

## Lean 4 Template

```lean
import Mathlib

-- Singular homology (mathlib4 has simplicial homology)
#check AlgebraicTopology.SimplicialComplex

-- Euler characteristic (alternating sum of Betti numbers)
-- χ(X) = ∑_n (-1)^n rank(H_n(X))
-- For a simplicial complex: χ = V - E + F (vertices - edges - faces)
def eulerCharacteristic (K : SimplicialComplex ℝ (Fin n → ℝ)) : ℤ :=
  ∑ d, (-1 : ℤ)^d * (K.faces.filter (fun s => s.card = d + 1)).card

-- Long exact sequence of a pair (structural)
-- 0 → H_n(A) → H_n(X) → H_n(X,A) → H_{n-1}(A) → ...
-- Encoded in Lean via ChainComplex and exact sequences
#check CategoryTheory.ShortExact
#check HomologicalComplex.exactAt

-- Mayer-Vietoris sequence sketch
-- H_n(U ∪ V) → H_{n-1}(U ∩ V) → H_{n-1}(U) ⊕ H_{n-1}(V) → H_{n-1}(U ∪ V)
theorem mayer_vietoris_structure {R : Type*} [CommRing R] [U V : TopologicalSpace] :
    [LONG_EXACT_SEQUENCE_STRUCTURE] := by
  sorry  -- Mayer-Vietoris in full generality requires derived categories

-- Cohomological obstruction: cup product detects non-contractibility
-- If H¹(X; ℤ/2) has non-zero cup products, X is not contractible
theorem cup_product_obstruction {X : Type*} [TopologicalSpace X] :
    [NON_TRIVIAL_CUP_PRODUCT] → ¬ Contractible X := by
  sorry

-- Brouwer's fixed point via homology
-- H_n(Dⁿ) = 0 but H_n(Sⁿ) ≠ 0, so Dⁿ cannot retract onto Sⁿ⁻¹ = ∂Dⁿ
theorem no_retraction_of_disk (n : ℕ) :
    ¬ ∃ (r : (EuclideanSpace ℝ (Fin (n+1))) → (Metric.sphere 0 1 : Set _)),
      Continuous r ∧ ∀ x : Metric.sphere (0 : EuclideanSpace ℝ (Fin (n+1))) 1, r x = x := by
  -- Follows from H_n(Sⁿ) ≠ H_n(Dⁿ) = 0
  sorry
```

## Worked Example

Euler characteristic of a sphere S²:

```lean
import Mathlib

-- χ(S²) = V - E + F = 2 (e.g., octahedron: 6 - 12 + 8 = 2)
example : (6 : ℤ) - 12 + 8 = 2 := by norm_num

-- This equals H_0 - H_1 + H_2 = 1 - 0 + 1 = 2 ✓
```

## DAG Node Config Template

```json
{
  "id": "apply_homological",
  "kind": "skill_apply",
  "label": "Compute homology groups to obstruct or establish existence",
  "dependsOn": ["literature", "[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/homological_cohomological_arguments/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.AlgebraicTopology.SimplicialComplex`, `Mathlib.Algebra.Homology.HomologicalComplex`.
- Hatcher, Allen. *Algebraic Topology*. Cambridge, 2002 (freely available: pi.math.cornell.edu/~hatcher/AT).
- Weibel, Charles. *An Introduction to Homological Algebra.* Cambridge, 1994.
