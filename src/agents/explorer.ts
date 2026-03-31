/**
 * explorer.ts — Multi-Domain Empirical Investigation Agent
 *
 * Given a research hypothesis, this agent:
 *   1. Uses Gemini to select N mathematical domains to probe.
 *   2. Generates a self-contained C or Python script per domain.
 *   3. Compiles/runs each script in a sandboxed subprocess.
 *   4. Synthesizes all results into a structured EvidenceReport.
 *
 * This reproduces the "69-crack forensic gauntlet" pattern from the
 * Goldbach exploration, but fully AI-driven and prompt-adaptive.
 */

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  InvestigationScript,
  ScriptResult,
  EvidenceReport,
} from "./research_types";

const DEFAULT_SANDBOX_TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 8_000;

export interface ExplorerConfig {
  apiKey: string;
  /** Number of domains to probe (default: 7) */
  domainDepth?: number;
  model?: string;
  /** Subprocess timeout in ms (default: 30000). Override in tests for speed. */
  sandboxTimeoutMs?: number;
}

export class ExplorerAgent {
  private ai: GoogleGenAI;
  private domainDepth: number;
  private model: string;
  private sandboxTimeoutMs: number;

  constructor(cfg: ExplorerConfig) {
    this.ai = new GoogleGenAI({ apiKey: cfg.apiKey });
    this.domainDepth = cfg.domainDepth ?? 7;
    this.model = cfg.model ?? "gemini-2.5-flash";
    this.sandboxTimeoutMs = cfg.sandboxTimeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS;
  }

