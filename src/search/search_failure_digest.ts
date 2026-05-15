/**
 * Search Phase: FailureDigest — Deterministic Thermodynamic Diagnosis
 *
 * Pure function. No LLM calls. Captures the thermodynamic telemetry from
 * a failed SA search and produces a structured diagnosis that the
 * ARCHITECT can read to pivot the search strategy.
 *
 * Mirrors src/agents/failure_digest.ts but for the search phase.
 */

// ──────────────────────────────────────────────
// Telemetry (returned by the SA worker)
// ──────────────────────────────────────────────

export interface SearchTelemetry {
  /** Best energy achieved across the entire run */
  bestEnergy: number;
  /** Energy at the final iteration */
  finalEnergy: number;
  /** Temperature at the final iteration */
  finalTemperature: number;
  /** Temperature at the first iteration */
  initialTemperature: number;
  /** Total iterations completed */
  totalIterations: number;
  /** Iterations per second */
  ips: number;
  /** Wall-clock time in seconds */
  wallTimeSeconds: number;
  /** Number of times reheat was triggered */
  reheatCount: number;
  /** Best energy at 10%, 20%, ..., 100% of budget (10 checkpoints) */
  energyTrajectory: number[];
  /** Temperature at 10%, 20%, ..., 100% of budget (10 checkpoints) */
  temperatureTrajectory: number[];
}

// ──────────────────────────────────────────────
// Failure Modes
// ──────────────────────────────────────────────

export type SearchFailureMode =
  | "TEMPERATURE_NOT_COOLING"
  | "GLASS_FLOOR"
  | "INSUFFICIENT_BUDGET"
  | "REHEAT_TOO_AGGRESSIVE";

export interface SearchDiagnosis {
  failureMode: SearchFailureMode;
  recommendation: string;
  /** Supporting evidence for the diagnosis */
  evidence: string;
}

// ──────────────────────────────────────────────
// Diagnosis Engine (deterministic — no LLM)
// ──────────────────────────────────────────────

/**
 * Analyze SA telemetry and produce a deterministic diagnosis.
 *
 * Priority order (check in this sequence):
 *   1. TEMPERATURE_NOT_COOLING: T_final > 0.5 * T_initial
 *   2. REHEAT_TOO_AGGRESSIVE: reheatCount > totalIterations / 10000
 *   3. GLASS_FLOOR: best energy unchanged for last 60%+ of trajectory
 *   4. INSUFFICIENT_BUDGET: energy still declining at end of run
 */
export function diagnoseSearchFailure(tel: SearchTelemetry): SearchDiagnosis {
  const tRatio = tel.finalTemperature / tel.initialTemperature;

  // 1. Temperature never cooled — the cooling rate is broken
  if (tRatio > 0.5) {
    return {
      failureMode: "TEMPERATURE_NOT_COOLING",
      recommendation:
        "The cooling schedule is broken. The final temperature is " +
        `${(tRatio * 100).toFixed(0)}% of the initial temperature. ` +
        "Fix: set coolingRate = exp(ln(0.01 / T_init) / (0.8 * totalIterations)) " +
        "so that temperature reaches ~1% of initial by 80% of budget. " +
        "Also increase reheatAfter to at least totalIterations / 50.",
      evidence: `T_init=${tel.initialTemperature}, T_final=${tel.finalTemperature}, ratio=${tRatio.toFixed(3)}`,
    };
  }

  // 2. Reheat fires too often — prevents actual cooling
  const expectedReheats = tel.totalIterations / 50000; // reasonable
  if (tel.reheatCount > expectedReheats * 5) {
    return {
      failureMode: "REHEAT_TOO_AGGRESSIVE",
      recommendation:
        `Reheat fired ${tel.reheatCount} times (expected ~${Math.round(expectedReheats)}). ` +
        "The search never settles into basins. Increase reheatAfter by 10x or " +
        "use a geometric reheat decay (reheatTemp *= 0.95 each reheat).",
      evidence: `reheatCount=${tel.reheatCount}, expected≈${Math.round(expectedReheats)}`,
    };
  }

  // 3. Glass floor — energy stalled in the latter part of the trajectory
  const traj = tel.energyTrajectory;
  if (traj.length >= 5) {
    const lastBest = traj[traj.length - 1]!;
    // Find when the trajectory first reached the final best energy
    const stallPoint = traj.findIndex(e => e <= lastBest);
    const stallFraction = stallPoint >= 0 ? stallPoint / traj.length : 1;

    // If stalled for more than 60% of the run, it's a glass floor
    if (stallFraction <= 0.4 && lastBest > 0) {
      return {
        failureMode: "GLASS_FLOOR",
        recommendation:
          `Best energy hit E=${lastBest} at ${(stallFraction * 100).toFixed(0)}% of budget ` +
          `and never improved. The energy landscape has a deep local minimum. ` +
          "Try: (1) multi-worker island model with 10 workers + migration, " +
          "(2) structural seed (Paley graph, circulant), or " +
          "(3) hybrid SA + tabu local search.",
        evidence: `stall_point=${(stallFraction * 100).toFixed(0)}%, trajectory=[${traj.join(",")}]`,
      };
    }
  }

  // 4. Insufficient budget — energy was still declining
  if (traj.length >= 3) {
    const last3 = traj.slice(-3);
    const isDecreasing = last3[0]! > last3[1]! || last3[1]! > last3[2]!;
    if (isDecreasing) {
      return {
        failureMode: "INSUFFICIENT_BUDGET",
        recommendation:
          "Energy is still declining at the end of the run " +
          `(last 3 checkpoints: [${last3.join(",")}]). ` +
          "Increase sa_iterations by 5-10x. Current IPS of " +
          `${tel.ips.toLocaleString()} suggests ${(tel.totalIterations * 5 / tel.ips).toFixed(0)}s ` +
          "for a 5x budget increase.",
        evidence: `last_3_checkpoints=[${last3.join(",")}], still_declining=true`,
      };
    }
  }

  // Fallback: glass floor (default)
  return {
    failureMode: "GLASS_FLOOR",
    recommendation:
      `Best energy E=${tel.bestEnergy} but no clear decline pattern. ` +
      "Try multi-worker island model or structural seeding.",
    evidence: `bestEnergy=${tel.bestEnergy}, finalEnergy=${tel.finalEnergy}`,
  };
}

