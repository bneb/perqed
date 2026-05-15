# Perqed Architecture: Hub and Spoke Model

## Overview
Perqed is a neuro-symbolic research lab organized around a **Hub-and-Spoke** model. This architecture separates stable automation tools and verified knowledge from the exploratory investigation of unsolved mathematics.

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
- **Isolation**: Each workspace is a self-contained research project.
- **Continuity Metadata (The "Four Truths")**: Every workspace must maintain these deterministic files to support project resumption:
  1. `OBJECTIVE.md`: The ultimate mathematical goal or conjecture.
  2. `STATE_OF_PLAY.md`: A high-level summary of the current mathematical frontier—what has been proven, what has been ruled out, and where the current "vice" is located.
  3. `TASKS.md`: A prioritized list of immediate next steps, lemmas to prove, or empirical probes to run.
  4. `LAB_LOG.md`: An append-only ledger of every execution attempt, including code, output, and failure analysis.
- **Version Control (Jujutsu)**: Researchers are encouraged to use **Jujutsu (jj)** for mathematical exploration. It provides automatic commits and non-linear history tracking.
- **Promotion Workflow**: Once a proof is finalized and verified in a workspace, it is refactored into a clean, reusable module and moved to the `library/` hub.


## 3. Trusted Substrates: The Trytet Engine

- **Overview**: Perqed uses the **Trytet Engine** (Rust-based Wasm substrate) for sandboxed empirical investigation.
- **Integration**: The engine is embedded in `.bin/tet` and managed via `src/execution/`.
- **Automatic Updates**: Running `perqed` will automatically attempt to rebuild the Trytet core if the sibling repository `../trytet` is found.

## 4. Trust Boundaries & Security

- **Trust Base**: The Lean kernel and the `library/` directory represent the trusted core. Everything in `workspaces/` is considered untrusted/experimental.
- **Data Locality**: To ensure portability, agents must prioritize writing empirical data (like LanceDB tables or local JSON logs) to the active workspace directory, not the root.
- **Engine Integrity**: Core engine changes must be verified against `tests/` to ensure that refactoring doesn't break the ability to process existing workspaces.
