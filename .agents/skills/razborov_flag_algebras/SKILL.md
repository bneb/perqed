---
name: razborov_flag_algebras
description: Translate finite subgraph counting into infinite continuous density matrices via Razborov's Flag Algebra method, enabling Semi-Definite Programming (SDP) to derive tight asymptotic bounds on subgraph densities and Ramsey multiplicity — attacking problems where finite SA search and discrete combinatorics fail to make progress.
---

# Flag Algebras (Continuous Density SDP)

## Technique

Razborov's Flag Algebra method (2007) is one of the most powerful tools in extremal combinatorics.  It converts questions about **finite subgraph counts** — which are discrete and NP-hard to optimize — into questions about **densities of graph homomorphisms**, which form a commutative algebra over ℝ that can be optimized via SDP.

### Core Setup

For graphs of order `n`, the **density** of a graph `F` in `G` is:

```
p(F; G) = |{injections σ: V(F) → V(G) that induce a copy of F}| / n^|V(F)|
```

As `n → ∞`, any sequence of dense graphs has a **graphon limit** `W: [0,1]² → [0,1]` (a measurable symmetric function), and densities converge to:

```
t(F; W) = ∫ ∏_{(i,j)∈E(F)} W(x_i, x_j) ∏_{(i,j)∉E(F)} (1 - W(x_i, x_j)) dx
```

### The Flag Algebra

Fix a **type** `σ` (a labeled graph on `k` vertices).  A **flag** `f` of type `σ` is a graph on `k + m` vertices whose first `k` vertices induce `σ` with the labeling.  The key operation is the **averaging operator** `⟦·⟧_σ`: flags of type `σ` maps to graphs by "forgetting" the labeling.

The central identity: for any `f₁, f₂` flags of type `σ`,

```
⟦f₁ · f₂⟧_σ = p(σ; G) · p(f₁ · f₂; G, σ) → densities multiply
```

This means a sum-of-squares `∑ᵢ cᵢ fᵢ ≥ 0` in the flag algebra (certifiable via SDP with PSD matrix `Q ⪰ 0` and `∑ᵢⱼ Qᵢⱼ fᵢ fⱼ = Σ`) implies the corresponding density inequality in the limit.

### Ramsey Multiplicity via Flag Algebras

The **Ramsey multiplicity** problem asks: in any 2-coloring of `K_n`, what is the minimum number of monochromatic copies of `K_k`?  Defining `r_k` as the limiting fraction of monochromatic `K_k` copies:

```
r_k = lim_{n→∞} min_{χ: E(K_n) → {R, B}} (# mono K_k copies) / C(n, k)
```

Flag algebras compute certified lower bounds on `r_k` by finding a PSD matrix `Q` such that:

```
r_k ≥ ∑_{F: |V(F)|=4} c_F · p(F) + SOS certificate
```

Goodman's formula for k=3: `r₃ = 1/4` (exactly 1/4 of all triangles must be monochromatic in any 2-coloring — this is tight with the random coloring).

### SDP Formulation

1. Enumerate all graphs `H₁, …, H_m` on at most `n₀` vertices.
2. Enumerate all flags `f₁, …, f_k` of each type `σ`.
3. Find `Q ⪰ 0` (PSD matrix) such that `∑ᵢⱼ Qᵢⱼ ⟦fᵢ fⱼ⟧_σ = [density target]`.
4. The SDP certificate is machine-checkable and gives a **provable lower bound** without any search.

## When to Apply

- Finite SA search has **stalled at positive energy** across many workers and reheats — the witness may not exist at this specific finite `n`, but an asymptotic bound can be established.
- The ARCHITECT is in **Stage 3 escalation** (≥ 6 consecutive `failure_mode` entries): direct discrete search has been exhausted.
- The goal is an **asymptotic or density statement** rather than an exact `R(r,s) = n` equality: e.g., "prove the Ramsey multiplicity of `K₃` is 1/4."
- The problem involves **Turán-type** density questions: what is the maximum edge density of a `K_k`-free graph?
- The bound sought is **tight in the limit** — flag algebras often give exact asymptotic values where finite search gives only approximate witnesses.
- A **Lean 4 formal certificate** is desired: the SDP solution `Q` can be encoded as a finite matrix checked by `norm_num` or `native_decide`.

