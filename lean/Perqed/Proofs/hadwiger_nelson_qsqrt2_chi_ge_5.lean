/-
  Perqed.Proofs.hadwiger_nelson_qsqrt2_chi_ge_5
  Automated Formal Proof Artifact: Unit-distance graph in (ℚ[√2])²
-/
import Perqed.Spec.hadwiger_nelson_qsqrt2_chi_ge_5

namespace Perqed.Proofs

open Perqed.Spec

/-- Machine-checked proof that all edges in canonicalE have exact unit distance 1 in ℚ[√2] -/
theorem hadwiger_nelson_qsqrt2_theorem : Perqed.Spec.hadwiger_nelson_qsqrt2_theorem := by
  unfold Perqed.Spec.hadwiger_nelson_qsqrt2_theorem Perqed.Spec.isUnitDistanceGraph
  decide

theorem hadwiger_nelson_unit_dist_proof : Perqed.Spec.hadwiger_nelson_qsqrt2_theorem := by
  exact hadwiger_nelson_qsqrt2_theorem

end Perqed.Proofs
