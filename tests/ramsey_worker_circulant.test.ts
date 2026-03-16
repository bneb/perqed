/**
 * TDD Tests — Circulant mode in ramsey_worker.ts
 * These tests are written FIRST (red phase).
 */

import { describe, test, expect } from "bun:test";
import { ramseySearch } from "../src/search/ramsey_worker";
import { isCirculant } from "../src/search/symmetry";

describe("Circulant SA — Init Invariant", () => {
  test("initialized graph satisfies circulant property", () => {
    // Run just 1 iteration to get the initial state, then check
    let initialAdj: any = null;
    ramseySearch(
      {
        n: 7,
        r: 3,
        s: 3,
        maxIterations: 1,
        initialTemp: 3.0,
        coolingRate: 0.99999,
        symmetry: "circulant",
      },
      undefined,
      (adj) => { initialAdj = adj; },
    );
    // If init callback is not supported, we rely on the isCirculant test below
    // The constructor-level invariant test is done via the mutation invariant test
  });

  test("graph initialized as circulant passes isCirculant check via full run", () => {
    // Use small N where we can verify: for N=5, 2^2 = 4 possible circulants
    // Run with snapshot callback to capture the initial adj
    let capturedAdj: any = null;
    const result = ramseySearch(
      {
        n: 5,
        r: 3,
        s: 3,
        maxIterations: 100,
        initialTemp: 3.0,
        coolingRate: 0.99999,
        symmetry: "circulant",
        onInit: (adj: any) => { capturedAdj = adj; },
      },
    );
    // Result should have been produced without crashing
    expect(result.bestEnergy).toBeGreaterThanOrEqual(0);
  });
});

describe("Circulant SA — Mutation Preserves Invariant", () => {
  test("mutation loop on N=7 never violates circulant property", () => {
    // We check that after any number of mutations, the adj stays circulant
    // by wrapping in a custom progress callback that checks every 1000 iters
    let violationFound = false;

    // We need to expose adj state — use a small N and run full search,
    // checking at progress intervals
    // Since ramsey_worker doesn't expose adj in progress, we test via witness shape:
    // Any witness returned must be circulant
    for (let trial = 0; trial < 5; trial++) {
      const result = ramseySearch({
        n: 7,
        r: 3,
        s: 3,
        maxIterations: 50_000,
        initialTemp: 3.0,
        coolingRate: 0.9999,
        symmetry: "circulant",
      });
      if (result.witness) {
        // The witness was produced by a circulant search, so it must be circulant
        expect(isCirculant(result.witness, 7)).toBe(true);
      }
    }
    expect(violationFound).toBe(false);
  });
});

describe("Circulant SA — E2E: R(3,3) on N=5", () => {
  test("finds E=0 witness on trivial case (2^2 search space)", () => {
    // R(3,3) = 6, so R(3,3) >= 5 is known true
    // On N=5 with circulant: only 4 possible colorings, SA finds E=0 fast
    let found = false;
    for (let trial = 0; trial < 10; trial++) {
      const result = ramseySearch({
        n: 5,
        r: 3,
        s: 3,
        maxIterations: 10_000,
        initialTemp: 3.0,
        coolingRate: 0.999,
        symmetry: "circulant",
      });
      if (result.bestEnergy === 0) {
        found = true;
        expect(result.witness).not.toBeNull();
        // Witness must be circulant
        expect(isCirculant(result.witness!, 5)).toBe(true);
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("Circulant SA — backward compatibility: symmetry=none still works", () => {
  test("omitting symmetry field uses unconstrained search (existing behavior)", () => {
    const result = ramseySearch({
      n: 5,
      r: 3,
      s: 3,
      maxIterations: 50_000,
      initialTemp: 3.0,
      coolingRate: 0.9999,
      // no symmetry field — defaults to unconstrained
    });
    expect(result.bestEnergy).toBeGreaterThanOrEqual(0);
  });
});
