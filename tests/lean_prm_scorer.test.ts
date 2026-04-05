import { test, expect, describe } from "bun:test";
import { LeanPRMScorer } from "../src/agents/lean_prm_scorer";

describe("LeanPRMScorer", () => {
  const scorer = new LeanPRMScorer();

  test("should perfectly score a terminal win bypass", async () => {
    const score = await scorer.scoreTransition(
      "⊢ n = n",
      "rfl",
      "no goals"
    );
    expect(score).toBe(1.0);
  });

  test("should harshly penalize a syntax error bypass", async () => {
    const score = await scorer.scoreTransition(
      "⊢ String = String",
      "exact",
      "error: tactic 'exact' failed, expected 1 argument(s)"
    );
    expect(score).toBe(0.0);
  });

  test("should lightly penalize a useless tactic bypass", async () => {
    const score = await scorer.scoreTransition(
      "⊢ True",
      "simp",
      "⊢ True"
    );
    expect(score).toBe(0.1);
  });

  // Not testing full LLM evaluation in unit test because it relies on external Ollama running,
  // but we can add a skipped live test.
  test.skip("LIVE: should realistically score progress", async () => {
    const score = await scorer.scoreTransition(
      "⊢ n = n + 0",
      "rw [Nat.add_zero]",
      "⊢ n = n"
    );
    expect(score).toBeGreaterThan(0.5);
  });
});
