/**
 * sieve_state.ts — IState implementation for sieve majorant SA search.
 *
 * State = 8 continuous hyperparameters defining a sieve weight function.
 * Mutations = Gaussian perturbation of one parameter.
 */
import type { IState } from "./optim/IState.ts";
import { sieveEnergy } from "./sieve_energy.ts";

export interface SieveParams {
  /** Sieve level R = rFrac * sqrt(N) */
  rFrac: number;
  /** Polynomial coefficients: P(t) = 1 - Σ coeffs[i] * t^(i+1) */
  coeffs: number[];
  /** Exponential smoothing cutoff */
  smoothCutoff: number;
}

const NUM_COEFFS = 6;
const PARAM_COUNT = NUM_COEFFS + 2; // coeffs + rFrac + smoothCutoff

export class SieveState implements IState<SieveParams> {
  private params: SieveParams;
  private cachedEnergy: number | null = null;
  private N: number;
  private Q: number;
  private gridSize: number;

  constructor(
    params: SieveParams,
    N: number,
    Q: number,
    gridSize: number
  ) {
    this.params = { ...params, coeffs: [...params.coeffs] };
    this.N = N;
    this.Q = Q;
    this.gridSize = gridSize;
  }

  getPayload(): SieveParams {
    return this.params;
  }

  getEnergy(): number {
    if (this.cachedEnergy !== null) return this.cachedEnergy;

    const R = this.params.rFrac * Math.sqrt(this.N);
    if (R < 2) {
      this.cachedEnergy = 1e10; // invalid
      return this.cachedEnergy;
    }

    this.cachedEnergy = sieveEnergy(
      this.N, R, this.params.coeffs, this.Q, this.gridSize
    );
    return this.cachedEnergy;
  }

  mutate(): SieveState | null {
    const newParams: SieveParams = {
      rFrac: this.params.rFrac,
      coeffs: [...this.params.coeffs],
      smoothCutoff: this.params.smoothCutoff,
    };

    // Pick a random parameter to perturb
    const idx = Math.floor(Math.random() * PARAM_COUNT);
    const perturbation = (Math.random() - 0.5) * 0.2; // ±0.1

    if (idx < NUM_COEFFS) {
      // Perturb a polynomial coefficient
      newParams.coeffs[idx]! += perturbation;
    } else if (idx === NUM_COEFFS) {
      // Perturb rFrac
      newParams.rFrac += perturbation * 0.1;
      newParams.rFrac = Math.max(0.01, Math.min(1.0, newParams.rFrac));
    } else {
      // Perturb smoothCutoff
      newParams.smoothCutoff += perturbation;
      newParams.smoothCutoff = Math.max(0.1, Math.min(10.0, newParams.smoothCutoff));
    }

    return new SieveState(newParams, this.N, this.Q, this.gridSize);
  }

  /** Create the standard Selberg sieve as initial state */
  static selbergDefault(N: number, Q: number, gridSize: number): SieveState {
    return new SieveState(
      {
        rFrac: 1.0 / Math.log(N),
        coeffs: [1.0, 0, 0, 0, 0, 0], // P(t) = 1 - t (linear Selberg)
        smoothCutoff: 1.0,
      },
      N, Q, gridSize
    );
  }

  /** Create a random initial state */
  static random(N: number, Q: number, gridSize: number): SieveState {
    const coeffs = Array.from({ length: NUM_COEFFS }, () =>
      (Math.random() - 0.5) * 2
    );
    // Normalize: P(1) should be near 0 (P(0)=1, P(1)≈0)
    const sumCoeffs = coeffs.reduce((a, b) => a + b, 0);
    coeffs[0]! += (1.0 - sumCoeffs); // adjust so P(1) ≈ 0

    return new SieveState(
      {
        rFrac: 0.05 + Math.random() * 0.5,
        coeffs,
        smoothCutoff: 0.5 + Math.random() * 3.0,
      },
      N, Q, gridSize
    );
  }
}
