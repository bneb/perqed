# Perqed

> **An automated framework for mathematical exploration, heuristic search, and formal verification in Lean 4.**

Perqed is an experimental research system designed to assist in formulating conjectures, evaluating analytical and combinatorial bounds, and constructing machine-checked formal proofs in **Lean 4**. All formal declarations are verified against the cold Lean 4 kernel with zero auxiliary axioms (`sorryAx`-free).

---

## 🔬 Research Notes & Formal Case Studies

### 1. Erdős–Graham Factorial Products (*Tao, arXiv:2603.27990*)
* **Asymptotic Leading Term**: Studies the counting function $N(x) = \#\{(a_1, a_2, a_3) : a_1! a_2! a_3! = m^2, a_3 \le x\}$ based on the framework introduced by Terence Tao (March 2026).
* **Dominant $H=1$ Family**: Parameterizes the $H=1$ solution family $(a_1, s(a_1!)n^2 - 1, s(a_1!)n^2)$, yielding the leading constant:
  $$\mathcal{C}_1 = \sum_{a_1=1}^\infty \frac{1}{\sqrt{s(a_1!)}} \approx 4.265293\dots$$
* **Convergence**: Identifies exponential remainder decay $R(50) = \sum_{a_1 > 50} \frac{1}{\sqrt{s(a_1!)}} < 10^{-6}$.
* **Formal Verification**: 8 locked declarations formalizing the algebraic identities, strict sequence ordering, and unit interval lengths in pure Lean 4 (`lean/Perqed/Proofs/erdos_graham_factorial.lean`).

### 2. Generalized Cunningham Exponential Diophantine Equations
* **Exponent Analysis**: Examines $p^x + (2^k p + 1)^y = z^2$ for odd primes $p$ and steps $k \ge 2$, generalizing the setting of Panda (2024).
* **Obstructions**: Proves modulo 8 non-residue obstructions for $(x=2, y=1)$, modulo 4 parity obstructions for $(x=2, y=2)$, and algebraic prime gap bounds for $(x=1, y=2)$.
* **Analytical Reductions**: Uses linear forms in two logarithms (Laurent's theorem) to establish an initial height bound $\max(x, y) < 1.4 \times 10^{13}$, and applies Baker–Davenport continued fraction reductions on $\theta = \frac{\ln 3}{\ln 13}$ to reduce the search domain to $\max(x, y) \le 6$.
* **Formal Verification**: 11 locked declarations in pure Lean 4 (`lean/Perqed/Proofs/general_cunningham_diophantine.lean`).

### 3. Hamiltonian Torus Decompositions
* **Topological Decompositions**: Machine-checked Hamiltonian cycle decompositions on 3D tori ($M=4$ and $M=6$) with custom decidable universal quantifiers (`lean/Perqed/TorusDecomposition/TopologyM4.lean`, `TopologyM6.lean`).

---

## 🏗️ Repository Layout

```
perqed/
├── crates/
│   └── perqed-core/               # Heuristic search, sieves, and depth evaluation
│       ├── src/
│       │   ├── depth_evaluator.rs # Mathematical classification & scoring
│       │   ├── baker_engine.rs    # Linear forms in logarithms & continued fractions
│       │   ├── erdos_sieve.rs     # Legendre valuations & asymptotic counting
│       │   ├── academic_linter.rs # Integrity & scope checker
│       │   └── ...
├── lean/
│   ├── Perqed/
│   │   ├── Spec/                  # Frozen theorem specifications & .lock files
│   │   ├── Proofs/                # Pure Lean 4 machine proofs (zero sorryAx)
│   │   └── TorusDecomposition/    # Hamiltonian decompositions
│   └── scripts/
│       └── AuditSpec.lean         # Cold-kernel reflection & axiom auditor
├── artifacts/
│   └── publications/              # LaTeX manuscript drafts
├── website/                       # Static documentation site (perqed.com)
└── tests/                         # Workspace integration tests
```

---

## 🚀 Building and Verification

### Rust Core Suite
```bash
cargo test --workspace
```

### Lean 4 Proof Kernel Build & Spec Audit
```bash
lake build

# Audit Erdős-Graham Factorial Declarations
lake env .lake/build/bin/audit_spec \
  --proof Perqed.Proofs.h1_strictly_increasing \
  --spec Perqed.Spec.h1_strictly_increasing_spec \
  --spec-file lean/Perqed/Spec/erdos_graham_factorial.lean \
  --expected-hash 17a24e4c2a30c180edd3ef9dcb0a0474f01807861f52a0c853343c16177b6ad6

# Audit Cunningham Diophantine Declarations
lake env .lake/build/bin/audit_spec \
  --proof Perqed.Proofs.cunningham_two_two_obstruction \
  --spec Perqed.Spec.cunningham_two_two_obstruction_spec \
  --spec-file lean/Perqed/Spec/general_cunningham_diophantine.lean \
  --expected-hash 323e658df4e556ebe4597849ee811484ea343ccc327ae5ce5da035e2b385084c
```

---

## 📜 License
Apache-2.0 / MIT
