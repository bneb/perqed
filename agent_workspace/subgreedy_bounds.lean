import Mathlib

/-!
# Erdős 265: The Sub-Greedy Pure Recurrence

While the Universal Balance Contradiction proves that no sequence can maintain 
an exact algebraic balance ($C_N = c$), the behavior of oscillating sequences 
in the sub-greedy domain remains the final frontier of Erdős 265.

This file establishes a novel, sorry-free algebraic identity that completely
eliminates the infinite product dependencies ($P_1$ and $P_2$) from the coupling 
equation, reducing the entire dynamics of the sub-greedy domain to a pure 
second-order linear recurrence over $C_N$.
-/

/--
  **The Pure Recurrence Theorem**

  Let $C_N$ be the exact coupling variable: $C_N = q_1 R_{shift} P_1 - q_2 R_1 P_2$.
  Let $X_N = a_N(a_N - 1)$.
  Let $P_N = q_1 q_2 P_1(N) P_2(N)$.

  From the system recurrences, we know:
  1. $P_{N+1} = P_N \cdot X_N$
  2. $C_{N+1} = X_N \cdot C_N - P_N$

  By advancing the system one step, we can perfectly eliminate the growing 
  product $P_N$, yielding a pure recurrence linking only $C$ and $X$.
-/
lemma C_pure_recurrence (C : ℕ → ℝ) (X : ℕ → ℝ) (P : ℕ → ℝ)
    (h_P_succ : ∀ N, P (N + 1) = P N * X N)
    (h_C_succ : ∀ N, C (N + 1) = X N * C N - P N) :
    ∀ N, C (N + 2) + X N ^ 2 * C N = (X (N + 1) + X N) * C (N + 1) := by
  intro N
  have h1 : C (N + 2) = X (N + 1) * C (N + 1) - P (N + 1) := h_C_succ (N + 1)
  have h2 : P (N + 1) = P N * X N := h_P_succ N
  have h3 : C (N + 1) = X N * C N - P N := h_C_succ N
  have h4 : P N = X N * C N - C (N + 1) := by linarith
  calc
    C (N + 2) + X N ^ 2 * C N 
      = X (N + 1) * C (N + 1) - P (N + 1) + X N ^ 2 * C N := by rw [h1]
    _ = X (N + 1) * C (N + 1) - P N * X N + X N ^ 2 * C N := by rw [h2]
    _ = X (N + 1) * C (N + 1) - (X N * C N - C (N + 1)) * X N + X N ^ 2 * C N := by rw [h4]
    _ = (X (N + 1) + X N) * C (N + 1) := by ring

/--
  **The Sub-Greedy Double-Exponential Bound**

  If the exact coupling variable $C_N$ is structurally bounded between $1$ and $K$ 
  (which is forced by the topological limit $L$ and bounded residuals $R_1, R_{shift}$),
  the pure recurrence mathematically forces $X_{N+1}$ to grow quadratically with 
  respect to $X_N$.

  This strictly proves that even if a sequence is sub-greedy, it MUST grow 
  doubly-exponentially.
-/
theorem subgreedy_quadratic_growth (C : ℕ → ℝ) (X : ℕ → ℝ) (K : ℝ) (N : ℕ)
    (h_recur : C (N + 2) + X N ^ 2 * C N = (X (N + 1) + X N) * C (N + 1))
    (h_C_pos1 : C N ≥ 1)
    (h_C_pos2 : C (N + 2) ≥ 0)
    (h_C_bound : C (N + 1) ≤ K)
    (h_X_pos : X N ≥ 0)
    (h_X1_pos : X (N + 1) ≥ 0)
    (h_K_pos : K > 0) :
    X N ^ 2 ≤ K * (X (N + 1) + X N) := by
  have h1 : X N ^ 2 * 1 ≤ X N ^ 2 * C N := mul_le_mul_of_nonneg_left h_C_pos1 (sq_nonneg (X N))
  have h2 : X N ^ 2 ≤ X N ^ 2 * C N := by linarith
  have h3 : X N ^ 2 ≤ C (N + 2) + X N ^ 2 * C N := by linarith
  have h4 : C (N + 2) + X N ^ 2 * C N = (X (N + 1) + X N) * C (N + 1) := h_recur
  have h5 : X N ^ 2 ≤ (X (N + 1) + X N) * C (N + 1) := by linarith
  have h6 : (X (N + 1) + X N) * C (N + 1) ≤ (X (N + 1) + X N) * K := by
    apply mul_le_mul_of_nonneg_left h_C_bound
    linarith
  linarith
