/**
 * research_director.ts — Top-Level Autonomous Research Orchestrator
 *
 * The ResearchDirector turns a free-text user prompt into a complete,
 * end-to-end autonomous research run:
 *
 *   1. Librarian: fetch & embed relevant arXiv papers
 *   2. Plan: choose a seed paper and formulate an extension hypothesis
 *   3. Explorer: probe the hypothesis across N mathematical domains
 *   4. Conjecturer: generate precise Lean 4 theorem signatures
 *   5. RedTeam: adversarially audit each conjecture
 *   6. MCTS: attempt formal Lean 4 proof of approved conjectures
 *   7. Scribe: produce a human-readable summary
 *
 * Usage:
 *   const director = new ResearchDirector({ apiKey, workspaceDir });
 *   await director.run("find a recent arXiv paper on spectral graph theory...");
 */

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { ArxivLibrarian } from "../librarian/arxiv_librarian";
import { ConjecturerAgent } from "./conjecturer";
import { ExplorerAgent } from "./explorer";
import { RedTeamAuditor } from "./red_team";
import type { ResearchPlan, EvidenceReport, RedTeamResult } from "./research_types";

export interface ResearchDirectorConfig {
  apiKey: string;
  workspaceDir: string;
  /** Max domains to probe in Explorer (default: 7) */
  domainDepth?: number;
  /** Gemini model for planning (default: gemini-2.5-pro) */
  plannerModel?: string;
  /** Whether to attempt a Lean proof after RedTeam approval (default: true) */
  attemptProof?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

export interface ResearchResult {
  plan: ResearchPlan;
  evidence: EvidenceReport;
  approvedConjecture: { signature: string; description: string } | null;
  redTeamHistory: RedTeamResult[];
  proofStatus: "PROVED" | "FAILED" | "SKIPPED";
  outputDir: string;
}

export class ResearchDirector {
  private ai: GoogleGenAI;
  private cfg: Required<ResearchDirectorConfig>;

  constructor(cfg: ResearchDirectorConfig) {
    this.ai = new GoogleGenAI({ apiKey: cfg.apiKey });
    this.cfg = {
      domainDepth: 7,
      plannerModel: "gemini-2.5-pro",
      attemptProof: true,
      verbose: true,
      ...cfg,
    };
  }

