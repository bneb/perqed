/**
 * SimulatedAnnealing — Generalized Metropolis-Hastings Engine
 *
 * A pure, domain-agnostic implementation of Simulated Annealing.
 * Only interacts with the IState<T> interface — zero knowledge of
 * graphs, cycles, or any specific mathematical structure.
 *
 * Uses AnnealingSchedule for temperature management, so the same
 * cooling/reheat logic is available to custom hot loops.
 */

import type { IState } from "./IState";
import { AnnealingSchedule } from "./AnnealingSchedule";

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
   * When the chain stagnates, temperature is set to max(1, bestEnergy^0.4).
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

    // Delegate temperature management to AnnealingSchedule
    const schedule = new AnnealingSchedule({
      initialTemp,
      coolingRate,
      reheatWindow: adaptiveReheatWindow,
      maxIterations,
      legacyReheatTemp: reheatTemp,
      legacyReheatInterval: reheatInterval,
    });

    let currentState = initialState;
    let currentEnergy = currentState.getEnergy();

    let globalBestState = currentState;
    let globalBestEnergy = currentEnergy;

    for (let i = 0; i < maxIterations; i++) {
      if (currentEnergy === 0) {
        return { bestState: currentState, bestEnergy: 0, iterations: i, foundZero: true };
      }

      const candidateState = currentState.mutate();
      if (!candidateState) {
        schedule.step();
        continue;
      }

      const candidateEnergy = candidateState.getEnergy();
      const deltaE = candidateEnergy - currentEnergy;

      // Metropolis-Hastings acceptance via schedule
      if (deltaE < 0 || Math.random() < schedule.acceptProbability(deltaE)) {
        currentState = candidateState;
        currentEnergy = candidateEnergy;

        if (currentEnergy < globalBestEnergy) {
          globalBestEnergy = currentEnergy;
          globalBestState = currentState;
          schedule.recordImprovement(globalBestEnergy);
          onImprovement?.(i, globalBestEnergy, schedule.temp);
        }
      }

      schedule.step();

      if (onProgress && i > 0 && i % progressInterval === 0) {
        onProgress(i, currentEnergy, globalBestEnergy, schedule.temp);
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
