import Mathlib

open Filter Topology Finset

/-- If HasSum f s, then HasSum (fun k => f (k + N)) (s - partial sum). -/
lemma hasSum_nat_shift {f : ℕ → ℝ} {s : ℝ} (hf : HasSum f s) (N : ℕ) :
    HasSum (fun k => f (k + N)) (s - ∑ i ∈ Finset.range N, f i) := by
  -- HasSum.sum_range_add says: HasSum (f ∘ (·+N)) m → HasSum f (∑ range N, f i + m)
  -- We need the reverse: HasSum f s → HasSum (f ∘ (·+N)) (s - ∑ range N, f i)
  -- Equivalently: the shifted series is summable and its sum is s - partial.
  have hsumm : Summable f := hf.summable
  have hsumm_shift : Summable (fun k => f (k + N)) := (summable_nat_add_iff N).mpr hsumm
  rw [hsumm_shift.hasSum_iff_tendsto_nat]
  -- Goal: Tendsto (fun n => ∑ i in range n, f (i + N)) atTop (𝓝 (s - ∑ i in range N, f i))
  have h_total := hf.summable.hasSum_iff_tendsto_nat.mp hf
  -- h_total: Tendsto (fun n => ∑ i in range n, f i) atTop (𝓝 s)
  -- ∑ i in range n, f (i + N) = ∑ i in range (n + N), f i - ∑ i in range N, f i
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
  have : Tendsto (fun n => ∑ i ∈ Finset.range (n + N), f i - ∑ i ∈ Finset.range N, f i)
    atTop (𝓝 (s - ∑ i ∈ Finset.range N, f i)) := by
    apply Filter.Tendsto.sub_const
    exact h_total.comp (tendsto_add_atTop_nat N)
  exact this
