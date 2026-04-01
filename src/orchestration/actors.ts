/**
 * orchestration/actors.ts — Isolated fromPromise Actor Definitions
 *
 * Each actor wraps an existing Perqed agent class, accepting structured
 * input and returning a typed output. No actor holds mutable state —
 * they are pure async functions that the XState machine invokes.
 *
 * Actors are registered by name in setup() and referenced via string
 * keys in the machine definition, enabling test injection via .provide().
 */

import { fromPromise } from "xstate";
import type {
  IdeationOutput,
  ValidationOutput,
  SandboxOutput,
  SMTOutput,
  FalsificationOutput,
  LeanOutput,
  ErrorCorrectionOutput,
  ScribeOutput,
} from "./types";
import type { ResearchPlan, EvidenceReport, RedTeamResult } from "../agents/research_types";

// ──────────────────────────────────────────────
// Actor Input Types
// ──────────────────────────────────────────────

export interface IdeationInput {
  prompt: string;
  retries: number;
  apiKey: string;
  workspaceDir: string;
  lastValidationError: string | null;
}

export interface ValidationInput {
  hypothesis: string;
}

export interface SandboxInput {
  hypothesis: string;
  domains: string[];
  apiKey: string;
  plan: ResearchPlan;
  evidence: EvidenceReport | null;
}

export interface SMTInput {
  smtScript: string;
}

export interface FalsificationInput {
  counterExample: unknown;
  literature: string[];
  apiKey: string;
}

export interface LeanInput {
  conjecture: { signature: string; description: string };
  outputDir: string;
  apiKey: string;
}

export interface ErrorCorrectionInput {
  compilerTrace: string;
  conjecture: { signature: string; description: string };
  apiKey: string;
}

export interface ScribeInput {
  plan: ResearchPlan;
  evidence: EvidenceReport;
  conjecture: { signature: string; description: string } | null;
  proofStatus: string;
  outputDir: string;
  apiKey: string;
  redTeamHistory: RedTeamResult[];
}

// ──────────────────────────────────────────────
// 1. Ideation Actor
// ──────────────────────────────────────────────

/**
 * Wraps ArxivLibrarian + Gemini planner.
 * Fetches literature, builds a research plan, and classifies novelty.
 */