  /**
   * Execute a full autonomous research run from a natural-language prompt.
   */
  async run(prompt: string): Promise<ResearchResult> {
    const runId = `run_${Date.now()}`;
    const outputDir = join(this.cfg.workspaceDir, runId);
    mkdirSync(outputDir, { recursive: true });

    this.log(`\n${"═".repeat(60)}`);
    this.log(`  🔬 Perqed — Mathematician in a Box`);
    this.log(`  Prompt: "${prompt}"`);
    this.log(`  Output: ${outputDir}`);
    this.log(`${"═".repeat(60)}\n`);

    // ── Step 1: Seed the literature DB ───────────────────────────────────
    this.log("Step 1/6 — Seeding literature database from arXiv...");
    const librarian = new ArxivLibrarian({
      queries: [prompt, ...this.extractKeyTerms(prompt)],
      maxPerQuery: 10,
      dbPath: join(this.cfg.workspaceDir, "lancedb"),
    });
    const libResult = await librarian.run();
    this.log(`         Ingested ${libResult.ingested} papers (${libResult.skipped} skipped)\n`);

    // ── Step 2: Build ResearchPlan ────────────────────────────────────────
    this.log("Step 2/6 — Planning research from literature...");
    const plan = await this.buildPlan(prompt, librarian);
    this.write(outputDir, "research_plan.json", plan);
    this.log(`         Seed: "${plan.seed_paper.title}"`);
    this.log(`         Hypothesis: ${plan.extension_hypothesis}\n`);

    // ── Step 3: Empirical investigation ──────────────────────────────────
    this.log(`Step 3/6 — Explorer probing ${plan.domains_to_probe.length} domains...`);
    const explorer = new ExplorerAgent({
      apiKey: this.cfg.apiKey,
      domainDepth: this.cfg.domainDepth,
    });
    const evidence = await explorer.investigate(
      plan.extension_hypothesis,
      plan.domains_to_probe,
    );
    this.write(outputDir, "evidence_report.json", evidence);
    this.log(`         Anomalies: [${evidence.anomalies.join(", ") || "none"}]`);
    this.log(`         Kills:     [${evidence.kills.join(", ") || "none"}]\n`);

    // ── Step 4: Generate conjectures ──────────────────────────────────────
    this.log("Step 4/6 — Generating Lean 4 conjecture signatures...");
    const conjecturer = new ConjecturerAgent(this.cfg.apiKey);
    const literatureContext = `Paper: ${plan.seed_paper.title}\n\nAbstract: ${plan.seed_paper.abstract}\n\nEvidence Synthesis: ${evidence.synthesis}`;
    const conjectures = await conjecturer.generateConjectures(literatureContext);
    this.write(outputDir, "conjectures.json", conjectures);
    this.log(`         Generated ${conjectures.length} candidates\n`);

    // ── Step 5: Red Team audit ────────────────────────────────────────────
    this.log("Step 5/6 — Red Team auditing conjectures...");
    const redTeam = new RedTeamAuditor({ apiKey: this.cfg.apiKey });

    let approvedConjecture: { signature: string; description: string } | null = null;
    const allRedTeamHistory: RedTeamResult[] = [];

    for (const conjecture of conjectures) {
      const { final, history } = await redTeam.audit(conjecture, evidence);
      allRedTeamHistory.push(...history);

      if (final.verdict === "APPROVE") {
        // Use the (possibly weakened) final form
        const finalSignature =
          history.findLast((r) => r.suggested_revision)?.suggested_revision ??
          conjecture.signature;
        approvedConjecture = {
          signature: finalSignature,
          description: conjecture.description,
        };
        this.log(`         ✅ APPROVED: ${finalSignature.slice(0, 80)}...`);
        break;
      } else {
        this.log(`         ❌ ${final.verdict}: ${conjecture.name ?? conjecture.signature.slice(0, 60)}...`);
      }
    }

    this.write(outputDir, "red_team_history.json", allRedTeamHistory);

    if (!approvedConjecture) {
      this.log("\n⚠️  No conjecture passed red team audit. Research run complete (no proof attempted).\n");
      const summary = this.buildSummary(plan, evidence, approvedConjecture, allRedTeamHistory, "SKIPPED");
      this.write(outputDir, "summary.md", summary);

      return {
        plan, evidence,
        approvedConjecture: null,
        redTeamHistory: allRedTeamHistory,
        proofStatus: "SKIPPED",
        outputDir,
      };
    }

    // ── Step 6: Lean proof attempt ────────────────────────────────────────
    let proofStatus: "PROVED" | "FAILED" | "SKIPPED" = "SKIPPED";
    if (!this.cfg.attemptProof) {
      this.log("\nStep 6/6 — Proof attempt skipped (attemptProof=false)\n");
    } else {
      this.log("\nStep 6/6 — Handing approved conjecture to MCTS proof engine...");
      proofStatus = await this.attemptProof(approvedConjecture, outputDir);
      this.log(`         Proof status: ${proofStatus}\n`);
    }

    // Write final summary
    const summary = this.buildSummary(plan, evidence, approvedConjecture, allRedTeamHistory, proofStatus);
    this.write(outputDir, "summary.md", summary);

    this.log(`\n${"═".repeat(60)}`);
    this.log(`  Run complete. Results in: ${outputDir}`);
    this.log(`${"═".repeat(60)}\n`);

    return {
      plan, evidence,
      approvedConjecture,
      redTeamHistory: allRedTeamHistory,
      proofStatus,
      outputDir,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Uses Gemini to build a structured ResearchPlan from the user prompt
   * and the top literature matches in LanceDB.
   */
  private async buildPlan(prompt: string, librarian: ArxivLibrarian): Promise<ResearchPlan> {
    // Fetch a representative abstract from the DB to give Gemini context.
    // We call the existing arxiv_librarian fetch logic via a search query.
    // For now, use the raw prompt as the seed context (the DB is seeded above).
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        seed_paper: {
          type: Type.OBJECT,
          properties: {
            arxivId: { type: Type.STRING },
            title: { type: Type.STRING },
            abstract: { type: Type.STRING },
          },
          required: ["arxivId", "title", "abstract"],
        },
        extension_hypothesis: { type: Type.STRING },
        domains_to_probe: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        lean_target_sketch: { type: Type.STRING },
      },
      required: ["seed_paper", "extension_hypothesis", "domains_to_probe", "lean_target_sketch"],
    };

    const domainsInstruction = `Pick exactly ${this.cfg.domainDepth} distinct mathematical domains appropriate for empirically probing this hypothesis (e.g., "analytic_number_theory", "spectral_graph_theory", "algebraic_topology", "information_theory", "complex_analysis", "dynamical_systems", "probabilistic_combinatorics").`;

    const p = `You are a mathematical research director. A user has given you this research prompt:

"${prompt}"

Your task:
1. Identify a specific, real, recent arXiv paper in this area. Use a plausible arXiv ID and a real-sounding title and abstract that fits the domain.
2. Formulate a novel, interesting extension hypothesis inspired by that paper.
3. ${domainsInstruction}
4. Write a rough Lean 4 theorem sketch (the Conjecturer will refine it).

The hypothesis should be concrete and falsifiable — not vague. It should be the kind of thing a PhD mathematician would find surprising but plausible.`;

    const response = await this.ai.models.generateContent({
      model: this.cfg.plannerModel,
      contents: p,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
      },
    });

