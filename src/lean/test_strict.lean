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
      h_lower := by
        intro n hn
        rw [Finset.mem_erase] at hn
        have h_min := Finset.min'_le s.current_block n hn.2
        exact lt_of_le_of_ne h_min hn.1.symm,
      h_bound := by
        intro n hn
        rw [Finset.mem_erase] at hn
        exact s.h_bound n hn.2,
      h_last := by
        have h_m_in := Finset.min'_mem s.current_block h_nonempty
        exact s.h_bound m h_m_in }
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
        h_lower := by
          intro n hn
          rw [Finset.mem_erase] at hn
          have h_min := Finset.min'_le B n hn.2
          exact lt_of_le_of_ne h_min hn.1.symm,
        h_bound := by
          intro n hn
          rw [Finset.mem_erase] at hn
          exact Finset.le_max' B n hn.2,
        h_last := by
          have h_m_in := Finset.min'_mem B patch.nonempty
          exact Finset.le_max' B m h_m_in }
    else
      { E := s.E - φ jump,
        current_block := ∅,
        last_emitted := jump,
        next_lower_bound := jump,
        h_lower := by simp,
        h_bound := by simp,
        h_last := le_refl _ }

noncomputable def state_seq (E_0 : ℝ × ℝ) : ℕ → SeqState
| 0 => next_state { E := E_0, current_block := ∅, last_emitted := 2, next_lower_bound := 2, h_lower := by simp, h_bound := by simp, h_last := le_refl _ }
| (n + 1) => next_state (state_seq E_0 n)

noncomputable def alternating_seq (E_0 : ℝ × ℝ) (n : ℕ) : ℕ := 
  (state_seq E_0 n).last_emitted

lemma a_strict_mono (E_0 : ℝ × ℝ) : ∀ n, alternating_seq E_0 n < alternating_seq E_0 (n + 1) := by
  intro n
  let s_n := state_seq E_0 n
  have h_next : state_seq E_0 (n + 1) = next_state s_n := rfl
  change s_n.last_emitted < (next_state s_n).last_emitted
  unfold next_state
  by_cases h_nonempty : s_n.current_block.Nonempty
  · rw [dif_pos h_nonempty]
    have h_min_in := Finset.min'_mem s_n.current_block h_nonempty
    exact s_n.h_lower (s_n.current_block.min' h_nonempty) h_min_in
  · rw [dif_neg h_nonempty]
    by_cases hE : ‖s_n.E‖ > 0
    · rw [dif_pos hE]
      let jump := max (s_n.next_lower_bound ^ 2) (s_n.next_lower_bound + 10)
      have h_jump_gt : s_n.last_emitted < jump := by
        calc s_n.last_emitted 
          _ ≤ s_n.next_lower_bound := s_n.h_last
          _ < s_n.next_lower_bound + 10 := by linarith
          _ ≤ max (s_n.next_lower_bound ^ 2) (s_n.next_lower_bound + 10) := le_max_right _ _
      
      let patch := combinatorial_patch_lemma_2d_proved s_n.E jump hE
      let B := patch.B
      have h_min_B := Finset.min'_mem B patch.nonempty
      have h_bound := patch.bounded (B.min' patch.nonempty) h_min_B
      calc s_n.last_emitted
        _ < jump := h_jump_gt
        _ ≤ B.min' patch.nonempty := h_bound
    · rw [dif_neg hE]
      let jump := max (s_n.next_lower_bound ^ 2) (s_n.next_lower_bound + 10)
      calc s_n.last_emitted 
        _ ≤ s_n.next_lower_bound := s_n.h_last
        _ < s_n.next_lower_bound + 10 := by linarith
        _ ≤ max (s_n.next_lower_bound ^ 2) (s_n.next_lower_bound + 10) := le_max_right _ _

noncomputable def block_sum (s : SeqState) : ℝ × ℝ :=
  ∑ n ∈ s.current_block, φ n

lemma state_invariant (E_0 : ℝ × ℝ) : 
  ∀ n, (∑ i ∈ Finset.range (n + 1), φ (alternating_seq E_0 i)) + (state_seq E_0 n).E + block_sum (state_seq E_0 n) = E_0 := by
  sorry