export const ideationActor = fromPromise<IdeationOutput, IdeationInput>(
  async ({ input }) => {
    const { ArxivLibrarian } = await import("../librarian/arxiv_librarian");
    const { GoogleGenAI, Type } = await import("@google/genai");

    const ai = new GoogleGenAI({ apiKey: input.apiKey });

    // 1. Seed the literature DB
    const librarian = new ArxivLibrarian({
      queries: [input.prompt],
      maxPerQuery: 10,
      dbPath: `${input.workspaceDir}/lancedb`,
    });
    const libResult = await librarian.run();

    // 2. Query top matches
    const searchResults = await librarian.searchDatabase(input.prompt, { limit: 10 });
    const randomIndex = Math.floor(Math.random() * Math.max(1, searchResults.length));
    const seedPaper = searchResults[randomIndex];

    const arxivId = seedPaper?.id?.replace("arxiv-", "") || "0000.00000";
    const title = seedPaper?.paperTitle || "Fallback Title";
    const abstract = seedPaper?.paperAbstract || "Fallback Abstract";

    if (searchResults.length > 0) {
      console.log(`[Librarian] Top matches:`);
      searchResults.slice(0, 3).forEach((p, idx) => {
        const idStr = p.id?.replace("arxiv-", "") || "unknown";
        console.log(`  ${idx + 1}. "${p.paperTitle || "No Title"}" (arxiv:${idStr})`);
      });
      console.log(`[Ideation] Selected Seed: "${title}"`);
    } else {
      console.log(`[Ideation] No literature matches found. Generating from scratch.`);
    }

    console.log(`[Ideation] Synthesizing strategy...`);

    // 3. Build plan via Gemini
    let historyFeedback = "";
    if (input.lastValidationError) {
      historyFeedback = `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${input.lastValidationError}\nPlease formulate a DIFFERENT hypothesis using only standard Mathlib definitions.`;
    }

    const schema = {
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
        novelty_classification: { type: Type.STRING },
      },
      required: ["seed_paper", "extension_hypothesis", "domains_to_probe", "lean_target_sketch", "novelty_classification"],
    };

    const prompt = `You are an elite mathematical architect.
Read the following abstract from a real arXiv paper:

Title: ${title}
arXiv ID: ${arxivId}
Abstract: ${abstract}

YOUR TASK:
1. Identify a potential extension related to this exact paper.
2. Formulate a hypothesis that extends this work.
3. Classify novelty: "NOVEL_DISCOVERY" if this is genuinely new, "KNOWN_THEOREM" if this is already established.
4. Pick 7 distinct mathematical domains to probe.

CRITICAL: The hypothesis MUST be finitely computable by native_decide. Do NOT invent new functions.
${historyFeedback}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      },
    });

    if (!response.text) throw new Error("[Ideation] Plan generation failed");

    const raw = JSON.parse(response.text) as {
      seed_paper: { arxivId: string; title: string; abstract: string };
      extension_hypothesis: string;
      domains_to_probe: string[];
      lean_target_sketch: string;
      novelty_classification: string;
    };

    const classification = raw.novelty_classification === "KNOWN_THEOREM"
      ? "KNOWN_THEOREM" as const
      : "NOVEL_DISCOVERY" as const;

    console.log(`[Ideation] Strategy formulated: ${(raw.extension_hypothesis || "No hypothesis").split('\n')[0]?.substring(0, 100) ?? ""}...`);

    return {
      classification,
      hypothesis: raw.extension_hypothesis,
      plan: {
        prompt: input.prompt,
        seed_paper: raw.seed_paper,
        extension_hypothesis: raw.extension_hypothesis,
        domains_to_probe: raw.domains_to_probe,
        lean_target_sketch: raw.lean_target_sketch,
      },
      literature: [title],
    };
  },
);

// ──────────────────────────────────────────────
// 2. Validation Actor
// ──────────────────────────────────────────────

/**
 * Wraps LeanASTValidator. Throws on hallucination (triggers onError).
 */
export const validationActor = fromPromise<ValidationOutput, ValidationInput>(
  async ({ input }) => {
    const { LeanASTValidator } = await import("../lean_ast_validator");
    const validator = new LeanASTValidator();

    console.log(`[Validation] Checking AST syntax for target: ${(input.hypothesis || "").split('\n')[0]?.substring(0, 100) ?? ""}`);

    // Build a minimal Lean source from the hypothesis
    const leanSource = `import Mathlib\n\n${input.hypothesis}\n`;
    const result = validator.validate(leanSource);

    if (!result.isValid) {
      console.log(`[Validation] ERROR: Hypothesis contains invalid Lean 4 syntax or synthetic definitions.`);
      throw new Error(result.error);
    }

    console.log(`[Validation] AST syntactically valid in Lean 4.`);
    return { isValid: true as const, ast: { hypothesis: input.hypothesis } };
  },
);

// ──────────────────────────────────────────────
// 3. Sandbox Actor
// ──────────────────────────────────────────────

/**
 * Wraps ExplorerAgent + ConjecturerAgent + RedTeamAuditor pipeline.
 * Classifies the empirical signal as WITNESS_FOUND, PLATEAU_DETECTED,
 * or CLEAN_KILL based on the evidence report.
 */
export const sandboxActor = fromPromise<SandboxOutput, SandboxInput>(
  async ({ input }) => {
    const { ExplorerAgent } = await import("../agents/explorer");
    const { ConjecturerAgent } = await import("../agents/conjecturer");
    const { RedTeamAuditor } = await import("../agents/red_team");

    console.log(`[Explorer] Probing domains: ${(input.domains || []).slice(0, 5).join(", ")}...`);

    const explorer = new ExplorerAgent({ apiKey: input.apiKey });
    const evidence = await explorer.investigate(
      input.hypothesis,
      input.domains,
    );

    if (evidence.kills.length > 0) {
      console.log(`[Explorer] Signal: COUNTER-EXAMPLE FOUND (${evidence.kills.length} counter-examples)`);
      console.log(`[Explorer] Result: The hypothesized bound failed.`);
    } else {
      console.log(`[Explorer] Signal: NO COUNTER-EXAMPLES (Plateau/Witness)`);
      console.log(`[Explorer] Anomalies found: ${evidence.anomalies.length}`);
    }

    // Classify the signal
    if (evidence.kills.length > 0) {
      return {
        signal: "CLEAN_KILL" as const,
        energy: -1,
        evidence,
        data: { kills: evidence.kills, counterExample: evidence.kills },
        approvedConjecture: null,
        redTeamHistory: [],
      };
    }

    // Generate conjectures + RedTeam audit
    const conjecturer = new ConjecturerAgent(input.apiKey);
    const literatureContext = `Paper: ${input.plan.seed_paper.title}\n\nAbstract: ${input.plan.seed_paper.abstract}\n\nEvidence Synthesis: ${evidence.synthesis}`;
    const conjectures = await conjecturer.generateConjectures(literatureContext, evidence);

    const redTeam = new RedTeamAuditor({ apiKey: input.apiKey });
    let approvedConjecture: { signature: string; description: string } | null = null;
    const allHistory: RedTeamResult[] = [];

    for (const conjecture of conjectures) {
      const { final, history } = await redTeam.audit(conjecture, evidence);
      allHistory.push(...history);
      if (final.verdict === "APPROVE") {
        const finalSig = history.findLast((r) => r.suggested_revision)?.suggested_revision ?? conjecture.signature;
        approvedConjecture = { signature: finalSig, description: conjecture.description };
        break;
      }
    }

    if (evidence.anomalies.length > 0 && approvedConjecture) {
      return {
        signal: "WITNESS_FOUND" as const,
        energy: 0,
        evidence,
        data: { anomalies: evidence.anomalies },
        approvedConjecture,
        redTeamHistory: allHistory,
      };
    }

    return {
      signal: "PLATEAU_DETECTED" as const,
      energy: 25,
      evidence,
      data: {},
      approvedConjecture,
      redTeamHistory: allHistory,
    };
  },
);

// ──────────────────────────────────────────────
// 4. SMT Actor
// ──────────────────────────────────────────────

/**
 * Wraps SolverBridge.runZ3SMT() for native SMT-LIB2 execution.
 */
export const smtActor = fromPromise<SMTOutput, SMTInput>(
  async ({ input }) => {
    const { SolverBridge } = await import("../solver");
    const solver = new SolverBridge();
    const result = await solver.runZ3SMT(input.smtScript, 60_000);

    if (result.success) {
      return { status: "SAT" as const, model: result.output };
    }
    return { status: "UNSAT" as const, model: null };
  },
);

// ──────────────────────────────────────────────
// 5. Falsification Actor
// ──────────────────────────────────────────────

/**
 * Wraps ConjecturerAgent to formalize a CLEAN_KILL counter-example.
 */
export const falsificationActor = fromPromise<FalsificationOutput, FalsificationInput>(
  async ({ input }) => {
    const { ConjecturerAgent } = await import("../agents/conjecturer");
    const { RedTeamAuditor } = await import("../agents/red_team");

    const conjecturer = new ConjecturerAgent(input.apiKey);
    const literatureContext = `[FALSIFICATION FORK]\nCounter-example discovered: ${JSON.stringify(input.counterExample)}\n\nFormulate a Lean 4 theorem proving WHY the original hypothesis fails.`;
    const conjectures = await conjecturer.generateConjectures(literatureContext);

    if (conjectures.length === 0) {
      throw new Error("Falsification actor: no conjectures generated");
    }

    // RedTeam audit the best candidate
    const redTeam = new RedTeamAuditor({ apiKey: input.apiKey });
    const best = conjectures[0]!;
    const { final, history } = await redTeam.audit(best, {
      hypothesis: "falsification",
      results: [],
      synthesis: "Counter-example proof",
      anomalies: [],
      kills: [],
    });

    const finalSig = history.findLast((r) => r.suggested_revision)?.suggested_revision ?? best.signature;

    return {
      proof: finalSig,
      approvedConjecture: { signature: finalSig, description: best.description },
      redTeamHistory: history,
    };
  },
);

// ──────────────────────────────────────────────
// 6. Lean Actor
// ──────────────────────────────────────────────

/**
 * Wraps the existing runDynamicLoop() as a black-box sub-actor.
 */
export const leanActor = fromPromise<LeanOutput, LeanInput>(
  async ({ input }) => {
    try {
      const { WorkspaceManager } = await import("../workspace");
      const { SolverBridge } = await import("../solver");
      const { runDynamicLoop } = await import("../orchestrator");
      const { AgentFactory } = await import("../agents/factory");
      const { LeanBridge } = await import("../lean_bridge");

      const workspace = new WorkspaceManager(input.outputDir, "proof");
      await workspace.init();

      const objectiveContent = `# Research Director Objective\n\n${input.conjecture.description}\n\n## Lean 4 Target\n\n\`\`\`lean\n${input.conjecture.signature}\n\`\`\`\n`;
      await Bun.write(workspace.paths.objective, objectiveContent);

      const solver = new SolverBridge();
      const leanProjectRoot = input.outputDir.split("/runs/")?.[0] ?? input.outputDir;

      const result = await runDynamicLoop(workspace, solver, {
        leanBridge: new LeanBridge(undefined, leanProjectRoot),
        theoremName: "approved_conjecture",
        theoremSignature: input.conjecture.signature,
        agentFactory: new AgentFactory({ geminiApiKey: input.apiKey }),
        maxGlobalIterations: 15,
      });

      if (result.status === "SOLVED") {
        const solutionFile = Bun.file(workspace.paths.proofSolution);
        const proof = (await solutionFile.exists())
          ? await solutionFile.text()
          : input.conjecture.signature;

        return {
          status: "PROOF_COMPLETE" as const,
          proof,
          error: null,
        };
      }

      return {
        status: "COMPILER_ERROR" as const,
        proof: null,
        error: "MCTS budget exhausted without proof",
      };
    } catch (err: any) {
      return {
        status: "COMPILER_ERROR" as const,
        proof: null,
        error: err.message,
      };
    }
  },
);

