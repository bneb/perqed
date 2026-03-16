/**
 * AnnealingSchedule — Reusable Temperature Schedule for Simulated Annealing
 *
 * Owns cooling, adaptive reheating (E^0.4), and exponential backoff.
 * Decoupled from the iteration loop so it can be used with both:
 *   - SimulatedAnnealing.run() (the generic IState<T> engine)
 *   - Custom hot loops with in-place tryMutation/acceptMutation patterns
 *
 * Usage:
 *   const schedule = new AnnealingSchedule({ initialTemp: 50, coolingRate: 0.999998, reheatWindow: 100_000 });
 *   for (let i = 0; i < ITERS; i++) {
 *     const accept = deltaE < 0 || Math.random() < schedule.acceptProbability(deltaE);
 *     if (accept && newEnergy < bestEnergy) schedule.recordImprovement(newEnergy);
 *     schedule.step();
 *   }
 */

export interface ScheduleConfig {
  /** Starting temperature. */
  initialTemp: number;
  /** Multiplicative cooling factor applied every step. */
  coolingRate: number;
  /**
   * Adaptive reheat: after this many steps without improvement,
   * temperature resets to max(1, bestEnergy^0.4).
   * The window doubles after each reheat (exponential backoff).
   * Set to undefined to disable.
   */
  reheatWindow?: number;
  /** Maximum iterations (caps the backoff window). */
  maxIterations?: number;
  /**
   * Custom reheat formula. Given the best energy, returns the new temperature.
   * Default: (e) => Math.max(1.0, Math.pow(e, 0.4))
   */
  reheatFormula?: (bestEnergy: number) => number;
  /** @deprecated Fixed reheat temperature (legacy). */
  legacyReheatTemp?: number;
  /** @deprecated Fixed reheat interval (legacy). */
  legacyReheatInterval?: number;
}

export class AnnealingSchedule {
  /** Current temperature. */
  temp: number;

  private readonly coolingRate: number;
  private readonly maxIterations: number;

  // Adaptive reheat state
  private readonly useAdaptiveReheat: boolean;
  private readonly initialReheatWindow: number;
  private readonly reheatFormula: (bestEnergy: number) => number;
  private currentReheatWindow: number;
  private itersSinceImprovement: number;
  private bestEnergy: number;

  // Legacy reheat state
  private readonly useLegacyReheat: boolean;
  private readonly legacyReheatTemp: number;
  private readonly legacyReheatInterval: number;

  constructor(config: ScheduleConfig) {
    this.temp = config.initialTemp;
    this.coolingRate = config.coolingRate;
    this.maxIterations = config.maxIterations ?? Infinity;

    this.useAdaptiveReheat = config.reheatWindow !== undefined;
    this.initialReheatWindow = config.reheatWindow ?? 100_000;
    this.currentReheatWindow = this.initialReheatWindow;
    this.itersSinceImprovement = 0;
    this.bestEnergy = Infinity;
    this.reheatFormula = config.reheatFormula ?? ((e) => Math.max(1.0, Math.pow(e, 0.4)));

    this.useLegacyReheat = !this.useAdaptiveReheat && config.legacyReheatTemp !== undefined;
    this.legacyReheatTemp = config.legacyReheatTemp ?? 0;
    this.legacyReheatInterval = config.legacyReheatInterval ?? 100_000;
  }

  /**
   * Metropolis-Hastings acceptance probability for a given energy delta.
   * Always accepts improvements (deltaE < 0). Probabilistically accepts
   * worsening moves based on current temperature.
   */
  acceptProbability(deltaE: number): number {
    if (deltaE < 0) return 1.0;
    if (this.temp <= 0) return 0.0;
    return Math.exp(-deltaE / this.temp);
  }

  /**
   * Call when a new global best energy is found.
   * Resets the stagnation counter and backoff window.
   */
  recordImprovement(newBestEnergy: number): void {
    this.bestEnergy = newBestEnergy;
    this.itersSinceImprovement = 0;
    if (this.useAdaptiveReheat) {
      this.currentReheatWindow = this.initialReheatWindow;
    }
  }

  /**
   * Advance one iteration: cool the temperature and check for reheat.
   * Call this once per iteration in your hot loop.
   */
  step(): void {
    this.temp *= this.coolingRate;
    this.itersSinceImprovement++;

    // Adaptive reheating: energy-proportional temperature with exponential backoff
    if (this.useAdaptiveReheat && this.itersSinceImprovement >= this.currentReheatWindow) {
      this.temp = this.reheatFormula(this.bestEnergy);
      this.itersSinceImprovement = 0;
      // Exponential backoff: wait longer before next reheat
      this.currentReheatWindow = Math.min(this.currentReheatWindow * 2, this.maxIterations);
    }
    // Legacy fixed reheating (backward compatibility)
    else if (this.useLegacyReheat && this.itersSinceImprovement >= this.legacyReheatInterval) {
      this.temp = this.legacyReheatTemp;
      this.itersSinceImprovement = 0;
    }
  }

  /**
   * Reset the schedule to its initial state.
   * Useful between restarts.
   */
  reset(): void {
    this.temp = this.temp; // caller should reconstruct or pass initialTemp
    this.itersSinceImprovement = 0;
    this.currentReheatWindow = this.initialReheatWindow;
    this.bestEnergy = Infinity;
  }
}
