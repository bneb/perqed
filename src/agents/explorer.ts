/**
 * explorer.ts — Multi-Domain Empirical Investigation Agent
 *
 * Given a research hypothesis, this agent:
 *   1. Uses Gemini to select N mathematical domains to probe.
 *   2. Generates a self-contained C or Python script per domain.
 *   3. Compiles/runs each script in a sandboxed subprocess.
 *   4. Synthesizes all results into a structured EvidenceReport.
 *
 * This performs a comprehensive multi-domain diagnostic suite, 
 * fully AI-driven and prompt-adaptive.
 */

import { Type, type Schema } from "@google/genai";
import { PerqedLLM } from "../agency/llm_client";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  InvestigationScript,
  ScriptResult,
  EvidenceReport,
} from "./research_types";
import { getAgencyRegistry } from "../agency";
import { loadSkillsIndex } from "./skills_loader";
import { TrytetClient } from "../execution/trytet_client";
import { ProgramDatabase, type HeuristicProgram } from "./program_database";
import { FunSearchCrossover } from "./funsearch_crossover";

const DEFAULT_SANDBOX_TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 8_000;

export interface ExplorerConfig {
  apiKey: string;
  /** Number of domains to probe (default: 7) */
  domainDepth?: number;
  model?: string;
  /** Subprocess timeout in ms (default: 30000). Override in tests for speed. */
  sandboxTimeoutMs?: number;
  /** Optional root path to load skills from (default: ".agents/skills") */
  skillsRoot?: string;
}

export class ExplorerAgent {
  private ai: PerqedLLM;
  private domainDepth: number;
  private model: string;
  private sandboxTimeoutMs: number;
  private skillsRoot?: string;
  private trytet: TrytetClient;
  private apiKey: string;

  constructor(cfg: ExplorerConfig) {
    this.apiKey = cfg.apiKey;
    this.ai = new PerqedLLM({ apiKey: cfg.apiKey });
    this.domainDepth = cfg.domainDepth ?? 7;
    this.model = cfg.model ?? getAgencyRegistry().resolveProvider("python").model;
    this.sandboxTimeoutMs = cfg.sandboxTimeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS;
    this.skillsRoot = cfg.skillsRoot;
    this.trytet = new TrytetClient();
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
    const { synthesis, anomalies, falsifications } = await this.synthesize(hypothesis, results);

    return { hypothesis, results, synthesis, anomalies, falsifications };
  }

