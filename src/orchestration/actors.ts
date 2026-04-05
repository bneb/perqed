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
  RefinementOutput,
  SMTOutput,
  FalsificationOutput,
  SketcherOutput,
  LeanOutput,
  ErrorCorrectionOutput,
  ScribeOutput,
} from "./types";
import type { ResearchPlan, EvidenceReport, RedTeamResult } from "../agents/research_types";
import type { AgentRole, AttemptLog } from "../types";
import type { ProofTree } from "../tree";

// ──────────────────────────────────────────────
// Actor Input Types
// ──────────────────────────────────────────────

export interface IdeationInput {
  prompt: string;
  retries: number;
  apiKey: string;
  workspaceDir: string;
  lastValidationError: string | null;
  publishableMode: boolean;
  crossPollinate: boolean;
  lakatosianHistory?: { failedConjecture: string; killerEdgeCase: any }[];
}

export interface ValidationInput {
  hypothesis: string;
}

export interface SketcherInput {
  informalMath: string;
  apiKey: string;
  workspaceDir: string;
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

export interface RedTeamInput {
  conjecture: string;
}

export interface RefinementInput {
  counterExample: unknown;
  hypothesis: string;
  plan: ResearchPlan;
  literature: string[];
  apiKey: string;
}

export interface LeanInput {
  conjecture: { signature: string; description: string };
  outputDir: string;
  apiKey: string;
  role: AgentRole;
  attemptLogs: AttemptLog[];
  lastTacticState: string;
  proofTree: ProofTree | null;
}

export interface LeanDynamicInput {
  conjecture: { signature: string; description: string };
  outputDir: string;
  apiKey: string;
  proofTree: ProofTree;
  maxIterations?: number;
  prunedContext: string;
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
    const { IdeatorAgent } = await import("../agents/ideation");
    const { NoveltyChecker } = await import("../librarian/novelty_checker");
    
    let refinementContext: string | undefined = undefined;
    if (input.lakatosianHistory && input.lakatosianHistory.length > 0) {
      refinementContext = "🔥 LAKATOSIAN ADVERSARIAL FEEDBACK 🔥\n\nThe Red Team systematically broke your previous conjectures by finding strict mathematical counter-examples.\n\n" + 
        input.lakatosianHistory.map(h => `[BROKEN CONJECTURE]\n${h.failedConjecture}\n\n[KILLER TOPOLOGY FOUND]\n${JSON.stringify(h.killerEdgeCase, null, 2)}`).join("\n\n") + 
        "\n\nYOUR TASK: You must NOT attempt to prove the broken conjectures. Analyze the 'KILLER TOPOLOGY' deeply. Mutate your axioms to structurally exclude or account for this counter-example while maintaining the generalized bound.";
    }

    const ideator = new IdeatorAgent(input.apiKey, input.workspaceDir);
    try {
      const result = await ideator.ideate(input.prompt, input.lastValidationError, input.publishableMode, refinementContext, input.crossPollinate);

      // ── Independent Novelty Verification ────────────────────────────
      // The LLM self-classifies, but we don't trust it blindly.
      // If it claims NOVEL_DISCOVERY, we run an embedding-based check
      // against the local LanceDB corpus. If the hypothesis is too
      // similar to a known theorem/paper, we override to KNOWN_THEOREM.
      if (result.classification === "NOVEL_DISCOVERY" && result.hypothesis) {
        const checker = new NoveltyChecker(`${input.workspaceDir}/lancedb`);
        const noveltyResult = await checker.check(result.hypothesis);

        if (noveltyResult.classification === "KNOWN_THEOREM") {
          console.warn(
            `[IdeationActor] LLM claimed NOVEL_DISCOVERY but NoveltyChecker overrode to KNOWN_THEOREM ` +
            `(matched: "${noveltyResult.matchedSource}", sim=${noveltyResult.topSimilarity.toFixed(3)})`
          );
          return {
            ...result,
            classification: "KNOWN_THEOREM",
          };
        }
      }

      return result;
    } catch (e: any) {
      console.error(`\n[IdeationActor] FATAL ERROR:`, e.stack || e);
      throw e;
    }
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
// 2b. Sketcher Actor (Draft-Sketch-Prove Translation Layer)
// ──────────────────────────────────────────────

/**
 * Wraps SketcherAgent. Drafts a fully verified structural Skeleton (only "sorry"s allowed).
 */
export const sketcherActor = fromPromise<SketcherOutput, SketcherInput>(
  async ({ input }) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { SketcherAgent } = await import("../agents/sketcher");
      const sketcher = new SketcherAgent(input.apiKey, input.workspaceDir);

      console.log(`[Sketcher] Drafting structural Lean 4 skeleton for hypothesis...`);
      const compiledSkeleton = await sketcher.sketchFormalOutline(input.informalMath);

      return { compiledSkeleton };
    } catch (err: any) {
      console.error(`\n[SketcherActor] FATAL ERROR:`, err.stack || err);
      throw err;
    }
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

