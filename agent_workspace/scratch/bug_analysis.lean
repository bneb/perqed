-- Verify: for Sylvester sequence, what is P_n * L / a_n?
-- a = [2, 3, 7, 43, 1807, ...]
-- P = [1, 2, 6, 42, 1806, ...]
-- P_n/a_n = [1/2, 2/3, 6/7, 42/43, 1806/1807, ...]
-- These converge to 1, NOT to 1/L.
-- So P_n * L / a_n → L, not → 1.

-- And T_n for Sylvester with sum = 1/1:
-- T_0 = 1
-- T_1 = 2*1 - 1*1 = 1  
-- T_2 = 3*1 - 1*2 = 1
-- T_3 = 7*1 - 1*6 = 1
-- T_4 = 43*1 - 1*42 = 1
-- So T_n = 1 for all n, converging to 1.
-- But asymptoticSqueezeLimit claims T_n → denom/L = 1/L ≈ 0.625.
-- This is WRONG. T_n = 1, not 1/L.

-- The bug doesn't affect the proof structure because
-- integerConvergenceRigidity only needs convergence to SOME limit.
-- The actual limit value is irrelevant for the contradiction.
