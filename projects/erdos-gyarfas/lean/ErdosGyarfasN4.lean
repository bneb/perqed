/-
  Erdős-Gyárfás Conjecture: Base Case n = 4
  Perqed AI Math Prover — Sprint 25

  Theorem: Every graph on 4 vertices with minimum degree ≥ 3 contains a 4-cycle.

  Proof Strategy:
    1. Extract three distinct non-zero neighbors of vertex 0 via `obtain`
    2. Apply omega pigeonhole: three distinct elements of Fin 4 \ {v} must cover {1,2,3}
    3. Repeat for vertices 1 and 2 to get edges g 0 1, g 1 2, g 2 3
    4. Derive g 3 0 by symmetry
    5. Provide the explicit 4-cycle witness ⟨0, 1, 2, 3, ...⟩

  This file contains SFT_TARGET markers around the critical witness construction
  step. The harvest_sft.ts script extracts the (State → Tactic) pair for
  Supervised Fine-Tuning of the DeepSeek Prover Tactician.
-/

theorem erdos_gyarfas_n4
  (g : Fin 4 → Fin 4 → Bool)
  (hnoloop : ∀ i, g i i = false)
  (hsym : ∀ i j, g i j = g j i)
  (hdeg : ∀ v : Fin 4, ∃ a b c : Fin 4,
    a ≠ v ∧ b ≠ v ∧ c ≠ v ∧ a ≠ b ∧ a ≠ c ∧ b ≠ c ∧
    g v a = true ∧ g v b = true ∧ g v c = true) :
  ∃ a b c d : Fin 4, a ≠ b ∧ b ≠ c ∧ c ≠ d ∧ d ≠ a ∧
    g a b = true ∧ g b c = true ∧ g c d = true ∧ g d a = true := by
  -- Phase 1: Extract vertex 0's three distinct non-zero neighbors
  obtain ⟨a, b, c, ha, hb, hc, hab, hac, hbc, ga, gb, gc⟩ := hdeg 0
  -- Phase 2: Pigeonhole — 3 distinct elements of Fin 4 \ {0} must cover {1,2,3}
  have h1 : a = 1 ∨ b = 1 ∨ c = 1 := by omega
  have h2 : a = 2 ∨ b = 2 ∨ c = 2 := by omega
  have h3 : a = 3 ∨ b = 3 ∨ c = 3 := by omega
  -- Derive g 0 1 = true
  have g01 : g 0 1 = true := by
    cases h1 with
    | inl h => rw [← h]; exact ga
    | inr h => cases h with
      | inl h => rw [← h]; exact gb
      | inr h => rw [← h]; exact gc
  -- Derive g 0 3 = true
  have g03 : g 0 3 = true := by
    cases h3 with
    | inl h => rw [← h]; exact ga
    | inr h => cases h with
      | inl h => rw [← h]; exact gb
      | inr h => rw [← h]; exact gc
  -- Phase 3: Extract vertex 1's neighbors → g 1 2 = true
  obtain ⟨a', b', c', ha', hb', hc', hab', hac', hbc', ga', gb', gc'⟩ := hdeg 1
  have h12 : a' = 2 ∨ b' = 2 ∨ c' = 2 := by omega
  have g12 : g 1 2 = true := by
    cases h12 with
    | inl h => rw [← h]; exact ga'
    | inr h => cases h with
      | inl h => rw [← h]; exact gb'
      | inr h => rw [← h]; exact gc'
  -- Phase 4: Extract vertex 2's neighbors → g 2 3 = true
  obtain ⟨a'', b'', c'', ha'', hb'', hc'', hab'', hac'', hbc'', ga'', gb'', gc''⟩ := hdeg 2
  have h23 : a'' = 3 ∨ b'' = 3 ∨ c'' = 3 := by omega
  have g23 : g 2 3 = true := by
    cases h23 with
    | inl h => rw [← h]; exact ga''
    | inr h => cases h with
      | inl h => rw [← h]; exact gb''
      | inr h => rw [← h]; exact gc''
  -- Phase 5: Derive g 3 0 by symmetry
  have g30 : g 3 0 = true := by rw [hsym]; exact g03
  --//-- SFT_STATE_START
  -- g : Fin 4 → Fin 4 → Bool
  -- hnoloop : ∀ (i : Fin 4), g i i = false
  -- hsym : ∀ (i j : Fin 4), g i j = g j i
  -- g01 : g 0 1 = true
  -- g12 : g 1 2 = true
  -- g23 : g 2 3 = true
  -- g30 : g 3 0 = true
  -- ⊢ ∃ a b c d : Fin 4, a ≠ b ∧ b ≠ c ∧ c ≠ d ∧ d ≠ a ∧
  --     g a b = true ∧ g b c = true ∧ g c d = true ∧ g d a = true
  --//-- SFT_STATE_END
  --//-- SFT_TACTIC
  exact ⟨0, 1, 2, 3, by decide, by decide, by decide, by decide, g01, g12, g23, g30⟩