    // Generate conjectures
    const conjecturer = new ConjecturerAgent(input.apiKey);
    const literatureContext = `Paper: ${input.plan.seed_paper.title}\n\nAbstract: ${input.plan.seed_paper.abstract}\n\nEvidence Synthesis: ${evidence.synthesis}`;
    const conjectures = await conjecturer.generateConjectures(literatureContext, evidence);

    const firstConjecture = conjectures[0] ?? { signature: input.hypothesis, description: "Fallback conjecture" };
    const approvedConjecture = { signature: firstConjecture.signature, description: firstConjecture.description };

    if (evidence.anomalies.length > 0 && approvedConjecture) {
      return {
        signal: "WITNESS_FOUND" as const,
        energy: 0,
        evidence,
        data: { anomalies: evidence.anomalies },
        approvedConjecture,
        redTeamHistory: [],
      };
    }

    return {
      signal: "PLATEAU_DETECTED" as const,
      energy: 25,
      evidence,
      data: {},
      approvedConjecture,
      redTeamHistory: [],
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
// 4b. Red Team Actor (Falsification Fork)
// ──────────────────────────────────────────────

export const redTeamActor = fromPromise<any, RedTeamInput>(
  async ({ input }) => {
    // Dynamically loaded to prevent circular agent dependencies
    const { RedTeamAuditor } = await import("../agents/red_team");
    
    const auditor = new RedTeamAuditor({ apiKey: process.env.GEMINI_API_KEY || "" });
    return await auditor.runAdversarialRedTeam(input.conjecture);
  }
);

// ──────────────────────────────────────────────
// 5. Falsification Actor
// ──────────────────────────────────────────────

/**
 * Wraps ConjecturerAgent to formalize a CLEAN_KILL counter-example.
 */
export const refinementActor = fromPromise<RefinementOutput, RefinementInput>(
  async ({ input }) => {
    const { IdeatorAgent } = await import("../agents/ideation");
    
    // We repurpose Ideator to systematically refine the hypothesis based on failure evidence
    const ideator = new IdeatorAgent(input.apiKey);

    const refinementContext = `
[HYPOTHESIS REFINEMENT REQUIRED]
Our original hypothesis completely failed empirical testing.
Original Hypothesis: ${input.hypothesis}
Counter-Example Discovered: ${JSON.stringify(input.counterExample, null, 2)}

Your directive: You MUST NOT attempt to prove the failure. Instead, you must structurally modify to the original hypothesis. Restrict its boundaries, weaken the claim, or introduce a natural parameter extension so that the revised hypothesis dodges this counter-example and represents a novel, publishable result.`;

    const plan = JSON.parse(JSON.stringify(input.plan));
    const result = await ideator.ideate(
      plan.prompt || input.hypothesis,
      null, // no validation error yet
      true, // publishableMode enabled for natural extensions
      refinementContext
    );

    return {
      hypothesis: result.plan.extension_hypothesis,
      classification: result.classification,
      plan: result.plan,
    };
  },
);

/**
 * Lean Dynamic Actor — MCTS State Search via REPL
 */
export const leanDynamicActor = fromPromise<any, LeanDynamicInput>(
  async ({ input }) => {
    const { LeanDynamicEvaluator } = await import("../search/lean_dynamic_evaluator");

    console.log(`[MCTS] Initiating dynamic proof evaluation for: ${input.conjecture.signature}`);
    
    // Instantiates the REPL and PRM Scorer under the hood
    const evaluator = new LeanDynamicEvaluator(
        input.outputDir, 
        input.apiKey
    );
    
    try {
        const res = await evaluator.runMCTSSearch(
            input.conjecture,
            input.proofTree,
            input.prunedContext
        );
        return res;
    } finally {
        evaluator.kill();
    }
  }
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
    const { getAgencyRegistry } = await import("../agency");
    const ai = new GoogleGenAI({ apiKey: input.apiKey });

    const prompt = `The following Lean 4 theorem failed to compile:

Signature: ${input.conjecture.signature}

Compiler Error:
${input.compilerTrace}

Suggest a corrected tactic sequence that fixes this specific error. Output ONLY the corrected tactic(s), no explanation.`;

    const response = await ai.models.generateContent({
      model: getAgencyRegistry().resolveProvider("formalization").model,
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
