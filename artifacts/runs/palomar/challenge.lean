/--
  Palomar Challenge Specification
  Theorem: Perqed.Spec.combinatorics.cap_set
  Frozen SHA-256: 47b6ef96e01fc02e795b94a18386ce1fb63ee44cf0cffd9e71ecdf27ce31d07a
--/
import Mathlib
import Perqed

/-
  Perqed.Spec.cap_set_3_9
  Domain: combinatorics.cap_set
  Dimension: F_3^3
  Witness size: 9 (target 9)
  Kernel-decidable by finite combinatorial reflection.
-/

namespace Perqed.Spec

/-- F_3 vector of dimension n represented as a list of coordinates mod 3 -/
def F3Vector := List Int

/-- Elementwise addition in F_3^n -/
def addF3 (u v : F3Vector) : F3Vector :=
  (u.zip v).map (fun (a, b) => (a + b) % 3)

/-- Check if three points form a 3-term arithmetic progression (u + v + w = 0 mod 3) -/
def is_3ap (u v w : F3Vector) : Bool :=
  let sum := addF3 (addF3 u v) w
  sum.all (fun x => x == 0)

/-- Check if a vector list is free of non-trivial 3-APs -/
def is_3ap_free (vecs : List F3Vector) : Bool :=
  let n := vecs.length
  (List.range n).all fun i =>
    (List.range n).all fun j =>
      if i < j then
        (List.range n).all fun k =>
          if j < k then
            !is_3ap (vecs.get! i) (vecs.get! j) (vecs.get! k)
          else true
      else true

def VECS_3 : List F3Vector := [
  [0, 0, 0],
  [0, 1, 1],
  [0, 2, 1],
  [1, 0, 1],
  [1, 1, 2],
  [1, 2, 2],
  [2, 0, 1],
  [2, 1, 2],
  [2, 2, 2]
]

theorem cap_set_3_9 : is_3ap_free VECS_3 = true ∧ VECS_3.length ≥ 9 :=
  by
end Perqed.Spec
