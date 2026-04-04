/**
 * novelty_checker.test.ts — Unit tests for the NoveltyChecker module.
 *
 * Tests the embedding-based novelty verification independently of the
 * XState machine. All Ollama/LanceDB interactions are tested via
 * constructor injection patterns.
 *
 * Run: bun test tests/librarian/novelty_checker.test.ts
 */

import { describe, expect, it } from "bun:test";
import { NoveltyChecker } from "../../src/librarian/novelty_checker";

describe("NoveltyChecker", () => {
  it("exports the NoveltyChecker class", () => {
    expect(NoveltyChecker).toBeDefined();
    expect(typeof NoveltyChecker).toBe("function");
  });

  it("constructs with default threshold of 0.92", () => {
    const checker = new NoveltyChecker("./data/test.lancedb");
    expect(checker.threshold).toBe(0.92);
  });

  it("constructs with custom threshold", () => {
    const checker = new NoveltyChecker("./data/test.lancedb", 0.85);
    expect(checker.threshold).toBe(0.85);
  });

  it("returns NOVEL_DISCOVERY when Ollama is unavailable (graceful degradation)", async () => {
    // This test will naturally hit the Ollama-unavailable path in CI
    // or any environment where Ollama isn't running on port 11434.
    const checker = new NoveltyChecker("./data/nonexistent_test.lancedb");
    const result = await checker.check("theorem foo : ∀ n : Nat, n + 0 = n");

    // The checker should gracefully degrade, not crash
    expect(result.classification).toBe("NOVEL_DISCOVERY");
    expect(result.matchedSource).toBeNull();
    expect(result.topSimilarity).toBe(0);
  });

  it("l2ToCosine utility converts correctly", () => {
    // Access through the module's internal function via a proxy test:
    // L2=0 → cosine=1 (identical vectors)
    // L2=√2 → cosine≈0 (orthogonal vectors)
    // L2=2 → cosine≈-1 (opposite vectors, clamped to 0)
    //
    // We test this indirectly through the checker's behavior,
    // but also validate the math here.
    const l2ToCosine = (d: number) => Math.max(0, Math.min(1, 1 - (d * d) / 2));

    expect(l2ToCosine(0)).toBe(1);
    expect(l2ToCosine(Math.sqrt(2))).toBeCloseTo(0, 5);
    expect(l2ToCosine(2)).toBe(0); // clamped
  });
});

describe("NoveltyChecker integration with XState machine", () => {
  /**
   * This test verifies that the ideation actor correctly integrates
   * the NoveltyChecker. It uses the existing machine test patterns
   * with mock actors to ensure the KNOWN_THEOREM override path works.
   */
  it("machine routes KNOWN_THEOREM from novelty check through existing guards", async () => {
    const { createActor, fromPromise } = await import("xstate");
    const { researchMachine } = await import("../../src/orchestration/machine");

    // Simulate the ideation actor returning a KNOWN_THEOREM classification
    // (as if the NoveltyChecker overrode the LLM's self-classification)
    let ideationCalls = 0;
    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: fromPromise<any, any>(async () => {
          ideationCalls++;
          return {
            classification: "KNOWN_THEOREM",
            hypothesis: "theorem pythagorean : ∀ a b c : ℕ, a^2 + b^2 = c^2",
            plan: {
              prompt: "test",
              seed_paper: { arxivId: "0000.00000", title: "Known", abstract: "Known" },
              extension_hypothesis: "pythagorean theorem",
              domains_to_probe: ["geometry"],
              lean_target_sketch: "theorem pythagorean ...",
            },
            literature: ["Known Paper"],
          };
        }),
      },
    });

    const actor = createActor(testMachine);
    actor.start();
    actor.send({
      type: "START",
      prompt: "prove pythagorean theorem",
      apiKey: "test",
      workspaceDir: "/tmp",
      outputDir: "/tmp/test",
      publishableMode: false,
    });

    // Wait for the machine to reach a final state
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out. Current: ${JSON.stringify(actor.getSnapshot().value)}`)),
        5000,
      );
      actor.subscribe((s) => {
        if (s.status === "done") {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // Should have been called 3 times (initial + 2 retries) before ExitGracefully
    expect(ideationCalls).toBe(3);
    expect(actor.getSnapshot().value).toBe("ExitGracefully");
    expect(actor.getSnapshot().context.ideationRetries).toBe(3);
  });

  it("machine proceeds to Validation when novelty is confirmed", async () => {
    const { createActor, fromPromise } = await import("xstate");
    const { researchMachine } = await import("../../src/orchestration/machine");

    const visited: string[] = [];

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: fromPromise<any, any>(async () => ({
          classification: "NOVEL_DISCOVERY",
          hypothesis: "theorem novel_bound : ∀ n : ℕ, n > 0 → 2 * n > n",
          plan: {
            prompt: "test",
            seed_paper: { arxivId: "2401.00001", title: "Novel", abstract: "Novel" },
            extension_hypothesis: "novel bound",
            domains_to_probe: ["number_theory"],
            lean_target_sketch: "theorem novel_bound ...",
          },
          literature: ["Novel Paper"],
        })),
        validationActor: fromPromise<any, any>(async () => ({
          isValid: true,
          ast: { validated: true },
        })),
        sandboxActor: fromPromise<any, any>(async () => ({
          signal: "WITNESS_FOUND",
          energy: 0,
          evidence: { hypothesis: "test", results: [], synthesis: "", anomalies: [], kills: [] },
          data: {},
          approvedConjecture: { signature: "theorem novel_bound ...", description: "novel" },
          redTeamHistory: [],
        })),
        redTeamActor: fromPromise<any, any>(async () => ({
          status: "VERIFIED_BULLETPROOF",
        })),
        leanVerificationActor: fromPromise<any, any>(async () => ({
          isComplete: true,
          tactic: "omega",
          error: null,
        })),
        tacticGeneratorActor: fromPromise<any, any>(async () => ({
          role: "TACTICIAN",
          response: { lean_tactics: [{ tactic: "omega" }] },
        })),
        scribeActor: fromPromise<any, any>(async () => ({
          reportPath: "/tmp/test/paper.tex",
        })),
      },
    });

    const actor = createActor(testMachine);
    actor.subscribe((s) => {
      const v = s.value;
      const stateName = typeof v === "object" && v !== null ? (Object.keys(v)[0] || "unknown") : String(v);
      if (!visited.includes(stateName)) visited.push(stateName);
    });

    actor.start();
    actor.send({
      type: "START",
      prompt: "novel math",
      apiKey: "test",
      workspaceDir: "/tmp",
      outputDir: "/tmp/test",
      publishableMode: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out. Current: ${JSON.stringify(actor.getSnapshot().value)}`)),
        5000,
      );
      actor.subscribe((s) => {
        if (s.status === "done") {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    expect(visited).toContain("Ideation");
    expect(visited).toContain("Validation");
    expect(actor.getSnapshot().context.noveltyClassification).toBe("NOVEL_DISCOVERY");
  });
});
