import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";

const BASE_DIR = "./tmp_test_workspace";
const RUN_NAME = "test_run";

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────

beforeEach(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────

describe("WorkspaceManager — Initialization", () => {
  test("creates the full directory hierarchy on init", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();

    expect(existsSync(join(BASE_DIR, "runs", RUN_NAME))).toBe(true);
    expect(existsSync(join(BASE_DIR, "runs", RUN_NAME, "domain_skills"))).toBe(true);
    expect(existsSync(join(BASE_DIR, "global_config"))).toBe(true);
  });

  test("is idempotent — calling init twice does not error", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.init(); // Should not throw
  });
});

// ──────────────────────────────────────────────
// Lab Log (Append-Only Ledger)
// ──────────────────────────────────────────────

describe("WorkspaceManager — Lab Log", () => {
  test("failed attempt logs ❌ and error, never ✅", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.logAttempt("Try induction", "code()", "Error: missing base case", false);

    const logContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "lab_log.md")).text();
    expect(logContent).toContain("Error: missing base case");
    expect(logContent).not.toContain("✅");
    expect(logContent).toContain("❌");
  });

  test("successful attempt logs ✅", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.logAttempt("Direct proof", "prove(x > 0)", "unsat", true);

    const logContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "lab_log.md")).text();
    expect(logContent).toContain("✅");
    expect(logContent).toContain("unsat");
  });

  test("multiple calls accumulate — append-only, never overwrite", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.logAttempt("Attempt 1", "code_1()", "fail_1", false);
    await wm.logAttempt("Attempt 2", "code_2()", "fail_2", false);
    await wm.logAttempt("Attempt 3", "code_3()", "success", true);

    const logContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "lab_log.md")).text();
    expect(logContent).toContain("fail_1");
    expect(logContent).toContain("fail_2");
    expect(logContent).toContain("success");
  });

  test("logged code appears in the entry", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.logAttempt("Test tactic", "x = Int('x')\nprove(x > 0)", "unsat", true);

    const logContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "lab_log.md")).text();
    expect(logContent).toContain("x = Int('x')");
  });

  test("each entry contains a timestamp", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.logAttempt("Tactic", "code()", "output", false);

    const logContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "lab_log.md")).text();
    // Should match YYYY-MM-DD pattern
    expect(logContent).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

// ──────────────────────────────────────────────
// Happy Path (Current Progress)
// ──────────────────────────────────────────────

describe("WorkspaceManager — Happy Path", () => {
  test("verified steps accumulate in current_progress.md", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.updateHappyPath("Step 1: x = y");
    await wm.updateHappyPath("Step 2: y = z");

    const progress = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "current_progress.md")).text();
    expect(progress).toContain("Step 1: x = y");
    expect(progress).toContain("Step 2: y = z");
  });

  test("backtracking removes last N steps correctly", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.updateHappyPath("Step 1: x = y");
    await wm.updateHappyPath("Step 2: y = z");
    await wm.updateHappyPath("Step 3: z = 0");

    await wm.backtrackProgress(2); // Remove steps 2 and 3

    const progressContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "current_progress.md")).text();
    const progressLines = progressContent.trim().split("\n").filter(Boolean);

    expect(progressLines.length).toBe(1);
    expect(progressLines[0]).toContain("Step 1");
  });

  test("backtracking more than exists leaves empty file", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.updateHappyPath("Step 1: only step");

    await wm.backtrackProgress(5);

    const progress = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "current_progress.md")).text();
    expect(progress.trim()).toBe("");
  });

  test("backtracking 0 is a no-op", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await wm.updateHappyPath("Step 1: x = y");
    await wm.updateHappyPath("Step 2: y = z");

    await wm.backtrackProgress(0);

    const progressContent = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "current_progress.md")).text();
    const progressLines = progressContent.trim().split("\n").filter(Boolean);
    expect(progressLines.length).toBe(2);
  });

  test("backtracking on nonexistent file does not crash", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    // No updateHappyPath called — progress file doesn't exist
    await wm.backtrackProgress(3); // Should be a no-op, not throw
  });
});

// ──────────────────────────────────────────────
// Context Window Builder
// ──────────────────────────────────────────────

describe("WorkspaceManager — Context Window", () => {
  async function writeMinimalGlobalConfig(baseDir: string) {
    const gc = join(baseDir, "global_config");
    await mkdir(gc, { recursive: true });
    await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
    await Bun.write(join(gc, "general_skills.md"), "Use deductive reasoning.");
    await Bun.write(join(gc, "config.json"), '{"solver":{"z3":{"timeoutMs":30000}}}');
  }

  test("includes the objective text", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await writeMinimalGlobalConfig(BASE_DIR);
    await Bun.write(
      join(BASE_DIR, "runs", RUN_NAME, "objective.md"),
      "Prove that there are infinitely many primes.",
    );

    const ctx = await wm.buildContextWindow();
    expect(ctx).toContain("infinitely many primes");
  });

  test("includes verified progress", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await writeMinimalGlobalConfig(BASE_DIR);
    await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Test objective");
    await wm.updateHappyPath("Step 1: base case verified");

    const ctx = await wm.buildContextWindow();
    expect(ctx).toContain("base case verified");
  });

  test("includes recent failures from lab log", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await writeMinimalGlobalConfig(BASE_DIR);
    await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Test objective");
    await wm.logAttempt("Bad tactic", "broken_code()", "SyntaxError: unexpected EOF", false);

    const ctx = await wm.buildContextWindow();
    expect(ctx).toContain("SyntaxError: unexpected EOF");
  });

  test("truncates gracefully with small maxTokens", async () => {
    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();
    await writeMinimalGlobalConfig(BASE_DIR);
    await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Test objective");

    // Flood the lab log
    for (let i = 0; i < 200; i++) {
      await wm.logAttempt(`Tactic ${i}`, `code_${i}()`, `Error ${i}`, false);
    }

    const ctx = await wm.buildContextWindow(500);
    // Generous upper bound — 500 tokens ≈ ~2000 chars, allow some overhead
    expect(ctx.length).toBeLessThan(500 * 6);
  });
});
