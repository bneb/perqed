import Mathlib

open Filter Topology Finset

/-!
# HasSum utilities for Erdős 265

Provides the key shifting lemma used throughout the proof.
-/

/-- If HasSum f s, then HasSum (fun k => f (k + N)) (s - partial sum). -/
lemma hasSum_nat_shift {f : ℕ → ℝ} {s : ℝ} (hf : HasSum f s) (N : ℕ) :
    HasSum (fun k => f (k + N)) (s - ∑ i ∈ Finset.range N, f i) := by
  have hsumm : Summable f := hf.summable
  have hsumm_shift : Summable (fun k => f (k + N)) := (summable_nat_add_iff N).mpr hsumm
  rw [hsumm_shift.hasSum_iff_tendsto_nat]
  have h_total := hf.summable.hasSum_iff_tendsto_nat.mp hf
  have h_eq : ∀ n, ∑ i ∈ Finset.range n, f (i + N) =
    ∑ i ∈ Finset.range (n + N), f i - ∑ i ∈ Finset.range N, f i := by
    intro n
    induction n with
    | zero => simp
    | succ n ih =>
      rw [sum_range_succ, ih]
      have hkey : n + 1 + N = (n + N) + 1 := by omega
      rw [hkey, sum_range_succ]
      ring
  simp_rw [h_eq]
  exact (h_total.comp (tendsto_add_atTop_nat N)).sub_const _
