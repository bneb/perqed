import { expect, test, describe } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { InvariantValidator, InvariantViolationError } from "../src/search/invariant_validator";

describe("Dynamic Invariant Validator", () => {
  test("Passes when no constraints are provided", () => {
    const graph = new AdjacencyMatrix(5);
    expect(() => InvariantValidator.validate(graph)).not.toThrow();
  });

  test("Enforces exact_vertices constraint", () => {
    const graph = new AdjacencyMatrix(10);
    
    // Valid
    expect(() => InvariantValidator.validate(graph, { exact_vertices: 10 })).not.toThrow();

    // Invalid (Specification Gaming attempt)
    expect(() => InvariantValidator.validate(graph, { exact_vertices: 35 }))
      .toThrow(InvariantViolationError);
  });

  test("Enforces undirected constraint", () => {
    // Note: AdjacencyMatrix is structurally undirected by default in its addEdge method,
    // but the validator tests raw matrix asymmetry if the internal state was ever corrupted or spoofed.

    const graph = new AdjacencyMatrix(5);
    // Standard addition is symmetric
    graph.addEdge(1, 2);
    expect(() => InvariantValidator.validate(graph, { undirected: true })).not.toThrow();

    // Corrupt the matrix directly to simulate a directed edge
    (graph as any).data[(1 * graph.n) + 2] = 1;
    (graph as any).data[(2 * graph.n) + 1] = 0;
    
    expect(() => InvariantValidator.validate(graph, { undirected: true }))
      .toThrow(InvariantViolationError);
  });

  test("Enforces no_self_loops constraint", () => {
    const graph = new AdjacencyMatrix(5);
    
    // Valid
    expect(() => InvariantValidator.validate(graph, { no_self_loops: true })).not.toThrow();

    // Add a self-loop
    (graph as any).data[(2 * graph.n) + 2] = 1;

    // Invalid
    expect(() => InvariantValidator.validate(graph, { no_self_loops: true }))
      .toThrow(InvariantViolationError);
  });
});
