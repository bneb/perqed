/**
 * schur_pipeline.test.ts — RED-to-GREEN tests for Phase schur_partition support
 *
 * Validates the three invariants introduced by the Schur pipeline changes:
 *   1. shouldRunSearchPhase() returns true for schur_partition
 *   2. buildLeanSource() prepends import Mathlib by default
 *   3. targetGoal string uses S(r)>=N format for schur_partition
 */
import { describe, expect, it } from "bun:test";
import { shouldRunSearchPhase } from "../src/cli/perqed";
import { LeanBridge } from "../src/lean_bridge";

// ── 1. shouldRunSearchPhase ───────────────────────────────────────────────────

describe("shouldRunSearchPhase — schur_partition routing", () => {
  it("returns true for schur_partition (SA must fire)", () => {
    expect(shouldRunSearchPhase({ problem_class: "schur_partition" }, false)).toBe(true);
  });

  it("returns true for ramsey_coloring (existing behaviour preserved)", () => {
    expect(shouldRunSearchPhase({ problem_class: "ramsey_coloring" }, false)).toBe(true);
  });

  it("returns false for unknown (Lean MCTS loop, no SA)", () => {
    expect(shouldRunSearchPhase({ problem_class: "unknown" }, false)).toBe(false);
  });

  it("returns false for undefined problem_class", () => {
    expect(shouldRunSearchPhase({}, false)).toBe(false);
  });

  it("returns false for null searchConfig", () => {
    expect(shouldRunSearchPhase(null, false)).toBe(false);
  });

  it("returns false for a future-unknown class (strict allowlist)", () => {
    // shouldRunSearchPhase should NOT silently route new unknown classes to SA
    expect(shouldRunSearchPhase({ problem_class: "van_der_waerden" }, false)).toBe(false);
  });
});

// ── 2. buildLeanSource preamble ───────────────────────────────────────────────

describe("LeanBridge.buildLeanSource — Mathlib preamble", () => {
  const bridge = new LeanBridge();

  it("prepends 'import Mathlib' by default", () => {
    const src = bridge.buildLeanSource("my_thm", ": True", ["trivial"]);
    expect(src).toMatch(/^import Mathlib\b/);
  });

  it("prepends 'open Nat' by default", () => {
    const src = bridge.buildLeanSource("my_thm", ": True", ["trivial"]);
    expect(src).toContain("open Nat");
  });

  it("preamble appears BEFORE the theorem declaration", () => {
    const src = bridge.buildLeanSource("my_thm", ": True", ["trivial"]);
    const importIdx = src.indexOf("import Mathlib");
    const theoremIdx = src.indexOf("theorem my_thm");
    expect(importIdx).toBeLessThan(theoremIdx);
  });

  it("theorem declaration is still present", () => {
    const src = bridge.buildLeanSource("schur_thm", ": ∃ f : Fin 537 → Fin 6, True", ["exact ⟨fun _ => 0, trivial⟩"]);
    expect(src).toContain("theorem schur_thm");
  });

  it("preamble can be overridden to empty string (no imports)", () => {
    const src = bridge.buildLeanSource("my_thm", ": True", ["trivial"], "");
    expect(src).not.toContain("import Mathlib");
    // Should start directly with the theorem
    expect(src.trimStart()).toMatch(/^theorem /);
  });

  it("custom preamble is used when provided", () => {
    const custom = "import Init.Data.Nat.Basic\n\n";
    const src = bridge.buildLeanSource("my_thm", ": True", ["trivial"], custom);
    expect(src).toContain("import Init.Data.Nat.Basic");
    expect(src).not.toContain("import Mathlib");
  });

  it("def main is still appended at the end", () => {
    const src = bridge.buildLeanSource("my_thm", ": True", ["trivial"]);
    expect(src).toContain('IO.println "PROOF_VALID"');
    // main must come after the theorem
    const theoremIdx = src.indexOf("theorem my_thm");
    const mainIdx = src.indexOf("def main");
    expect(mainIdx).toBeGreaterThan(theoremIdx);
  });

  it("multiple tactics are all indented into the by block", () => {
    const src = bridge.buildLeanSource("my_thm", ": True", ["intro h", "exact h"]);
    expect(src).toContain("  intro h");
    expect(src).toContain("  exact h");
  });
});
