/**
 * Ramsey SA Worker — Simulated Annealing search for Ramsey witnesses.
 *
 * State:   AdjacencyMatrix (undirected, simple graph on n vertices)
 * Mutation: flip one random edge
 * Energy:  ramseyEnergy(adj, r, s) = (# red K_r) + (# blue K_s)
 * Goal:    E = 0  →  valid R(r,s) lower bound witness
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import {
  ramseyEnergy,
  ramseyEnergyDelta,
  ramseyEnergyDeltaBatch,
  flipEdge,
} from "../math/graph/RamseyEnergy";
import {
  getEdgesForDistance,
  buildCirculantGraph,
  extractDistanceColors,
} from "./symmetry";
import { ZobristHasher } from "./zobrist_hash";

import type { SearchTelemetry } from "./search_failure_digest";

export interface RamseySearchConfig {
  /** Number of vertices in the graph */
  n: number;
  /** Clique size (red) */
  r: number;
  /** Independent set size (blue) */
  s: number;
  /** Maximum SA iterations per worker */
  maxIterations: number;
  /** Initial temperature */
  initialTemp: number;
  /** Cooling rate (multiplied each step, e.g. 0.99999) */
  coolingRate: number;
  /** Optional: start from this graph instead of random */
  initialGraph?: AdjacencyMatrix;
  /**
   * Symmetry constraint for the search space.
   * - 'none' (default): unconstrained search on 2^C(n,2) graphs
   * - 'circulant': restrict to circulant graphs (2^floor(n/2) states)
   *
   * For R(4,6) on n=35: reduces space from 2^595 → 2^17.
   * The known Exoo (1989) witness IS a circulant graph.
   */
  /** Symmetry constraint */
  symmetry?: 'none' | 'circulant';
  /**
   * Tabu: set of 64-bit Zobrist hashes representing known-sterile energy
   * basins (glass floors). Stored as decimal strings for safe JSON transport
   * through worker thread boundaries (BigInt cannot be JSON-serialized).
   * The SA worker coerces these back to BigInt via BigInt(h) at startup.
   */
  tabuHashes?: string[];
  /**
   * Temperature to reheat to when a tabu basin is entered.
   * Default: 3.0 (aggressive reheat to force basin escape)
   */
  tabuPenaltyTemperature?: number;
  /**
   * Reheat patience: iterations without improvement before adaptive reheat fires.
   * Defaults to 10% of maxIterations.
   */
  minPatience?: number;
  /**
   * Energy threshold below which a sterile basin triggers the MicroSAT callback.
   * E.g. 15 means: if bestEnergy ≤ 15 when scatter fires, call onSterilBasin.
   * Default: disabled (undefined = never fires).
   */
  microSatThreshold?: number;
  /**
   * Called just before each scatter event when bestEnergy ≤ microSatThreshold.
   * Fire-and-forget: scatter proceeds immediately without waiting for the callback.
   * The callback receives a CLONE of bestAdj (safe to read after scatter).
   */
  onSterilBasin?: (bestAdj: AdjacencyMatrix, bestEnergy: number) => void;
}

export interface RamseySearchResult {
  /** Best energy found */
  bestEnergy: number;
  /** The witness graph (if E=0) */
  witness: AdjacencyMatrix | null;
  /** Best graph regardless of energy (for LNS repair when E>0) */
  bestAdj: AdjacencyMatrix;
  /** Total iterations performed */
  iterations: number;
  /** Iterations per second */
  ips: number;
  /** Full thermodynamic telemetry for diagnosis */
  telemetry: SearchTelemetry;
}

/**
 * Run a single SA worker searching for a Ramsey witness.
 *
 * Reheat strategy — Progressive Thermal Escalation Ladder:
 *   Each time patience is exhausted without escaping the basin,
 *   `localReheatCount` increments. This drives a two-stage response:
 *
 *   Stage 1 (reheats 1–3): SUPERCRITICAL REHEAT
 *     T = initialTemp * (1 + localReheatCount * 0.4)
 *     Intentionally spikes T above initialTemp to explore the basin wall.
 *
 *   Stage 2 (4th consecutive reheat): SCATTER (EJECTION SEAT)
 *     50% of edges are randomly flipped, teleporting to a new region of
 *     the 2^C(n,2) search space. T resets to initialTemp.
 *
 *   `localReheatCount` resets to 0 whenever a new bestEnergy is found,
 *   confirming basin escape.
 */
