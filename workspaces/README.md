# Perqed Workspaces

This directory contains experimental workspaces for specific mathematical problems. Each workspace is intended to be an isolated environment for non-linear exploration, automated search, and formalization.

## Active Workspaces

### [Erdős 265](erdos265/)
- **Problem**: Simultaneous rationality of Ahmes series $\sum 1/a_n$ and $\sum 1/(a_n-1)$.
- **Status**: Resolution proved in the affirmative. The core proofs have been promoted to the [Perqed Library](../../library/Perqed/Erdos265/).
- **Artifacts**: Search logs, draft formalizations, and counter-example probes.

### [Torus Decomposition](torus-decomposition/)
- **Problem**: Machine-checked proofs of directed Hamiltonian torus decompositions ($m=4, 6$).
- **Status**: Verified proofs promoted to the [Perqed Library](../../library/Perqed/TorusDecomposition/).
- **Artifacts**: Paper draft and supplementary Lean files.

## Workflow

1. **Initialize**: Create a new subdirectory for the problem.
2. **Explore**: Use the Perqed CLI to run automated searches or literature reviews.
3. **Formalize**: Draft Lean 4 proofs within the workspace.
4. **Promote**: Once a proof is verified and structured, refactor it into the top-level `library/` folder.
