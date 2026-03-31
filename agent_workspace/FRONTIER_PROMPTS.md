# The Mathematical Frontier: Prompts for Perqed V3

To get a real result (e.g. a new Ramsey bound) without hitting the Finite Computability Paradox, point the `Librarian` and `Architect` at specific domains where combinatorial explosion is high enough that humans haven't mapped it, but $N$ is small enough to fit inside a `native_decide` bound.

## 1. Asymmetric / Bipartite Ramsey Numbers
Everyone knows $R(4,4)$ and $R(4,5)$. But the frontier for bipartite Ramsey numbers (e.g., $b(K_{2,2}, K_{3,3})$) or multicolor Ramsey numbers on small graphs is full of holes.

**Prompt:**
> "Search arXiv for recent bounds on bipartite Ramsey numbers or multicolor Ramsey numbers for specific small graphs. Propose a new exact bound for a specific, uncomputed finite case, and verify it."

## 2. Zero-Sum Combinatorics (The Erdős-Ginzburg-Ziv Frontier)
Look into zero-sum Ramsey theory on finite abelian groups. The bounds for non-cyclic groups like $\mathbb{Z}_p \oplus \mathbb{Z}_p$ for small primes ($p=5, 7$) are notoriously messy.

**Prompt:**
> "Find recent papers on the Erdős-Ginzburg-Ziv constant for non-cyclic finite abelian groups. Propose a specific counter-example or exact bound for a small finite group."

## 3. Graph Ramsey-Turán Theory
Instead of just asking for a graph without triangles, ask for a graph without triangles that also has an independence number less than $\alpha$. The specific finite extremal graphs for these dual-constraint problems are mostly unknown.

**Prompt:**
> "Investigate finite extremal graphs in Ramsey-Turán theory. Formulate a specific computable bound for $N \le 40$ vertices combining edge density and independence number constraints."