// ──────────────────────────────────────────────
// 7. Error Correction Actor
// ──────────────────────────────────────────────

/**
 * Wraps FormalistAgent to fix compiler errors in Lean tactics.
 */
export const errorCorrectionActor = fromPromise<ErrorCorrectionOutput, ErrorCorrectionInput>(
  async ({ input }) => {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: input.apiKey });

    const prompt = `The following Lean 4 theorem failed to compile:

Signature: ${input.conjecture.signature}

Compiler Error:
${input.compilerTrace}

Suggest a corrected tactic sequence that fixes this specific error. Output ONLY the corrected tactic(s), no explanation.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.3 },
    });

    if (!response.text) {
      return { status: "UNFIXABLE" as const, proof: null };
    }

    return { status: "FIXED" as const, proof: response.text.trim() };
  },
);

// ──────────────────────────────────────────────
// 8. Scribe Actor
// ──────────────────────────────────────────────

/**
 * Wraps ScribeAgent to produce a LaTeX research paper.
 */
export const scribeActor = fromPromise<ScribeOutput, ScribeInput>(
  async ({ input }) => {
    const { ScribeAgent } = await import("../agents/scribe");
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { execSync } = await import("node:child_process");

    const scribe = new ScribeAgent(input.apiKey);
    const texSource = await scribe.draftResearchPaper({
      plan: input.plan,
      evidence: input.evidence,
      approvedConjecture: input.conjecture,
      redTeamHistory: input.redTeamHistory,
      proofStatus: input.proofStatus as "PROVED" | "FAILED" | "SKIPPED",
    });

    const texPath = join(input.outputDir, "paper.tex");
    writeFileSync(texPath, texSource, "utf8");

    try {
      execSync("tectonic paper.tex", { cwd: input.outputDir, stdio: "ignore" });
    } catch {
      // tectonic not installed — .tex is still saved
    }

    return { reportPath: texPath };
  },
);
