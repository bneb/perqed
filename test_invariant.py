import subprocess

lean_code = """
import Mathlib
import «verified_growth»
import «kt_combinatorics»

open Finset Real

structure SeqState where
  E : ℝ × ℝ
  current_block : Finset ℕ
  last_emitted : ℕ
  next_lower_bound : ℕ
  h_lower : ∀ n ∈ current_block, last_emitted < n
  h_bound : ∀ n ∈ current_block, n ≤ next_lower_bound
  h_last  : last_emitted ≤ next_lower_bound

noncomputable def next_state (s : SeqState) : SeqState :=
  if h_nonempty : s.current_block.Nonempty then
    let m := s.current_block.min' h_nonempty
    { E := s.E,
      current_block := s.current_block.erase m,
      last_emitted := m,
      next_lower_bound := s.next_lower_bound,
      h_lower := sorry, h_bound := sorry, h_last := sorry }
  else
    let jump := max (s.next_lower_bound ^ 2) (s.next_lower_bound + 10)
    if hE : ‖s.E‖ > 0 then
      let patch := combinatorial_patch_lemma_2d_proved s.E jump hE
      let B := patch.B
      let m := B.min' patch.nonempty
      { E := s.E - ∑ n ∈ B, φ n,
        current_block := B.erase m,
        last_emitted := m,
        next_lower_bound := B.max' patch.nonempty,
        h_lower := sorry, h_bound := sorry, h_last := sorry }
    else
      { E := s.E - φ jump, current_block := ∅, last_emitted := jump, next_lower_bound := jump,
        h_lower := sorry, h_bound := sorry, h_last := sorry }

noncomputable def initial_state (E_0 : ℝ × ℝ) : SeqState :=
  { E := E_0, current_block := ∅, last_emitted := 2, next_lower_bound := 2, h_lower := sorry, h_bound := sorry, h_last := sorry }

noncomputable def state_seq (E_0 : ℝ × ℝ) : ℕ → SeqState
| 0 => next_state (initial_state E_0)
| (n + 1) => next_state (state_seq E_0 n)

noncomputable def alternating_seq (E_0 : ℝ × ℝ) (n : ℕ) : ℕ := 
  (state_seq E_0 n).last_emitted

noncomputable def block_sum (s : SeqState) : ℝ × ℝ :=
  ∑ n ∈ s.current_block, φ n

lemma state_invariant_step (s_n : SeqState) :
  φ (next_state s_n).last_emitted + (next_state s_n).E + block_sum (next_state s_n) = s_n.E + block_sum s_n := by
  unfold next_state
  by_cases h_nonempty : s_n.current_block.Nonempty
  · rw [dif_pos h_nonempty]
    dsimp [block_sum]
    let m := s_n.current_block.min' h_nonempty
    have h_sum : ∑ n ∈ s_n.current_block, φ n = φ m + ∑ n ∈ s_n.current_block.erase m, φ n := by
      exact (Finset.add_sum_erase s_n.current_block φ (Finset.min'_mem s_n.current_block h_nonempty)).symm
    rw [h_sum]
    abel
  · rw [dif_neg h_nonempty]
    by_cases hE : ‖s_n.E‖ > 0
    · rw [dif_pos hE]
      dsimp [block_sum]
      let jump := max (s_n.next_lower_bound ^ 2) (s_n.next_lower_bound + 10)
      let patch := combinatorial_patch_lemma_2d_proved s_n.E jump hE
      let B := patch.B
      let m := B.min' patch.nonempty
      have h_sum : ∑ n ∈ B, φ n = φ m + ∑ n ∈ B.erase m, φ n := by
        exact (Finset.add_sum_erase B φ (Finset.min'_mem B patch.nonempty)).symm
      have h_empty : s_n.current_block = ∅ := by
        exact Finset.not_nonempty_iff_eq_empty.mp h_nonempty
      rw [h_empty, Finset.sum_empty, h_sum]
      abel
    · rw [dif_neg hE]
      dsimp [block_sum]
      have h_empty : s_n.current_block = ∅ := by
        exact Finset.not_nonempty_iff_eq_empty.mp h_nonempty
      rw [h_empty, Finset.sum_empty]
      abel

lemma state_invariant (E_0 : ℝ × ℝ) : 
  ∀ n, (∑ i ∈ Finset.range (n + 1), φ (alternating_seq E_0 i)) + (state_seq E_0 n).E + block_sum (state_seq E_0 n) = E_0 := by
  intro n
  induction n with
  | zero =>
    rw [Finset.sum_range_one]
    have h_step := state_invariant_step (initial_state E_0)
    have h_a_0 : alternating_seq E_0 0 = (next_state (initial_state E_0)).last_emitted := rfl
    have h_s_0 : state_seq E_0 0 = next_state (initial_state E_0) := rfl
    rw [h_a_0, h_s_0]
    have h_rewrite : φ (next_state (initial_state E_0)).last_emitted + (next_state (initial_state E_0)).E + block_sum (next_state (initial_state E_0)) = (initial_state E_0).E + block_sum (initial_state E_0) := h_step
    calc φ (next_state (initial_state E_0)).last_emitted + (next_state (initial_state E_0)).E + block_sum (next_state (initial_state E_0))
      _ = (initial_state E_0).E + block_sum (initial_state E_0) := h_rewrite
      _ = E_0 + 0 := rfl
      _ = E_0 := by abel
  | succ n ih =>
    rw [Finset.sum_range_succ]
    have h_step := state_invariant_step (state_seq E_0 n)
    have h_a_np1 : alternating_seq E_0 (n + 1) = (next_state (state_seq E_0 n)).last_emitted := rfl
    have h_s_np1 : state_seq E_0 (n + 1) = next_state (state_seq E_0 n) := rfl
    rw [h_a_np1, h_s_np1]
    have h_rewrite : φ (next_state (state_seq E_0 n)).last_emitted + (next_state (state_seq E_0 n)).E + block_sum (next_state (state_seq E_0 n)) = (state_seq E_0 n).E + block_sum (state_seq E_0 n) := h_step
    calc (∑ i ∈ range (n + 1), φ (alternating_seq E_0 i)) + φ (next_state (state_seq E_0 n)).last_emitted + (next_state (state_seq E_0 n)).E + block_sum (next_state (state_seq E_0 n))
      _ = (∑ i ∈ range (n + 1), φ (alternating_seq E_0 i)) + (φ (next_state (state_seq E_0 n)).last_emitted + (next_state (state_seq E_0 n)).E + block_sum (next_state (state_seq E_0 n))) := by abel
      _ = (∑ i ∈ range (n + 1), φ (alternating_seq E_0 i)) + ((state_seq E_0 n).E + block_sum (state_seq E_0 n)) := by rw [h_rewrite]
      _ = (∑ i ∈ range (n + 1), φ (alternating_seq E_0 i)) + (state_seq E_0 n).E + block_sum (state_seq E_0 n) := by abel
      _ = E_0 := ih
"""

with open("src/lean/test_invariant.lean", "w") as f:
    f.write(lean_code)

res = subprocess.run(["lake", "env", "lean", "src/lean/test_invariant.lean"], capture_output=True, text=True)
print(res.stdout)
print(res.stderr)