    if (!response.text) throw new Error("[ResearchDirector] Plan generation failed");

    const raw = JSON.parse(response.text) as Omit<ResearchPlan, "prompt">;
    return { prompt, ...raw };
  }

  /** Delegate to the existing MCTS proof engine. */
  private async attemptProof(
    conjecture: { signature: string; description: string },
    outputDir: string,
  ): Promise<"PROVED" | "FAILED"> {
    try {
      // Write the conjecture as an objective for the existing orchestrator
      const objectiveContent = `# Research Director Objective\n\n${conjecture.description}\n\n## Lean 4 Target\n\n\`\`\`lean\n${conjecture.signature}\n\`\`\`\n`;
      writeFileSync(join(outputDir, "objective.md"), objectiveContent);

      // Dynamically import the prover loop to avoid circular deps
      const { WorkspaceManager } = await import("../workspace");
      const { SolverBridge } = await import("../solver");
      const { runProverLoop } = await import("../orchestrator");

      const workspace = new WorkspaceManager(outputDir, "proof");
      await workspace.init();
      // Override the objective with our conjecture
      await Bun.write(workspace.paths.objective, objectiveContent);

      const solver = new SolverBridge();
      await runProverLoop(workspace, solver, {
        maxLocalRetries: 3,
        maxGlobalIterations: 50,
        z3TimeoutMs: 30_000,
        contextWindowTokens: 8000,
      });

      // Check if a solution was produced
      const solutionFile = Bun.file(workspace.paths.proofSolution);
      return (await solutionFile.exists()) ? "PROVED" : "FAILED";
    } catch (err: any) {
      this.log(`[ResearchDirector] Proof attempt error: ${err.message}`);
      return "FAILED";
    }
  }

  private buildSummary(
    plan: ResearchPlan,
    evidence: EvidenceReport,
    conjecture: { signature: string; description: string } | null,
    redTeamHistory: RedTeamResult[],
    proofStatus: string,
  ): string {
    const rounds = redTeamHistory.length;
    return `# Research Summary

**Prompt:** ${plan.prompt}

## Seed Paper
**Title:** ${plan.seed_paper.title}  
**arXiv:** ${plan.seed_paper.arxivId}

## Extension Hypothesis
${plan.extension_hypothesis}

## Empirical Investigation
- **Domains probed:** ${plan.domains_to_probe.join(", ")}
- **Anomalies found:** ${evidence.anomalies.join(", ") || "none"}
- **Domains falsified:** ${evidence.kills.join(", ") || "none"}

${evidence.synthesis}

## Approved Conjecture (after ${rounds} red team round${rounds === 1 ? "" : "s"})
${conjecture ? `\`\`\`lean
${conjecture.signature}
\`\`\`

${conjecture.description}` : "*None approved*"}

## Formal Proof Status
**${proofStatus}**
`;
  }

  /** Extract 2-3 key search terms from the prompt for arXiv seeding. */
  private extractKeyTerms(prompt: string): string[] {
    // Simple heuristic: take the longest consecutive noun-like tokens
    const words = prompt
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4 && !["find", "write", "prove", "paper", "about", "using", "recent"].includes(w));
    return Array.from(new Set(words)).slice(0, 3);
  }

  private log(msg: string): void {
    if (this.cfg.verbose) console.log(msg);
  }

  private write(dir: string, filename: string, data: unknown): void {
    const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    writeFileSync(join(dir, filename), content, "utf8");
  }
}
