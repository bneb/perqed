# Torus Decomposition

Machine-checked proofs of the *m*=4 and *m*=6 Directed Hamiltonian Torus Decompositions.

## Verifying the Proofs

The only dependency is [Lean 4](https://lean-lang.org). No Mathlib, no external libraries.

```bash
# Install Lean 4 (if not already installed)
curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y

# Verify the m=4 proof (~5 seconds)
lake env lean lean/TorusTopologyM4.lean

# Verify the m=6 proof (~60 seconds on Apple M4)
lake env lean lean/TorusTopologyM6.lean
```

No output means success — the Lean kernel verified every theorem. The witnesses are hardcoded in the `.lean` files; you do not need to run the search engine.

## Reproducing the Search

The SA engine that *found* the witnesses requires [Bun](https://bun.sh). The search is stochastic (unseeded PRNG), so you will likely find a *different* valid witness, not the same one.

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# From the repo root:
bun install

# Hunt for an m=4 witness (~3-30 seconds)
bun run projects/torus-decomposition/src/hunt_fast.ts 4 20 2000000

# Hunt for an m=6 witness (~60-300 seconds, may require multiple runs)
bun run projects/torus-decomposition/src/hunt_fast.ts 6 50 5000000
```

## Contents

```
torus-decomposition/
├── lean/
│   ├── TorusTopologyM4.lean     # Formally verified m=4 proof
│   ├── TorusTopologyM6.lean     # Formally verified m=6 proof
│   ├── TorusEvenGeneralized.lean # Generalized open conjecture framework for even m>=8
│   └── KnuthTorusM4.lean       # Earlier m=4 draft
├── paper/
│   └── torus_decomposition.tex  # LaTeX manuscript
├── src/
│   ├── state.ts                 # SA state (baseline, full recompute)
│   ├── state_fast.ts            # SA state (incremental, O(1) delta)
│   ├── hunt.ts                  # Baseline SA runner
│   ├── hunt_fast.ts             # Incremental SA runner
│   └── even_closed_form.ts      # Empirical verification script mapping Ho Boon Suan's construction for m>=8
└── data/
    ├── cycles_m4.json           # m=4 witness payload (64 elements)
    └── cycles_m6.json           # m=6 witness payload (216 elements)
```
