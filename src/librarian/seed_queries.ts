/**
 * Domain seed queries for the Perqed vector store.
 *
 * Curated to cover the problem areas Perqed actively searches:
 *   - Ramsey theory (lower bounds, witnesses, specific numbers)
 *   - Combinatorial search methods (SA, LNS, flag algebras)
 *   - Formal verification (Lean 4, kernel reflection)
 *   - Adjacent extremal combinatorics (for technique transfer)
 */

export const DOMAIN_SEED_QUERIES: string[] = [
  // ── Ramsey theory ──────────────────────────────────────────────────────
  "Ramsey number lower bound construction graph coloring",
  "Ramsey R(4,6) circulant graph witness Exoo",
  "multicolor Ramsey number computational search",
  "Paley graph Ramsey number lower bound spectral",
  "Ramsey multiplicity clique coloring survey Radziszowski",

  // ── Combinatorial search ───────────────────────────────────────────────
  "simulated annealing graph coloring combinatorial optimization",
  "large neighborhood search constraint satisfaction integer programming",
  "non-monotonic cooling schedule reheat simulated annealing stagnation",

  // ── Flag algebras ──────────────────────────────────────────────────────
  "flag algebra method Razborov Ramsey extremal combinatorics",
  "semidefinite programming Ramsey number upper bound flag algebra",

  // ── Lean 4 formal verification ─────────────────────────────────────────
  "Lean 4 decide tactic kernel reflection formal proof combinatorics",
  "machine-checked combinatorics Lean Coq certified proof",
  "native_decide kernel computation Lean 4 verified",

  // ── Adjacent extremal combinatorics ────────────────────────────────────
  "Turán theorem extremal graph forbidden subgraph",
  "probabilistic method Ramsey theory Lovász Local Lemma",
  "Zarankiewicz problem bipartite forbidden subgraph extremal",
];
