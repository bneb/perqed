import Mathlib

open FiniteDimensional BigOperators

lemma ker_ne_bot_of_finrank_lt {K V W : Type*} [Field K] [AddCommGroup V] [Module K V] [AddCommGroup W] [Module K W]
    [FiniteDimensional K V] [FiniteDimensional K W] (h : finrank K W < finrank K V) (f : V →ₗ[K] W) :
    LinearMap.ker f ≠ ⊥ := by
  intro h_ker
  have h_inj : Function.Injective f := LinearMap.ker_eq_bot.mp h_ker
  have h_le : finrank K V ≤ finrank K W := LinearMap.finrank_le_finrank_of_injective h_inj
  omega

lemma exists_ne_zero_of_ker_ne_bot {K V W : Type*} [Field K] [AddCommGroup V] [Module K V] [AddCommGroup W] [Module K W]
    (f : V →ₗ[K] W) (h : LinearMap.ker f ≠ ⊥) :
    ∃ x : V, x ≠ 0 ∧ f x = 0 := by
  by_contra h_contra
  push_neg at h_contra
  have h_bot : LinearMap.ker f = ⊥ := by
    apply LinearMap.ker_eq_bot'.mpr
    intro x hx
    by_contra h_x_ne_zero
    exact h_contra x h_x_ne_zero hx
  exact h h_bot

lemma exists_linear_dep (M N : ℕ) (h : M < N) (v : Fin N → (Fin M → ℚ)) :
  ∃ c : Fin N → ℚ, (∑ i, c i • v i) = 0 ∧ c ≠ 0 := by
  let f : (Fin N → ℚ) →ₗ[ℚ] (Fin M → ℚ) :=
  { toFun := fun c => ∑ i : Fin N, c i • v i
    map_add' := by
      intro x y
      ext j
      simp [add_smul, Finset.sum_add_distrib, Finset.sum_apply]
    map_smul' := by
      intro r x
      ext j
      simp only [RingHom.id_apply, Pi.smul_apply, smul_eq_mul, Finset.sum_apply, smul_smul, Finset.smul_sum]
      have h_assoc : (fun i => (r * x i) * v i j) = fun i => r * (x i * v i j) := by ext i; ring
      rw [h_assoc, ← Finset.mul_sum] }
      
  have h_finrank_dom : finrank ℚ (Fin N → ℚ) = N := by simp
  have h_finrank_codom : finrank ℚ (Fin M → ℚ) = M := by simp
  have h_dim : finrank ℚ (Fin M → ℚ) < finrank ℚ (Fin N → ℚ) := by linarith
  
  have h_ker := ker_ne_bot_of_finrank_lt h_dim f
  rcases exists_ne_zero_of_ker_ne_bot f h_ker with ⟨c, hc_ne_zero, hc_eq_zero⟩
  use c
  constructor
  · exact hc_eq_zero
  · exact hc_ne_zero
