# Perqed Architecture: Hub and Spoke Model

## Overview
Perqed is a neuro-symbolic research lab organized around a **Hub-and-Spoke** model. This architecture separates stable automation tools and verified knowledge from the chaotic exploration of unsolved mathematics.

## 1. The Hub: Core Engine & Verified Library

### The Engine Hub (`src/`, `crates/`, `ml/`)
- **Responsibility**: Provides the "machinery" for research (LLM orchestration, MCTS search, SMT solvers, and literature RAG).
- **Statelessness**: The engine should ideally be stateless. It acts upon workspaces but does not store project-specific findings in its own source tree.
- **Entry Point**: `src/cli/perqed.ts` (compiled to the `perqed` binary).

### The Library Hub (`library/`)
- **Responsibility**: The cumulative repository of machine-verified mathematical knowledge.
- **The "Zero-Sorry" Mandate**: Files promoted to the library **must** be verified by the Lean kernel. They should contain no `sorry`, `admit`, or unchecked axioms.
- **Structure**: Organized by mathematical domain (e.g., `Perqed.Combinatorics`, `Perqed.NumberTheory`).

## 2. The Spokes: Experimental Workspaces (`workspaces/`)

- **Responsibility**: Isolated environments for attacking specific problems (e.g., `workspaces/erdos265`).
- **Isolation**: Each workspace is a self-contained research project. It should contain its own:
  - `RESEARCH_LOG.md`: A non-linear journal of attempts and failures.
  - `data/`: Local empirical findings (graph adjacency matrices, prime distributions).
  - `lakefile.lean`: A workspace-specific Lean configuration that may include "dirty" proofs (with `sorry`) during the exploration phase.
- **Promotion Workflow**: Once a proof is finalized and verified in a workspace, it is refactored into a clean, reusable module and moved to the `library/` hub.

## 3. Trust Boundaries & Security

- **Trust Base**: The Lean kernel and the `library/` directory represent the trusted core. Everything in `workspaces/` is considered untrusted/experimental.
- **Data Locality**: To ensure portability, agents must prioritize writing empirical data (like LanceDB tables or local JSON logs) to the active workspace directory, not the root.
- **Engine Integrity**: Core engine changes must be verified against `tests/` to ensure that refactoring doesn't break the ability to process existing workspaces.