  /**
   * Main entry point. Runs the full exploration pipeline for a hypothesis.
   */
  async investigate(
    hypothesis: string,
    domains: string[],
  ): Promise<EvidenceReport> {
    console.log(`\n[Explorer] Generating investigation scripts for ${domains.length} domains...`);
    const scripts = await this.generateScripts(hypothesis, domains);

    console.log(`[Explorer] Running ${scripts.length} scripts in sandbox...`);
    const results = await this.runAll(scripts);

    console.log(`[Explorer] Synthesizing evidence...`);
    const { synthesis, anomalies, kills } = await this.synthesize(hypothesis, results);

    return { hypothesis, results, synthesis, anomalies, kills };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Ask Gemini to generate investigation scripts for the given domains. */
  private async generateScripts(
    hypothesis: string,
    domains: string[],
  ): Promise<InvestigationScript[]> {
    const domainList = domains.slice(0, this.domainDepth).join(", ");

    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          domain: { type: Type.STRING },
          language: { type: Type.STRING, enum: ["c", "python"] },
          purpose: { type: Type.STRING },
          code: { type: Type.STRING },
        },
        required: ["domain", "language", "purpose", "code"],
      },
    };

    const prompt = `You are an elite computational mathematician designing empirical tests.

HYPOTHESIS: ${hypothesis}

DOMAINS TO PROBE: ${domainList}

For each domain, write a self-contained empirical investigation script that:
1. Tests whether the hypothesis has hidden structure in that domain.
2. Outputs clear numerical or boolean results to stdout.
3. Is COMPLETELY SELF-CONTAINED — no external libraries beyond <math.h> for C or standard library for Python.
4. Runs in under 20 seconds on a modern machine.
5. Ends with a one-line verdict: "SIGNAL DETECTED" or "HYPOTHESIS FALSIFIED IN THIS DOMAIN".

For C: include all necessary #includes, a main() function, compile with: cc -O2 file.c -lm
For Python: use only the standard library.

Generate exactly one script per domain. Keep scripts under 150 lines.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "Output strict JSON matching the schema. Code must be pure ASCII.",
        temperature: 0.4,
      },
    });

    if (!response.text) throw new Error("[Explorer] Script generation failed: empty response");
    return JSON.parse(response.text) as InvestigationScript[];
  }

  /** Run all scripts concurrently in sandboxed subprocesses. */
  private async runAll(scripts: InvestigationScript[]): Promise<ScriptResult[]> {
    return Promise.all(scripts.map((s) => this.runScript(s)));
  }

  /** Compile (if C) and run a single script in a sandboxed subprocess. */
  private async runScript(script: InvestigationScript): Promise<ScriptResult> {
    const id = `perqed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const start = Date.now();

    if (script.language === "c") {
      return this.runC(script, id, start);
    } else {
      return this.runPython(script, id, start);
    }
  }

  private async runC(
    script: InvestigationScript,
    id: string,
    start: number,
  ): Promise<ScriptResult> {
    const srcPath = join(tmpdir(), `${id}.c`);
    const binPath = join(tmpdir(), id);

    writeFileSync(srcPath, script.code, "utf8");

    // Compile
    const compileResult = await this.exec("cc", ["-O2", "-o", binPath, srcPath, "-lm"]);
    if (compileResult.exitCode !== 0) {
      this.cleanup([srcPath]);
      return {
        domain: script.domain,
        purpose: script.purpose,
        language: "c",
        exitCode: compileResult.exitCode,
        stdout: "",
        stderr: `Compile error:\n${compileResult.stderr.slice(0, 1000)}`,
        wallTimeMs: Date.now() - start,
        timedOut: false,
      };
    }

    // Run
    const runResult = await this.exec(binPath, []);
    this.cleanup([srcPath, binPath]);

    return {
      domain: script.domain,
      purpose: script.purpose,
      language: "c",
      exitCode: runResult.exitCode,
      stdout: runResult.stdout.slice(0, MAX_STDOUT_BYTES),
      stderr: runResult.stderr.slice(0, 500),
      wallTimeMs: Date.now() - start,
      timedOut: runResult.timedOut,
    };
  }

  private async runPython(
    script: InvestigationScript,
    id: string,
    start: number,
  ): Promise<ScriptResult> {
    const srcPath = join(tmpdir(), `${id}.py`);
    writeFileSync(srcPath, script.code, "utf8");

    const result = await this.exec("python3", [srcPath]);
    this.cleanup([srcPath]);

    return {
      domain: script.domain,
      purpose: script.purpose,
      language: "python",
      exitCode: result.exitCode,
      stdout: result.stdout.slice(0, MAX_STDOUT_BYTES),
      stderr: result.stderr.slice(0, 500),
      wallTimeMs: Date.now() - start,
      timedOut: result.timedOut,
    };
  }

  /** Execute a subprocess with timeout, capturing stdout/stderr. */
  private exec(
    cmd: string,
    args: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
    const timeoutMs = this.sandboxTimeoutMs;
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, { timeout: timeoutMs });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, timeoutMs);

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout, stderr, timedOut });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({ exitCode: 1, stdout, stderr: err.message, timedOut: false });
      });
    });
  }

  private cleanup(paths: string[]): void {
    for (const p of paths) {
      try { if (existsSync(p)) unlinkSync(p); } catch {}
    }
  }

  /**
   * Use Gemini to synthesize all script results into a structured summary.
   */
  private async synthesize(
    hypothesis: string,
    results: ScriptResult[],
  ): Promise<{ synthesis: string; anomalies: string[]; kills: string[] }> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        synthesis: { type: Type.STRING },
        anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
        kills: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["synthesis", "anomalies", "kills"],
    };

    const resultsText = results
      .map(
        (r) =>
          `[${r.domain}] (${r.language}, exit=${r.exitCode}, ${r.wallTimeMs}ms)\n${r.stdout || "(no output)"}\n${r.stderr ? `STDERR: ${r.stderr}` : ""}`,
      )
      .join("\n\n---\n\n");

    const prompt = `You are a rigorous mathematical analyst. Review these empirical investigation results for the hypothesis:

HYPOTHESIS: ${hypothesis}

RESULTS:
${resultsText}

Synthesize the findings. Identify:
- anomalies: domains where unexpected structure or signal was detected (list domain names)
- kills: domains where the hypothesis was cleanly falsified (list domain names)
- synthesis: a concise 2-3 paragraph academic summary of what was found

Be skeptical. A non-zero result is not automatically a signal.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      },
    });

    if (!response.text) {
      return {
        synthesis: "Synthesis unavailable.",
        anomalies: [],
        kills: results.map((r) => r.domain),
      };
    }

    return JSON.parse(response.text) as {
      synthesis: string;
      anomalies: string[];
      kills: string[];
    };
  }
}
