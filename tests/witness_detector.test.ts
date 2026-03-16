/**
 * Witness Detection Tests — TDD Red-to-Green
 *
 * Tests the general-purpose constructive existence detection:
 *   1. isConstructiveExistence: detects ∃ in theorem signatures
 *   2. classifyProblem: maps problem descriptions to problem classes
 *   3. extractSearchConfig: produces search config from problem class + params
 */

import { describe, test, expect } from "bun:test";
import {
  isConstructiveExistence,
  classifyProblem,
  extractSearchConfig,
  type ProblemClass,
  type SearchConfig,
} from "../src/search/witness_detector";

// ──────────────────────────────────────────────
// isConstructiveExistence
// ──────────────────────────────────────────────

describe("WitnessDetector — isConstructiveExistence", () => {

  test("detects ∃ at start of signature", () => {
    const sig = ": ∃ (G : Fin 17 → Fin 17 → Bool), ...";
    expect(isConstructiveExistence(sig)).toBe(true);
  });

  test("detects ∃ with leading colon and whitespace", () => {
    const sig = " : ∃ (G : Fin 5 → Fin 5 → Bool), ...";
    expect(isConstructiveExistence(sig)).toBe(true);
  });

  test("returns false for ∀ (universal, not constructive)", () => {
    const sig = ": ∀ (n : Nat), n + 0 = n";
    expect(isConstructiveExistence(sig)).toBe(false);
  });

  test("returns false for plain equality", () => {
    const sig = ": 2 + 2 = 4";
    expect(isConstructiveExistence(sig)).toBe(false);
  });

  test("detects Exists keyword (ASCII alternative)", () => {
    const sig = ": Exists (fun G => ...)";
    expect(isConstructiveExistence(sig)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// classifyProblem
// ──────────────────────────────────────────────

describe("WitnessDetector — classifyProblem", () => {

  test("classifies Ramsey R(4,4) lower bound", () => {
    const desc = "R(4,4) >= 18, find a 17-vertex graph with no K4 clique and no independent set of size 4";
    const result = classifyProblem(desc);
    expect(result.type).toBe("ramsey");
    expect(result.params.r).toBe(4);
    expect(result.params.s).toBe(4);
    expect(result.params.vertices).toBe(17);
  });

  test("classifies Ramsey R(3,3) lower bound", () => {
    const desc = "Ramsey R(3,3) >= 6, find 5-vertex triangle-free graph with no independent set of size 3";
    const result = classifyProblem(desc);
    expect(result.type).toBe("ramsey");
    expect(result.params.r).toBe(3);
    expect(result.params.s).toBe(3);
    expect(result.params.vertices).toBe(5);
  });

  test("classifies asymmetric Ramsey R(4,6)", () => {
    const desc = "R(4,6) >= 37, find a 36-vertex graph that is K4-free and has no independent set of size 6";
    const result = classifyProblem(desc);
    expect(result.type).toBe("ramsey");
    expect(result.params.r).toBe(4);
    expect(result.params.s).toBe(6);
    expect(result.params.vertices).toBe(36);
  });

  test("returns unknown for unrecognized problems", () => {
    const desc = "Prove that every even number greater than 2 is the sum of two primes";
    const result = classifyProblem(desc);
    expect(result.type).toBe("unknown");
  });
});

// ──────────────────────────────────────────────
// extractSearchConfig
// ──────────────────────────────────────────────

describe("WitnessDetector — extractSearchConfig", () => {

  test("Ramsey problem produces ramsey_sa search config", () => {
    const pc: ProblemClass = { type: "ramsey", params: { r: 4, s: 4, vertices: 17 } };
    const config = extractSearchConfig(pc);

    expect(config).not.toBeNull();
    expect(config!.type).toBe("ramsey_sa");
    expect(config!.n).toBe(17);
    expect(config!.r).toBe(4);
    expect(config!.s).toBe(4);
    expect(config!.saIterations).toBeGreaterThan(0);
  });

  test("scales iterations with problem size", () => {
    const small: ProblemClass = { type: "ramsey", params: { r: 3, s: 3, vertices: 5 } };
    const large: ProblemClass = { type: "ramsey", params: { r: 4, s: 6, vertices: 36 } };

    const smallConfig = extractSearchConfig(small)!;
    const largeConfig = extractSearchConfig(large)!;

    expect(largeConfig.saIterations).toBeGreaterThan(smallConfig.saIterations);
  });

  test("unknown problem returns null", () => {
    const pc: ProblemClass = { type: "unknown", params: {} };
    const config = extractSearchConfig(pc);
    expect(config).toBeNull();
  });
});