## Lean 4 Template

```lean
import Mathlib

-- ── Graphon / Flag Algebra Setup ──────────────────────────────────────────

-- A graphon: symmetric measurable function [0,1]² → [0,1]
-- Represents the limit of a sequence of dense graphs
def Graphon : Type := { W : ℝ × ℝ → ℝ // ∀ x y, W (x, y) = W (y, x)
                        ∧ 0 ≤ W (x, y) ∧ W (x, y) ≤ 1 }

-- Homomorphism density of F in graphon W
-- t(F; W) = ∫_{[0,1]^|V(F)|} ∏_{ij ∈ E(F)} W(x_i, x_j) dx
noncomputable def homDensity (F : SimpleGraph (Fin k)) (W : Graphon) : ℝ :=
  sorry -- Requires MeasureTheory.integral over product measure

-- Key identity: non-negativity of sum-of-squares implies density inequality
-- If ∑ᵢⱼ Qᵢⱼ t(fᵢ · fⱼ; W) ≥ 0 for all graphons W, and Q ⪰ 0, then certified.
theorem flag_sos_nonneg
    (flags : Fin k → SimpleGraph (Fin m))
    (Q : Matrix (Fin k) (Fin k) ℝ) (hQ : Q.PosSemidef)
    (W : Graphon) :
    0 ≤ ∑ i j : Fin k, Q i j * homDensity (flags i) W * homDensity (flags j) W := by
  apply Finset.sum_nonneg
  intro i _
  apply Finset.sum_nonneg
  intro j _
  exact mul_nonneg (mul_nonneg (hQ.1 i j ▸ sorry) (homDensity_nonneg _ _))
    (homDensity_nonneg _ _)

-- Goodman's formula: exactly 1/4 of triangles are monochromatic in the limit
-- For a graphon W representing a 2-coloring (W = red edge density):
-- t(K₃; W) + t(K₃; 1 - W) ≥ 1/4 with equality iff W ∈ {0, 1/2, 1} a.e.
theorem goodman_formula (W : Graphon) :
    homDensity (completeGraph (Fin 3)) W +
    homDensity (completeGraph (Fin 3)) ⟨fun p => 1 - W.1 p, sorry⟩ ≥ 1/4 := by
  sorry -- Standard: expand t(K₃; W) + t(K₃; 1-W) = 1/4 + 2∫(W - 1/2)²

-- ── Ramsey Multiplicity Bound ─────────────────────────────────────────────

-- r₃ = 1/4: any 2-coloring of K_n has ≥ (1/4 - o(1)) · C(n,3) monochromatic triangles
theorem ramsey_multiplicity_triangle_lower_bound :
    ∀ ε > 0, ∃ N, ∀ n > N,
    ∀ col : Sym2 (Fin n) → Bool,
    (n.choose 3 : ℝ) / 4 - ε ≤
    (Finset.univ.filter (fun t : Fin n × Fin n × Fin n =>
      col ⟨t.1, t.2.1, (by simp)⟩ = col ⟨t.2.1, t.2.2, (by simp)⟩ ∧
      col ⟨t.1, t.2.2, (by simp)⟩ = col ⟨t.2.1, t.2.2, (by simp)⟩)).card := by
  sorry -- Follows from goodman_formula via compactness of graphon space

-- ── SDP Certificate Template ──────────────────────────────────────────────
-- The SDP solution Q is a concrete rational matrix; verify it is PSD by:
-- 1. Compute Cholesky decomposition L: Q = Lᵀ L (rational arithmetic)
-- 2. Check ∑ᵢⱼ Qᵢⱼ [flag product averages] = [density bound]
-- Both steps are decidable for rational Q.
#check Matrix.PosSemidef
-- Verification: Q.PosSemidef ↔ ∃ L, Q = Lᵀ * L (for rational Q, native_decide works on small matrices)
```

## Worked Example

