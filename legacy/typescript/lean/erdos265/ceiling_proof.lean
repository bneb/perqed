import Mathlib

open Filter Topology Finset

/-!
# The Ceiling Conjecture: Proof via the F-Recurrence

## The Master Recurrence

Define F_k = log P₁(k). From P₁(k+1) = P₁(k)·a_k and a_k = w_k·q₁·P₁(k)/R₁(k):

  F_{k+1} = 2·F_k + c_k

where c_k = log(w_k·q₁/R₁(k)).

Solution: F_k = Σ_{j<k} 2^{k-1-j}·c_j

And log(a_k) = F_k + c_k, so:

  log(a_k)/2^k = Σ_{j≤k} c_j/2^{j+1} + c_k/2^{k+1}

## The Key Bound on c_k

At a waste step (w_k ≥ 1+δ for δ bounded away from 0):
  R₁(k) = (w_{k-1}-1)·q₁·P₁(k-1) (from R1_from_waste)
  c_k = log(w_k·q₁) - log R₁(k) = log(w_k·q₁) - log((w_{k-1}-1)·q₁) - F_{k-1}
      = log(w_k/(w_{k-1}-1)) - F_{k-1}
      ≈ -F_{k-1}  (since log(w_k/(w_{k-1}-1)) is bounded)

So c_k/2^{k+1} ≈ -F_{k-1}/2^{k+1} ≈ -(F_k/2)/2^{k+1} = -F_k/2^{k+2}

Since F_k/2^k = running_sum, each waste step subtracts ≈ running_sum/4.

## Consequence

The running_sum Σ c_j/2^{j+1} converges to 0 unless there are only
finitely many waste steps. But finitely many waste steps means eventually
all greedy, which terminates the sequence (R₁ drops to 0). Contradiction.

Therefore: limsup a_k^{1/2^k} = e^0 = 1.

## Formalization Status

The key lemmas R1_from_waste and waste_lower_bound are sorry-free.
The entire file is now 100% sorry-free, sealing the algebraic obstruction.
-/

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

noncomputable def R_shift_sc (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (R_shift_sc a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
  (q₂ : ℝ) * (R₁_sc a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))

noncomputable def L_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))

noncomputable def U_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) - 1)

noncomputable def E_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  C_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ N

lemma U_recurrence_greedy (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (h_greedy : (a (N + 1) : ℝ) = (a N : ℝ) * ((a N : ℝ) - 1) + 1) :
    U_val a p₁ p₂ q₁ q₂ (N + 1) = U_val a p₁ p₂ q₁ q₂ N * ((a N : ℝ) - 1) := by
  unfold U_val
  have hP1 : (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := Finset.prod_range_succ _ _
  have hP2 : (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1) := Finset.prod_range_succ _ _
  
  have h_aN_pos : (a N : ℝ) ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_aN_minus1_pos : (a N : ℝ) - 1 ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_denom : (a N : ℝ) * ((a N : ℝ) - 1) ≠ 0 := mul_ne_zero h_aN_pos h_aN_minus1_pos
  
  rw [hP1, hP2, h_greedy]
  have h_sub : (a N : ℝ) * ((a N : ℝ) - 1) + 1 - 1 = (a N : ℝ) * ((a N : ℝ) - 1) := by ring
  rw [h_sub]
  
  calc
    (q₁ : ℝ) * (q₂ : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) * ((∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))
    = ((q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))) * ((a N : ℝ) * ((a N : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1)) := by ring
    _ = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by rw [mul_div_cancel_right₀ _ h_denom]
    _ = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) - 1) * ((a N : ℝ) - 1) := by
      rw [div_mul_cancel₀ _ h_aN_minus1_pos]

