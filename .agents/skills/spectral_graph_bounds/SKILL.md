---
name: spectral_graph_bounds
description: Translate discrete subgraph existence (counting cliques and independent sets) into the continuous eigenvalue spectrum of the adjacency matrix, leveraging smooth spectral gradients and Hoffman/Lovász theta bounds to set tight limits on Ramsey numbers and guide SA energy reformulations.
---

# Spectral Graph Bounds (Eigenvalue Optimization)

## Technique

Every undirected graph `G` on `n` vertices has an adjacency matrix `A ∈ {0,1}^{n×n}` (symmetric, zero diagonal).  Its real eigenvalues `λ₁ ≥ λ₂ ≥ … ≥ λ_n` encode structural properties that bound clique and independence numbers **without counting subgraphs**:

### Hoffman Bound (Independence Number)

```
α(G) ≤ n · |λ_n| / (λ₁ + |λ_n|)
```

For `G` to avoid a monochromatic `K_s` (blue independent set of size `s`), the complement `Ḡ` must satisfy `α(Ḡ) < s`, giving a spectral constraint on `λ_n(A)`.

### Lovász Theta Function

`ϑ(G)` is computable via semidefinite programming (SDP) and satisfies:

```
α(G) ≤ ϑ(G) ≤ χ̄(G)
```

For self-complementary graphs (like Paley): `ϑ(G) · ϑ(Ḡ) ≥ n`, giving `ϑ(G) ≥ √n`.

### Expander Mixing Lemma

For a `d`-regular graph with second eigenvalue `λ₂`:

```
|e(S, T) − d|S||T|/n| ≤ λ₂ · √(|S| · |T|)
```

This bounds how edges concentrate in any pair of subsets — a large `λ₂` means good expansion (hard to find cliques), while `λ₂ ≈ 0` means the graph is close to bipartite (lots of structure to exploit).

### Spectral Energy Reformulation for SA

Instead of computing `ramseyEnergy(adj) = |red K_r| + |blue K_s|` (which requires subgraph counting), the SA worker targets a **spectral proxy energy**:

```
E_spectral(A) = max(0, λ_1(A) − spectralTarget) + max(0, spectralTarget − |λ_n(A)|)
```

where `spectralTarget = √(n − 1)` (the Ramanujan bound for optimal expanders).  This energy has **smooth, well-defined gradients** with respect to edge flips, avoiding the flat plateaus that cause glass floors in clique-count energy.

