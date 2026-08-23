/--
  Palomar Challenge Specification
  Theorem: Perqed.Spec.number_theory.zaremba
  Frozen SHA-256: 60b6e33a1848ca6e66baffe781741978806904308cc7154e6fb87d8457621b13
--/
import Mathlib
import Perqed

/-
  Perqed.Spec.zaremba_witness_8_3
  Domain: number_theory.zaremba
  Witness: 3/8 = [0, 2, 1, 2], all partial quotients ≤ 2
  Kernel-decidable by exact Int arithmetic.
-/

namespace Perqed.Spec

/-- Numerator p of [q₀; q₁, …, qₙ] via the pair recurrence. -/
def cf_num (qs : List Int) : Int :=
  (qs.foldl (fun acc q => (acc.2, q * acc.2 + acc.1)) (0, 1)).2

/-- Denominator q of [q₀; q₁, …, qₙ] via the pair recurrence. -/
def cf_den (qs : List Int) : Int :=
  (qs.foldl (fun acc q => (acc.2, q * acc.2 + acc.1)) (1, 0)).2

/-- All partial quotients bounded by B. -/
def all_le (qs : List Int) (B : Int) : Bool :=
  qs.all (fun q => q <= B)

theorem zaremba_witness_8_3 :
    cf_num [0, 2, 1, 2] = 3 ∧ cf_den [0, 2, 1, 2] = 8 ∧ all_le [0, 2, 1, 2] 2 :=
  by
end Perqed.Spec
