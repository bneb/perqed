/**
 * TDD: --wiles flag, Orthogonal Paradigm Forcing (OPF) prompt,
 * formulate() initial injection, and SA bypass gate.
 *
 * Tests cover:
 *   1. computeEscalation escalation ladder remains intact (GREEN guard)
 *   2. formulateDAG(forceWilesMode=true) → T=0.95 + OPF 4-step prompt
 *   3. formulateDAG(forceWilesMode=false) → T=0.2, no OPF
 *   4. buildFormulationPreamble(true)  → contains OPF header in initial prompt
 *   5. buildFormulationPreamble(false) → no OPF header in initial prompt
 *   6. parseArgs --wiles  → wiles=true
 *   7. parseArgs (absent) → wiles=false
 *   8. shouldRunSearchPhase(ramsey_config, wilesMode=true)  → false (SA bypassed)
 *   9. shouldRunSearchPhase(ramsey_config, wilesMode=false) → true  (SA runs)
 *  10. shouldRunSearchPhase(unknown config, wilesMode=false) → false (no search)
 */

import { describe, test, expect, beforeEach } from "bun:test";

import { computeEscalation, ArchitectClient } from "../src/architect_client";
import { parseArgs, buildFormulationPreamble, shouldRunSearchPhase } from "../src/cli/perqed";

// ── 1: computeEscalation escalation ladder (existing, must stay GREEN) ────────

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

// ── 2–3: formulateDAG — OPF 3-step prompt override ──────────────────────────

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

  let lastPayload: any = null;

  beforeEach(() => {
    lastPayload = null;
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

  test("forceWilesMode=true → T=0.95 + OPF 3-step prompt injected", async () => {
    const client = makeClient();
    await client.formulateDAG("journal context", "test goal", [], [], undefined, true);

    expect(lastPayload).not.toBeNull();
    expect(lastPayload.generationConfig.temperature).toBe(0.95);
    const prompt = lastPayload.contents[0].parts[0].text as string;
    // All four OPF steps must be present
    expect(prompt).toContain("STEP 1 - HISTORICAL ANTI-PATTERN RECOGNITION");
    expect(prompt).toContain("STEP 2 - THE STRICT BAN");
    expect(prompt).toContain("STEP 3 - THE FUNCTORIAL LEAP");
    expect(prompt).toContain("STEP 4 - THE SIGNATURE ANCHOR (ANTI-HALLUCINATION)");
  });

  test("forceWilesMode=false → T=0.2, no OPF steps injected", async () => {
    const client = makeClient();
    await client.formulateDAG("journal context", "test goal", [], [], undefined, false);

    expect(lastPayload).not.toBeNull();
    expect(lastPayload.generationConfig.temperature).toBe(0.2);
    const prompt = lastPayload.contents[0].parts[0].text as string;
    expect(prompt).not.toContain("STEP 1 - HISTORICAL ANTI-PATTERN RECOGNITION");
  });
});

// ── 4–5: buildFormulationPreamble — OPF injected into initial call ─────────

describe("buildFormulationPreamble (formulate() wilesMode injection)", () => {
  test("wilesMode=true → preamble contains OPF header and all 4 steps", () => {
    const preamble = buildFormulationPreamble(true);
    expect(preamble).toContain("MANDATORY WILES MANEUVER");
    expect(preamble).toContain("STEP 1 - HISTORICAL ANTI-PATTERN RECOGNITION");
    expect(preamble).toContain("STEP 2 - THE STRICT BAN");
    expect(preamble).toContain("STEP 3 - THE FUNCTORIAL LEAP");
    expect(preamble).toContain("STEP 4 - THE SIGNATURE ANCHOR (ANTI-HALLUCINATION)");
  });

  test("wilesMode=false → preamble uses normal INITIAL TRIAGE text, no OPF", () => {
    const preamble = buildFormulationPreamble(false);
    expect(preamble).not.toContain("STEP 1 - HISTORICAL ANTI-PATTERN RECOGNITION");
  });
});

// ── 6–7: CLI flag parsing ────────────────────────────────────────────────────

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

// ── 8–10: shouldRunSearchPhase — SA bypass gate ──────────────────────────────

describe("shouldRunSearchPhase (SA bypass gate)", () => {
  const ramseyConfig = { problem_class: "ramsey_coloring", domain_size: 35, r: 4, s: 6 };
  const unknownConfig = { problem_class: "unknown" };

  test("wilesMode=true suppresses SA even for ramsey_coloring (the bypass)", () => {
    expect(shouldRunSearchPhase(ramseyConfig, true)).toBe(false);
  });

  test("wilesMode=false runs SA for ramsey_coloring (normal path)", () => {
    expect(shouldRunSearchPhase(ramseyConfig, false)).toBe(true);
  });

  test("unknown problem_class skips SA regardless of wilesMode", () => {
    expect(shouldRunSearchPhase(unknownConfig, false)).toBe(false);
    expect(shouldRunSearchPhase(unknownConfig, true)).toBe(false);
  });
});

