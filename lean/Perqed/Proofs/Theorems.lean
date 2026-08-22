/-
  Perqed.Proofs.Theorems
  Fully elaborated, machine-checked proofs matching the frozen specifications.
-/
import Perqed.Spec.Theorems
import Perqed.Library.Lemmas

namespace Perqed.Proofs

/-- Proof of Propositional de Morgan forward law -/
theorem de_morgan_not_or (P Q : Prop) : Perqed.Spec.de_morgan_not_or P Q := by
  intro h
  constructor
  · intro hp
    exact h (Or.inl hp)
  · intro hq
    exact h (Or.inr hq)

/-- Proof of Natural addition right identity -/
theorem nat_add_right_id (n : Nat) : Perqed.Spec.nat_add_right_id n := by
  exact Nat.add_zero n

/-- Proof of Natural addition commutativity -/
theorem nat_add_comm_spec (a b : Nat) : Perqed.Spec.nat_add_comm_spec a b := by
  exact Nat.add_comm a b

/-- Proof of Implication transitivity -/
theorem imp_trans_spec (P Q R : Prop) : Perqed.Spec.imp_trans_spec P Q R := by
  intro hpq hqr hp
  exact hqr (hpq hp)

/-- Proof of Double negation on conjunction -/
theorem not_and_from_or_not (P Q : Prop) : Perqed.Spec.not_and_from_or_not P Q := by
  intro h hpa
  rcases h with hnp | hnq
  · exact hnp hpa.1
  · exact hnq hpa.2

/-- Proof of Distributivity of conjunction over disjunction -/
theorem and_or_distrib_spec (P Q R : Prop) : Perqed.Spec.and_or_distrib_spec P Q R := by
  constructor
  · intro h
    rcases h with ⟨hp, hq | hr⟩
    · exact Or.inl ⟨hp, hq⟩
    · exact Or.inr ⟨hp, hr⟩
  · intro h
    rcases h with ⟨hp, hq⟩ | ⟨hp, hr⟩
    · exact ⟨hp, Or.inl hq⟩
    · exact ⟨hp, Or.inr hr⟩

/-- Proof of Sum of two even numbers is even -/
theorem sum_of_evens_is_even (a b : Nat) : Perqed.Spec.sum_of_evens_is_even a b := by
  intro ha hb
  rcases ha with ⟨ka, rfl⟩
  rcases hb with ⟨kb, rfl⟩
  exact ⟨ka + kb, (Nat.left_distrib 2 ka kb).symm⟩

end Perqed.Proofs
