/**
 * WorkspaceManager — File-system-based state engine for the neuro-symbolic orchestrator.
 *
 * Uses the filesystem as the single source of truth. Every piece of state
 * (objectives, progress, failure logs) lives in inspectable markdown files
 * so a human can monitor the agent's "mind" in real-time.
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export class WorkspaceManager {
  readonly baseDir: string;
  readonly runName: string;

  /** Resolved paths — computed once on construction. */
  readonly paths: {
    readonly globalConfig: string;
    readonly runDir: string;
    readonly domainSkills: string;
    readonly scratch: string;
    readonly verifiedLib: string;
    readonly labLog: string;
    readonly progress: string;
    readonly objective: string;
    readonly architectDirective: string;
    readonly proofSolution: string;
    readonly systemPrompts: string;
    readonly generalSkills: string;
    readonly config: string;
    readonly tacticState: string;
  };

  constructor(baseDir: string, runName: string) {
    this.baseDir = baseDir;
    this.runName = runName;

    const runDir = join(baseDir, "runs", runName);
    const globalConfig = join(baseDir, "global_config");
    const scratch = join(runDir, "scratch");
    const verifiedLib = join(runDir, "verified_lib");

    this.paths = {
      globalConfig,
      runDir,
      domainSkills: join(runDir, "domain_skills"),
      scratch,
      verifiedLib,
      labLog: join(runDir, "lab_log.md"),
      progress: join(runDir, "current_progress.md"),
      objective: join(runDir, "objective.md"),
      architectDirective: join(runDir, "domain_skills", "architect_directive.md"),
      proofSolution: join(runDir, "proof_solution.txt"),
      systemPrompts: join(globalConfig, "system_prompts.md"),
      generalSkills: join(globalConfig, "general_skills.md"),
      config: join(globalConfig, "config.json"),
      tacticState: join(scratch, "current_tactic_state.txt"),
    };
  }

  /**
   * Initialize the workspace hierarchy. Idempotent — safe to call multiple times.
   */
  async init(): Promise<void> {
    await mkdir(this.paths.runDir, { recursive: true });
    await mkdir(this.paths.domainSkills, { recursive: true });
    await mkdir(this.paths.globalConfig, { recursive: true });
    await mkdir(this.paths.scratch, { recursive: true });
    await mkdir(this.paths.verifiedLib, { recursive: true });
  }

  // ──────────────────────────────────────────────
  // Lab Log — Append-Only Ledger
  // ──────────────────────────────────────────────

  /**
   * Append an exhaustive timestamped record to lab_log.md.
   * This file is strictly append-only — entries are never modified or deleted.
   */
  async logAttempt(
    tactic: string,
    code: string,
    output: string,
    success: boolean,
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const status = success ? "✅ SUCCESS" : "❌ FAILED";

    const entry = [
      `### Attempt: ${timestamp} | Status: ${status}`,
      `**Tactic/Approach:** ${tactic}`,
      `**Code Executed:**`,
      "```python",
      code,
      "```",
      `**Solver Output:**`,
      "```",
      output,
      "```",
      "---",
      "", // trailing newline
    ].join("\n");

    await appendFile(this.paths.labLog, entry);
  }

  // ──────────────────────────────────────────────
  // Happy Path — Mutable Progress Tracker
  // ──────────────────────────────────────────────

  /**
   * Append a single verified sub-goal to current_progress.md.
   */
  async updateHappyPath(verifiedStep: string): Promise<void> {
    await appendFile(this.paths.progress, `- ${verifiedStep}\n`);
  }

  /**
   * Remove the last N lines from current_progress.md (backtracking).
   * Records are preserved in lab_log.md — this only affects the "happy path" view.
   */
  async backtrackProgress(stepsToRemove: number): Promise<void> {
    if (stepsToRemove <= 0) return;

    const file = Bun.file(this.paths.progress);
    if (!(await file.exists())) return;

    const content = await file.text();
    const lines = content.split("\n").filter((l) => l.trim() !== "");

    if (lines.length <= stepsToRemove) {
      // Remove everything — write empty file
      await Bun.write(this.paths.progress, "");
      return;
    }

    const remaining = lines.slice(0, lines.length - stepsToRemove);
    await Bun.write(this.paths.progress, remaining.join("\n") + "\n");
  }

  // ──────────────────────────────────────────────
  // Verified Lib — The Vault (Append-Only)
  // ──────────────────────────────────────────────

  /**
   * Commit a verified proof to the vault. Writes the .lean file and
   * appends to index.lean. Does NOT overwrite existing proofs.
   */
  async commitProof(lemmaName: string, leanSource: string): Promise<void> {
    const proofPath = join(this.paths.verifiedLib, `${lemmaName}.lean`);
    const indexPath = join(this.paths.verifiedLib, "index.lean");

    // Safety: never overwrite a verified proof
    const file = Bun.file(proofPath);
    if (await file.exists()) {
      console.log(`⚠️  Proof ${lemmaName}.lean already exists in vault — skipping.`);
      return;
    }

    await Bun.write(proofPath, leanSource);
    await appendFile(indexPath, `-- ${lemmaName}\n`);
    console.log(`🔒 Committed ${lemmaName}.lean to verified_lib/`);
  }

  /**
   * List all committed proof names in the vault.
   */
  async getVerifiedProofs(): Promise<string[]> {
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(this.paths.verifiedLib);
      return files
        .filter((f) => f.endsWith(".lean") && f !== "index.lean")
        .map((f) => f.replace(".lean", ""))
        .sort();
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // Tactic State
  // ──────────────────────────────────────────────

  /**
   * Write the current Lean tactic state to scratch/.
   */
  async writeTacticState(state: string): Promise<void> {
    await Bun.write(this.paths.tacticState, state);
  }

  /**
   * Read the current Lean tactic state from scratch/.
   */
  async readTacticState(): Promise<string> {
    return safeReadText(this.paths.tacticState, "");
  }

  // ──────────────────────────────────────────────
  // Domain Skills Reader
  // ──────────────────────────────────────────────

  /**
   * Read all .md files from the run's domain_skills/ directory.
   * Excludes architect_directive.md (which has its own dedicated section).
   */
  private async readDomainSkills(): Promise<string> {
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(this.paths.domainSkills);
      const mdFiles = files
        .filter((f) => f.endsWith(".md") && f !== "architect_directive.md")
        .sort();

      if (mdFiles.length === 0) return "";

      const contents: string[] = [];
      for (const file of mdFiles) {
        const filePath = join(this.paths.domainSkills, file);
        const text = await safeReadText(filePath, "");
        if (text) contents.push(text);
      }
      return contents.join("\n\n");
    } catch {
      // Directory doesn't exist yet
      return "";
    }
  }

  // ──────────────────────────────────────────────
  // Context Window Builder
  // ──────────────────────────────────────────────

  /**
   * Compile all filesystem state into a single prompt string for the LLM.
   *
   * @param maxTokens - Approximate token budget. We estimate ~4 chars/token
   *   and truncate the lab log tail to stay within budget.
   */
  async buildContextWindow(maxTokens: number = 4000): Promise<string> {
    const charBudget = maxTokens * 4; // rough 4 chars/token estimate
    const sections: string[] = [];

    // 1. System identity
    sections.push(await safeReadText(this.paths.systemPrompts, ""));

    // 2. General skills
    const skills = await safeReadText(this.paths.generalSkills, "");
    if (skills) sections.push(skills);

    // 3. Domain skills (run-specific — e.g., z3_tactics.md)
    const domainSkillsContent = await this.readDomainSkills();
    if (domainSkillsContent) {
      sections.push(`## DOMAIN SKILLS\n${domainSkillsContent}`);
    }

    // 4. Architect directive (if present — highest priority strategic context)
    const directive = await safeReadText(this.paths.architectDirective, "");
    if (directive) {
      sections.push(`## ⚡ ARCHITECT DIRECTIVE (FOLLOW THIS)\n${directive}`);
    }

    // 4. Ultimate objective
    const objective = await safeReadText(this.paths.objective, "No objective set.");
    sections.push(`## ULTIMATE OBJECTIVE\n${objective}`);

    // 5. Current verified progress
    const progress = await safeReadText(this.paths.progress, "No steps verified yet.");
    sections.push(`## CURRENT VERIFIED PROGRESS\n${progress}`);

    // 6. Recent failures from lab log — tail-read to prevent overflow
    const labLogSection = await this.buildLabLogSection(charBudget, sections);
    sections.push(labLogSection);

    // Assemble and enforce the budget
    let assembled = sections.join("\n\n");
    if (assembled.length > charBudget) {
      assembled = assembled.slice(0, charBudget);
    }

    return assembled;
  }

  /**
   * Build the lab log section with head+tail smart truncation.
   *
   * Strategy: When the lab log exceeds the remaining character budget,
   * keep the first 10% (to remember early fundamental failures) and
   * the last 90% (immediate context), inserting a truncation marker
   * in the middle. This is the "MCTS backtracking" memory strategy.
   */
  private async buildLabLogSection(
    totalCharBudget: number,
    existingSections: string[],
  ): Promise<string> {
    const existingLength = existingSections.reduce((sum, s) => sum + s.length + 2, 0);
    const remainingBudget = Math.max(0, totalCharBudget - existingLength - 100); // 100 char header reserve

    const header = "## RECENT ATTEMPTS (DO NOT REPEAT FAILED TACTICS)";

    const labLogContent = await safeReadText(this.paths.labLog, "");
    if (!labLogContent) return `${header}\nNo attempts recorded yet.`;

    // If it fits, include everything
    if (labLogContent.length <= remainingBudget) {
      return `${header}\n${labLogContent}`;
    }

    // Split into entries by the "---" delimiter
    const entries = labLogContent.split("---").filter((e) => e.trim().length > 0);
    const totalEntries = entries.length;

    if (totalEntries <= 2) {
      // Too few entries to split — just tail-truncate
      const truncated = labLogContent.slice(-remainingBudget);
      return `${header}\n*(truncated)*\n${truncated}`;
    }

    // Head+Tail strategy: keep first 10% and last 90% of budget
    const truncationMarkerTemplate = "\n... [TRUNCATED X ATTEMPTS FOR CONTEXT LIMITS] ...\n";
    const markerOverhead = truncationMarkerTemplate.length + 20; // extra for number
    const usableBudget = remainingBudget - markerOverhead;

    const headBudget = Math.floor(usableBudget * 0.1);
    const tailBudget = usableBudget - headBudget;

    // Build head: take entries from the start
    let headText = "";
    let headEntryCount = 0;
    for (const entry of entries) {
      const candidate = headText + entry.trim() + "\n---\n";
      if (candidate.length > headBudget && headEntryCount > 0) break;
      headText = candidate;
      headEntryCount++;
    }

    // Build tail: take entries from the end
    let tailText = "";
    let tailEntryCount = 0;
    for (let i = entries.length - 1; i >= headEntryCount; i--) {
      const candidate = entries[i]!.trim() + "\n---\n" + tailText;
      if (candidate.length > tailBudget && tailEntryCount > 0) break;
      tailText = candidate;
      tailEntryCount++;
    }

    const skippedCount = totalEntries - headEntryCount - tailEntryCount;
    const marker = `\n... [TRUNCATED ${skippedCount} ATTEMPTS FOR CONTEXT LIMITS] ...\n`;

    return `${header}\n${headText}${marker}${tailText}`;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Safely read a text file. Returns `fallback` if file doesn't exist.
 */
async function safeReadText(
  path: string,
  fallback: string,
): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) return fallback;
  return file.text();
}

/**
 * Append text to a file. Creates the file if it doesn't exist.
 */
async function appendFile(path: string, content: string): Promise<void> {
  const file = Bun.file(path);
  const existing = (await file.exists()) ? await file.text() : "";
  await Bun.write(path, existing + content);
}