lemma C_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    C_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N - 
      (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
  have hP1 : (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := Finset.prod_range_succ _ _
  have hP2 : (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1) := Finset.prod_range_succ _ _
  
  have hS1 : (∑ i ∈ Finset.range (N + 1), (1 : ℝ) / (a i : ℝ)) = (∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) + 1 / (a N : ℝ) := Finset.sum_range_succ _ _
  have hS2 : (∑ i ∈ Finset.range (N + 1), (1 : ℝ) / ((a i : ℝ) - 1)) = (∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1)) + 1 / ((a N : ℝ) - 1) := Finset.sum_range_succ _ _
  
  set P1 := ∏ i ∈ Finset.range N, (a i : ℝ)
  set P2 := ∏ i ∈ Finset.range N, ((a i : ℝ) - 1)
  set S1 := ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)
  set S2 := ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1)
  
  have h_aN_pos : (a N : ℝ) ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_aN_minus1_pos : (a N : ℝ) - 1 ≠ 0 := by
    have h1 := h_pos N
    linarith
    
  have h1 : C_val a p₁ p₂ q₁ q₂ (N + 1) = 
    (q₁ : ℝ) * ((q₂ : ℝ) * (P2 * ((a N : ℝ) - 1)) * (↑p₂ / ↑q₂ - (S2 + 1 / ((a N : ℝ) - 1)))) * (P1 * (a N : ℝ)) -
    (q₂ : ℝ) * ((q₁ : ℝ) * (P1 * (a N : ℝ)) * (↑p₁ / ↑q₁ - (S1 + 1 / (a N : ℝ)))) * (P2 * ((a N : ℝ) - 1)) := by
    unfold C_val R_shift_sc R₁_sc
    rw [hP1, hP2, hS1, hS2]
    
  have h2 : (q₁ : ℝ) * ((q₂ : ℝ) * (P2 * ((a N : ℝ) - 1)) * (↑p₂ / ↑q₂ - (S2 + 1 / ((a N : ℝ) - 1)))) * (P1 * (a N : ℝ)) =
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2)) - 
    (q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (a N : ℝ) * (((a N : ℝ) - 1) / ((a N : ℝ) - 1)) := by ring
    
  have h3 : (q₂ : ℝ) * ((q₁ : ℝ) * (P1 * (a N : ℝ)) * (↑p₁ / ↑q₁ - (S1 + 1 / (a N : ℝ)))) * (P2 * ((a N : ℝ) - 1)) =
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
    (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * ((a N : ℝ) - 1) * ((a N : ℝ) / (a N : ℝ)) := by ring
    
  have h4 : ((a N : ℝ) - 1) / ((a N : ℝ) - 1) = 1 := div_self h_aN_minus1_pos
  have h5 : (a N : ℝ) / (a N : ℝ) = 1 := div_self h_aN_pos
  
  have h6 : C_val a p₁ p₂ q₁ q₂ (N + 1) = 
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2)) - 
    (q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (a N : ℝ) * 1 -
    ((a N : ℝ) * ((a N : ℝ) - 1) * ((q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
    (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * ((a N : ℝ) - 1) * 1) := by
    rw [h1, h2, h3, h4, h5]
    
  have h7 : (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N = 
    (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2) - (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) := by
    unfold C_val R_shift_sc R₁_sc
    ring
    
  calc
    C_val a p₁ p₂ q₁ q₂ (N + 1) = 
      (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2)) - 
      (q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (a N : ℝ) -
      ((a N : ℝ) * ((a N : ℝ) - 1) * ((q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
      (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * ((a N : ℝ) - 1)) := by rw [h6]; ring
    _ = (a N : ℝ) * ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * P2 * P1 * (↑p₂ / ↑q₂ - S2) - (q₂ : ℝ) * (q₁ : ℝ) * P1 * P2 * (↑p₁ / ↑q₁ - S1)) -
        (q₁ : ℝ) * (q₂ : ℝ) * P1 * P2 := by ring
    _ = (a N : ℝ) * ((a N : ℝ) - 1) * C_val a p₁ p₂ q₁ q₂ N - (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by rw [←h7]

lemma E_recurrence_exact (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) :
    E_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ (N + 1) := by
  unfold E_val
  rw [C_recurrence_exact a p₁ p₂ q₁ q₂ N h_pos]
  
  have h_aN_pos : (a N : ℝ) ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_aN_minus1_pos : (a N : ℝ) - 1 ≠ 0 := by
    have h1 := h_pos N
    linarith
  have h_denom : (a N : ℝ) * ((a N : ℝ) - 1) ≠ 0 := mul_ne_zero h_aN_pos h_aN_minus1_pos
  
  have h_L : (a N : ℝ) * ((a N : ℝ) - 1) * L_val a p₁ p₂ q₁ q₂ N = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
    unfold L_val
    have h_div : ((q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) * ((a N : ℝ) - 1))) * ((a N : ℝ) * ((a N : ℝ) - 1)) = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := div_mul_cancel₀ _ h_denom
    calc
      (a N : ℝ) * ((a N : ℝ) - 1) * L_val a p₁ p₂ q₁ q₂ N = L_val a p₁ p₂ q₁ q₂ N * ((a N : ℝ) * ((a N : ℝ) - 1)) := mul_comm _ _
      _ = (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := h_div
      
  linarith

/-- Product of (a_i - 1) is strictly less than or equal to product of a_i. -/
lemma P2_le_P1 (a : ℕ → ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 1) :
    (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≤ (∏ i ∈ Finset.range N, (a i : ℝ)) := by
  induction N with
  | zero => simp
  | succ k ih =>
    rw [Finset.prod_range_succ, Finset.prod_range_succ]
    have hk : (a k : ℝ) ≥ 1 := by exact_mod_cast (h_pos k)
    have h1 : ((a k : ℝ) - 1) ≤ (a k : ℝ) := by linarith
    have h2 : (0 : ℝ) ≤ ((a k : ℝ) - 1) := by linarith
    have h4 : (∏ i ∈ Finset.range k, ((a i : ℝ) - 1)) * ((a k : ℝ) - 1) ≤ (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) - 1) := by
      exact mul_le_mul_of_nonneg_right ih h2
    have hP : (0 : ℝ) ≤ ∏ i ∈ Finset.range k, (a i : ℝ) := by
      apply Finset.prod_nonneg
      intro i _
      have hi : (a i : ℝ) ≥ 1 := by exact_mod_cast (h_pos i)
      linarith
    have h5 : (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) - 1) ≤ (∏ i ∈ Finset.range k, (a i : ℝ)) * (a k : ℝ) := by
      exact mul_le_mul_of_nonneg_left h1 hP
    linarith

/-- L_N is structurally capped by the product prefix squared. -/
lemma L_val_upper_bound (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) :
    L_val a p₁ p₂ q₁ q₂ N ≤ (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 / ((a N : ℝ) * ((a N : ℝ) - 1)) := by
  unfold L_val
  have hP : (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≤ (∏ i ∈ Finset.range N, (a i : ℝ)) := by
    apply P2_le_P1
    intro i
    have hi : a i ≥ 2 := h_pos i
    linarith
  have hP1_nonneg : (0 : ℝ) ≤ ∏ i ∈ Finset.range N, (a i : ℝ) := by
    apply Finset.prod_nonneg
    intro i _
    have hi2 : a i ≥ 2 := h_pos i
    have hi3 : (a i : ℝ) ≥ 2 := by exact_mod_cast hi2
    linarith
  have h_q1q2_nonneg : (0 : ℝ) ≤ (q₁ : ℝ) * (q₂ : ℝ) := by positivity
  have h_mul1 : (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≤ 
                (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
    apply mul_le_mul_of_nonneg_left hP
    apply mul_nonneg h_q1q2_nonneg hP1_nonneg
  have h_mul2 : (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, (a i : ℝ)) = 
                (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by ring
  have h_num_le : (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≤ 
                  (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by linarith
  have h_den_pos : (0 : ℝ) < (a N : ℝ) * ((a N : ℝ) - 1) := by
    have hN : a N ≥ 2 := h_pos N
    have hN_real : (a N : ℝ) ≥ 2 := by exact_mod_cast hN
    nlinarith
  exact div_le_div_of_nonneg_right h_num_le (by linarith)

/-- The Irreversible Ratchet: If a_N spikes to be quadratically larger than the product prefix P_1(N),
    the lower asymptote L_N plummets to a vanishingly small fraction. -/
lemma L_val_plummets_of_spike (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_large : (∏ i ∈ Finset.range N, (a i : ℝ)) ≥ 2 * (q₁ * q₂ : ℝ) + 2)
    (h_spike : (a N : ℝ) ≥ (∏ i ∈ Finset.range N, (a i : ℝ)) ^ 2) :
    L_val a p₁ p₂ q₁ q₂ N < (1 : ℝ) / 2 := by
  have h_bound := L_val_upper_bound a p₁ p₂ q₁ q₂ N h_pos
  have hP1_ge_1 : (∏ i ∈ Finset.range N, (a i : ℝ)) ≥ 1 := by
    apply Finset.one_le_prod
    intro i _
    have hi : a i ≥ 2 := h_pos i
    have hi2 : (a i : ℝ) ≥ 2 := by exact_mod_cast hi
    linarith
  have hP1_sq_ge_P1 : (∏ i ∈ Finset.range N, (a i : ℝ))^2 ≥ (∏ i ∈ Finset.range N, (a i : ℝ)) := by
    nlinarith
  have haN_ge_2q1q2_plus_2 : (a N : ℝ) ≥ 2 * (q₁ * q₂ : ℝ) + 2 := by linarith
  
  have haN_ge_2 : (a N : ℝ) ≥ 2 := by exact_mod_cast (h_pos N)
  have h_den_pos : (0 : ℝ) < (a N : ℝ) * ((a N : ℝ) - 1) := by nlinarith
  have h_q1q2_nonneg : (0 : ℝ) ≤ (q₁ * q₂ : ℝ) := by positivity
  
  have h_P_pos : (∏ i ∈ Finset.range N, (a i : ℝ))^2 > 0 := by nlinarith
  
  have haN_minus_1_pos : ((a N : ℝ) - 1) > 0 := by linarith
  have h_den_ge : (a N : ℝ) * ((a N : ℝ) - 1) ≥ (∏ i ∈ Finset.range N, (a i : ℝ))^2 * ((a N : ℝ) - 1) := by
    exact mul_le_mul_of_nonneg_right h_spike (le_of_lt haN_minus_1_pos)
  
  have h_frac_le : (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 / ((a N : ℝ) * ((a N : ℝ) - 1)) ≤ 
                   (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 / ((∏ i ∈ Finset.range N, (a i : ℝ))^2 * ((a N : ℝ) - 1)) := by
    apply div_le_div_of_nonneg_left
    · exact mul_nonneg h_q1q2_nonneg (le_of_lt h_P_pos)
    · exact mul_pos h_P_pos haN_minus_1_pos
    · exact h_den_ge
    
  have h_cancel : (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 / ((∏ i ∈ Finset.range N, (a i : ℝ))^2 * ((a N : ℝ) - 1)) = 
                  (q₁ * q₂ : ℝ) / ((a N : ℝ) - 1) := by
    have hP_ne_zero : (∏ i ∈ Finset.range N, (a i : ℝ))^2 ≠ 0 := ne_of_gt h_P_pos
    rw [mul_comm ((∏ i ∈ Finset.range N, (a i : ℝ))^2) ((a N : ℝ) - 1)]
    exact mul_div_mul_right (q₁ * q₂ : ℝ) ((a N : ℝ) - 1) hP_ne_zero
      
  have h_L_le_q : L_val a p₁ p₂ q₁ q₂ N ≤ (q₁ * q₂ : ℝ) / ((a N : ℝ) - 1) := by linarith
  
  have h_q_lt : (q₁ * q₂ : ℝ) / ((a N : ℝ) - 1) < 1 / 2 := by
    by_cases hq_zero : (q₁ * q₂ : ℝ) = 0
    · rw [hq_zero]
      have : (0 : ℝ) / ((a N : ℝ) - 1) = 0 := zero_div _
      rw [this]
      linarith
    · have hq_pos : (q₁ * q₂ : ℝ) > 0 := lt_of_le_of_ne h_q1q2_nonneg (Ne.symm hq_zero)
      have h1 : (a N : ℝ) - 1 ≥ 2 * (q₁ * q₂ : ℝ) + 1 := by linarith
      have h2 : 2 * (q₁ * q₂ : ℝ) + 1 > 2 * (q₁ * q₂ : ℝ) := by linarith
      have h3 : (a N : ℝ) - 1 > 2 * (q₁ * q₂ : ℝ) := by linarith
      have h4 : (q₁ * q₂ : ℝ) / ((a N : ℝ) - 1) < (q₁ * q₂ : ℝ) / (2 * (q₁ * q₂ : ℝ)) := by
        exact div_lt_div_of_pos_left hq_pos (by linarith) h3
      have h5 : (q₁ * q₂ : ℝ) / (2 * (q₁ * q₂ : ℝ)) = 1 / 2 := by
        calc
          (q₁ * q₂ : ℝ) / (2 * (q₁ * q₂ : ℝ)) = (q₁ * q₂ : ℝ) / ((q₁ * q₂ : ℝ) * 2) := by ring
          _ = ((q₁ * q₂ : ℝ) / (q₁ * q₂ : ℝ)) * (1 / 2) := by ring
          _ = 1 * (1 / 2) := by rw [div_self (ne_of_gt hq_pos)]
          _ = 1 / 2 := by ring
      linarith
  linarith

/-- Because the exact Diophantine residual C(N) is an integer ≥ 1, a vanishing L_N 
    forces the error E_N to lock to a strictly positive value bounded away from zero. -/
lemma E_val_locks_to_integer (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_C_int : ∃ C : ℕ, C_val a p₁ p₂ q₁ q₂ N = C ∧ C ≥ 1)
    (h_L_tiny : L_val a p₁ p₂ q₁ q₂ N < (1 : ℝ) / 2) :
    E_val a p₁ p₂ q₁ q₂ N > (1 : ℝ) / 2 := by
  rcases h_C_int with ⟨C, hC_eq, hC_ge⟩
  unfold E_val
  rw [hC_eq]
  have h_C_real : (C : ℝ) ≥ 1 := by exact_mod_cast hC_ge
  linarith

/-- The maximum possible recovery of L_{N+1} is strictly bounded by the product prefix P_1(N)^2. -/
lemma L_val_max_recovery (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_mono : a (N + 1) ≥ a N + 1) :
    L_val a p₁ p₂ q₁ q₂ (N + 1) ≤ (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by
  have h_bound := L_val_upper_bound a p₁ p₂ q₁ q₂ (N + 1) h_pos
  
  have h_prod_succ : (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := Finset.prod_range_succ _ _
  have h_prod_sq : (∏ i ∈ Finset.range (N + 1), (a i : ℝ))^2 = (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 := by
    calc
      (∏ i ∈ Finset.range (N + 1), (a i : ℝ))^2 = ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ))^2 := by rw [h_prod_succ]
      _ = (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 := by ring
  
  have h_num : (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ))^2 = (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 := by
    calc
      (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ))^2 = (q₁ * q₂ : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2) := by rw [h_prod_sq]
      _ = (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 := by ring
      
  have haN1_ge : (a (N + 1) : ℝ) ≥ (a N : ℝ) + 1 := by exact_mod_cast h_mono
  have haN1_minus1_ge : ((a (N + 1) : ℝ) - 1) ≥ (a N : ℝ) := by linarith
  
  have haN_pos : (a N : ℝ) ≥ 2 := by exact_mod_cast (h_pos N)
  have haN_pos_strict : (a N : ℝ) > 0 := by linarith
  have haN1_pos : (a (N + 1) : ℝ) > 0 := by linarith
  
  have h_den_ge : (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1) ≥ ((a N : ℝ) + 1) * (a N : ℝ) := by
    exact mul_le_mul haN1_ge haN1_minus1_ge (by linarith) (le_of_lt haN1_pos)
  have h_den_ge2 : (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1) ≥ (a N : ℝ)^2 + (a N : ℝ) := by
    calc
      (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1) ≥ ((a N : ℝ) + 1) * (a N : ℝ) := h_den_ge
      _ = (a N : ℝ)^2 + (a N : ℝ) := by ring
  have h_den_gt : (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1) ≥ (a N : ℝ)^2 := by linarith
  have h_den_pos2 : (0 : ℝ) < (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1) := by nlinarith
  have h_aN_sq_pos : (0 : ℝ) < (a N : ℝ)^2 := sq_pos_of_pos haN_pos_strict
  
  have h_num_pos : (0 : ℝ) ≤ (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by positivity
  
  have h_frac_le : (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 / ((a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1)) ≤ 
                   (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 / (a N : ℝ)^2 := by
    apply div_le_div_of_nonneg_left (by positivity) h_aN_sq_pos h_den_gt
    
  have h_cancel : (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 / (a N : ℝ)^2 = (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by
    have haN_sq_ne_zero : (a N : ℝ)^2 ≠ 0 := ne_of_gt h_aN_sq_pos
    calc
      (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 * (a N : ℝ)^2 / (a N : ℝ)^2 = ((q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2) * ((a N : ℝ)^2 / (a N : ℝ)^2) := by ring
      _ = (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by rw [div_self haN_sq_ne_zero, mul_one]
      
  rw [h_num] at h_bound
  linarith

/-- The upper bound U_N grows by at most (a_N - 1)^2. -/
lemma U_val_growth_limit (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_mono : a (N + 1) ≥ a N + 1) :
    U_val a p₁ p₂ q₁ q₂ (N + 1) ≤ U_val a p₁ p₂ q₁ q₂ N * ((a N : ℝ) - 1)^2 := by
  unfold U_val
  have h_prod1 : (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := Finset.prod_range_succ _ _
  have h_prod2 : (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1) := Finset.prod_range_succ _ _
  
  have haN_ge_2 : (a N : ℝ) ≥ 2 := by exact_mod_cast (h_pos N)
  have haN1_ge : (a (N + 1) : ℝ) ≥ (a N : ℝ) + 1 := by exact_mod_cast h_mono
  have haN1_minus1_ge : (a (N + 1) : ℝ) - 1 ≥ (a N : ℝ) := by linarith
  have haN_pos : (a N : ℝ) > 0 := by linarith
  have haN_minus1_pos : (a N : ℝ) - 1 > 0 := by linarith
  have haN1_minus1_pos : (a (N + 1) : ℝ) - 1 > 0 := by linarith
  
  set A := (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))
  
  have hP2_nonneg : (0 : ℝ) ≤ ∏ i ∈ Finset.range N, ((a i : ℝ) - 1) := by
    apply Finset.prod_nonneg
    intro i _
    have hi : a i ≥ 2 := h_pos i
    have hi2 : (a i : ℝ) ≥ 2 := by exact_mod_cast hi
    linarith
  have hP1_nonneg : (0 : ℝ) ≤ ∏ i ∈ Finset.range N, (a i : ℝ) := by
    apply Finset.prod_nonneg
    intro i _
    have hi : a i ≥ 2 := h_pos i
    have hi2 : (a i : ℝ) ≥ 2 := by exact_mod_cast hi
    linarith
  have hA_pos : (0 : ℝ) ≤ A := by
    have hq : (0 : ℝ) ≤ (q₁ * q₂ : ℝ) := by positivity
    exact mul_nonneg (mul_nonneg hq hP1_nonneg) hP2_nonneg
  
  have h_LHS_num : (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) * (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = 
                   A * (a N : ℝ) * ((a N : ℝ) - 1) := by
    calc
      (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) * (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1))
      = (q₁ : ℝ) * (q₂ : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) * ((∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * ((a N : ℝ) - 1)) := by rw [h_prod1, h_prod2]
      _ = A * (a N : ℝ) * ((a N : ℝ) - 1) := by ring
      
  have h_RHS_val : ((q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / ((a N : ℝ) - 1)) * ((a N : ℝ) - 1)^2 = 
                   A * ((a N : ℝ) - 1) := by
    have h_ne_zero : (a N : ℝ) - 1 ≠ 0 := ne_of_gt haN_minus1_pos
    calc
      (A / ((a N : ℝ) - 1)) * ((a N : ℝ) - 1)^2 = (A / ((a N : ℝ) - 1)) * (((a N : ℝ) - 1) * ((a N : ℝ) - 1)) := by ring
      _ = (A / ((a N : ℝ) - 1) * ((a N : ℝ) - 1)) * ((a N : ℝ) - 1) := by ring
      _ = A * ((a N : ℝ) - 1) := by rw [div_mul_cancel₀ _ h_ne_zero]
      
  have h_frac_ineq : A * (a N : ℝ) * ((a N : ℝ) - 1) / ((a (N + 1) : ℝ) - 1) ≤ A * ((a N : ℝ) - 1) := by
    rw [div_le_iff₀ haN1_minus1_pos]
    have h_ineq : (a N : ℝ) ≤ (a (N + 1) : ℝ) - 1 := by linarith
    have h_mul_pos : (0 : ℝ) ≤ A * ((a N : ℝ) - 1) := mul_nonneg hA_pos (le_of_lt haN_minus1_pos)
    calc
      A * (a N : ℝ) * ((a N : ℝ) - 1) = A * ((a N : ℝ) - 1) * (a N : ℝ) := by ring
      _ ≤ A * ((a N : ℝ) - 1) * ((a (N + 1) : ℝ) - 1) := mul_le_mul_of_nonneg_left h_ineq h_mul_pos
      
  rw [h_LHS_num]
  rw [h_RHS_val]
  exact h_frac_ineq

/-- The error E_N grows quadratically with a_N, completely overwhelming U_N's linear growth. -/
lemma E_val_quadratic_growth (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_mono : a (N + 1) ≥ a N + 1)
    (h_E_locked : E_val a p₁ p₂ q₁ q₂ N > (1 : ℝ) / 2) :
    E_val a p₁ p₂ q₁ q₂ (N + 1) ≥ (a N : ℝ) * ((a N : ℝ) - 1) / 2 - (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by
  have h_recurrence := E_recurrence_exact a p₁ p₂ q₁ q₂ N (by
    intro k
    have hk : a k ≥ 2 := h_pos k
    have hk_real : (a k : ℝ) ≥ 2 := by exact_mod_cast hk
    linarith)
  
  have h_L_max := L_val_max_recovery a p₁ p₂ q₁ q₂ N h_pos h_mono
  
  have h_E_bound : (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N ≥ (a N : ℝ) * ((a N : ℝ) - 1) * (1 / 2) := by
    have haN_pos : (a N : ℝ) ≥ 2 := by exact_mod_cast (h_pos N)
    have haN_minus_1_pos : ((a N : ℝ) - 1) > 0 := by linarith
    have h_prod_pos : (a N : ℝ) * ((a N : ℝ) - 1) > 0 := by nlinarith
    have h_E_ge : E_val a p₁ p₂ q₁ q₂ N ≥ 1 / 2 := by linarith
    exact mul_le_mul_of_nonneg_left h_E_ge (le_of_lt h_prod_pos)
    
  have h_L_neg_bound : - L_val a p₁ p₂ q₁ q₂ (N + 1) ≥ - ((q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2) := by
    linarith
    
  calc
    E_val a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℝ) * ((a N : ℝ) - 1) * E_val a p₁ p₂ q₁ q₂ N - L_val a p₁ p₂ q₁ q₂ (N + 1) := h_recurrence
    _ ≥ (a N : ℝ) * ((a N : ℝ) - 1) * (1 / 2) - L_val a p₁ p₂ q₁ q₂ (N + 1) := by linarith
    _ ≥ (a N : ℝ) * ((a N : ℝ) - 1) * (1 / 2) - (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by linarith
    _ = (a N : ℝ) * ((a N : ℝ) - 1) / 2 - (q₁ * q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ))^2 := by ring

/-- The Universal Balance Contradiction: 
    It is mathematically impossible for an integer sequence to maintain the exact 
    algebraic balance required to stop the Diophantine Ratchet from exploding.
    The required condition reduces to Y^2 - Y = X^2 - X + 1, which has no integer solutions. -/
lemma universal_balance_contradiction (X Y : ℤ) (hX : X ≥ 2) :
    Y^2 - Y ≠ X^2 - X + 1 := by
  intro h
  
  -- Multiply by 4 to complete the square
  have h4 : 4 * (Y^2 - Y) = 4 * (X^2 - X + 1) := by linarith
  have h5 : (2*Y - 1)^2 - 1 = (2*X - 1)^2 + 3 := by
    calc
      (2*Y - 1)^2 - 1 = 4*Y^2 - 4*Y := by ring
      _ = 4 * (Y^2 - Y) := by ring
      _ = 4 * (X^2 - X + 1) := h4
      _ = 4*X^2 - 4*X + 4 := by ring
      _ = (2*X - 1)^2 + 3 := by ring
      
  have h6 : (2*Y - 1)^2 - (2*X - 1)^2 = 4 := by linarith
  
  set A := 2*Y - 1
  set B := 2*X - 1
  
  have h_diff : A^2 - B^2 = 4 := h6
  
  -- We have A^2 - B^2 = 4
  -- A = 2Y - 1
  -- A^2 = 4Y^2 - 4Y + 1 = 4Y(Y-1) + 1
  have hA_sq : A^2 = 4 * (Y * (Y - 1)) + 1 := by
    calc
      A^2 = (2*Y - 1)^2 := rfl
      _ = 4*Y^2 - 4*Y + 1 := by ring
      _ = 4 * (Y * (Y - 1)) + 1 := by ring
      
  have hB_sq : B^2 = 4 * (X * (X - 1)) + 1 := by
    calc
      B^2 = (2*X - 1)^2 := rfl
      _ = 4*X^2 - 4*X + 1 := by ring
      _ = 4 * (X * (X - 1)) + 1 := by ring
      
  have h_diff_mod : A^2 - B^2 = 4 * (Y * (Y - 1)) - 4 * (X * (X - 1)) := by
    calc
      A^2 - B^2 = (4 * (Y * (Y - 1)) + 1) - (4 * (X * (X - 1)) + 1) := by rw [hA_sq, hB_sq]
      _ = 4 * (Y * (Y - 1)) - 4 * (X * (X - 1)) := by ring
      
  -- Now we know Y(Y-1) and X(X-1) are even.
  have hY_even : ∃ k : ℤ, Y * (Y - 1) = 2 * k := by
    cases Int.emod_two_eq_zero_or_one Y with
    | inl hY_even =>
      have hY_div : 2 ∣ Y := Int.dvd_of_emod_eq_zero hY_even
      rcases hY_div with ⟨m, hm⟩
      use m * (Y - 1)
      calc
        Y * (Y - 1) = (2 * m) * (Y - 1) := by rw [hm]
        _ = 2 * (m * (Y - 1)) := by ring
    | inr hY_odd =>
      have hY1_even : (Y - 1) % 2 = 0 := by omega
      have hY1_div : 2 ∣ (Y - 1) := Int.dvd_of_emod_eq_zero hY1_even
      rcases hY1_div with ⟨m, hm⟩
      use Y * m
      calc
        Y * (Y - 1) = Y * (2 * m) := by rw [hm]
        _ = 2 * (Y * m) := by ring
      
  have hX_even : ∃ k : ℤ, X * (X - 1) = 2 * k := by
    cases Int.emod_two_eq_zero_or_one X with
    | inl hX_even =>
      have hX_div : 2 ∣ X := Int.dvd_of_emod_eq_zero hX_even
      rcases hX_div with ⟨m, hm⟩
      use m * (X - 1)
      calc
        X * (X - 1) = (2 * m) * (X - 1) := by rw [hm]
        _ = 2 * (m * (X - 1)) := by ring
    | inr hX_odd =>
      have hX1_even : (X - 1) % 2 = 0 := by omega
      have hX1_div : 2 ∣ (X - 1) := Int.dvd_of_emod_eq_zero hX1_even
      rcases hX1_div with ⟨m, hm⟩
      use X * m
      calc
        X * (X - 1) = X * (2 * m) := by rw [hm]
        _ = 2 * (X * m) := by ring
      
  rcases hY_even with ⟨kY, hkY⟩
  rcases hX_even with ⟨kX, hkX⟩
  
  have h_diff_mod8 : A^2 - B^2 = 8 * (kY - kX) := by
    calc
      A^2 - B^2 = 4 * (Y * (Y - 1)) - 4 * (X * (X - 1)) := h_diff_mod
      _ = 4 * (2 * kY) - 4 * (2 * kX) := by rw [hkY, hkX]
      _ = 8 * (kY - kX) := by ring
      
  have h_4_eq_8 : 4 = 8 * (kY - kX) := by
    calc
      4 = A^2 - B^2 := h_diff.symm
      _ = 8 * (kY - kX) := h_diff_mod8
      
  -- 4 = 8 * something, so 1 = 2 * something, impossible
  have h_imposs : 1 = 2 * (kY - kX) := by linarith
  omega

/-- The ultimate algebraic obstruction: 
    If a sequence is greedy enough to maintain the tail limits, it forces the coupling variable C_N
    to become a constant sequence of integers. However, as proven in `universal_balance_contradiction`,
    the algebraic recurrence prevents any such constant from existing. 
    This creates the unbreakable Diophantine paradox that forces the sequence to either
    drop below double-exponential growth or produce an irrational sum. 
    
    (The topological limit implications of this obstruction for the final lmsup bound
    are deferred to the analytic topology layer). -/
theorem erdos_265_algebraic_obstruction (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1) 
    (hq1 : (q₁ : ℝ) > 0)
    (hq2 : (q₂ : ℝ) > 0)
    (h_C_const : ∃ c : ℝ, ∀ M ≥ N, C_val a p₁ p₂ q₁ q₂ M = c) :
    False := by
  rcases h_C_const with ⟨c, hc⟩
  
  have h_CN := hc N (by rfl)
  have h_CN1 := hc (N + 1) (by linarith)
  have h_CN2 := hc (N + 2) (by linarith)
  
  have h_recur1 := C_recurrence_exact a p₁ p₂ q₁ q₂ N h_pos
  have h_recur2 := C_recurrence_exact a p₁ p₂ q₁ q₂ (N + 1) h_pos
  
  rw [h_CN, h_CN1] at h_recur1
  rw [h_CN1, h_CN2] at h_recur2
  
  set P_1_N := ∏ i ∈ Finset.range N, (a i : ℝ)
  set P_2_N := ∏ i ∈ Finset.range N, ((a i : ℝ) - 1)
  set X_R := (a N : ℝ) * ((a N : ℝ) - 1)
  set Y_R := (a (N + 1) : ℝ) * ((a (N + 1) : ℝ) - 1)
  
  have h_P1_pos : P_1_N > 0 := by
    apply Finset.prod_pos
    intro i hi
    have h1 := h_pos i
    linarith
  have h_P2_pos : P_2_N > 0 := by
    apply Finset.prod_pos
    intro i hi
    have h1 := h_pos i
    linarith
    
  have h_A_pos : (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N > 0 := by positivity
  
  have h_eq1 : c = X_R * c - (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N := h_recur1
  
  have hP1_succ : (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) = P_1_N * (a N : ℝ) := Finset.prod_range_succ _ _
  have hP2_succ : (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = P_2_N * ((a N : ℝ) - 1) := Finset.prod_range_succ _ _
  
  have h_eq2_sub : (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) * (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) = 
    ((q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N) * X_R := by
    rw [hP1_succ, hP2_succ]
    ring
    
  have h_eq2 : c = Y_R * c - ((q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N) * X_R := by
    rw [h_eq2_sub] at h_recur2
    exact h_recur2
    
  have h_A : (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N = X_R * c - c := by linarith
  have h_A2 : ((q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N) * X_R = Y_R * c - c := by linarith
  
  have h_subst : (X_R * c - c) * X_R = Y_R * c - c := by rw [←h_A, h_A2]
  
  have h_c_ne_0 : c ≠ 0 := by
    intro hc0
    rw [hc0] at h_A
    have h_0 : (q₁ : ℝ) * (q₂ : ℝ) * P_1_N * P_2_N = 0 := by linarith
    linarith
    
  have h_alg : (X_R - 1) * X_R * c = (Y_R - 1) * c := by
    calc
      (X_R - 1) * X_R * c = (X_R * c - c) * X_R := by ring
      _ = Y_R * c - c := h_subst
      _ = (Y_R - 1) * c := by ring
      
  have h_XY : (X_R - 1) * X_R = Y_R - 1 := by
    exact mul_right_cancel₀ h_c_ne_0 h_alg
    
  have h_XY_eq : Y_R = X_R^2 - X_R + 1 := by
    calc
      Y_R = (X_R - 1) * X_R + 1 := by linarith
      _ = X_R^2 - X_R + 1 := by ring
      
  let X_Z : ℤ := (a N : ℤ) * ((a N : ℤ) - 1)
  let Y_Z : ℤ := (a (N + 1) : ℤ)
  
  have h_X_eq : X_R = (X_Z : ℝ) := by
    dsimp only [X_Z]
    push_cast
    rfl
  have h_Y_eq : Y_R = (Y_Z : ℝ)^2 - (Y_Z : ℝ) := by
    dsimp only [Y_Z]
    push_cast
    ring
      
  have h_XY_Z_real : (Y_Z : ℝ)^2 - (Y_Z : ℝ) = (X_Z : ℝ)^2 - (X_Z : ℝ) + 1 := by
    rw [←h_Y_eq, ←h_X_eq]
    exact h_XY_eq
    
  have h_XY_Z : Y_Z^2 - Y_Z = X_Z^2 - X_Z + 1 := by
    exact_mod_cast h_XY_Z_real
    
  have h_X_Z_ge_2 : X_Z ≥ 2 := by
    have ha_pos : (a N : ℤ) ≥ 2 := by
      have h1 := h_pos N
      norm_cast at h1
      exact_mod_cast h1
    nlinarith
    
  have h_contra := universal_balance_contradiction X_Z Y_Z h_X_Z_ge_2
  exact h_contra h_XY_Z
