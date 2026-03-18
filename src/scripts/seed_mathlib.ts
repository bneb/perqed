#!/usr/bin/env bun
/**
 * seed_mathlib.ts — Bootstrap the mathlib_premises LanceDB table.
 *
 * Seeds fundamental combinatorics, graph theory, and number theory
 * Lean 4 theorem signatures so the DAG `mathlib_query` node has real
 * formal content to retrieve from day one.
 *
 * Prerequisites:
 *   - Ollama running with nomic-embed-text pulled:
 *       ollama serve && ollama pull nomic-embed-text
 *
 * Usage:
 *   bun run src/scripts/seed_mathlib.ts
 */

import { MathlibLibrarian, type LeanTheorem } from "../librarian/mathlib_librarian";

const DB_PATH = "./data/perqed.lancedb";

// ── Fundamental theorem catalogue ──────────────────────────────────────────
// Each entry provides a docstring written to be semantically meaningful for
// vector search, so queries like "Ramsey number graph coloring" surface the
// most relevant formal lemmas.

const SEED_THEOREMS: LeanTheorem[] = [
  // ── Combinatorics: Pigeonhole ────────────────────────────────────────────
  {
    theorem: "Finset.exists_ne_map_eq_of_card_lt_of_maps_to",
    signature: "theorem Finset.exists_ne_map_eq_of_card_lt_of_maps_to {α β : Type*} [DecidableEq β] {s : Finset α} {t : Finset β} {f : α → β} (hc : t.card < s.card) (hf : ∀ a ∈ s, f a ∈ t) : ∃ x ∈ s, ∃ y ∈ s, x ≠ y ∧ f x = f y",
    docstring: "Pigeonhole principle: if more elements are mapped into fewer buckets, two must collide. Core tool for Ramsey-type existence arguments.",
    module: "Mathlib.Data.Finset.Card",
  },
  {
    theorem: "SimpleGraph.IsClique.mono",
    signature: "theorem SimpleGraph.IsClique.mono {V : Type*} {G H : SimpleGraph V} {s : Set V} (h : G.IsClique s) (hGH : G ≤ H) : H.IsClique s",
    docstring: "If s is a clique in G and G is a subgraph of H, then s is also a clique in H. Used for monotonicity arguments in Ramsey lower bounds.",
    module: "Mathlib.Combinatorics.SimpleGraph.Clique",
  },
  {
    theorem: "SimpleGraph.IsIndependentSet.mono",
    signature: "theorem SimpleGraph.IsIndependentSet.mono {V : Type*} {G H : SimpleGraph V} {s : Set V} (h : H.IsIndependentSet s) (hGH : G ≤ H) : G.IsIndependentSet s",
    docstring: "If s is an independent set in H and G is a subgraph of H, then s is independent in G. Dual of IsClique.mono; used in 2-coloring lower bound witnesses.",
    module: "Mathlib.Combinatorics.SimpleGraph.Clique",
  },
  {
    theorem: "SimpleGraph.chromaticNumber_le_card",
    signature: "theorem SimpleGraph.chromaticNumber_le_card {V : Type*} [Fintype V] (G : SimpleGraph V) : G.chromaticNumber ≤ Fintype.card V",
    docstring: "The chromatic number of a finite graph is at most the number of vertices. Trivial upper bound used as termination argument in SA graph coloring proofs.",
    module: "Mathlib.Combinatorics.SimpleGraph.Coloring",
  },
  {
    theorem: "Nat.add_comm",
    signature: "theorem Nat.add_comm (n m : ℕ) : n + m = m + n",
    docstring: "Natural number addition is commutative. Foundational lemma relied on by virtually all arithmetic proofs.",
    module: "Mathlib.Data.Nat.Basic",
  },
  {
    theorem: "Nat.choose_symm",
    signature: "theorem Nat.choose_symm {n k : ℕ} (hk : k ≤ n) : n.choose (n - k) = n.choose k",
    docstring: "Binomial coefficients are symmetric: C(n,k) = C(n,n-k). Used in probabilistic method calculations for Ramsey upper bounds.",
    module: "Mathlib.Data.Nat.Choose.Basic",
  },
  {
    theorem: "Finset.sum_le_sum",
    signature: "theorem Finset.sum_le_sum {α : Type*} {s : Finset α} {f g : α → ℕ} (h : ∀ i ∈ s, f i ≤ g i) : ∑ i in s, f i ≤ ∑ i in s, g i",
    docstring: "Pointwise domination implies sum domination over a Finset. Used in density-based flag algebra upper bound arguments for Ramsey numbers.",
    module: "Mathlib.Algebra.BigOperators.Order",
  },
];

// ── Main ───────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════");
console.log("  📐 PERQED — Mathlib Premise Seeding");
console.log("═══════════════════════════════════════════════");
console.log(`  Theorems: ${SEED_THEOREMS.length}`);
console.log(`  DB Path:  ${DB_PATH}`);
console.log("═══════════════════════════════════════════════\n");

const librarian = new MathlibLibrarian({ dbPath: DB_PATH });
const { ingested, skipped } = await librarian.ingest(SEED_THEOREMS);

console.log("\n═══════════════════════════════════════════════");
console.log(`  ✅ Seeding complete`);
console.log(`     Premises ingested: ${ingested}`);
console.log(`     Embed failures:    ${skipped}`);
console.log("═══════════════════════════════════════════════\n");
