/**
 * TDD: --wiles flag & formulateDAG forceWilesMode
 *
 * RED tests — all fail before implementation.
 *
 * Tests cover:
 *   1. computeEscalation returns Stage 3 correctly at 6+ failures (existing ladder intact)
 *   2. formulateDAG sends T=0.95 + "MANDATORY WILES MANEUVER OVERRIDE" when forceWilesMode=true
 *   3. formulateDAG uses normal ladder when forceWilesMode=false
 *   4. parseArgs correctly sets wiles=true for --wiles flag
 *   5. parseArgs sets wiles=false when flag is absent
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

import { computeEscalation, ArchitectClient } from "../src/architect_client";
import { parseArgs } from "../src/cli/perqed";

// ── 1–3: computeEscalation escalation ladder (existing, should remain GREEN) ─

describe("computeEscalation (escalation ladder integrity)", () => {
  test("Stage 1: T=0.2 for 0 failures", () => {
    const { temperature } = computeEscalation(0);
    expect(temperature).toBe(0.2);
  });

  test("Stage 2: T=0.70 for 3 failures", () => {
    const { temperature } = computeEscalation(3);
    expect(temperature).toBe(0.70);
  });

  test("Stage 3: T=0.95 for 6 failures (Wiles Maneuver)", () => {
    const { temperature } = computeEscalation(6);
    expect(temperature).toBe(0.95);
  });
});

// ── 4–5: formulateDAG Wiles Mode override ────────────────────────────────────

describe("formulateDAG forceWilesMode", () => {
  const VALID_DAG = JSON.stringify({
    id: "wiles-test-dag",
    goal: "test goal",
    nodes: [
      {
        id: "lit_node",
        kind: "literature",
        label: "Search relevant literature",
        dependsOn: [],
        config: { query: "test" },
        status: "pending",
      },
    ],
    createdAt: new Date().toISOString(),
  });

  /** Capture the fetch payload so we can inspect temperature and prompt. */
  let lastPayload: any = null;

  beforeEach(() => {
    lastPayload = null;
    // Mirror the pattern in escalating_creativity.test.ts — reinstall the
    // mock in each beforeEach to override any stale globalThis.fetch from
    // sibling test files in the same worker process.
    (globalThis as any).fetch = async (_url: string, opts: RequestInit) => {
      lastPayload = JSON.parse(opts.body as string);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: VALID_DAG }] } }],
        }),
        text: async () => "",
      };
    };
  });

  function makeClient() {
    return new ArchitectClient({ apiKey: "test-key", model: "gemini-test" });
  }

  test("forceWilesMode=true overrides T to 0.95 and injects MANDATORY WILES MANEUVER OVERRIDE", async () => {
    const client = makeClient();
    await client.formulateDAG("journal context", "test goal", [], [], undefined, true);

    expect(lastPayload).not.toBeNull();
    expect(lastPayload.generationConfig.temperature).toBe(0.95);
    const promptText = lastPayload.contents[0].parts[0].text as string;
    expect(promptText).toContain("MANDATORY WILES MANEUVER OVERRIDE");
  });

  test("forceWilesMode=false uses normal ladder (T=0.2 for 0 failures)", async () => {
    const client = makeClient();
    await client.formulateDAG("journal context", "test goal", [], [], undefined, false);

    expect(lastPayload).not.toBeNull();
    expect(lastPayload.generationConfig.temperature).toBe(0.2);
    const promptText = lastPayload.contents[0].parts[0].text as string;
    expect(promptText).not.toContain("MANDATORY WILES MANEUVER OVERRIDE");
  });
});



// ── 6–7: CLI flag parsing ─────────────────────────────────────────────────────

describe("parseArgs --wiles flag", () => {
  test("sets wiles=true when --wiles is present", () => {
    const args = parseArgs(["--prompt=Prove R(4,6)", "--wiles"]);
    expect(args.wiles).toBe(true);
  });

  test("sets wiles=false when --wiles is absent", () => {
    const args = parseArgs(["--prompt=Prove R(4,6)"]);
    expect(args.wiles).toBe(false);
  });
});
