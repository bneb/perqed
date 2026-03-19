/**
 * schur_routing.test.ts — RED-to-GREEN tests for schur_partition routing fix
 *
 * Validates new behavior introduced by the SchurPartitionArchitectConfig change:
 *   1. SchurPartitionArchitectConfig is a valid ArchitectSearchConfig variant
 *   2. extractSearchConfig returns null for schur_partition (handled by Wiles DAG, not Ramsey SA)
 *   3. shouldRunSearchPhase still returns true for schur_partition (ensures needsSearch fires)
 *   4. extractSearchConfig still works for ramsey_coloring (no regression)
 */
import { describe, expect, it } from "bun:test";
import {
  type ArchitectSearchConfig,
  type SchurPartitionArchitectConfig,
  extractSearchConfig,
} from "../src/search/witness_detector";
import { shouldRunSearchPhase } from "../src/cli/perqed";

// ── 1. Type-level: SchurPartitionArchitectConfig is assignable to ArchitectSearchConfig ──

describe("SchurPartitionArchitectConfig type membership", () => {
  it("is a valid ArchitectSearchConfig", () => {
    const cfg: ArchitectSearchConfig = {
      problem_class: "schur_partition",
      domain_size: 537,
      num_partitions: 6,
    };
    expect(cfg.problem_class).toBe("schur_partition");
  });

  it("carries domain_size correctly", () => {
    const cfg: SchurPartitionArchitectConfig = {
      problem_class: "schur_partition",
      domain_size: 537,
      num_partitions: 6,
    };
    expect(cfg.domain_size).toBe(537);
  });

  it("carries num_partitions correctly", () => {
    const cfg: SchurPartitionArchitectConfig = {
      problem_class: "schur_partition",
      domain_size: 537,
      num_partitions: 6,
    };
    expect(cfg.num_partitions).toBe(6);
  });
});

// ── 2. extractSearchConfig: returns null for schur_partition ──
// schur_partition is handled by the Wiles/algebraic DAG loop, not the Ramsey SA island model.
// extractSearchConfig SHOULD return null so the needsSearch block doesn't set a searchPhase.

describe("extractSearchConfig — schur_partition returns null (DAG loop handles it)", () => {
  it("returns null for schur_partition", () => {
    const cfg: ArchitectSearchConfig = {
      problem_class: "schur_partition",
      domain_size: 537,
      num_partitions: 6,
    };
    expect(extractSearchConfig(cfg)).toBeNull();
  });
});

// ── 3. shouldRunSearchPhase: still true for schur_partition ──
// This ensures needsSearch = true so the routing block is entered.

describe("shouldRunSearchPhase — schur_partition still returns true", () => {
  it("returns true for schur_partition", () => {
    expect(shouldRunSearchPhase({ problem_class: "schur_partition" }, false)).toBe(true);
  });
});

// ── 4. Regression: ramsey_coloring still works ──

describe("extractSearchConfig — ramsey_coloring regression", () => {
  it("returns a SearchConfig for a valid ramsey_coloring config", () => {
    const cfg: ArchitectSearchConfig = {
      problem_class: "ramsey_coloring",
      domain_size: 35,
      num_colors: 2,
      r: 4,
      s: 6,
      symmetry: "circulant",
    };
    const result = extractSearchConfig(cfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("ramsey_sa");
    expect(result?.n).toBe(35);
    expect(result?.r).toBe(4);
    expect(result?.s).toBe(6);
    expect(result?.symmetry).toBe("circulant");
  });

  it("returns null for unknown problem_class", () => {
    const cfg: ArchitectSearchConfig = { problem_class: "unknown" };
    expect(extractSearchConfig(cfg)).toBeNull();
  });
});