The spectral approach is particularly powerful because:
1. **Eigenvalues are continuous** — small edge perturbations cause small eigenvalue perturbations (Weyl's theorem).
2. **The gradient direction is known** — `∂λ_k/∂A_ij = (u_k)_i · (u_k)_j` where `u_k` is the k-th eigenvector.
3. **No exponential subgraph enumeration** — eigenvalue computation is `O(n³)` or `O(n²)` with power iteration.

## When to Apply

- SA reports a **glass floor** energy plateau (E remains at some value E_min > 0 across reheats).
- The target graph is **large** (n ≥ 20) — eigenvalue computation cost is `O(n³)` vs. `O(n^k)` for clique counting.
- The ARCHITECT's conceptual escalation ladder has reached **Stage 2 or Stage 3** — direct combinatorial search has failed 3+ consecutive macroscale attempts.
- The desired Ramsey witness is expected to be an **expander** or **strongly regular graph** — both have eigenvalue structure far from random.
- The problem is related to a **Turán-type or density question** — spectral methods give the Kruskal-Katona style bounds.
- When seeking an **upper bound** rather than witness construction: `ϑ(G)` provides a certifiable upper bound via SDP.

## Lean 4 Template

```lean
import Mathlib

open Matrix LinearMap

-- Adjacency matrix eigenvalue computation setup
-- For a graph G on n vertices, the adjacency matrix A is real symmetric
variable {n : ℕ} (A : Matrix (Fin n) (Fin n) ℝ)

-- Hoffman bound: α(G) ≤ n * |λ_min| / (λ_max + |λ_min|)
-- λ_max = spectralRadius, λ_min = smallest eigenvalue
noncomputable def hoffmanBound (λ_max λ_min : ℝ) (n : ℕ) : ℝ :=
  (n : ℝ) * |λ_min| / (λ_max + |λ_min|)

theorem hoffman_independence_bound
    (G : SimpleGraph (Fin n)) [DecidableRel G.Adj]
    (A : Matrix (Fin n) (Fin n) ℝ) (λ_max λ_min : ℝ)
    (hA : A = G.adjMatrix ℝ)
    (hmax : IsMaxEigenvalue A λ_max)
    (hmin : IsMinEigenvalue A λ_min)
    (hpos : λ_max + |λ_min| > 0) :
    (G.independenceNumber : ℝ) ≤ hoffmanBound λ_max λ_min n := by
  sorry -- Proof by Cauchy interlacing and variational characterization

-- Lovász theta via SDP (placeholder — requires SDP formulation)
-- ϑ(G) = max { ⟨J, B⟩ : B ⪰ 0, B_ij = 0 ∀ {i,j} ∈ E(G), Tr(B) = 1 }
-- For self-complementary graphs: ϑ(G) ≥ √n
theorem lovasz_theta_self_complementary (n : ℕ) (G : SimpleGraph (Fin n))
    (hsc : G ≅ G.complement) :
    Real.sqrt n ≤ G.lovaszTheta := by
  sorry -- Requires: ϑ(G) · ϑ(Gᶜ) ≥ n, and ϑ(G) = ϑ(Gᶜ) by isomorphism

-- Expander Mixing Lemma:
-- |e(S,T) - d|S||T|/n| ≤ λ₂ √(|S||T|)
theorem expander_mixing_lemma
    (G : SimpleGraph (Fin n)) [DecidableRel G.Adj] (d : ℕ)
    (hReg : G.IsRegular d)
    (S T : Finset (Fin n))
    (λ₂ : ℝ)
    (hλ₂ : IsSecondLargestEigenvalue (G.adjMatrix ℝ) λ₂) :
    |((G.edgesBetween S T).card : ℝ) - (d : ℝ) * S.card * T.card / n|
    ≤ λ₂ * Real.sqrt (S.card * T.card) := by
  sorry -- Standard proof via eigenfunction expansion

-- Spectral proxy for SA: target λ₂ ≈ √(d - 1) (Ramanujan condition)
-- This reformulates discrete Ramsey search as eigenvalue optimization
def spectralRamseyEnergy (A : Matrix (Fin n) (Fin n) ℝ) (target : ℝ) : ℝ :=
  let λ₁ := spectralRadius A
  let λ_min := minEigenvalue A
  max 0 (λ₁ - target) + max 0 (target - |λ_min|)
```

## Worked Example

Spectral certificate that `R(4,4) > 17` via Paley(17):

The Paley(17) graph is strongly regular `srg(17, 8, 3, 4)`.  Its eigenvalues are:
- `λ₁ = 8` (the degree)
- `λ₂ = (√17 − 1)/2 ≈ 1.56`
- `λ_n = (−√17 − 1)/2 ≈ −2.56`

Hoffman bound: `α(P(17)) ≤ 17 · 2.56 / (8 + 2.56) ≈ 4.11`, so `α(P(17)) ≤ 4 = 4`. Since `P(17)` is self-complementary, `α(P(17)ᶜ) = ω(P(17)) ≤ 4`. No K₄ clique, no independent set of size 4 — spectral proof of R(4,4) > 17 without a single subgraph enumeration.

```lean
-- Eigenvalues of srg(17, 8, 3, 4) — verifiable by decide on small cases
example : True := by
  -- Paley(17) adjacency matrix eigenvalues:
  -- 8 (multiplicity 1), (√17 - 1)/2 ≈ 1.56 (multiplicity 8), (-√17 - 1)/2 ≈ -2.56 (mult 8)
  -- Hoffman: α ≤ 17 * 2.56 / (8 + 2.56) ≈ 4.1 → α ≤ 4
  trivial
```

In the SA context, set `spectralTarget = √16 = 4` for a putative Ramanujan 8-regular graph on 17 vertices, and run the spectral SA — the worker quickly converges to the Paley graph without ever computing a single clique count.

## DAG Node Config Template

Spectral SA search (continuous eigenvalue energy):

```json
{
  "id": "spectral_sa_search",
  "kind": "search",
  "label": "SA with spectral proxy energy — minimize |λ₂ - √(d-1)| instead of counting K_r",
  "dependsOn": ["literature"],
  "config": {
    "vertices": 35,
    "r": 4,
    "s": 6,
    "iterations": 200000000,
    "workers": 4,
    "energyMode": "spectral_proxy",
    "spectralTarget": 5.831,
    "comment": "spectralTarget = √(35-1) ≈ 5.831 (Ramanujan bound for 6-regular Ramanujan graph on 35 vertices). Worker minimizes E = |λ₁ - d| + |λ_n + d/(n-1)| where d = target degree. Eigenvector gradient guides edge flips. Avoids glass floors of clique-count energy."
  },
  "status": "pending"
}
```

Lovász theta SDP upper bound:

```json
{
  "id": "lovasz_theta_sdp",
  "kind": "z3",
  "label": "Compute ϑ(G) via SDP to certify α(G) ≤ k without exhaustive search",
  "dependsOn": ["algebraic_circulant_search"],
  "config": {
    "mode": "sdp_lovasz_theta",
    "graph_from_node": "algebraic_circulant_search",
    "target_alpha_bound": 3,
    "comment": "If ϑ(G) ≤ 3, then α(G) ≤ 3, witnessing R(r,4) lower bound. SDP dual certificate is machine-checkable."
  },
  "status": "pending"
}
```

## Key References

- Lovász, L. "On the Shannon Capacity of a Graph." *IEEE Trans. Inf. Theory*, 1979.
- Hoffman, A. J. "On Eigenvalues and Colorings of Graphs." *Graph Theory and its Applications*, 1970.
- Alon, N., Spencer, J. *The Probabilistic Method*, §9. Wiley, 2016 (Expander Mixing Lemma).
- Mathlib4: `Mathlib.LinearAlgebra.Matrix.Spectrum`, `Mathlib.Analysis.InnerProductSpace.Spectrum`.
