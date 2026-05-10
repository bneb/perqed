import { expect, test, describe } from "bun:test";
import { LeanPRMScorer } from "../src/agents/lean_prm_scorer";

describe("LeanPRMScorer Heuristics", () => {
  const scorer = new LeanPRMScorer();

  test("returns 1.0 for 'no goals'", async () => {
    const score = await scorer.scoreTransition("⊢ x = x", "exact rfl", "no goals");
    expect(score).toBe(1.0);
  });

  test("returns 0.0 for 'error:'", async () => {
    const score = await scorer.scoreTransition("⊢ x = x", "simp", "error: simp made no progress");
    expect(score).toBe(0.0);
  });

  test("returns 0.1 for identical states", async () => {
    const state = "n : Nat\n⊢ n = n";
    const score = await scorer.scoreTransition(state, "simp", state);
    expect(score).toBe(0.1);
  });

  test("returns 0.85 when number of goals decreases", async () => {
    const beforeState = "⊢ A\n\n⊢ B";
    const afterState = "⊢ B";
    const score = await scorer.scoreTransition(beforeState, "exact a", afterState);
    expect(score).toBe(0.85);
  });

  test("returns 0.75 when state size decreases by >20%", async () => {
    const beforeState = "n m k : Nat\nh1 : n + m = k\nh2 : k + m = n\nh3 : a bunch of useless stuff\n⊢ x = x";
    const afterState = "n m k : Nat\n⊢ x = x";
    const score = await scorer.scoreTransition(beforeState, "clear h1 h2 h3", afterState);
    expect(score).toBe(0.75);
  });

  test("returns 0.65 when 'have' introduces new hypotheses", async () => {
    const beforeState = "n : Nat\n⊢ n = n";
    const afterState = "n : Nat\nh : n = n\n⊢ n = n";
    const score = await scorer.scoreTransition(beforeState, "have h : n = n := rfl", afterState);
    expect(score).toBe(0.65);
  });

  test("returns 0.65 when 'intro' introduces new hypotheses", async () => {
    const beforeState = "⊢ ∀ x : Nat, x = x";
    const afterState = "x : Nat\n⊢ x = x";
    const score = await scorer.scoreTransition(beforeState, "intro x", afterState);
    expect(score).toBe(0.65);
  });

  test("returns 0.60 for creative expansion tactics that increase state size", async () => {
    const beforeState = "⊢ f x = f x";
    // State size strictly increases because we generalized x to y
    const afterState = "y : Nat\nh : y = x\n⊢ f y = f y";
    const score = await scorer.scoreTransition(beforeState, "generalize h : x = y", afterState);
    expect(score).toBe(0.60);
  });
});

describe("LeanPRMScorer Structural Caching", () => {
  test("skeletonize strips variable names consistently", () => {
    const scorer = new LeanPRMScorer();
    // Expose private method for testing
    const skel = (scorer as any).skeletonize.bind(scorer);
    
    const stateA = "n m : Nat\n⊢ n + m = m + n";
    const stateB = "x y : Nat\n⊢ n + m = m + n"; // Same goal to test binder normalization
    
    const resA = skel(stateA);
    const resB = skel(stateB);
    
    expect(resA).toContain("?VAR ?VAR : Nat");
    expect(resA).toBe(resB);
  });

  test("uses LRU cache for isomorphic states to skip LLM", async () => {
    const scorer = new LeanPRMScorer();
    
    const stateA = "n m : Nat\n⊢ n + m = m + n";
    const stateB = "x y : Nat\n⊢ n + m = m + n"; // Same skeleton
    
    const beforeState = "⊢ A"; // Falls through heuristics
    
    // Seed the cache to verify that the LLM is skipped entirely
    (scorer as any).scoreCache.set((scorer as any).skeletonize(stateB), 0.999);
    
    const scoreB = await scorer.scoreTransition(beforeState, "tactic_b", stateB);
    
    expect(scoreB).toBe(0.999);
  });
});
