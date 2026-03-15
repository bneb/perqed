/**
 * Sprint 19: Lean Goal Parsing Tests (TDD RED → GREEN)
 *
 * Tests parseGoalCount and splitGoals for AND/OR topology decisions.
 */

import { describe, test, expect } from "bun:test";
import { LeanBridge } from "../src/lean_bridge";

describe("LeanBridge Goal Parsing", () => {
  const bridge = new LeanBridge();

  describe("parseGoalCount", () => {
    test("returns 2 for multi-goal state with '2 goals' header", () => {
      const state = "2 goals\ncase zero\n⊢ 0 = 0\ncase succ\n⊢ n + 1 = 1 + n";
      expect(bridge.parseGoalCount(state)).toBe(2);
    });

    test("returns 1 for single goal without header", () => {
      const state = "⊢ n + m = m + n";
      expect(bridge.parseGoalCount(state)).toBe(1);
    });

    test("returns 0 for 'no goals'", () => {
      expect(bridge.parseGoalCount("no goals")).toBe(0);
    });

    test("returns 0 for empty string", () => {
      expect(bridge.parseGoalCount("")).toBe(0);
    });

    test("returns 3 for '3 goals' header", () => {
      const state = "3 goals\ncase a\n⊢ a\ncase b\n⊢ b\ncase c\n⊢ c";
      expect(bridge.parseGoalCount(state)).toBe(3);
    });
  });

  describe("splitGoals", () => {
    test("splits multi-goal state by 'case' headers", () => {
      const state = "2 goals\ncase zero\n⊢ 0 = 0\ncase succ\nn : Nat\nih : n + 0 = n\n⊢ n + 1 + 0 = n + 1";
      const goals = bridge.splitGoals(state);

      expect(goals.length).toBe(2);
      expect(goals[0]).toContain("case zero");
      expect(goals[1]).toContain("case succ");
    });

    test("returns single-element array for single goal", () => {
      const state = "⊢ n + m = m + n";
      const goals = bridge.splitGoals(state);

      expect(goals.length).toBe(1);
      expect(goals[0]).toContain("⊢ n + m = m + n");
    });

    test("returns single-element array for 'no goals'", () => {
      const goals = bridge.splitGoals("no goals");
      expect(goals.length).toBe(1);
    });

    test("splits by double-newline when no 'case' headers present", () => {
      const state = "2 goals\n⊢ a = a\n\n⊢ b = b";
      const goals = bridge.splitGoals(state);

      expect(goals.length).toBeGreaterThanOrEqual(2);
    });
  });
});