// ──────────────────────────────────────────────
// SearchFailureDigest Type
// ──────────────────────────────────────────────

export interface SearchFailureDigest {
  /** Problem parameters */
  n: number;
  r: number;
  s: number;
  /** Which attempt this is (1-indexed) */
  attemptNumber: number;
  /** Key metrics */
  bestEnergy: number;
  finalTemperature: number;
  ips: number;
  totalIterations: number;
  wallTimeSeconds: number;
  reheatCount: number;
  /** Energy trajectory (10 checkpoints) */
  energyTrajectory: number[];
  /** Deterministic diagnosis */
  diagnosis: SearchDiagnosis;
}

interface DigestContext {
  n: number;
  r: number;
  s: number;
  attemptNumber: number;
}

// ──────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────

export function buildSearchFailureDigest(
  tel: SearchTelemetry,
  ctx: DigestContext,
): SearchFailureDigest {
  return {
    n: ctx.n,
    r: ctx.r,
    s: ctx.s,
    attemptNumber: ctx.attemptNumber,
    bestEnergy: tel.bestEnergy,
    finalTemperature: tel.finalTemperature,
    ips: tel.ips,
    totalIterations: tel.totalIterations,
    wallTimeSeconds: tel.wallTimeSeconds,
    reheatCount: tel.reheatCount,
    energyTrajectory: tel.energyTrajectory,
    diagnosis: diagnoseSearchFailure(tel),
  };
}

// ──────────────────────────────────────────────
// Formatter (for ARCHITECT context)
// ──────────────────────────────────────────────

export function formatSearchDigestForArchitect(digest: SearchFailureDigest): string {
  const lines = [
    `🚨 [SEARCH ESCALATION TRIGGERED — Attempt ${digest.attemptNumber}]`,
    ``,
    `## Problem: R(${digest.r},${digest.s}) ≥ ${digest.n + 1} (${digest.n} vertices)`,
    ``,
    `## Thermodynamic Telemetry`,
    `- Best Energy: ${digest.bestEnergy}`,
    `- Final Temperature: ${digest.finalTemperature}`,
    `- IPS: ${digest.ips.toLocaleString()}`,
    `- Total Iterations: ${digest.totalIterations.toLocaleString()}`,
    `- Wall Time: ${digest.wallTimeSeconds.toFixed(1)}s`,
    `- Reheat Count: ${digest.reheatCount}`,
    ``,
    `## Energy Trajectory (10%, 20%, ..., 100%)`,
    `[${digest.energyTrajectory.join(", ")}]`,
    ``,
    `## Diagnosis: ${digest.diagnosis.failureMode}`,
    `- Evidence: ${digest.diagnosis.evidence}`,
    ``,
    `## Recommendation`,
    digest.diagnosis.recommendation,
  ];
  return lines.join("\n");
}
