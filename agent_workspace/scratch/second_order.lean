import Mathlib

open Filter Topology

noncomputable section

-- KEY NEW IDEA: T_{n+1} = a_n · T_n - denom · P_n
-- Rearranging: denom · P_n = a_n · T_n - T_{n+1}
-- Since P_{n+1} = P_n · a_n:
-- denom · P_{n+1} = a_n · denom · P_n = a_n · (a_n · T_n - T_{n+1})
-- Also: denom · P_{n+1} = a_{n+1} · T_{n+1} - T_{n+2}
-- So: a_n · (a_n · T_n - T_{n+1}) = a_{n+1} · T_{n+1} - T_{n+2}
-- i.e.: a_n² · T_n - a_n · T_{n+1} = a_{n+1} · T_{n+1} - T_{n+2}
-- i.e.: T_{n+2} = (a_n + a_{n+1}) · T_{n+1} - a_n² · T_n
--
-- This is a SECOND-ORDER LINEAR RECURRENCE for T_n!
-- T_{n+2} = (a_n + a_{n+1}) · T_{n+1} - a_n² · T_n
--
-- For T_n to be eventually constant (T_n = C for n ≥ N):
-- C = (a_N + a_{N+1}) · C - a_N² · C = C · (a_N + a_{N+1} - a_N²)
-- So a_N + a_{N+1} - a_N² = 1, i.e., a_{N+1} = a_N² - a_N + 1 = a_N(a_N-1) + 1
-- Which is exactly the Sylvester recurrence! ✓
--
-- Now, for T_n to become constant, the "characteristic equation" of the recurrence
-- should have a root at 1 and one at a_n² (which goes to infinity).
--
-- More precisely: if T_{n+1} - T_n is small compared to T_n, then
-- T_{n+2} - T_{n+1} ≈ a_n · (T_{n+1} - T_n)  [from the recurrence]
-- 
-- Wait: T_{n+2} = (a_n + a_{n+1})·T_{n+1} - a_n²·T_n
-- Let δ_n = T_{n+1} - T_n. Then:
-- T_{n+2} - T_{n+1} = (a_n + a_{n+1} - 1)·T_{n+1} - a_n²·T_n
-- = (a_n + a_{n+1} - 1)·(T_n + δ_n) - a_n²·T_n
-- = (a_n + a_{n+1} - 1 - a_n²)·T_n + (a_n + a_{n+1} - 1)·δ_n
-- = (a_{n+1} - a_n² + a_n - 1)·T_n + (a_n + a_{n+1} - 1)·δ_n
-- = (a_{n+1} - a_n(a_n-1) - 1)·T_n + (a_n + a_{n+1} - 1)·δ_n
--
-- So δ_{n+1} = (a_{n+1} - a_n(a_n-1) - 1)·T_n + (a_n + a_{n+1} - 1)·δ_n
--
-- For Sylvester: a_{n+1} = a_n(a_n-1) + 1, so the first term is 0,
-- and δ_{n+1} = (a_n + a_{n+1} - 1)·δ_n. Since δ_0 = 0 for Sylvester, δ_n = 0 for all n. ✓
--
-- For general sequences: if δ_n ≠ 0, then δ_{n+1} grows by factor ≈ a_{n+1}.
-- So |δ_n| grows super-exponentially unless δ_n = 0 eventually.
-- But T_n is a positive integer with T_n/P_n → 0, so |δ_n| can't grow faster than P_n.
-- And P_n grows as ∏ a_k = a_0·a_1·...·a_{n-1}.
-- While δ_{n+1} ≈ a_{n+1}·δ_n, so |δ_n| ≈ |δ_0| · ∏ a_k ≈ |δ_0| · P_n.
-- So |δ_n| ≈ P_n, which means T_{n+1} ≈ T_n ± P_n.
-- But T_n = denom · P_n · S_n with S_n → 0, so T_n ≪ P_n eventually.
-- If |δ_n| ≈ P_n and T_n ≪ P_n, then T_{n+1} = T_n + δ_n could go negative!
-- But T_n ≥ 1 always. Contradiction → δ_n must be 0 eventually.
--
-- THIS IS THE PROOF! δ_n can't grow because T_n can't go negative.
-- More precisely:
-- If there exists some n₀ where δ_{n₀} ≠ 0, then |δ_n| grows at least as fast as 
-- c · ∏_{k=n₀}^{n-1} a_k for some c > 0 (because the multiplier is ≥ a_n + a_{n+1} - 1 ≥ a_n).
-- Eventually |δ_n| > T_n (since T_n/P_n → 0 but |δ_n|/P_n → c' > 0).
-- At that point, T_{n+1} = T_n + δ_n either goes negative (contradicting T > 0)
-- or becomes much larger than T_n (contradicting T/P → 0).
-- Either way, contradiction.
--
-- Let's formalize this!

end
