/**
 * Sprint 23: IState — Generic Optimization Contract
 *
 * Decouples Simulated Annealing from domain logic.
 * Any discrete mathematical structure (graphs, SAT, Ramsey colorings)
 * can be optimized by implementing this interface.
 */

export interface IState<T> {
  /** Returns the underlying mathematical structure. */
  getPayload(): T;

  /** Heuristic cost function. Lower is better. 0 = perfect solution. */
  getEnergy(): number;

  /**
   * Returns a newly mutated IState, or null if the mutation was invalid.
   * MUST NOT mutate the current state in place (immutability guarantee).
   */
  mutate(): IState<T> | null;
}
