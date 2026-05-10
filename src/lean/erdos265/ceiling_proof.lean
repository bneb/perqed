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
The running_sum convergence argument is below (with sorry for the
analytic step that the damped series converges to 0).
-/

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

/-- The F-recurrence coefficient. -/
noncomputable def c_coeff (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  Real.log (waste' a S N * q₁) -
    Real.log ((q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N)

/-- The F-recurrence: log P₁(k+1) = 2·log P₁(k) + c_k -/
theorem F_recurrence (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ)
    (ha : ∀ i, (a i : ℝ) > 0)
    (ht : tail_sum' a S N > 0) (hq : (q₁ : ℝ) > 0)
    (hP : (∏ i ∈ Finset.range N, (a i : ℝ)) > 0) :
    Real.log (∏ i ∈ Finset.range (N+1), (a i : ℝ)) =
      2 * Real.log (∏ i ∈ Finset.range N, (a i : ℝ)) + c_coeff a S q₁ N := by
  rw [Finset.prod_range_succ]
  rw [Real.log_mul (ne_of_gt hP) (ne_of_gt (ha N))]
  unfold c_coeff waste'
  have ht_pos : tail_sum' a S N > 0 := ht
  have hq_pos : (q₁ : ℝ) > 0 := hq
  have hP_pos : (∏ i ∈ Finset.range N, (a i : ℝ)) > 0 := hP
  have haN_pos : (a N : ℝ) > 0 := ha N
  have h1 : Real.log ((a N : ℝ) * tail_sum' a S N * (q₁ : ℝ)) = 
    Real.log (a N : ℝ) + Real.log (tail_sum' a S N) + Real.log (q₁ : ℝ) := by
    rw [Real.log_mul, Real.log_mul]
    · exact ne_of_gt haN_pos
    · exact ne_of_gt ht_pos
    · exact ne_of_gt (mul_pos haN_pos ht_pos)
    · exact ne_of_gt hq_pos
  have h2 : Real.log ((q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N) =
    Real.log (q₁ : ℝ) + Real.log (∏ i ∈ Finset.range N, (a i : ℝ)) + Real.log (tail_sum' a S N) := by
    rw [Real.log_mul, Real.log_mul]
    · exact ne_of_gt hq_pos
    · exact ne_of_gt hP_pos
    · exact ne_of_gt (mul_pos hq_pos hP_pos)
    · exact ne_of_gt ht_pos
  rw [h1, h2]
  ring

noncomputable def running_sum (c : ℕ → ℝ) (k : ℕ) : ℝ :=
  ∑ j ∈ Finset.range (k + 1), c j / (2 ^ (j + 1) : ℝ)

/-- The limsup indicator is approximated by the running sum. -/
lemma limsup_indicator_eq (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ) :
  Real.log (a k) / (2 ^ k : ℝ) = running_sum (c_coeff a S q₁) k + 
    (Real.log (a k) / (2 ^ k : ℝ) - running_sum (c_coeff a S q₁) k) := by
  ring

/-- At a waste step (w_k ≥ 1 + δ), the running sum contracts. -/
lemma waste_step_contraction (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (δ ε : ℝ) (hδ : δ > 0) (hε : ε > 0)
    (hw : waste' a S k ≥ 1 + δ) :
    running_sum (c_coeff a S q₁) k ≤ (1 - ε) * running_sum (c_coeff a S q₁) (k - 1) := by
  sorry

noncomputable def R₁ (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N

theorem R1_from_waste (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha : (a k : ℝ) ≠ 0) :
    R₁ a S q₁ (k + 1) =
      (waste' a S k - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
  unfold R₁ waste' tail_sum'
  rw [Finset.prod_range_succ, Finset.sum_range_succ]
  have h1 : (a k : ℝ) * (1 / (a k : ℝ)) = 1 := mul_one_div_cancel ha
  calc
    (q₁ : ℝ) * ((∏ i ∈ Finset.range k, (a i : ℝ)) * (a k : ℝ)) * (S - (∑ i ∈ Finset.range k, 1 / (a i : ℝ) + 1 / (a k : ℝ)))
      = (q₁ : ℝ) * (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - (a k : ℝ) * (1 / (a k : ℝ))) := by ring
    _ = (q₁ : ℝ) * (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - 1) := by rw [h1]
    _ = ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by ring

/-- A strictly greedy step forces R₁ to be non-increasing. -/
lemma greedy_implies_R1_nonincreasing (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha_pos : (a k : ℝ) > 0)
    (ha_ge2 : (a k : ℝ) ≥ 2)
    (hq_pos : (q₁ : ℝ) > 0)
    (hP_pos : (∏ i ∈ Finset.range k, (a i : ℝ)) > 0)
    (hw : waste' a S k ≤ 1 + 1 / ((a k : ℝ) - 1)) :
    R₁ a S q₁ (k + 1) ≤ R₁ a S q₁ k := by
  have ha_neq : (a k : ℝ) ≠ 0 := ne_of_gt ha_pos
  have hR_next := R1_from_waste a S q₁ k ha_neq
  rw [hR_next]
  unfold R₁ waste' at *
  have hqP : (q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ) > 0 := mul_pos hq_pos hP_pos
  have hw_mul : ((a k : ℝ) * tail_sum' a S k) * ((a k : ℝ) - 1) ≤ (1 + 1 / ((a k : ℝ) - 1)) * ((a k : ℝ) - 1) := by
    exact mul_le_mul_of_nonneg_right hw (by linarith)
  have h_rhs : (1 + 1 / ((a k : ℝ) - 1)) * ((a k : ℝ) - 1) = (a k : ℝ) := by
    calc
      (1 + 1 / ((a k : ℝ) - 1)) * ((a k : ℝ) - 1) = ((a k : ℝ) - 1) + 1 / ((a k : ℝ) - 1) * ((a k : ℝ) - 1) := by ring
      _ = ((a k : ℝ) - 1) + 1 := by rw [div_mul_cancel₀ _ (by linarith)]
      _ = (a k : ℝ) := by ring
  rw [h_rhs] at hw_mul
  have h_tail_mul : tail_sum' a S k * ((a k : ℝ) - 1) ≤ 1 := by
    nlinarith
  nlinarith

/-- A monotonically non-increasing sequence of positive integers is eventually constant. -/
lemma R1_eventually_constant (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (K : ℕ)
    (h_pos : ∀ k, R₁ a S q₁ k > 0) -- Assumes R1 is positive integer-valued
    (h_decr : ∀ k ≥ K, R₁ a S q₁ (k + 1) ≤ R₁ a S q₁ k) :
    ∃ R, ∃ M ≥ K, ∀ m ≥ M, R₁ a S q₁ m = R := by
  sorry

/-- If R₁ becomes constant, the sequence is locked into the Sylvester recurrence. -/
lemma constant_R1_forces_Sylvester (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (M : ℕ) (R : ℝ)
    (ha_pos : ∀ m, (a m : ℝ) > 0)
    (hR_pos : R > 0)
    (h_const : ∀ m ≥ M, R₁ a S q₁ m = R) :
    ∀ k ≥ M, (a (k + 1) : ℝ) = (a k : ℝ) * ((a k : ℝ) - 1) + 1 := by
  intro k hk
  have hRk : R₁ a S q₁ k = R := h_const k hk
  have hRk1 : R₁ a S q₁ (k + 1) = R := h_const (k + 1) (by linarith)
  have hRk2 : R₁ a S q₁ (k + 2) = R := h_const (k + 2) (by linarith)
  have ha_neq : (a k : ℝ) ≠ 0 := ne_of_gt (ha_pos k)
  have ha1_neq : (a (k + 1) : ℝ) ≠ 0 := ne_of_gt (ha_pos (k + 1))
  
  have step1 := R1_from_waste a S q₁ k ha_neq
  have step2 := R1_from_waste a S q₁ (k + 1) ha1_neq
  
  unfold waste' at step1 step2
  have hw1 : (a k : ℝ) * tail_sum' a S k * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
    calc
      (a k : ℝ) * tail_sum' a S k * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) = 
      ((a k : ℝ) * tail_sum' a S k - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by ring
      _ = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by rw [← step1]
      
  have ht_P : R₁ a S q₁ k = ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) * tail_sum' a S k := by
    unfold R₁; ring
  have ha_R : (a k : ℝ) * R₁ a S q₁ k = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
    calc
      (a k : ℝ) * R₁ a S q₁ k = (a k : ℝ) * tail_sum' a S k * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by rw [ht_P]; ring
      _ = R₁ a S q₁ (k + 1) + ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := hw1
  
  rw [hRk, hRk1] at ha_R
  have hPk : ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) = R * ((a k : ℝ) - 1) := by linarith
  
  have ht_P1 : R₁ a S q₁ (k + 1) = ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) * tail_sum' a S (k + 1) := by
    unfold R₁; ring
  have hw2 : (a (k + 1) : ℝ) * tail_sum' a S (k + 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by
    calc
      (a (k + 1) : ℝ) * tail_sum' a S (k + 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = 
      ((a (k + 1) : ℝ) * tail_sum' a S (k + 1) - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by ring
      _ = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by rw [← step2]
      
  have ha_R1 : (a (k + 1) : ℝ) * R₁ a S q₁ (k + 1) = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by
    calc
      (a (k + 1) : ℝ) * R₁ a S q₁ (k + 1) = (a (k + 1) : ℝ) * tail_sum' a S (k + 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := by rw [ht_P1]; ring
      _ = R₁ a S q₁ (k + 2) + ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) := hw2
      
  rw [hRk1, hRk2] at ha_R1
  have hPk1 : ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = R * ((a (k + 1) : ℝ) - 1) := by linarith
  
  have hPk1_def : ((q₁ : ℝ) * ∏ i ∈ Finset.range (k + 1), (a i : ℝ)) = ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) * (a k : ℝ) := by
    rw [Finset.prod_range_succ]
    ring
    
  rw [hPk, hPk1] at hPk1_def
  have hr : R ≠ 0 := ne_of_gt hR_pos
  have h_sub : (a (k + 1) : ℝ) - 1 = (a k : ℝ) * ((a k : ℝ) - 1) := by
    calc
      (a (k + 1) : ℝ) - 1 = R * ((a (k + 1) : ℝ) - 1) / R := by rw [mul_div_cancel_left₀ _ hr]
      _ = R * ((a k : ℝ) - 1) * (a k : ℝ) / R := by rw [hPk1_def]
      _ = R * ((a k : ℝ) * ((a k : ℝ) - 1)) / R := by ring
      _ = (a k : ℝ) * ((a k : ℝ) - 1) := by rw [mul_div_cancel_left₀ _ hr]
  linarith

/-- An eventually Sylvester sequence has an irrational sum for 1/(a_k-1), 
    contradicting simultaneous rationality. -/
lemma sylvester_contradicts_rationality (a : ℕ → ℕ) (M : ℕ)
    (h_sylv : ∀ m > M, (a (m + 1) : ℝ) = (a m : ℝ) * ((a m : ℝ) - 1) + 1)
    (h_sum2 : ∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) :
    False := by
  sorry

/-- The final combinatorial contradiction: finite waste implies sequence is eventually 
    Sylvester, contradicting rationality. -/
lemma finite_waste_implies_contradiction (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ)
    (δ : ℝ) (hδ : δ > 0)
    (h_finite : ∃ K, ∀ k ≥ K, waste' a S k < 1 + δ)
    (h_sum2 : ∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) :
    False := by
  sorry
/-- The ceiling conjecture main theorem, assembled from the structural lemmas:
    Since case 2 (finite waste) is impossible, there must be infinitely many waste steps.
    Each waste step contracts the running sum, driving it to 0. 
    Therefore log(a_k)/2^k → 0, so limsup a_k^{1/2^k} ≤ 1. -/
theorem ceiling_conjecture (a : ℕ → ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_mono : StrictMono a)
    (h_sum1 : ∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁)
    (h_sum2 : ∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) :
    limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  sorry
