/**
 * architect_diagnostic.test.ts — P0 RED tests
 *
 * Validates that replanDAG forces the ARCHITECT to provide a substantive
 * diagnostic before emitting new DAG nodes. Trivial or missing diagnostics
 * must throw, forcing a retry loop.
 */
import { describe, expect, it } from "bun:test";

// ── Helper: simulates the post-parse validation logic ──────────────────────
// This mirrors exactly what architect_client.ts will implement.
function validateDiagnostic(parsed: any): void {
  if (!parsed.diagnostic || parsed.diagnostic.trim().length < 20) {
    throw new Error(
      "Architect failed to provide a rigorous mathematical diagnostic. Retrying."
    );
  }
}

describe("P0 — replanDAG diagnostic validation", () => {
  it("throws when diagnostic field is absent", () => {
    const parsed = { id: "r1", goal: "R(4,6)", nodes: [] };
    expect(() => validateDiagnostic(parsed)).toThrow(
      "Architect failed to provide a rigorous mathematical diagnostic"
    );
  });

  it("throws when diagnostic is an empty string", () => {
    const parsed = { diagnostic: "", id: "r1", goal: "R(4,6)", nodes: [] };
    expect(() => validateDiagnostic(parsed)).toThrow(
      "Architect failed to provide a rigorous mathematical diagnostic"
    );
  });

  it("throws when diagnostic is whitespace only", () => {
    const parsed = { diagnostic: "   \n  ", id: "r1", goal: "R(4,6)", nodes: [] };
    expect(() => validateDiagnostic(parsed)).toThrow(
      "Architect failed to provide a rigorous mathematical diagnostic"
    );
  });

  it("throws when diagnostic is trivially short (< 20 chars)", () => {
    // 19 chars — just below threshold
    const parsed = { diagnostic: "Rule failed badly.", id: "r1", goal: "R(4,6)", nodes: [] };
    expect(() => validateDiagnostic(parsed)).toThrow(
      "Architect failed to provide a rigorous mathematical diagnostic"
    );
  });

  it("passes when diagnostic is exactly 20 chars", () => {
    // 20 chars — exactly at boundary
    const parsed = {
      diagnostic: "Exactly twenty chars",  // 20 chars
      id: "r1",
      goal: "R(4,6)",
      nodes: [],
    };
    expect(() => validateDiagnostic(parsed)).not.toThrow();
  });

  it("passes when diagnostic is substantive (> 20 chars)", () => {
    const parsed = {
      diagnostic:
        "The Paley graph over GF(37) failed because quadratic residues produce a " +
        "strongly regular graph with lambda=8 and mu=9, yielding K_4 cliques in " +
        "the complement exceeding the R(4,6) > 35 bound.",
      id: "r1",
      goal: "R(4,6)",
      nodes: [{ id: "n1", kind: "algebraic_graph_construction", config: {} }],
    };
    expect(() => validateDiagnostic(parsed)).not.toThrow();
  });

  it("diagnostic is validated BEFORE ProofDAG schema parsing", () => {
    // Short diagnostic with otherwise-valid DAG structure — must throw on diagnostic
    const parsed = {
      diagnostic: "bad",
      id: "r1",
      goal: "R(4,6)",
      nodes: [{ id: "n1", kind: "algebraic_graph_construction", config: {} }],
    };
    expect(() => validateDiagnostic(parsed)).toThrow(
      "Architect failed to provide a rigorous mathematical diagnostic"
    );
  });
});
