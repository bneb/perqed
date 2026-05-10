# Erdős 265: Research & Experimentation Log

This document serves as a laboratory log for our formalization efforts on the Erdős 265 problem. By tracking failed hypotheses, naive strategies, and structural blockers, we avoid redundant work and clarify the necessary logical path.

## Failed Attempt 1: The Monolithic Outline
**Date:** May 2026
**Strategy:** We attempted to prove the Ceiling Conjecture by dumping the entire logical pipeline into a single monolithic `ceiling_conjecture_outline` theorem using `sorry` blocks.
**Why it failed:** 
- The theorem was too complex for Lean to parse and verify structurally.
- Mixing analytic real-limits (running sums) with combinatorial integer arguments (R₁ sequences) in the same block obscured type mismatches and made it impossible to isolate components.
**Correction:** We decomposed the proof into isolated structural lemmas (e.g., `greedy_implies_R1_nonincreasing`, `constant_R1_forces_Sylvester`).

## Failed Attempt 2: Finite Waste implies Termination
**Date:** May 2026
**Strategy:** We hypothesized that if the sequence only has finitely many waste steps (i.e. it becomes purely greedy), the residual $R_1(k)$ would strictly decrease until it hits 0, causing the sequence to "terminate." Since the sequence is infinite, this would provide a contradiction.
**Why it failed:**
- $R_1(k)$ is monotonically non-increasing during greedy steps, but it is **not guaranteed to strictly decrease**. It can hit a constant floor $R > 0$.
- If $R_1(k)$ becomes constant, the sequence perfectly locks into the Sylvester recurrence ($a_{k+1} = a_k(a_k - 1) + 1$). It does not terminate.
**Correction:** We pivoted to `constant_R1_forces_Sylvester` and used the fact that Sylvester sequences have an irrational shifted sum (via Erdős-Straus) to achieve the contradiction.

## Failed Attempt 3: The Naive Running Sum Contraction
**Date:** May 2026
**Strategy:** We hypothesized that every "waste step" ($w_k \ge 1 + \delta$) heavily contracts the log-growth running sum $S_k = F_k/2^k$, driving it to 0. We formulated `waste_step_contraction` assuming that infinitely many waste steps would trivially force $\limsup a_k^{1/2^k} \le 1$.
**Why it failed:**
- A Red Team analysis revealed this is analytically false. While a waste step drops the running sum temporarily, the sequence can immediately enter an arbitrarily long "greedy phase." 
- During a long greedy phase, $R_1(k)$ monotonically decreases or stays constant, meaning the sequence behaves almost exactly like the Sylvester sequence. During this phase, $S_k$ climbs *back up* towards $\log 2$.
- By spacing waste steps further and further apart, a sequence could theoretically achieve $\limsup S_k = \log 2$ (and thus $\limsup a_k^{1/2^k} = 2$), completely bypassing the contraction.
**Correction:** We abandoned the pure running sum contraction in favor of the **Coupling Diophantine Squeeze**. The length of the greedy runs is strictly bounded because the coupling residual $C(N)$ grows astronomically during greedy steps and cannot be "closed" by an integer denominator if the run is too long.

## Failed Attempt 4: The Pure Diophantine Squeeze (No Waste Steps)
**Date:** May 2026
**Strategy:** We attempted to completely bypass the concept of "waste steps" and "greedy runs" by analyzing the coupling recurrence $C(N)$ directly. We proved $C(N) \ge 1$ always. We then hypothesized that if the sequence achieves $\limsup a_N^{1/2^N} = 2$, it must perfectly mimic Sylvester growth, which would force $C(N)$ to converge to a constant. This would trigger the Diophantine equation $y^2 - y = x^2 - x + 1$, which has no integer solutions, supposedly proving $\limsup \le 1$ algebraically.
**Why it failed:**
- A deeper algebraic Red Team pass revealed a fundamental flaw: for the exact Sylvester sequence ($a_{N+1} = a_N(a_N-1) + 1$), the quantity $C(N)$ does **not** converge to a constant! 
- In fact, $C(N)$ grows exactly by a factor of $a_N - 1$ at each step for the Sylvester sequence.
- Because $C(N)$ is not constant, the "no integer solutions" Diophantine obstruction $y^2 - y = x^2 - x + 1$ is mathematically irrelevant to the sequence's actual growth.
- Furthermore, we *already* have a proven contradiction for the exact Sylvester sequence: `sylvester_shifted_irrational` in `negative_resolution.lean` proves that Sylvester sequences cannot have a rational shifted sum. We do not need a new algebraic lemma to handle the boundary case.
**Correction:** We reverted back to the **Bounded Greedy Runs** logic (Attempt 3 correction). The Coupling Squeeze explosion is real, but it must be used to physically bound the length of greedy runs, which forces waste steps to occur frequently enough to collapse the running sum to zero.

## Current Successful Path: The Coupling Diophantine Squeeze (with Bounded Runs)
**Date:** May 2026
**Strategy:** 
1. The sequence cannot be purely greedy eventually (Case 2) because that forces Sylvester growth, contradicting the rationality of $\sum 1/(a_k - 1)$ (`sylvester_shifted_irrational`).
2. Therefore, there are infinitely many waste steps.
3. Between waste steps, the sequence follows greedy runs. During a greedy run, the coupling residual $C(N)$ explodes.
4. Because the residual must eventually be closed by an integer, the greedy runs cannot be arbitrarily long (`greedy_run_bounded`).
5. Because the distance between waste steps is strictly bounded, the running sum $S_N$ is frequently cut down. This forces the sequence's growth to be uniformly throttled below the double-exponential Sylvester rate, leading to $\limsup a_k^{1/2^k} \le 1$.
