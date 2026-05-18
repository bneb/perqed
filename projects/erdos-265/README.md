# Erdős Problem #265 Archive

This project investigated the open portion of Erdős Problem #265:
"Let $1 \le a_1 < a_2 < \dots$ be an increasing sequence of integers. How fast can $a_n \to \infty$ grow if $\sum \frac{1}{a_n}$ and $\sum \frac{1}{a_n-1}$ are both rational?"

## Formal Proofs

All formally verified Lean 4 proofs have been successfully promoted to the Hub and are permanently located in the `library/Perqed/Erdos265/` directory.

### Verified Unconditional Pillars:
1. **The Greedy Impossibility (`Main.lean`)**: Sequences that ride exactly on the $c=2$ ceiling (greedy sequences like Sylvester's) cannot be *dual*-rational because of a parity obstruction on the exact coupling integer.
2. **The Diophantine Lower Bound (`AnalyticApproximation.lean`)**: Using Liouville's theorem on rational approximation, the tail sum of any dual-rational sequence is bounded below by $1 / (q \prod_{k<N} a_k)$. This establishes a physical upper bound on sequence growth.

### The Remaining Open Gap
The mathematical frontier has been pushed exactly up to the Kovač-Tao oscillation barrier. The condition `hFast` ($S_N \le \frac{1}{a_N - 1}$) cannot be derived unconditionally from $\limsup a_n^{1/2^n} > 1$, because a sequence might jump to a massive value but then enter a slow-growth phase (e.g., $a_{N+k} = a_N + k$). This slow-growth phase inflates the tail sum, preventing the sequence from violating the Diophantine lower bounds.

The full resolution of Erdős 265 requires proving that a sequence cannot oscillate in this manner while satisfying *both* rational sums simultaneously.

## Archive Contents
- `paper/`: Drafts and LaTeX source for the formalization report.
- `data/`: Extracted JSONL logs and telemetry from the MCTS proof searches.
- `src/`: Custom scripts used during the investigation of the greedy regime.
- `walkthrough.md`: Historical audit logs of the project.
