---
name: double_counting
description: Prove a combinatorial identity by counting the elements of a single finite set in two different ways, equating the two expressions to obtain the desired equality.
---

# Double Counting

## Technique

Double counting (also: counting in two ways, Fubini for finite sets) establishes an algebraic identity by considering a bipartite relationship R ⊆ A × B. Counting the total number of "incidences" `|R|` by summing over the A-side gives one expression; summing over the B-side gives another. Equating them yields the identity.

Formally, if `f(a) = |{b : (a,b) ∈ R}|` and `g(b) = |{a : (a,b) ∈ R}|`, then `∑_{a ∈ A} f(a) = |R| = ∑_{b ∈ B} g(b)`. This is Lean's `Finset.sum_comm` or `Finset.card_biUnion`.

Double counting appears everywhere: the handshaking lemma (sum of degrees = 2|E|), binomial coefficient identities (Vandermonde convolution), and counting paths in bipartite graphs. In Ramsey theory, it relates the number of monochromatic edges to the total edge count.

## When to Apply

- The goal is an equality of two sums over different index sets.
- A bipartite incidence structure (vertex × edge, student × course) admits two natural summations.
- Binomial coefficient identities like `∑_k C(n,k) = 2^n` or Vandermonde `∑_k C(m,k)C(n,r-k) = C(m+n,r)`.
- The handshaking lemma or a Ramsey edge-counting identity is needed.
- The ARCHITECT's context shows a combinatorial equality that has two natural decompositions.

## Lean 4 Template

```lean
import Mathlib
open Finset BigOperators

-- Double counting via Finset.sum_comm
theorem double_count {α β : Type*} [DecidableEq α] [DecidableEq β]
    (s : Finset α) (t : Finset β) (R : α → β → Prop) [∀ a b, Decidable (R a b)]
    (f : α → ℕ) (g : β → ℕ)
    (hf : ∀ a ∈ s, f a = (t.filter (R a)).card)
    (hg : ∀ b ∈ t, g b = (s.filter (fun a => R a b)).card) :
    ∑ a ∈ s, f a = ∑ b ∈ t, g b := by
  simp only [hf, hg]
  rw [sum_comm]
  congr 1

-- Handshaking lemma: sum of degrees = 2 * |edges|
theorem handshaking {V : Type*} [Fintype V] [DecidableEq V]
    (G : SimpleGraph V) [DecidableRel G.Adj] :
    ∑ v : V, G.degree v = 2 * G.edgeFinset.card :=
  SimpleGraph.sum_degrees_eq_twice_card_edges G

-- Vandermonde convolution via double counting
theorem vandermonde (m n r : ℕ) :
    ∑ k ∈ range (r + 1), Nat.choose m k * Nat.choose n (r - k) = Nat.choose (m + n) r := by
  exact Nat.add_choose_eq m n r   -- mathlib4 has this

-- Generic sum_comm double counting template
theorem [IDENTITY] (s t : Finset ℕ) (w : ℕ → ℕ → ℕ) :
    ∑ a ∈ s, ∑ b ∈ t, w a b = ∑ b ∈ t, ∑ a ∈ s, w a b :=
  Finset.sum_comm
```

## Worked Example

Proving `∑ k ≤ n, k * C(n,k) = n * 2^(n-1)` by double counting:

```lean
import Mathlib
open Finset BigOperators

-- Count (element, k-subset containing it) pairs two ways:
-- LHS: for each k, k * C(n,k) pairs
-- RHS: for each element, 2^(n-1) subsets contain it
theorem sum_k_choose (n : ℕ) :
    ∑ k ∈ range (n + 1), k * n.choose k = n * 2 ^ (n - 1) := by
  induction n with
  | zero => simp
  | succ n ih =>
    simp [Finset.sum_range_succ, Nat.choose_succ_succ]
    ring_nf
    linarith
```

## DAG Node Config Template

```json
{
  "id": "apply_double_counting",
  "kind": "skill_apply",
  "label": "Count incidences in two ways to establish combinatorial identity",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/double_counting/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Algebra.BigOperators.Basic`, `Finset.sum_comm`, `SimpleGraph.sum_degrees_eq_twice_card_edges`.
- Aigner & Ziegler. *Proofs from THE BOOK*, Ch. 2 (counting in two ways).
- Stanley, Richard P. *Enumerative Combinatorics*, Vol. 1, Cambridge University Press.