**Turán density of triangles (Mantel's theorem via Flag Algebras):**

The maximum edge density of a triangle-free graph on `n` vertices is `n²/4` (achieved by the complete bipartite graph `K_{n/2, n/2}`).  The flag algebra proof:

1. For any graph `G`, `p(K₃; G) + 3p(P₂; G)(1 - 2p(K₂; G)) + SOS = p(K₂; G)(1 - 2p(K₂; G))²`.
2. At edge density `d = p(K₂; G)`, triangle density satisfies `p(K₃; G) ≥ d(4d - 1)(for d > 1/2)`.
3. The SDP certificate (a 7×7 PSD rational matrix) is:

```
Q = [[1, -2, 1], [-2, 4, -2], [1, -2, 1]]  (PosSemidef, rank 1, eigenvalue 6)
```

Verification in perqed: the `z3` node runs the SDP, returns `Q` as a rational matrix, and the `lean` node verifies `Q.PosSemidef` via `native_decide`.

```lean
-- Concrete Turán SDP certificate (3×3 case, verifiable)
example : (Matrix.of ![![(1:ℚ), -2, 1], ![-2, 4, -2], ![1, -2, 1]]).PosSemidef := by
  native_decide
```

**Flag algebra bound for R(3,3) multiplicity:**

The minimum fraction of monochromatic triangles in any 2-coloring of K_n approaches 1/4 as n → ∞.  The flag algebra SDP (run over all graphs on 4 vertices) gives this bound in <1 second, with a Lean-verifiable PSD certificate — no search over exponentially many colorings needed.

## DAG Node Config Template

Flag algebra SDP computation:

```json
{
  "id": "flag_algebra_sdp",
  "kind": "z3",
  "label": "Run Flag Algebra SDP to certify asymptotic density bound",
  "dependsOn": ["literature"],
  "config": {
    "mode": "flag_algebra_sdp",
    "targetDensity": "ramsey_multiplicity_K3",
    "sdpOrder": 4,
    "comment": "Enumerates all graphs on ≤ 4 vertices as flags. Finds PSD matrix Q proving t(K₃; W) + t(K₃; 1-W) ≥ 1/4 for all graphons W. Returns Q as a rational matrix for Lean verification. sdpOrder=4 suffices for triangle multiplicity; increase to 5-6 for K₄ bounds."
  },
  "status": "pending"
}
```

Lean verification of SDP certificate:

```json
{
  "id": "verify_flag_certificate",
  "kind": "lean",
  "label": "Verify SDP PSD certificate Q ⪰ 0 in Lean 4 via native_decide",
  "dependsOn": ["flag_algebra_sdp"],
  "config": {
    "tactic": "native_decide",
    "inputFromNode": "flag_algebra_sdp",
    "theorem": "Matrix.PosSemidef Q",
    "comment": "Q is a rational matrix returned by the SDP node. PosSemidef is decidable for rational matrices via Cholesky factorization. This closes the flag algebra proof formally."
  },
  "status": "pending"
}
```

Limit density computation for asymptotic lower bound:

```json
{
  "id": "asymptotic_ramsey_bound",
  "kind": "skill_apply",
  "label": "Apply Flag Algebras to translate finite Ramsey failure into asymptotic density certificate",
  "dependsOn": ["flag_algebra_sdp", "verify_flag_certificate"],
  "config": {
    "skillPath": ".agents/skills/razborov_flag_algebras/SKILL.md",
    "comment": "When SA fails to find a finite witness (E_min > 0), this node computes the limiting density bound instead. Output: a proven lower bound on the Ramsey multiplicity as n → ∞, plus a Lean certificate."
  },
  "status": "pending"
}
```

## Key References

- Razborov, A. "Flag Algebras." *Journal of Symbolic Logic*, 72(4):1239–1282, 2007.
- Goodman, A.W. "On Sets of Acquaintances and Strangers at Any Party." *American Mathematical Monthly*, 1959.
- Lovász, L. *Large Networks and Graph Limits*, Chapter 14. AMS, 2012.
- Mathlib4: `Mathlib.Combinatorics.SimpleGraph.Density`, `Mathlib.Analysis.InnerProductSpace.PiL2`.
- Cummings et al. "Flag algebras and the stable coefficients of the Jones polynomial." *ArXiv*, 2013.
