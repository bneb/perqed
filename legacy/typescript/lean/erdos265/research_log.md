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

## ~~Current Successful Path~~ Failed Attempt 5: Bounded Greedy Runs via C(N) Explosion
**Date:** May 2026
**Strategy:**
1. Eventually greedy → Sylvester → irrational shifted sum → contradiction. (PROVED ✅)
2. Therefore infinitely many waste steps.
3. C(N) explodes during greedy runs → runs must be bounded.
4. Bounded runs → frequent waste → running sum throttled → limsup ≤ 1.
**Why it failed:**
- **Step 3 is wrong.** C(N) being a large integer is not a contradiction — integers can be arbitrarily large. The "explosion" of C(N) during greedy phases does not bound the run length. (Identified in red team audit, session 2.)
- **Step 4 was already refuted in Attempt 3.** Even with bounded greedy runs, the running sum gain during a greedy phase of length L is ~log(c)/2^k (dominated by the first term), while the waste cost is ~log(w)/2^{k+L+1} (exponentially smaller). Net gain is positive, so bounded runs do NOT throttle growth.
**Correction:** See Attempt 6 below.

## Failed Attempt 6: Deviation Cost Drives L to Zero
**Date:** May 2026
**Strategy:** Show that every deviation from Sylvester costs L (the running sum limit) by approximately C/2^K, and since infinitely many deviations are needed, L → 0.
**Why it failed:**
- The cost per unit deviation at step K IS approximately C/2^K (verified numerically: C ≈ 0.17).
- But deviations can be **sparse**: if they occur at steps K_1, K_2, ... with exponentially growing gaps, the total cost ∑ C/2^{K_j} converges to a FINITE value much less than L_Sylvester ≈ 0.47.
- Example: deviations at K = 1, 4, 16, 64, ... cost ≈ 0.09, leaving L_∞ ≈ 0.38 > 0.
- The argument only works if we can show deviations must be DENSE (at every step or nearly), which requires an **irrationality measure** for the Sylvester shifted sum — exactly the hard part.
**Correction:** The real question is not "do deviations exist" but "how frequent and large must they be." This reduces to an effective irrationality measure problem.

## ~~Current Opening~~ Failed Attempt 7: Irrationality Measure Bound
**Date:** May 2026
**Strategy:** Use the irrationality measure μ of the Sylvester shifted sum to show that Sylvester runs of length L create a gap between the tail sum and any rational p/q, forcing deviations to be frequent.
**Why it failed:**
- The irrationality measure IS finite (μ = 2 for doubly-exponential sequences).
- But the bound goes the **wrong way**: after L Sylvester steps, |T₂(N+L) - T₂_∞| ≈ 1/C^{2^L}, while 1/P₂(N+L)^μ ≈ 1/C^{2·(2^L - 1)}.
- Since 2^L < 2·(2^L - 1) for L ≥ 2, the tail is ALWAYS larger than the irrationality bound.
- This means the rational partial sums are NEVER good enough approximations to violate the irrationality measure. The tail sum comfortably remains rational through arbitrarily long Sylvester runs.
- The irrationality measure only constrains approximations with **small** denominators; our denominators P₂(N+L) grow doubly-exponentially, so the bound is never tight.

## Honest State of Affairs
**Date:** May 2026

### What is definitely proved
1. **Case 1 (Eventually FastGrowth):** If a_{n+1} ≥ a_n(a_n-1)+1 for all large n, then ∑1/(a_k-1) is irrational → not Erdős 265. **(PROVED in Lean, 1 casting sorry)**
2. **Coupling recurrence:** C(N+1) = a_N(a_N-1)·C(N) - q₁q₂P₁P₂. **(PROVED in Lean, 0 sorry)**
3. **R₁ waste identity:** R₁(N+1) = (waste-1)·q₁·P₁(N). **(PROVED in Lean, 0 sorry)**
4. **Deviation cost:** Each unit deviation from Sylvester at step K costs L by ≈ 0.17/2^K. **(VERIFIED numerically)**

### What remains genuinely open
The conjecture: limsup a_k^{1/2^k} ≤ 1 for all Erdős 265 sequences.

### Why it's hard — the core tension
- **Sylvester growth** is the "natural attractor" for any greedy-like sequence. Sequences near Sylvester grow doubly-exponentially (limsup ≈ 1.598).
- **Sylvester shifted sums are irrational.** So Erdős 265 sequences must deviate from Sylvester.
- **Deviations cost growth.** But the cost is ∝ 1/2^K, so sparse deviations don't kill limsup > 1.
- **The open question:** Do the specific deviations required for shifted sum rationality have to be dense/large enough to force limsup ≤ 1?

### What approaches have been exhausted
| # | Strategy | Why it fails |
|---|----------|-------------|
| 1 | Monolithic proof | Too complex to verify |
| 2 | Finite waste → termination | R₁ can plateau at constant > 0 |
| 3 | Running sum contraction | Greedy phases recover the loss |
| 4 | Pure Diophantine squeeze | C(N) doesn't converge to constant |
| 5 | Bounded greedy runs via C(N) | C(N) explosion doesn't bound anything |
| 6 | Deviation cost drives L→0 | Sparse deviations have finite total cost |
| 7 | Irrationality measure | Bound goes the wrong way (tail >> 1/q^μ) |

### Possible remaining approaches
1. **Constructive disproof:** Try harder to push the KT construction toward β=2. The barrier is in the error analysis — perhaps a d=3 or d=4 Vandermonde approach could achieve higher β.
2. **R₁-R_shift coupling analysis:** The TWO residuals are coupled. Even if R₁ alone doesn't constrain run lengths, the joint evolution of (R₁, R_shift) might. This has not been explored.
3. **Algebraic structure of deviations:** The deviations can't be arbitrary — they must satisfy BOTH sum constraints simultaneously. Perhaps the 2D lattice structure of the correction forces specific patterns.
