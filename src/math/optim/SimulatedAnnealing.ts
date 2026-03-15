/**
 * Sprint 23: SimulatedAnnealing — Generalized Metropolis-Hastings Engine
 *
 * A pure, domain-agnostic implementation of Simulated Annealing.
 * Only interacts with the IState<T> interface — zero knowledge of
 * graphs, cycles, or any specific mathematical structure.
 */

import type { IState } from "./IState";

export interface AnnealingResult<T> {
  bestState: IState<T>;
  bestEnergy: number;
  iterations: number;
  foundZero: boolean;
}

export interface AnnealingConfig {
  maxIterations: number;
  initialTemp: number;
  coolingRate: number;
  /** Optional callback for logging energy improvements */
  onImprovement?: (iteration: number, energy: number, temp: number) => void;
  /** Optional callback for periodic progress updates */
  onProgress?: (iteration: number, currentEnergy: number, bestEnergy: number, temp: number) => void;
  /** Interval for onProgress callback (default: 50000) */
  progressInterval?: number;
  /**
   * Enable adaptive reheating with energy-proportional temperature.
   * When the chain stagnates, temperature is set to max(1, bestEnergy).
   * The stagnation window uses exponential backoff (doubles each reheat).
   * Set to the initial stagnation window size, or undefined to disable.
   */
  adaptiveReheatWindow?: number;
  /** @deprecated Use adaptiveReheatWindow instead. Fixed reheat temp. */
  reheatTemp?: number;
  /** @deprecated Use adaptiveReheatWindow instead. Fixed reheat interval. */
  reheatInterval?: number;
}

export class SimulatedAnnealing {
  /**
   * Run Simulated Annealing on any IState<T>.
   * Returns the best state found, or terminates early if energy reaches 0.
   */
  static run<T>(initialState: IState<T>, config: AnnealingConfig): AnnealingResult<T> {
    const {
      maxIterations,
      initialTemp,
      coolingRate,
      onImprovement,
      onProgress,
      progressInterval = 50_000,
      adaptiveReheatWindow,
      reheatTemp,
      reheatInterval = 100_000,
    } = config;

    let currentState = initialState;
    let currentEnergy = currentState.getEnergy();

    let globalBestState = currentState;
    let globalBestEnergy = currentEnergy;

    let temperature = initialTemp;
    let itersSinceImprovement = 0;
    let currentReheatWindow = adaptiveReheatWindow ?? reheatInterval;
    const useAdaptiveReheat = adaptiveReheatWindow !== undefined;
    const useLegacyReheat = !useAdaptiveReheat && reheatTemp !== undefined;

    for (let i = 0; i < maxIterations; i++) {
      if (currentEnergy === 0) {
        return { bestState: currentState, bestEnergy: 0, iterations: i, foundZero: true };
      }

      const candidateState = currentState.mutate();
      if (!candidateState) continue;

      const candidateEnergy = candidateState.getEnergy();
      const deltaE = candidateEnergy - currentEnergy;

      // Metropolis-Hastings acceptance criterion
      if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temperature)) {
        currentState = candidateState;
        currentEnergy = candidateEnergy;

        if (currentEnergy < globalBestEnergy) {
          globalBestEnergy = currentEnergy;
          globalBestState = currentState;
          itersSinceImprovement = 0;
          // Reset backoff window on genuine improvement
          if (useAdaptiveReheat) {
            currentReheatWindow = adaptiveReheatWindow!;
          }
          onImprovement?.(i, globalBestEnergy, temperature);
        }
      }

      temperature *= coolingRate;
      itersSinceImprovement++;

      // Adaptive reheating: energy-proportional temperature with exponential backoff
      if (useAdaptiveReheat && itersSinceImprovement >= currentReheatWindow) {
        // Reheat to E^(2/5): power-law scaling across energy landscape
        temperature = Math.max(1.0, Math.pow(globalBestEnergy, 0.4));
        itersSinceImprovement = 0;
        // Exponential backoff: wait longer before next reheat
        currentReheatWindow = Math.min(currentReheatWindow * 2, maxIterations);
      }
      // Legacy fixed reheating (backward compatibility)
      else if (useLegacyReheat && itersSinceImprovement >= reheatInterval) {
        temperature = reheatTemp!;
        itersSinceImprovement = 0;
      }

      if (onProgress && i > 0 && i % progressInterval === 0) {
        onProgress(i, currentEnergy, globalBestEnergy, temperature);
      }
    }

    return {
      bestState: globalBestState,
      bestEnergy: globalBestEnergy,
      iterations: maxIterations,
      foundZero: false,
    };
  }
}
