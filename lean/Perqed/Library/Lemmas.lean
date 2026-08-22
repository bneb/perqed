/-
  Perqed.Library.Lemmas
  Reusable, fully-elaborated, sorry-free helper lemmas for proof search.
-/

namespace Perqed.Library

/-- Double negation introduction -/
theorem not_not_intro (P : Prop) (h : P) : ¬¬P :=
  fun hnp => hnp h

/-- Modus tollens -/
theorem modus_tollens {P Q : Prop} (hpq : P → Q) (hnq : ¬Q) : ¬P :=
  fun hp => hnq (hpq hp)

/-- Contrapositive equivalence -/
theorem contrapositive_forward {P Q : Prop} (h : P → Q) : ¬Q → ¬P :=
  modus_tollens h

/-- Conjunction symmetry -/
theorem and_symm {P Q : Prop} (h : P ∧ Q) : Q ∧ P :=
  ⟨h.2, h.1⟩

/-- Disjunction symmetry -/
theorem or_symm {P Q : Prop} (h : P ∨ Q) : Q ∨ P :=
  h.elim Or.inr Or.inl

/-- Natural number sum identity helper -/
theorem add_zero_nat (n : Nat) : n + 0 = n :=
  Nat.add_zero n

/-- Natural number zero add helper -/
theorem zero_add_nat (n : Nat) : 0 + n = n :=
  Nat.zero_add n

/-- Natural number commutativity -/
theorem add_comm_nat (a b : Nat) : a + b = b + a :=
  Nat.add_comm a b

/-- Natural number associativity -/
theorem add_assoc_nat (a b c : Nat) : (a + b) + c = a + (b + c) :=
  Nat.add_assoc a b c

end Perqed.Library
