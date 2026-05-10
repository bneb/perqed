import Mathlib

open Filter Topology Metric Set Finset

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

-- The squeeze logic
-- E(N) = C_0 - C(N)
-- where C(N) is an integer.
-- We want to show that if a run is too long, E(N) is strictly between 0 and 1,
-- but C_0 might not be an integer. Wait!
-- Is C_0 = q_1 q_2 P_1(K) P_2(K) / (a_K - 1) an integer?
-- Not necessarily!
-- But C(N) = C_0 - E(N) for ALL N in the run.
-- So C(N+1) = C_0 - E(N+1).
-- But C(N+1) and C(N) are both integers!
-- So C(N+1) - C(N) = E(N) - E(N+1) must be an integer!
-- But E(N) = C_0 (a_N - 1) / (a_{K+M+1} - 1) + ...
-- As M gets large, E(N) AND E(N+1) both get incredibly small!
-- So E(N) - E(N+1) gets arbitrarily small!
-- Since it's an integer, it must be EXACTLY ZERO!
-- If E(N) - E(N+1) = 0, then C(N+1) = C(N).
-- But we checked that C(N+1) cannot equal C(N)!
-- Let's check: C(N+1) - C(N) = 0 => C(N+1) = C(N).
-- C(N+1) = a_N(a_N - 1) C(N) - q_1 q_2 P_1(N) P_2(N).
-- So C(N) = a_N(a_N - 1) C(N) - q_1 q_2 P_1(N) P_2(N).
-- C(N) [a_N(a_N - 1) - 1] = q_1 q_2 P_1(N) P_2(N).
-- This means C(N) = q_1 q_2 P_1(N) P_2(N) / (a_{N+1} - 2).
-- But we know C(N) ≈ q_1 q_2 P_1(N) P_2(N) / (a_N - 1).
-- Since a_N - 1 ≪ a_{N+1} - 2, C(N) CANNOT equal C(N+1)!
-- Specifically, E(N) ≈ C_0 (a_N - 1) / a_{K+M+1}, which grows with N.
-- So E(N+1) ≈ C_0 (a_{N+1} - 1) / a_{K+M+1}.
-- Since a_{N+1} - 1 = a_N(a_N - 1), E(N+1) is much LARGER than E(N).
-- So E(N+1) - E(N) is roughly E(N+1), which is > 0.
-- So E(N+1) - E(N) cannot be 0!
-- But it must be an integer!
-- So it must be ≥ 1.
-- But E(N+1) can be made < 1 by making M large enough!
-- Contradiction!

-- Let's write this clearly.
lemma squeeze_test (a : ℕ → ℕ) : True := trivial