export function ramseySearch(
  config: RamseySearchConfig,
  onProgress?: (iter: number, energy: number, bestEnergy: number, temp: number) => void,
): RamseySearchResult {
  const { n, r, s, maxIterations, initialTemp, coolingRate } = config;
  const useCirculant = config.symmetry === 'circulant';
  // For circulant search, track distance colors (17 bits for N=35)
  let distanceColors: Map<number, number> | null = null;
  const maxDist = Math.floor(n / 2);
  // Adaptive reheat patience — configurable per worker (default: 10% of budget)
  const minPatience = config.minPatience ?? Math.max(100_000, Math.floor(maxIterations * 0.1));

  // Initialize: use seed graph, or random (circulant or unconstrained)
  let adj: AdjacencyMatrix;
  if (config.initialGraph) {
    adj = config.initialGraph.clone();
    if (useCirculant) {
      distanceColors = extractDistanceColors(adj, n);
    }
  } else if (useCirculant) {
    // Circulant init: assign random color (0=absent, 1=present) to each distance
    distanceColors = new Map<number, number>();
    for (let d = 1; d <= maxDist; d++) {
      distanceColors.set(d, Math.floor(Math.random() * 2));
    }
    adj = buildCirculantGraph(distanceColors, n);
  } else {
    adj = new AdjacencyMatrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < 0.5) adj.addEdge(i, j);
      }
    }
  }

  let energy = ramseyEnergy(adj, r, s);
  let bestEnergy = energy;
  let bestAdj = adj.clone();
  let temp = initialTemp;
  let staleCount = 0;
  let reheatCount = 0;
  // localReheatCount: consecutive failed escape attempts since last bestEnergy improvement.
  // Drives the Progressive Thermal Escalation Ladder (supercritical → scatter).
  let localReheatCount = 0;
  let tabuReheatCount = 0;
  // Cooldown: prevents dead-temp trigger from firing again immediately after a reheat.
  // After each reheat, dead-temp is suppressed for minPatience iterations.
  let reheatCooldown = 0;

  // ── Tabu Search setup ──────────────────────────────────────────────────
  // tabuHashes arrives as string[] (JSON-safe). Coerce to BigInt here, at
  // the worker boundary, so the hot inner loop only touches native BigInt.
  const tabuSet = config.tabuHashes && config.tabuHashes.length > 0
    ? new Set<bigint>(config.tabuHashes.map((h) => BigInt(h)))
    : null;
  const tabuPenaltyTemp = config.tabuPenaltyTemperature ?? 3.0;
  const hasher = tabuSet ? new ZobristHasher(n) : null;
  let graphHash: bigint = hasher ? hasher.computeInitial(adj) : 0n;
  // ─────────────────────────────────────────────────────────────────────

  // Trajectory tracking: 10 checkpoints at 10%, 20%, ..., 100%
  const checkpointInterval = Math.max(1, Math.floor(maxIterations / 10));
  const energyTrajectory: number[] = [];
  const temperatureTrajectory: number[] = [];

  const startTime = Date.now();

  for (let iter = 0; iter < maxIterations; iter++) {
    let delta: number;

    if (useCirculant && distanceColors) {
      // ── Circulant mutation: flip all N edges at a random distance ──
      const mutatedDist = Math.floor(Math.random() * maxDist) + 1;
      const affectedEdges = getEdgesForDistance(mutatedDist, n);

      // Batch delta: apply all flips, measure Δ, roll back
      delta = ramseyEnergyDeltaBatch(adj, affectedEdges, r, s);

      // Metropolis acceptance
      if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
        // ── Tabu check for circulant mutations ────────────────────────
        // For batch flips, compute the proposed hash by toggling all affected edges.
        let proposedHashCirculant = graphHash;
        if (hasher) {
          for (const [eu, ev] of affectedEdges) {
            proposedHashCirculant = hasher.toggleEdge(proposedHashCirculant, eu, ev);
          }
          if (tabuSet!.has(proposedHashCirculant)) {
            // Tabu basin — hard reject and reheat
            temp = tabuPenaltyTemp;
            tabuReheatCount++;
            reheatCooldown = Math.min(minPatience, Math.max(1_000_000, Math.floor(maxIterations / 100)));
            temp *= coolingRate;
            staleCount++;
            if (reheatCooldown > 0) reheatCooldown--;
            if ((iter + 1) % checkpointInterval === 0 && energyTrajectory.length < 10) {
              energyTrajectory.push(bestEnergy);
              temperatureTrajectory.push(temp);
            }
            if (onProgress && iter % 10000 === 0) onProgress(iter, energy, bestEnergy, temp);
            continue;
          }
        }
        // ─────────────────────────────────────────────────────────────
        // Accept: apply all flips permanently
        const oldColor = distanceColors.get(mutatedDist)!;
        const newColor = 1 - oldColor;
        distanceColors.set(mutatedDist, newColor);
        for (const [u, v] of affectedEdges) flipEdge(adj, u, v);
        energy += delta;
        if (hasher) graphHash = proposedHashCirculant;

        if (energy < bestEnergy) {
          bestEnergy = energy;
          bestAdj = adj.clone();
          staleCount = 0;
          localReheatCount = 0; // ← basin escaped; reset escalation ladder

          if (energy === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const ips = elapsed > 0 ? Math.round(iter / elapsed) : Infinity;
            while (energyTrajectory.length < 10) energyTrajectory.push(0);
            while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);
            return {
              bestEnergy: 0, witness: bestAdj, bestAdj, iterations: iter, ips,
              telemetry: {
                bestEnergy: 0, finalEnergy: 0, finalTemperature: temp,
                initialTemperature: initialTemp, totalIterations: iter,
                ips, wallTimeSeconds: elapsed, reheatCount,
                energyTrajectory, temperatureTrajectory,
              },
            };
          }
        }
      }
      // Reject: ramseyEnergyDeltaBatch already rolled back — nothing to do
    } else {
      // ── Standard unconstrained mutation: flip one random edge ──
      const u = Math.floor(Math.random() * n);
      let v = Math.floor(Math.random() * (n - 1));
      if (v >= u) v++;

      delta = ramseyEnergyDelta(adj, u, v, r, s);

      // ── Tabu check (O(1)) ────────────────────────────────────────────
      // If this mutation would land on a known glass floor, hard-reject it
      // and trigger an aggressive thermal reheat to force basin escape.
      if (hasher) {
        const proposedHash = hasher.toggleEdge(graphHash, u, v);
        if (tabuSet!.has(proposedHash)) {
          temp = tabuPenaltyTemp;
          tabuReheatCount++;
          reheatCooldown = Math.min(minPatience, Math.max(1_000_000, Math.floor(maxIterations / 100)));
          // Skip to next iteration (no cooling, no stale increment for tabu hit)
          temp *= coolingRate;
          staleCount++;
          if (reheatCooldown > 0) reheatCooldown--;
          if ((iter + 1) % checkpointInterval === 0 && energyTrajectory.length < 10) {
            energyTrajectory.push(bestEnergy);
            temperatureTrajectory.push(temp);
          }
          if (onProgress && iter % 10000 === 0) onProgress(iter, energy, bestEnergy, temp);
          continue;
        }
      }
      // ─────────────────────────────────────────────────────────────────

      // Metropolis acceptance
      if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
        flipEdge(adj, u, v);
        energy += delta;
        if (hasher) graphHash = hasher.toggleEdge(graphHash, u, v);

        if (energy < bestEnergy) {
          bestEnergy = energy;
          bestAdj = adj.clone();
          staleCount = 0;
          localReheatCount = 0; // ← basin escaped; reset escalation ladder

          if (energy === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const ips = elapsed > 0 ? Math.round(iter / elapsed) : Infinity;
            while (energyTrajectory.length < 10) energyTrajectory.push(0);
            while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);
            return {
              bestEnergy: 0, witness: bestAdj, bestAdj, iterations: iter, ips,
              telemetry: {
                bestEnergy: 0, finalEnergy: 0, finalTemperature: temp,
                initialTemperature: initialTemp, totalIterations: iter,
                ips, wallTimeSeconds: elapsed, reheatCount,
                energyTrajectory, temperatureTrajectory,
              },
            };
          }
        }
      }
    }

    // Cooling
    temp *= coolingRate;
    staleCount++;
    if (reheatCooldown > 0) reheatCooldown--;

    // ── Progressive Thermal Escalation Ladder ──────────────────────────────
    // Trigger 1 (patience): stuck long enough without improvement
    // Trigger 2 (dead temp): T is near-zero but energy is still high
    //   Dead-temp is suppressed for minPatience iters after each reheat
    //   to prevent the spike-crash rolling-boil loop on steep cooling rates.
    const tempRatio = temp / initialTemp;
    const DEAD_TEMP_FRAC = 0.005;  // T < 0.5% of T₀ → "cold dead"
    const tempIsDead = tempRatio < DEAD_TEMP_FRAC && reheatCooldown === 0;
    const isStale = staleCount >= minPatience;

    if (isStale || tempIsDead) {
      reheatCount++;
      localReheatCount++;

      const MAX_LOCAL_REHEATS = 4;
      const SCATTER_RATE = 0.50;
      const maxCooldown = Math.max(1_000_000, Math.floor(maxIterations / 100));

      if (localReheatCount >= MAX_LOCAL_REHEATS) {
        // ── STAGE 2: SCATTER (Ejection Seat) ────────────────────────────
        // Basin is a proven glass floor after MAX_LOCAL_REHEATS consecutive
        // failed escape attempts. Teleport to a new sector of the search
        // space by randomly flipping 50% of edges.
        console.log(`[SA] Basin sterile after ${MAX_LOCAL_REHEATS} reheats. SCATTERING to new coordinates. E=${energy}`);

        // ── MicroSAT hook: fire before scatter if energy is critically low ──
        // The callback receives a snapshot of bestAdj (not the current adj,
        // which is about to be scattered). It runs asynchronously — scatter
        // proceeds immediately so the SA loop stays hot.
        if (
          config.microSatThreshold !== undefined &&
          bestEnergy <= config.microSatThreshold &&
          config.onSterilBasin
        ) {
          config.onSterilBasin(bestAdj.clone(), bestEnergy);
        }
        adj.scatter(SCATTER_RATE);
        energy = ramseyEnergy(adj, r, s);

        // Re-anchor tracking to the new location so patience isn't immediately
        // exhausted again after landing.
        bestAdj = adj.clone();
        // Note: we do NOT update bestEnergy — we preserve the global best.
        staleCount = 0;
        localReheatCount = 0;

        // Recompute Zobrist hash for the teleported graph position
        if (hasher) graphHash = hasher.computeInitial(adj);

        // Full temperature reset to initial heat
        temp = initialTemp;
        reheatCooldown = Math.min(minPatience, maxCooldown);

        console.log(`[SA] Basin sterile after ${MAX_LOCAL_REHEATS} reheats. SCATTERING to new coordinates. E=${energy}`);

      } else {
        // ── STAGE 1: SUPERCRITICAL REHEAT ───────────────────────────────
        // Spike T intentionally above initialTemp. Each consecutive failed
        // escape attempt gets hotter:
        //   reheat 1: T = initialTemp * 1.4
        //   reheat 2: T = initialTemp * 1.8
        //   reheat 3: T = initialTemp * 2.2
        const escalationFactor = 1.0 + localReheatCount * 0.4;
        temp = initialTemp * escalationFactor;

        staleCount = 0;
        reheatCooldown = Math.min(minPatience, maxCooldown);

        console.log(`[SA] Reheat escalation ${localReheatCount}/${MAX_LOCAL_REHEATS}. T spiked to ${temp.toFixed(3)}`);
      }
    }
    // ── End Progressive Thermal Escalation Ladder ───────────────────────────

    // Trajectory checkpoint
    if ((iter + 1) % checkpointInterval === 0 && energyTrajectory.length < 10) {
      energyTrajectory.push(bestEnergy);
      temperatureTrajectory.push(temp);
    }

    // Progress callback
    if (onProgress && iter % 10000 === 0) {
      onProgress(iter, energy, bestEnergy, temp);
    }
  }

  // Fill trajectory if needed
  while (energyTrajectory.length < 10) energyTrajectory.push(bestEnergy);
  while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);

  const elapsed = (Date.now() - startTime) / 1000;
  const ips = elapsed > 0 ? Math.round(maxIterations / elapsed) : Infinity;

  return {
    bestEnergy,
    witness: bestEnergy === 0 ? bestAdj : null,
    bestAdj,
    iterations: maxIterations,
    ips,
    telemetry: {
      bestEnergy, finalEnergy: energy, finalTemperature: temp,
      initialTemperature: initialTemp, totalIterations: maxIterations,
      ips, wallTimeSeconds: elapsed, reheatCount,
      energyTrajectory, temperatureTrajectory,
    },
  };
}

/**
 * Export adjacency matrix as a flat boolean[][] for Lean codegen.
 */
export function adjToMatrix(adj: AdjacencyMatrix): boolean[][] {
  const n = adj.n;
  const result: boolean[][] = [];
  for (let i = 0; i < n; i++) {
    const row: boolean[] = [];
    for (let j = 0; j < n; j++) {
      row.push(adj.hasEdge(i, j));
    }
    result.push(row);
  }
  return result;
}
