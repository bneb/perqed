/-
  Perqed.Proofs.arxiv_claim_nat_add_right_id
  Automated Formal Proof Artifact
-/
import Perqed.Spec.Theorems
import Perqed.Spec.arxiv_claim_nat_add_right_id
import Perqed.Library.Lemmas

namespace Perqed.Proofs

theorem arxiv_claim_nat_add_right_id : ∀ (n : Nat), Perqed.Spec.arxiv_claim_nat_add_right_id n := by
  intro; simp [Perqed.Spec.arxiv_claim_nat_add_right_id]

end Perqed.Proofs