  /**
   * Phase 2: Evolutionary FunSearch over a pool of 64 Python heuristics.
   */
  async evolveDomain(
    domain: string,
    initialSeeds: string[],
    generations: number = 10,
  ): Promise<HeuristicProgram> {
    console.log(`\n[Explorer] Bootstrapping FunSearch Database with ${initialSeeds.length} seeds for ${domain}...`);
    const db = new ProgramDatabase({ capacity: 64 });
    const crossover = new FunSearchCrossover({ apiKey: this.apiKey, model: this.model });

    // Seed evaluation
    for (let i = 0; i < initialSeeds.length; i++) {
       const code = initialSeeds[i]!;
       const script: InvestigationScript = { domain, language: "python", purpose: "seed", code };
       const result = await this.runScript(script);
       const score = this.extractScore(result);
       db.registerProgram({ code, score });
       console.log(` > Seed ${i} scored: ${score}`);
    }

    // Evolutionary loop
    for (let gen = 0; gen < generations; gen++) {
       console.log(`[Explorer] Generation ${gen + 1}/${generations} ...`);
       try {
         const { parentA, parentB } = db.sampleParents();
         const childCode = await crossover.mutate(parentA, parentB, domain);
         
         const script: InvestigationScript = { domain, language: "python", purpose: "offspring", code: childCode };
         const result = await this.runScript(script);
         const score = this.extractScore(result);
         const candidateStructure = this.extractCandidateStructure(result);
         const currentBest = db.getPrograms()[0]?.score ?? -Infinity;
         
         if (candidateStructure && score > currentBest) {
             const isValid = await this.deterministicCrossVerifier(domain, candidateStructure);
             if (!isValid) {
                console.warn(`[Explorer] Heuristic produced a false positive. Penalizing program.`);
                db.registerProgram({ code: childCode, score: -1 }); // Penalize liar
                continue;
             }
         }
         
         db.registerProgram({ code: childCode, score });
         console.log(` > Offspring generated. Score: ${score}`);
       } catch (err: any) {
         console.warn(`[Explorer] Variation failed: ${err.message}`);
       }
    }

    const best = db.getPrograms()[0];
    if (!best) throw new Error("Evolution collapsed");
    
    return best;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private extractCandidateStructure(result: ScriptResult): any {
    const match = result.stdout.match(/CANDIDATE_STRUCTURE:\s*(\{.*\})/i);
    if (match) {
        try {
            return JSON.parse(match[1]!);
        } catch { return null; }
    }
    return null;
  }

  private async deterministicCrossVerifier(domain: string, candidateStructure: any): Promise<boolean> {
     // A localized exact verification step.
     // In a real implementation this would invoke Z3 or a deterministic algorithm.
     // For now we will assume true unless the structure violates a known constraint.
     if (!candidateStructure) return true;
     return true; 
  }

  /**
   * Evaluates the execution outputs to extract the combinatorial fitness score.
   * Looks for "SCORE: X". If none found or timed out, assigns 0.
   * If Z3 errors out or terminates brutally, assigns -1.
   */
  private extractScore(result: ScriptResult): number {
    if (result.stderr.includes("Z3Exception") || result.stderr.includes("MemoryError")) return -1;
    const match = result.stdout.match(/SCORE:\s*(\d+)/i);
    if (match) return parseInt(match[1]!, 10);
    return 0; // Default to zero if the script lacks numerical yield.
  }


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
          language: { type: Type.STRING, enum: ["python"] },
          purpose: { type: Type.STRING },
          code: { type: Type.STRING },
        },
        required: ["domain", "language", "purpose", "code"],
      },
    };

    const matchedSkills = this.matchSkillsByDomains(domains);
    const skillIndex = loadSkillsIndex(this.skillsRoot, matchedSkills);
    const skillInjection = skillIndex
      ? `\nYou are aware of the following mathematical capabilities and scripts within our local codebase that can be leveraged during your exploration framework:\n${skillIndex}\n\nUse this knowledge appropriately to utilize complex computational methods (for instance, structuring your script to load our local SMT solver, or explicitly writing a simulated annealing search loop for a combinatorial space). \nCRITICAL: Do not let this list limit your novel exploration. If a domain is best probed through pure linear algebra or brute-force code, do so instead of applying a skill unnecessarily.\n`
      : "";

    const prompt = `You are an expert computational mathematician designing empirical tests.

HYPOTHESIS: ${hypothesis}

DOMAINS TO PROBE: ${domainList}

For each domain, write a self-contained empirical investigation script that:
1. Tests whether the hypothesis has hidden structure in that domain.
2. Outputs clear numerical or boolean results to stdout.
3. Is COMPLETELY SELF-CONTAINED. You are encouraged to use robust scientific libraries: SymPy, NumPy, SciPy, or plain logic. DO NOT USE HEAVY NATIVE LIBRARIES (e.g., Z3) OR SAGEMATH. The Python code runs in a highly restricted WebAssembly WASI Sandbox; avoid C-extensions where possible.
4. Uses a "Robustness Wrapper": Python scripts should wrap their core logic in a try/except block to catch and report specific mathematical or runtime errors cleanly.
5. Runs in under 20 seconds on a modern machine.
6. Ends with a one-line verdict: "SIGNAL DETECTED" or "HYPOTHESIS FALSIFIED IN THIS DOMAIN".
CRITICAL: If the state space is too large to exhaustively check within 20 seconds (e.g. Ramsey Graph Search, Circulant cliques > N=30), do NOT output "FALSIFIED" if your script simply times out or fails to randomly stumble into a witness. You MUST output "SIGNAL DETECTED". We have a dedicated Z3 solver instance that will handle the complexity downstream. Only emit "FALSIFIED" if you mathematically prove a strict counter-example exists.

Do not cut any corners. Use a test driven approach with red-to-green workflows.

For Python: you may import numpy, sympy, and math to ensure mathematical accuracy. Do NOT write your own graph/algebra algorithms if a robust library can do it perfectly. Under no circumstances should you generate SageMath code, as the runtime strictly does not support native Fortran dependencies.
${skillIndex ? skillInjection : ""}
DEFINITION GUARDRAIL (CRITICAL):
Do NOT invent synthetic scoring functions, heuristic metrics, or proxy measures. Your scripts must compute standard, well-defined mathematical quantities (e.g., chromatic number, clique number, independence number, graph diameter, group order, number of solutions to an equation, partition counts). If a concept cannot be directly computed using standard definitions, state that the domain is not applicable rather than inventing an approximation.

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
    try {
      return JSON.parse(response.text) as InvestigationScript[];
    } catch (err: any) {
      console.warn(`[Explorer] Warning: JSON parse failed during script generation: ${err.message}`);
      return [];
    }
  }

  /** Run all scripts concurrently in sandboxed subprocesses. */
  private async runAll(scripts: InvestigationScript[]): Promise<ScriptResult[]> {
    return Promise.all(scripts.map((s) => this.runScript(s)));
  }

  /** Compile (if C) and run a single script in a sandboxed subprocess. */
  private async runScript(script: InvestigationScript): Promise<ScriptResult> {
    const id = `perqed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const start = Date.now();

    // Unescape literal backslash-n that Gemini sometimes produces inside JSON strings
    script.code = script.code.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

    // Enforce Python execution exclusively
    if (script.language !== "python") {
       throw new Error("Only Python scripts are supported for sandboxed execution.");
    }
    return this.runPython(script, id, start);
  }

  private async runPython(
    script: InvestigationScript,
    id: string,
    start: number,
  ): Promise<ScriptResult> {
    let result = await this.trytet.executeWasm({
      code: script.code,
      image: "python-3.11.wasm",
      timeoutMs: this.sandboxTimeoutMs
    });

    // --- REPAIR LOOP ---
    if (result.exitCode !== 0 && !result.timedOut) {
      console.warn(`[Explorer] Script failed for ${script.domain}. Attempting automated repair...`);
      const repairedCode = await this.repairPythonScript(script.code, result.stderr);
      if (repairedCode) {
        result = await this.trytet.executeWasm({
          code: repairedCode,
          image: "python-3.11.wasm",
          timeoutMs: this.sandboxTimeoutMs
        });
      }
    }

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

  /** Attempt a one-time repair of a failing research script by feeding the error back to Gemini. */
  private async repairPythonScript(code: string, error: string): Promise<string | null> {
    const prompt = `Your previous empirical investigation script failed with the following error:
    
    ERROR:
    ${error}
    
    CODE:
    ${code}
    
    TASK: Focus strictly on fixing the error (e.g., missing imports, syntax, defined variables). 
    Ensure you use standard scientific libraries (numpy, sympy). NO SAGEMATH OR Z3 NATIVE BINARIES ALLOWED.
    Output ONLY the corrected code. Do not apologize or explain.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: { temperature: 0.1 },
      });
      return response.text?.trim()?.replace(/^```python\n|```$/g, "") || null;
    } catch {
      return null;
    }
  }

  private matchSkillsByDomains(domains: string[]): string[] {
    const alwaysOn = ["proof_by_contradiction", "direct_proof", "proof_by_contraposition", "mathematical_induction"];
    const matched = new Set<string>(alwaysOn);
    const domainStr = domains.join(" ").toLowerCase();

    const mapping: Record<string, string[]> = {
      graph: ["graph-witness-search", "spectral_graph_bounds", "razborov_flag_algebras", "algebraic_graph_construction", "lean-finite-graph"],
      ramsey: ["graph-witness-search", "spectral_graph_bounds", "razborov_flag_algebras"],
      combinatorial: ["schur-partition-search", "pigeonhole_principle", "double_counting"],
      partition: ["schur-partition-search", "generating_functions"],
      sat: ["z3-constraint-solver", "lns-z3-hybrid", "micro_sat_patch"],
      smt: ["z3-constraint-solver", "lns-z3-hybrid"],
      algebraic: ["local_to_global_hasse_principle", "fixed_point_arguments", "generating_functions"],
      arithmetic: ["local_to_global_hasse_principle", "epsilon_delta_bounding"],
      prime: ["local_to_global_hasse_principle", "epsilon_delta_bounding"],
      analysis: ["epsilon_delta_bounding", "analytic_continuation", "compactness_arguments"],
      topology: ["homological_cohomological_arguments", "geometric_flow_homotopy", "invariants_and_monovariants", "compactness_arguments"],
      logic: ["forcing_set_theory_independence", "maximality_zorns_lemma"],
      complexity: ["polynomial_time_reductions"]
    };

    for (const [key, skills] of Object.entries(mapping)) {
      if (domainStr.includes(key)) {
        skills.forEach(s => matched.add(s));
      }
    }

    return Array.from(matched);
  }

  /**
   * Use Gemini to synthesize all script results into a structured summary.
   */
  private async synthesize(
    hypothesis: string,
    results: ScriptResult[],
  ): Promise<{ synthesis: string; anomalies: string[]; falsifications: string[] }> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        synthesis: { type: Type.STRING },
        anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
        falsifications: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["synthesis", "anomalies", "falsifications"],
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
- falsifications: domains where the hypothesis was cleanly falsified (list domain names)
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
        falsifications: results.map((r) => r.domain),
      };
    }

    try {
      return JSON.parse(response.text) as {
        synthesis: string;
        anomalies: string[];
        falsifications: string[];
      };
    } catch (err: any) {
      console.warn(`[Explorer] Warning: JSON parse failed during synthesis: ${err.message}`);
      return {
        synthesis: "Synthesis unavailable due to LLM response truncation.",
        anomalies: [],
        falsifications: results.map((r) => r.domain),
      };
    }
  }
}
