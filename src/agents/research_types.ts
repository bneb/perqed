/**
 * research_types.ts — Shared types for the autonomous research pipeline.
 *
 * These types flow through:
 *   ResearchDirector → Explorer → ConjecturerAgent → RedTeamAuditor → MCTS
 */

// ── Research Plan ────────────────────────────────────────────────────────────

/** A seed arXiv paper identified by the ResearchDirector. */
export interface SeedPaper {
  arxivId: string;
  title: string;
  abstract: string;
}

/**
 * The top-level research plan produced by ResearchDirector from a user prompt.
 * Drives the entire downstream pipeline.
 */
export interface ResearchPlan {
  /** The original user prompt. */
  prompt: string;
  /** The arXiv paper chosen as the research seed. */
  seed_paper: SeedPaper;
  /** Natural-language description of the extension hypothesis. */
  extension_hypothesis: string;
  /**
   * Mathematical domains the Explorer should probe empirically.
   * e.g. ["analytic_number_theory", "spectral_graph_theory", "complex_analysis"]
   */
  domains_to_probe: string[];
  /**
   * A rough Lean 4 theorem statement to use as the target.
   * The Conjecturer will refine this into a precise signature.
   */
  lean_target_sketch: string;
}

// ── Explorer / Evidence ──────────────────────────────────────────────────────

/** One empirical investigation generated and executed by the Explorer. */
export interface InvestigationScript {
  domain: string;
  language: "c" | "python";
  purpose: string;
  code: string;
}

/** The result of running a single InvestigationScript in the sandbox. */
export interface ScriptResult {
  domain: string;
  purpose: string;
  language: "c" | "python";
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Wall-clock time in ms */
  wallTimeMs: number;
  /** Did the process timeout? */
  timedOut: boolean;
}

/**
 * The structured evidence report produced by the Explorer.
 * Passed to ConjecturerAgent and RedTeamAuditor.
 */
export interface EvidenceReport {
  hypothesis: string;
  results: ScriptResult[];
  /** High-level synthesis written by the Explorer agent via LLM. */
  synthesis: string;
  /** Domains that produced anomalous/interesting signal. */
  anomalies: string[];
  /** Domains that were cleanly falsified (null results). */
  kills: string[];
}

// ── Red Team ─────────────────────────────────────────────────────────────────

export type RedTeamVerdict = "APPROVE" | "WEAKEN" | "REJECT";

/** Output from the RedTeamAuditor agent. */
export interface RedTeamResult {
  verdict: RedTeamVerdict;
  rationale: string;
  /** Present when verdict is WEAKEN — a narrowed conjecture to try instead. */
  suggested_revision?: string;
  /** Which round of auditing produced this verdict (1-indexed). */
  round: number;
}
