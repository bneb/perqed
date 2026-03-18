import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantViolationError";
  }
}

export class InvariantValidator {
  /**
   * Evaluates the given matrix against the high-level boundary constraints
   * parsed by the Formulator, immediately throwing if the LLM hallucinated
   * a degenerate solution (like a 4-vertex graph for R(4,6) >= 36).
   */
  static validate(
    graph: AdjacencyMatrix,
    constraints?: { exact_vertices?: number; undirected?: boolean; no_self_loops?: boolean }
  ): void {
    if (!constraints) return;

    if (constraints.exact_vertices !== undefined) {
      if (graph.n !== constraints.exact_vertices) {
        throw new InvariantViolationError(
          `Matrix dimension (${graph.n}) does not match required exact_vertices (${constraints.exact_vertices}).`
        );
      }
    }

    if (constraints.undirected) {
      for (let i = 0; i < graph.n; i++) {
        for (let j = 0; j < graph.n; j++) {
          if (graph.hasEdge(i, j) !== graph.hasEdge(j, i)) {
            throw new InvariantViolationError(`Matrix is directed (edge ${i}->${j} != ${j}->${i}), but constraint undirected=true.`);
          }
        }
      }
    }

    if (constraints.no_self_loops) {
      for (let i = 0; i < graph.n; i++) {
        if (graph.hasEdge(i, i)) {
          throw new InvariantViolationError(`Matrix contains a self-loop at vertex ${i}, but constraint no_self_loops=true.`);
        }
      }
    }
  }
}
