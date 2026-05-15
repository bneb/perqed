Formal Verification Scripts for:
Machine-Checked Proofs of the m=4 and m=6 Directed Hamiltonian Torus Decompositions

This directory contains the Lean 4 proof scripts that formally verify the
Hamiltonian decompositions for the m=4 and m=6 directed torus graphs.

Files:
  TorusTopologyM4.lean  --  Verifies the 64-vertex (4x4x4) decomposition.
  TorusTopologyM6.lean  --  Verifies the 216-vertex (6x6x6) decomposition.

Requirements:
  Lean 4 (no external libraries required; in particular, Mathlib is NOT needed).
  The proofs rely entirely on Lean's trusted kernel via the `decide` tactic.

Running the proofs:
  $ lean TorusTopologyM4.lean
  $ lean TorusTopologyM6.lean

  Or, if inside the repository with a lakefile:
  $ lake env lean TorusTopologyM4.lean
  $ lake env lean TorusTopologyM6.lean

Notes:
  - TorusTopologyM6.lean sets `maxHeartbeats 400000000` to give the kernel
    sufficient time for the 46,656 pairwise injectivity checks per color and
    the 216-step orbit verification. Compilation takes approximately 60 seconds
    on modern hardware (tested on Apple M4).
  - The witnesses encoded in these files are the exact arrays found by the
    Simulated Annealing search. The search is non-reproducible (unseeded RNG),
    but the verification is fully deterministic and reproducible.
  - Full source code for the search engine is available at:
    https://github.com/bneb/perqed
