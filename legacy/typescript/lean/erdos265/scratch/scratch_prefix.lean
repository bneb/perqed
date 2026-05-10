import Mathlib

open Filter Topology Metric Finset

def history_product (q : ℕ) (a : ℕ → ℕ) (N : ℕ) : ℕ :=
  q * ∏ i ∈ Finset.range N, a i

lemma prefix_is_integer (q : ℕ) (a : ℕ → ℕ) (N : ℕ) (h_pos : ∀ i, a i > 0) :
  ∃ (k : ℕ), (history_product q a N : ℝ) * ∑ i ∈ Finset.range N, (1 / (a i : ℝ)) = (k : ℝ) := by
  -- distribute the multiplication
  rw [Finset.mul_sum]
  -- inside the sum, history_product q a N * (1 / a i)
  -- = (q * prod a) / a i
  -- Since a i divides the product, it's an integer.
  have h_int : ∀ i ∈ Finset.range N, ∃ (m : ℕ), (history_product q a N : ℝ) * (1 / (a i : ℝ)) = (m : ℝ) := by
    intro i hi
    have h_div : a i ∣ ∏ j ∈ Finset.range N, a j := Finset.dvd_prod_of_mem a hi
    obtain ⟨c, hc⟩ := h_div
    use q * c
    have ha_pos : (a i : ℝ) ≠ 0 := by exact_mod_cast (h_pos i).ne'
    calc (history_product q a N : ℝ) * (1 / (a i : ℝ))
      _ = (q * ∏ j ∈ Finset.range N, a j : ℝ) / (a i : ℝ) := by 
        unfold history_product
        push_cast
        ring
      _ = (q * (a i * c) : ℝ) / (a i : ℝ) := by
        congr 2; exact_mod_cast hc
      _ = (q * c * a i : ℝ) / (a i : ℝ) := by ring
      _ = (q * c : ℝ) := by rw [mul_div_cancel_right₀ _ ha_pos]
      _ = (q * c : ℕ) := by norm_cast
  
  -- Since each term in the sum is an integer, the sum is an integer.
  let m : ℕ → ℕ := fun i => 
    if hi : i ∈ Finset.range N then Classical.choose (h_int i hi) else 0
  have hm : ∀ i ∈ Finset.range N, (history_product q a N : ℝ) * (1 / (a i : ℝ)) = (m i : ℝ) := by
    intro i hi
    dsimp [m]
    rw [dif_pos hi]
    exact Classical.choose_spec (h_int i hi)
    
  use ∑ i ∈ Finset.range N, m i
  rw [Nat.cast_sum]
  apply Finset.sum_congr rfl
  intro i hi
  exact hm i hi
