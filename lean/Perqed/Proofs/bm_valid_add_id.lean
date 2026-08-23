/-
  Perqed.Proofs.bm_valid_add_id
  Automated Formal Proof Artifact
-/
import Perqed.Spec.Theorems
import Perqed.Spec.bm_valid_add_id
import Perqed.Library.Lemmas

namespace Perqed.Proofs

theorem bm_valid_add_id : ∀ (n : Nat), Perqed.Spec.bm_valid_add_id n := by
  intro; simp [Perqed.Spec.bm_valid_add_id]

end Perqed.Proofs
