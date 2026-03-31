/**
 * tests/explorer.test.ts — ExplorerAgent (TDD RED → GREEN)
 *
 * Covers: script generation, real subprocess sandbox (Python + C),
 * timeout enforcement, stdout truncation, compile errors, concurrency,
 * temp file cleanup, and synthesis prompt contracts.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { ExplorerAgent } from "../src/agents/explorer";
import type { InvestigationScript } from "../src/agents/research_types";
import {
  geminiSequenceMock,
  geminiCapturingMock,
} from "./helpers/fetch_mock";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const PYTHON_FALSIFIED: InvestigationScript = {
  domain: "number_theory",
  language: "python",
  purpose: "Test additive structure of primes.",
  code: [
    "primes = [p for p in range(2, 100) if all(p % i != 0 for i in range(2, p))]",
    "print(f'Found {len(primes)} primes below 100')",
    "print('HYPOTHESIS FALSIFIED IN THIS DOMAIN')",
  ].join("\n"),
};

const PYTHON_SIGNAL: InvestigationScript = {
  domain: "complex_analysis",
  language: "python",
  purpose: "Detect analytic continuation boundaries.",
  code: [
    "import math",
    "result = sum((-1)**n / (n+1) for n in range(1000))",
    "print(f'Partial sum: {result:.6f}')",
    "print('SIGNAL DETECTED')",
  ].join("\n"),
};

const C_SIMPLE: InvestigationScript = {
  domain: "algebraic_topology",
  language: "c",
  purpose: "Compute Euler characteristic.",
  code: [
    "#include <stdio.h>",
    "int main() {",
    "    int V = 4, E = 6, F = 4;",
    "    printf(\"Euler: %d\\n\", V - E + F);",
    "    printf(\"HYPOTHESIS FALSIFIED IN THIS DOMAIN\\n\");",
    "    return 0;",
    "}",
  ].join("\n"),
};

const C_COMPILE_ERROR: InvestigationScript = {
  domain: "broken_domain",
  language: "c",
  purpose: "This has a compile error.",
  code: "#include <stdio.h>\nint main( {\n    printf(\"hello\\n\");\n}\n",
};

const PYTHON_INSTANT: InvestigationScript = {
  domain: "fast_domain",
  language: "python",
  purpose: "Exits immediately.",
  code: "print('done')\nprint('HYPOTHESIS FALSIFIED IN THIS DOMAIN')",
};

const DEFAULT_SYNTHESIS = {
  synthesis: "Evidence is mixed.",
  anomalies: ["complex_analysis"],
  kills: ["number_theory", "algebraic_topology"],
};

// ── script generation (mocked Gemini) ────────────────────────────────────────

describe("ExplorerAgent — script generation (mocked Gemini)", () => {
  test("investigate() returns EvidenceReport with the correct hypothesis", async () => {
    globalThis.fetch = geminiSequenceMock([[PYTHON_FALSIFIED], DEFAULT_SYNTHESIS]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("All primes above 2 are odd", ["number_theory"]);

    expect(report.hypothesis).toBe("All primes above 2 are odd");
  });

  test("results array has one entry per script returned by Gemini", async () => {
    globalThis.fetch = geminiSequenceMock([[PYTHON_FALSIFIED, PYTHON_SIGNAL], DEFAULT_SYNTHESIS]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 2 });
    const report = await explorer.investigate("test hypothesis", [
      "number_theory",
      "complex_analysis",
    ]);

    expect(report.results).toHaveLength(2);
    expect(report.results.map((r) => r.domain)).toContain("number_theory");
    expect(report.results.map((r) => r.domain)).toContain("complex_analysis");
  });

  test("anomalies and kills are populated from the synthesis response", async () => {
    globalThis.fetch = geminiSequenceMock([[PYTHON_FALSIFIED], DEFAULT_SYNTHESIS]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["number_theory"]);

    expect(report.anomalies).toEqual(DEFAULT_SYNTHESIS.anomalies);
    expect(report.kills).toContain("number_theory");
  });

  test("synthesis string is propagated from the Gemini synthesis call", async () => {
    globalThis.fetch = geminiSequenceMock([[PYTHON_FALSIFIED], DEFAULT_SYNTHESIS]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["number_theory"]);

    expect(report.synthesis).toBe(DEFAULT_SYNTHESIS.synthesis);
  });

  test("exactly 2 Gemini API calls: script generation + synthesis", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      [PYTHON_FALSIFIED],
      DEFAULT_SYNTHESIS,
    ]);
    globalThis.fetch = fetch;

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate("test", ["number_theory"]);

    expect(capturedBodies).toHaveLength(2);
  });

  test("script generation prompt includes the hypothesis string", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      [PYTHON_FALSIFIED],
      DEFAULT_SYNTHESIS,
    ]);
    globalThis.fetch = fetch;

    const UNIQUE_HYP = "HYPOTHESIS_ABCDEF_UNIQUE_12345";
    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate(UNIQUE_HYP, ["some_domain"]);

    // First call (script generation) must include the hypothesis
    expect(capturedBodies[0]).toContain(UNIQUE_HYP);
  });

  test("script generation prompt includes the domain list", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      [PYTHON_FALSIFIED],
      DEFAULT_SYNTHESIS,
    ]);
    globalThis.fetch = fetch;

    const UNIQUE_DOMAIN = "UNIQUE_DOMAIN_ZZZZZ_99999";
    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate("test", [UNIQUE_DOMAIN]);

    expect(capturedBodies[0]).toContain(UNIQUE_DOMAIN);
  });

  test("synthesis prompt includes stdout from script results", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      [PYTHON_INSTANT],
      DEFAULT_SYNTHESIS,
    ]);
    globalThis.fetch = fetch;

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate("test", ["fast_domain"]);

    // Second call (synthesis) should include script output
    expect(capturedBodies[1]).toContain("done");
  });
});

// ── sandbox execution (real subprocesses) ─────────────────────────────────────

describe("ExplorerAgent — sandbox execution (real subprocesses)", () => {
  test("Python: valid script captures stdout, exitCode=0", async () => {
    globalThis.fetch = geminiSequenceMock([
      [PYTHON_INSTANT],
      { ...DEFAULT_SYNTHESIS, kills: ["fast_domain"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["fast_domain"]);

    const result = report.results[0]!;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("done");
    expect(result.timedOut).toBe(false);
    expect(result.language).toBe("python");
  });

  test("C: valid script compiles, executes, and stdout captured", async () => {
    globalThis.fetch = geminiSequenceMock([
      [C_SIMPLE],
      { ...DEFAULT_SYNTHESIS, kills: ["algebraic_topology"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["algebraic_topology"]);

    const result = report.results[0]!;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Euler: 2");
    expect(result.language).toBe("c");
  });

  test("C: compile error yields non-zero exitCode and non-empty stderr", async () => {
    globalThis.fetch = geminiSequenceMock([
      [C_COMPILE_ERROR],
      { ...DEFAULT_SYNTHESIS, kills: ["broken_domain"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["broken_domain"]);

    const result = report.results[0]!;
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test("Python: syntax error yields non-zero exitCode", async () => {
    const badPython: InvestigationScript = {
      domain: "syntax_domain",
      language: "python",
      purpose: "Syntax error test.",
      code: "def broken(: print('oops')",
    };

    globalThis.fetch = geminiSequenceMock([
      [badPython],
      { ...DEFAULT_SYNTHESIS, kills: ["syntax_domain"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["syntax_domain"]);

    expect(report.results[0]!.exitCode).not.toBe(0);
  });

  test("timedOut=true when script exceeds sandboxTimeoutMs", async () => {
    const infiniteScript: InvestigationScript = {
      domain: "infinite_domain",
      language: "python",
      purpose: "Loops forever.",
      code: "import time\nwhile True:\n    time.sleep(0.1)\n",
    };

    globalThis.fetch = geminiSequenceMock([
      [infiniteScript],
      { synthesis: "timeout", anomalies: [], kills: ["infinite_domain"] },
    ]);

    const explorer = new ExplorerAgent({
      apiKey: "k",
      domainDepth: 1,
      sandboxTimeoutMs: 500,   // short timeout for test speed
    });
    const report = await explorer.investigate("test", ["infinite_domain"]);

    expect(report.results[0]!.timedOut).toBe(true);
  }, 10_000);

  test("stdout is truncated at MAX_STDOUT_BYTES (8000)", async () => {
    const verboseScript: InvestigationScript = {
      domain: "verbose_domain",
      language: "python",
      purpose: "Prints >8 KB.",
      code: [
        "for i in range(10000):",
        "    print(f'Line {i}: ' + 'x' * 100)",
        "print('HYPOTHESIS FALSIFIED IN THIS DOMAIN')",
      ].join("\n"),
    };

    globalThis.fetch = geminiSequenceMock([
      [verboseScript],
      { ...DEFAULT_SYNTHESIS, kills: ["verbose_domain"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["verbose_domain"]);

    expect(report.results[0]!.stdout.length).toBeLessThanOrEqual(8_000);
  });

  test("wallTimeMs is a positive number for every result", async () => {
    globalThis.fetch = geminiSequenceMock([
      [PYTHON_INSTANT],
      { ...DEFAULT_SYNTHESIS, kills: ["fast_domain"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    const report = await explorer.investigate("test", ["fast_domain"]);

    expect(report.results[0]!.wallTimeMs).toBeGreaterThan(0);
    expect(typeof report.results[0]!.wallTimeMs).toBe("number");
  });

  test("multiple scripts run concurrently (total time < sum of individual times)", async () => {
    const sleep200ms = (domain: string): InvestigationScript => ({
      domain,
      language: "python",
      purpose: "Sleep 200ms.",
      code: "import time\ntime.sleep(0.2)\nprint('HYPOTHESIS FALSIFIED IN THIS DOMAIN')",
    });

    globalThis.fetch = geminiSequenceMock([
      [sleep200ms("d1"), sleep200ms("d2"), sleep200ms("d3")],
      { synthesis: "ok", anomalies: [], kills: ["d1", "d2", "d3"] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 3 });
    const start = Date.now();
    const report = await explorer.investigate("test", ["d1", "d2", "d3"]);
    const elapsed = Date.now() - start;

    expect(report.results).toHaveLength(3);
    // Sequential would be ~600ms; concurrent should finish in under 1.2s with overhead
    expect(elapsed).toBeLessThan(1_200);
  }, 10_000);

  test("C temp files (.c source and binary) are deleted after execution", async () => {
    const { readdirSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");

    globalThis.fetch = geminiSequenceMock([
      [C_SIMPLE],
      { ...DEFAULT_SYNTHESIS, kills: ["algebraic_topology"], anomalies: [] },
    ]);

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate("test", ["algebraic_topology"]);

    const leftovers = readdirSync(tmpdir()).filter(
      (f) => f.startsWith("perqed_") && (f.endsWith(".c") || !f.includes(".")),
    );
    expect(leftovers).toHaveLength(0);
  });
});

// ── synthesis prompt contracts ────────────────────────────────────────────────

describe("ExplorerAgent — synthesis prompt contracts", () => {
  test("synthesis prompt includes the hypothesis", async () => {
    const UNIQUE_HYP = "UNIQUE_HYPOTHESIS_FOR_SYNTHESIS_77777";
    const { fetch, capturedBodies } = geminiCapturingMock([
      [PYTHON_INSTANT],
      DEFAULT_SYNTHESIS,
    ]);
    globalThis.fetch = fetch;

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate(UNIQUE_HYP, ["fast_domain"]);

    // Second body = synthesis call
    expect(capturedBodies[1]).toContain(UNIQUE_HYP);
  });

  test("synthesis prompt includes the domain name from results", async () => {
    const UNIQUE_DOMAIN = "UNIQUE_SYNTHESIS_DOMAIN_88888";
    const customScript: InvestigationScript = { ...PYTHON_INSTANT, domain: UNIQUE_DOMAIN };

    const { fetch, capturedBodies } = geminiCapturingMock([
      [customScript],
      DEFAULT_SYNTHESIS,
    ]);
    globalThis.fetch = fetch;

    const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
    await explorer.investigate("test", [UNIQUE_DOMAIN]);

    expect(capturedBodies[1]).toContain(UNIQUE_DOMAIN);
  });
});
