/**
 * witness_detector tests — TDD (red → green)
 *
 * Tests the new architecture: structured SearchConfig from ARCHITECT JSON,
 * no regex parsing of English descriptions.
 */

import { describe, test, expect } from "bun:test";
import {
  isConstructiveExistence,
  extractSearchConfig,
  type ArchitectSearchConfig,
} from "../src/search/witness_detector";

describe("isConstructiveExistence", () => {
  test("detects ∃ with leading colon (ARCHITECT output style)", () => {
    const sig = ": ∃ (coloring : Fin 35 → Fin 35 → Bool), ...";
    expect(isConstructiveExistence(sig)).toBe(true);
  });

  test("detects bare ∃", () => {
    expect(isConstructiveExistence("∃ x : Nat, x > 0")).toBe(true);
  });

  test("detects Exists keyword", () => {
    expect(isConstructiveExistence("Exists (fun x => x > 0)")).toBe(true);
  });

  test("rejects non-existence statements", () => {
    expect(isConstructiveExistence("∀ x : Nat, x ≥ 0")).toBe(false);
    expect(isConstructiveExistence(": (n : Nat) → n + 0 = n")).toBe(false);
  });
});

describe("extractSearchConfig — ramsey_coloring", () => {
  const ramseyConfig: ArchitectSearchConfig = {
    problem_class: "ramsey_coloring",
    domain_size: 35,
    num_colors: 2,
    forbidden_subgraphs: [
      { color: 0, clique_size: 4 },
      { color: 1, clique_size: 6 },
    ],
  };

  test("extracts correct vertex count", () => {
    const result = extractSearchConfig(ramseyConfig);
    expect(result).not.toBeNull();
    expect(result!.n).toBe(35);
  });

  test("extracts r and s from forbidden_subgraphs", () => {
    const result = extractSearchConfig(ramseyConfig);
    expect(result!.r).toBe(4);
    expect(result!.s).toBe(6);
  });

  test("auto-scales to 8 workers (island_model) for n=35", () => {
    const result = extractSearchConfig(ramseyConfig);
    expect(result!.workers).toBe(8);
    expect(result!.strategy).toBe("island_model");
    expect(result!.saIterations).toBe(500_000_000);
  });

  test("auto-scales to single worker for small problems (n≤20)", () => {
    const small: ArchitectSearchConfig = {
      problem_class: "ramsey_coloring",
      domain_size: 5,
      num_colors: 2,
      forbidden_subgraphs: [
        { color: 0, clique_size: 3 },
        { color: 1, clique_size: 3 },
      ],
    };
    const result = extractSearchConfig(small);
    expect(result!.workers).toBe(1);
    expect(result!.strategy).toBe("single");
  });

  test("auto-scales to 4 workers for medium problems (21-30v)", () => {
    const medium: ArchitectSearchConfig = {
      problem_class: "ramsey_coloring",
      domain_size: 25,
      num_colors: 2,
      forbidden_subgraphs: [
        { color: 0, clique_size: 4 },
        { color: 1, clique_size: 5 },
      ],
    };
    const result = extractSearchConfig(medium);
    expect(result!.workers).toBe(4);
    expect(result!.strategy).toBe("island_model");
  });

  test("type is ramsey_sa", () => {
    const result = extractSearchConfig(ramseyConfig);
    expect(result!.type).toBe("ramsey_sa");
  });
});

describe("extractSearchConfig — unknown", () => {
  test("returns null for unknown problem class", () => {
    const unknown: ArchitectSearchConfig = {
      problem_class: "unknown",
    };
    expect(extractSearchConfig(unknown)).toBeNull();
  });
});
