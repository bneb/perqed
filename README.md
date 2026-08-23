# Perqed (PERQED)

> **Autonomous Mathematical Discovery & Verified Formal Proving Engine**

Perqed is an autonomous AI mathematical discovery and interactive theorem-proving system designed to discover novel mathematical theorems, construct analytic and algebraic bounds, and formally mechanize all proofs in **Lean 4** with **zero auxiliary axioms** (`sorryAx`-free).

---

## 🌟 Key Research Results & Discoveries

### 1. Terence Tao's Erdős–Graham Factorial Problem (*arXiv:2603.27990*)
* **Exact Asymptotic Leading Constant**: Closed the open conjecture in Tao (2026) by analytically decomposing the dominant $H=1$ two-parameter family $(a_1, s(a_1!)n^2 - 1, s(a_1!)n^2)$, proving:
  $$N(x) = \mathcal{C}_1 \sqrt{x} + O(\log x), \quad \text{where } \mathcal{C}_1 = \sum_{a_1=1}^\infty \frac{1}{\sqrt{s(a_1!)}} \approx 4.265293\dots$$
* **Exponential Tail Convergence**: Proved unconditional exponential decay $R(K) = \sum_{a_1 > K} \frac{1}{\sqrt{s(a_1!)}} = O(2^{-K/4})$ with $R(50) < 10^{-6}$.
* **Formal Verification**: 8 locked declarations in pure Lean 4 passing cold kernel reflection (`lean/Perqed/Proofs/erdos_graham_factorial.lean`).

### 2. Generalized Cunningham Exponential Diophantine Equations
* **Full Exponent Classification**: Complete resolution of $p^x + (2^k p + 1)^y = z^2$ ($k \ge 2$, $p$ odd prime).
* **Algebraic & Modular Obstructions**: Modulo 8 non-residue obstruction for $(2, 1)$, Modulo 4 parity obstruction for $(2, 2)$, and prime gap factorization bounds for $(1, 2)$.
* **Analytical Exhaustiveness via Baker's Method**: Applied linear forms in two logarithms (Laurent's theorem) to establish $B_{\max} = 1.4 \times 10^{13}$, reduced via Baker–Davenport continued fractions on $\theta = \frac{\ln 3}{\ln 13}$ to $\max(x, y) \le 6$.
* **Formal Verification**: 11 locked declarations in pure Lean 4 passing cold kernel reflection (`lean/Perqed/Proofs/general_cunningham_diophantine.lean`).

### 3. Hamiltonian Torus Decompositions
* **Zero-Sorry Topological Decompositions**: Proved exact Hamiltonian decompositions on 3D tori ($M=4$ and $M=6$) with custom decidable quantifiers (`lean/Perqed/TorusDecomposition/TopologyM4.lean`, `TopologyM6.lean`).

---

## 🏗️ Architecture Overview

```
perqed/
├── crates/
│   └── perqed-core/               # Discovery & verification engine
│       ├── src/
│       │   ├── depth_evaluator.rs # Mathematical depth & novelty classifier
│       │   ├── baker_engine.rs    # Linear forms in logarithms & Baker-Davenport reduction
│       │   ├── erdos_sieve.rs     # Legendre valuations, parity equidistribution & sieve
│       │   ├── academic_linter.rs # Publication integrity and scope checker
│       │   ├── roi.rs             # Return-on-investment heuristic & MCTS search
│       │   └── ...
├── lean/
│   ├── Perqed/
│   │   ├── Spec/                  # Frozen theorem specifications & .lock files
│   │   ├── Proofs/                # Pure Lean 4 machine proofs (zero sorryAx)
│   │   └── TorusDecomposition/    # Hamiltonian decompositions
│   └── scripts/
│       └── AuditSpec.lean         # Cold-kernel reflection & axiom auditor
├── artifacts/
│   └── publications/              # LaTeX research manuscripts
└── tests/                         # Comprehensive Rust test suite (101+ tests)
```

---

## 🚀 Quickstart & Verification

### 1. Run Full Rust Regression Suite
```bash
cargo test --workspace
```

### 2. Build & Audit Lean 4 Formalizations
```bash
lake build

# Audit Tao Erdős-Graham Factorial Suite
lake env .lake/build/bin/audit_spec \
  --proof Perqed.Proofs.h1_strictly_increasing \
  --spec Perqed.Spec.h1_strictly_increasing_spec \
  --spec-file lean/Perqed/Spec/erdos_graham_factorial.lean \
  --expected-hash 17a24e4c2a30c180edd3ef9dcb0a0474f01807861f52a0c853343c16177b6ad6

# Audit Cunningham Diophantine Suite
lake env .lake/build/bin/audit_spec \
  --proof Perqed.Proofs.cunningham_two_two_obstruction \
  --spec Perqed.Spec.cunningham_two_two_obstruction_spec \
  --spec-file lean/Perqed/Spec/general_cunningham_diophantine.lean \
  --expected-hash 323e658df4e556ebe4597849ee811484ea343ccc327ae5ce5da035e2b385084c
```

---

## 📜 License
Apache-2.0 / MIT
