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
        rw [mem_erase] at hn
        have h_min := min'_le s.current_block n hn.2
        exact lt_of_le_of_ne h_min hn.1.symm,
      h_bound := by
        intro n hn
        rw [mem_erase] at hn
        exact s.h_bound n hn.2,
      h_last := by
        have h_m_in := min'_mem s.current_block h_nonempty
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
          rw [mem_erase] at hn
          have h_min := min'_le B n hn.2
          exact lt_of_le_of_ne h_min hn.1.symm,
        h_bound := by
          intro n hn
          rw [mem_erase] at hn
          exact le_max' B n hn.2,
        h_last := by
          have h_m_in := min'_mem B patch.nonempty
          exact le_max' B m h_m_in }
    else
      { E := s.E - φ jump,
        current_block := ∅,
        last_emitted := jump,
        next_lower_bound := jump,
        h_lower := by simp,
        h_bound := by simp,
        h_last := le_refl _ }
