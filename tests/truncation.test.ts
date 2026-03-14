/**
 * Sprint 4 Tests — Context window token management and smart truncation.
 *
 * These tests verify that the upgraded buildContextWindow() correctly
 * protects sacred files (objective, progress, directive) while
 * intelligently truncating the lab log with a head+tail strategy.
 *
 * NOTE: To avoid O(n²) I/O from hundreds of individual logAttempt() calls,
 * large lab logs are written directly via Bun.write().
 */

import { expect, test, describe, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";

const BASE_DIR = "./tmp_test_truncation";
const RUN_NAME = "trunc_test";

/** Generate a single lab log entry string (matches logAttempt format). */
function makeEntry(id: string, success: boolean = false): string {
  const status = success ? "✅ SUCCESS" : "❌ FAILED";
  return [
    `### Attempt: 2026-03-14 00:00:00 | Status: ${status}`,
    `**Tactic/Approach:** ${id}`,
    `**Code Executed:**`,
    "```python",
    `code_${id}()`,
    "```",
    `**Solver Output:**`,
    "```",
    `Error_${id}`,
    "```",
    "---",
    "",
  ].join("\n");
}

/** Build a lab log with N entries written in one shot. */
function buildBulkLabLog(count: number): string {
  const entries: string[] = [];
  for (let i = 0; i < count; i++) {
    entries.push(makeEntry(`Tactic_${i.toString().padStart(4, "0")}`));
  }
  return entries.join("");
}

async function freshWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();
  const gc = join(BASE_DIR, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Prove the Riemann Hypothesis.");
  return wm;
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Token Heuristic
// ──────────────────────────────────────────────

describe("Token Management — Heuristic", () => {
  test("token estimation: context stays within maxTokens char budget", async () => {
    const wm = await freshWorkspace();

    // Write 200 entries in one shot
    await Bun.write(wm.paths.labLog, buildBulkLabLog(200));

    const maxTokens = 1000; // ~4000 chars budget
    const ctx = await wm.buildContextWindow(maxTokens);

    expect(ctx.length).toBeLessThanOrEqual(maxTokens * 4 + 100);
  });
});

// ──────────────────────────────────────────────
// Sacred Files Protection
// ──────────────────────────────────────────────

describe("Token Management — Sacred Files Protection", () => {
  test("objective and progress are never truncated even when they consume most of the budget", async () => {
    const wm = await freshWorkspace();

    // Write a huge objective
    const bigObjective = "Prove the following theorem: ".padEnd(2000, "x");
    await Bun.write(wm.paths.objective, bigObjective);

    // Write bulky progress in one shot
    const progressLines = Array.from({ length: 30 }, (_, i) =>
      `- Step ${i}: verified sub-lemma ${i} with a fairly detailed description`,
    ).join("\n") + "\n";
    await Bun.write(wm.paths.progress, progressLines);

    // Write lab log in one shot
    await Bun.write(wm.paths.labLog, buildBulkLabLog(50));

    // Write a directive
    await Bun.write(wm.paths.architectDirective, "Use proof by contradiction.");

    // Small token budget — forces heavy truncation
    const ctx = await wm.buildContextWindow(1500);

    // Sacred files must be fully intact
    expect(ctx).toContain(bigObjective);
    expect(ctx).toContain("Step 0: verified sub-lemma 0");
    expect(ctx).toContain("Step 29: verified sub-lemma 29");
    expect(ctx).toContain("Use proof by contradiction.");
  });
});

// ──────────────────────────────────────────────
// Middle Truncation (Head + Tail Strategy)
// ──────────────────────────────────────────────

describe("Token Management — Middle Truncation", () => {
  test("inserts [TRUNCATED] marker and preserves oldest and newest entries", async () => {
    const wm = await freshWorkspace();

    // Write 500 entries in one shot (instant, no O(n²) I/O)
    await Bun.write(wm.paths.labLog, buildBulkLabLog(500));

    // Moderate budget — forces truncation
    const ctx = await wm.buildContextWindow(2000);

    // Must contain the TRUNCATED marker
    expect(ctx).toContain("TRUNCATED");

    // Must contain early entries (head — first 10%)
    expect(ctx).toContain("Tactic_0000");

    // Must contain the most recent entries (tail — last 90%)
    expect(ctx).toContain("Tactic_0499");

    // Must stay within budget
    expect(ctx.length).toBeLessThanOrEqual(2000 * 4 + 100);
  });

  test("does not truncate if lab log fits within budget", async () => {
    const wm = await freshWorkspace();

    // Only a few entries
    await wm.logAttempt("Tactic A", "code_a()", "Error A", false);
    await wm.logAttempt("Tactic B", "code_b()", "Error B", false);

    const ctx = await wm.buildContextWindow(4000);

    // Should NOT contain truncation marker
    expect(ctx).not.toContain("TRUNCATED");
    expect(ctx).toContain("Tactic A");
    expect(ctx).toContain("Tactic B");
  });
});
