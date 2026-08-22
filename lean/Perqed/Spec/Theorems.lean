/-
  Perqed.Spec.Theorems
  Frozen, hash-locked specification declarations for verification benchmarks.
-/

namespace Perqed.Spec

/-- Propositional de Morgan forward law -/
def de_morgan_not_or (P Q : Prop) : Prop :=
  ¬(P ∨ Q) → (¬P ∧ ¬Q)

/-- Natural addition right identity -/
def nat_add_right_id (n : Nat) : Prop :=
  n + 0 = n

/-- Natural addition symmetry -/
def nat_add_comm_spec (a b : Nat) : Prop :=
  a + b = b + a

/-- Implication transitivity -/
def imp_trans_spec (P Q R : Prop) : Prop :=
  (P → Q) → (Q → R) → (P → R)

/-- Double negation on conjunction -/
def not_and_from_or_not (P Q : Prop) : Prop :=
  ¬P ∨ ¬Q → ¬(P ∧ Q)

/-- Distributivity of conjunction over disjunction -/
def and_or_distrib_spec (P Q R : Prop) : Prop :=
  P ∧ (Q ∨ R) ↔ (P ∧ Q) ∨ (P ∧ R)

/-- Even natural number predicate -/
def IsEven (n : Nat) : Prop :=
  ∃ k, n = 2 * k

/-- Sum of two even numbers is even specification -/
def sum_of_evens_is_even (a b : Nat) : Prop :=
  IsEven a → IsEven b → IsEven (a + b)

end Perqed.Spec
