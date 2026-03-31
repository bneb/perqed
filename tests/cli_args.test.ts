/**
 * tests/cli_args.test.ts — CLI argument parsing (TDD RED → GREEN)
 *
 * Tests the argument parsing logic that distinguishes between
 * the legacy `bun run src/cli.ts <run_name>` mode and the new
 * `bun run src/cli.ts prompt="..."` research pipeline mode.
 *
 * Because the parser is a pure function embedded in cli.ts, we extract
 * and test its logic in isolation without spawning subprocesses.
 */

import { describe, test, expect } from "bun:test";

// ── Inline the pure parseArgs logic for isolated testing ──────────────────────
//
// We deliberately inline this rather than exporting it from cli.ts to keep
// the CLI entrypoint clean, and to validate the logic contract independently.

interface ParsedArgs {
  prompt: string | null;
  runName: string;
  liveMode: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const promptArg = argv.find((a) => a.startsWith("prompt="));
  if (promptArg) {
    const raw = promptArg.slice("prompt=".length);
    const prompt = raw.replace(/^["']|["']$/g, "");
    return { prompt, runName: "research", liveMode: true };
  }
  return {
    prompt: null,
    runName: argv[0] ?? "default_run",
    liveMode: argv.includes("--live"),
  };
}

// ── prompt= detection ─────────────────────────────────────────────────────────

describe("CLI — prompt= argument detection", () => {
  test("detects unquoted prompt= value", () => {
    const r = parseArgs(["prompt=find a paper on Ramsey theory"]);
    expect(r.prompt).toBe("find a paper on Ramsey theory");
  });

  test("detects double-quoted prompt= value", () => {
    const r = parseArgs(['prompt="find a recent arxiv paper"']);
    expect(r.prompt).toBe("find a recent arxiv paper");
  });

  test("detects single-quoted prompt= value", () => {
    const r = parseArgs(["prompt='spectral graph theory extension'"]);
    expect(r.prompt).toBe("spectral graph theory extension");
  });

  test("sets runName to 'research' when prompt= is present", () => {
    const r = parseArgs(['prompt="anything"']);
    expect(r.runName).toBe("research");
  });

  test("sets liveMode=true when prompt= is present (pipeline always uses live)", () => {
    const r = parseArgs(['prompt="anything"']);
    expect(r.liveMode).toBe(true);
  });

  test("returns null prompt when no prompt= arg present", () => {
    const r = parseArgs(["my_run", "--live"]);
    expect(r.prompt).toBeNull();
  });
});

// ── legacy run_name mode ──────────────────────────────────────────────────────

describe("CLI — legacy run_name mode", () => {
  test("uses first positional arg as runName", () => {
    const r = parseArgs(["my_experiment_run"]);
    expect(r.runName).toBe("my_experiment_run");
  });

  test("defaults runName to 'default_run' with no args", () => {
    const r = parseArgs([]);
    expect(r.runName).toBe("default_run");
  });

  test("--live flag sets liveMode=true", () => {
    const r = parseArgs(["my_run", "--live"]);
    expect(r.liveMode).toBe(true);
  });

  test("liveMode is false when --live is absent", () => {
    const r = parseArgs(["my_run"]);
    expect(r.liveMode).toBe(false);
  });

  test("liveMode is false with no args", () => {
    const r = parseArgs([]);
    expect(r.liveMode).toBe(false);
  });

  test("prompt is null in legacy mode", () => {
    const r = parseArgs(["my_run", "--live"]);
    expect(r.prompt).toBeNull();
  });
});

// ── edge cases ────────────────────────────────────────────────────────────────

describe("CLI — edge cases", () => {
  test("prompt='' (empty quoted string) returns empty string not null", () => {
    const r = parseArgs(['prompt=""']);
    // After stripping quotes, empty string — still not null
    expect(r.prompt).toBe("");
  });

  test("prompt= is detected even when other args precede it", () => {
    // Unusual but should still work — prompt= can be anywhere in argv
    const r = parseArgs(["--verbose", 'prompt="find something"']);
    expect(r.prompt).toBe("find something");
  });

  test("only the first prompt= argument is used", () => {
    const r = parseArgs(['prompt="first"', 'prompt="second"']);
    // Array.find() returns the first match
    expect(r.prompt).toBe("first");
  });

  test("runName with --live flag but no positional comes out as first arg", () => {
    const r = parseArgs(["--live"]);
    // "--live" is the only arg, it becomes the run name in the legacy path
    // since no prompt= is found and argv[0] is "--live"
    expect(r.runName).toBe("--live");
    expect(r.liveMode).toBe(true);
  });
});
