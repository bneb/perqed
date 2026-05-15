# Perqed Architectural Red Team Audit

## High Severity: Trust Boundary Violations
- **Issue**: The `library/` directory was found to contain proofs with `sorry` statements (e.g., `library/Perqed/Erdos265/Main.lean`), violating the architectural mandate of a "pristine" core.
- **Remediation**: Establish a CI check (`lake build`) that blocks any PR if the library contains `sorry` or fails to compile.

## Medium Severity: Shared State Leakage
- **Issue**: Root-level `data/`, `lancedb/`, and `agency.json` are shared across all workspaces. This prevents true workspace isolation and makes results dependent on global state.
- **Remediation**: Refactor the engine to initialize these resources within the active workspace directory.

## Medium Severity: CLI-Engine Coupling
- **Issue**: `src/cli/perqed.ts` is a 2.5k line monolith that is tightly coupled with internal engine modules.
- **Remediation**: Extract CLI argument parsing, UI rendering, and orchestration into separate, testable modules in `src/cli/`.

## Low Severity: Environment Fragmentation
- **Issue**: Lean toolchains and Lake manifests exist at both the root and in `library/`, creating potential versioning conflicts for the agent.
- **Remediation**: The root should not be a Lean project. All formal math should be localized to either `library/` or a specific `workspaces/` project.

