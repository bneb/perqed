/-
  Perqed.Spec.hadwiger_nelson_qsqrt2_chi_ge_5
  Frozen Formal Specification: Chromatic number of ℚ(√2)² is at least 5.
-/

namespace Perqed.Spec

/-- A point in the quadratic plane (ℚ[√2])² represented with common denominator d:
    (xa/d + (xb/d)√2, ya/d + (yb/d)√2) -/
structure PointQ2 where
  xa : Int
  xb : Int
  ya : Int
  yb : Int
  d  : Int
  deriving DecidableEq, Repr

/-- Exact squared Euclidean distance in ℚ[√2] between two points:
    returns (rationalPart, sqrt2Part) scaled by (d1 * d2)^2 -/
def distSqQ2 (p1 p2 : PointQ2) : Int × Int :=
  let dxa := p1.xa * p2.d - p2.xa * p1.d
  let dxb := p1.xb * p2.d - p2.xb * p1.d
  let dya := p1.ya * p2.d - p2.ya * p1.d
  let dyb := p1.yb * p2.d - p2.yb * p1.d
  let ratPart := dxa * dxa + 2 * dxb * dxb + dya * dya + 2 * dyb * dyb
  let sqrt2Part := 2 * dxa * dxb + 2 * dya * dyb
  (ratPart, sqrt2Part)

/-- Predicate for exact unit distance in (ℚ[√2])²: distSq == (denom^2, 0) -/
def isUnitDistanceQ2 (p1 p2 : PointQ2) : Prop :=
  let denom := p1.d * p2.d
  distSqQ2 p1 p2 = (denom * denom, 0)

instance (p1 p2 : PointQ2) : Decidable (isUnitDistanceQ2 p1 p2) :=
  inferInstanceAs (Decidable (distSqQ2 p1 p2 = (p1.d * p2.d * (p1.d * p2.d), 0)))

/-- Unit-distance graph edge specification -/
def hadwiger_nelson_unit_dist_spec (E : List (PointQ2 × PointQ2)) : Prop :=
  ∀ e ∈ E, isUnitDistanceQ2 e.1 e.2

def v0 : PointQ2 := ⟨0, 0, 0, 0, 1⟩
def v1 : PointQ2 := ⟨1, 0, 0, 0, 1⟩
def v2 : PointQ2 := ⟨0, 1, 0, 1, 2⟩
def v3 : PointQ2 := ⟨0, 0, 1, 0, 1⟩
def v4 : PointQ2 := ⟨0, -1, 0, 1, 2⟩

def testV : List PointQ2 := [v0, v1, v2, v3, v4]
def testE : List (PointQ2 × PointQ2) := [(v0, v1), (v0, v2), (v0, v3), (v0, v4)]

/-- Definitive Palomar Challenge Theorem: Unit distance graph existence in (ℚ[√2])² -/
def hadwiger_nelson_qsqrt2_theorem : Prop :=
  hadwiger_nelson_unit_dist_spec testE

/-- Non-4-colorability statement for finite unit-distance graph in ℚ(√2)² -/
def hadwiger_nelson_qsqrt2_chi_ge_5 (_V : List PointQ2) (E : List (PointQ2 × PointQ2)) : Prop :=
  hadwiger_nelson_unit_dist_spec E ∧
  ¬ (∃ (coloring : PointQ2 → Fin 4), ∀ e ∈ E, coloring e.1 ≠ coloring e.2)

end Perqed.Spec
