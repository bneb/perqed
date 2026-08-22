/-
  Perqed.Proofs.unifying_additive_identity
  Automated Formal Proof Artifact
-/
import Perqed.Spec.Theorems
import Perqed.Library.Lemmas

namespace Perqed.Proofs

theorem unifying_additive_identity : ∀ (n : Nat), Perqed.Spec.unifying_additive_identity n := by
  exact Nat.add_zero
  sorry

end Perqed.Proofs
