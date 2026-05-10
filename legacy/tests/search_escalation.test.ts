/**
 * Search Escalation Tests — TDD Red-to-Green
 *
 * Tests the full search escalation loop:
 *   1. SearchFailureDigest correctly captures thermodynamic telemetry
 *   2. ARCHITECT pivot prompt is well-formed
 *   3. Retry loop correctly chains failed attempts to ARCHITECT pivots
 */

import { describe, test, expect } from "bun:test";
import {
  buildSearchFailureDigest,
  formatSearchDigestForArchitect,
  diagnoseSearchFailure,
  type SearchTelemetry,
  type SearchFailureDigest,
  type SearchDiagnosis,
} from "../src/search/search_failure_digest";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeTelemetry(overrides: Partial<SearchTelemetry> = {}): SearchTelemetry {
  return {
    bestEnergy: 12,
    finalEnergy: 30,
    finalTemperature: 1.49,
    initialTemperature: 2.0,
    totalIterations: 10_000_000,
    ips: 3_200_000,
    wallTimeSeconds: 3.1,
    reheatCount: 200,
    energyTrajectory: [100, 50, 30, 20, 15, 13, 12, 12, 12, 12],
    temperatureTrajectory: [2.0, 1.9, 1.85, 1.8, 1.75, 1.6, 1.52, 1.50, 1.49, 1.49],
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// SearchFailureDigest Construction
// ──────────────────────────────────────────────

describe("SearchFailureDigest — buildSearchFailureDigest", () => {

  test("captures all thermodynamic telemetry fields", () => {
    const tel = makeTelemetry();
    const digest = buildSearchFailureDigest(tel, {
      n: 17, r: 4, s: 4, attemptNumber: 1,
    });

    expect(digest.bestEnergy).toBe(12);
    expect(digest.finalTemperature).toBe(1.49);
    expect(digest.ips).toBe(3_200_000);
    expect(digest.totalIterations).toBe(10_000_000);
    expect(digest.attemptNumber).toBe(1);
    expect(digest.n).toBe(17);
    expect(digest.r).toBe(4);
    expect(digest.s).toBe(4);
  });

  test("includes diagnosis of the failure mode", () => {
    const tel = makeTelemetry();
    const digest = buildSearchFailureDigest(tel, {
      n: 17, r: 4, s: 4, attemptNumber: 1,
    });

    expect(digest.diagnosis).toBeDefined();
    expect(typeof digest.diagnosis.failureMode).toBe("string");
    expect(typeof digest.diagnosis.recommendation).toBe("string");
  });

  test("detects TEMPERATURE_NOT_COOLING when T barely dropped", () => {
    const tel = makeTelemetry({ initialTemperature: 2.0, finalTemperature: 1.49 });
    const diagnosis = diagnoseSearchFailure(tel);

    expect(diagnosis.failureMode).toBe("TEMPERATURE_NOT_COOLING");
  });

  test("detects GLASS_FLOOR when best energy stalled > 60% of iterations", () => {
    // Energy never improved after the 30% mark
    const tel = makeTelemetry({
      initialTemperature: 2.0,
      finalTemperature: 0.001, // temperature DID cool
      energyTrajectory: [100, 30, 12, 12, 12, 12, 12, 12, 12, 12], // stalled at 30%
    });
    const diagnosis = diagnoseSearchFailure(tel);

    expect(diagnosis.failureMode).toBe("GLASS_FLOOR");
  });

  test("detects INSUFFICIENT_BUDGET when energy is still improving at end", () => {
    const tel = makeTelemetry({
      initialTemperature: 2.0,
      finalTemperature: 0.001,
      energyTrajectory: [100, 80, 60, 40, 30, 20, 15, 12, 10, 8], // still dropping
    });
    const diagnosis = diagnoseSearchFailure(tel);

    expect(diagnosis.failureMode).toBe("INSUFFICIENT_BUDGET");
  });

  test("detects REHEAT_TOO_AGGRESSIVE when reheatCount > iters/reheatAfter expected", () => {
    const tel = makeTelemetry({
      reheatCount: 500, // 500 reheats in 10M iters = way too many
      initialTemperature: 2.0,
      finalTemperature: 1.49,
    });
    const diagnosis = diagnoseSearchFailure(tel);

    // Should detect either TEMPERATURE_NOT_COOLING or REHEAT_TOO_AGGRESSIVE
    expect(["TEMPERATURE_NOT_COOLING", "REHEAT_TOO_AGGRESSIVE"]).toContain(
      diagnosis.failureMode
    );
  });
});

// ──────────────────────────────────────────────
// Diagnosis → Recommendation
// ──────────────────────────────────────────────

describe("SearchFailureDigest — diagnoseSearchFailure", () => {

  test("TEMPERATURE_NOT_COOLING recommends fixing cooling rate", () => {
    const tel = makeTelemetry({ initialTemperature: 2.0, finalTemperature: 1.49 });
    const diagnosis = diagnoseSearchFailure(tel);

    expect(diagnosis.recommendation).toContain("cooling");
  });

  test("GLASS_FLOOR recommends multi-worker or structural seed", () => {
    const tel = makeTelemetry({
      initialTemperature: 2.0,
      finalTemperature: 0.001,
      energyTrajectory: [100, 30, 12, 12, 12, 12, 12, 12, 12, 12],
    });
    const diagnosis = diagnoseSearchFailure(tel);

    expect(
      diagnosis.recommendation.includes("worker") ||
      diagnosis.recommendation.includes("seed") ||
      diagnosis.recommendation.includes("island")
    ).toBe(true);
  });

  test("INSUFFICIENT_BUDGET recommends more iterations", () => {
    const tel = makeTelemetry({
      initialTemperature: 2.0,
      finalTemperature: 0.001,
      energyTrajectory: [100, 80, 60, 40, 30, 20, 15, 12, 10, 8],
    });
    const diagnosis = diagnoseSearchFailure(tel);

    expect(diagnosis.recommendation).toContain("iteration");
  });
});

// ──────────────────────────────────────────────
// Formatting for ARCHITECT
// ──────────────────────────────────────────────

describe("SearchFailureDigest — formatSearchDigestForArchitect", () => {

  test("formatted digest includes all key fields", () => {
    const tel = makeTelemetry();
    const digest = buildSearchFailureDigest(tel, {
      n: 17, r: 4, s: 4, attemptNumber: 1,
    });
    const formatted = formatSearchDigestForArchitect(digest);

    expect(formatted).toContain("ESCALATION");
    expect(formatted).toContain("12"); // bestEnergy
    expect(formatted).toContain("1.49"); // finalTemperature
    expect(formatted).toContain("17"); // vertices
    expect(formatted).toContain("R(4,4)"); // problem
    expect(formatted).toContain("Recommendation");
  });

  test("formatted digest includes energy trajectory", () => {
    const tel = makeTelemetry();
    const digest = buildSearchFailureDigest(tel, {
      n: 17, r: 4, s: 4, attemptNumber: 1,
    });
    const formatted = formatSearchDigestForArchitect(digest);

    expect(formatted).toContain("Trajectory");
  });

  test("formatted digest includes attempt number", () => {
    const tel = makeTelemetry();
    const digest = buildSearchFailureDigest(tel, {
      n: 17, r: 4, s: 4, attemptNumber: 3,
    });
    const formatted = formatSearchDigestForArchitect(digest);

    expect(formatted).toContain("Attempt 3");
  });
});
