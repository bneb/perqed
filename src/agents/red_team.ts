/**
 * red_team.ts — Red Team Auditor Agent
 *
 * A skeptical Gemini Flash agent that audits a conjecture against
 * empirical evidence before it is sent to the expensive MCTS proof engine.
 *
 * Verdicts:
 *   APPROVE  — conjecture is sound, proceed to proof search.
 *   WEAKEN   — conjecture has a fixable flaw; returns a revised version.
 *   REJECT   — conjecture is fatally flawed; start over with a new hypothesis.
 *
 * The caller runs up to MAX_ROUNDS of WEAKEN→re-audit before giving up.
 */

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { EvidenceReport, RedTeamResult, RedTeamVerdict } from "./research_types";
import { getAgencyRegistry } from "../agency";

const MAX_ROUNDS = 3;

export interface RedTeamConfig {
  apiKey: string;
  model?: string;
}

export class RedTeamAuditor {
  private ai: GoogleGenAI;
  private model: string;

  constructor(cfg: RedTeamConfig) {
    this.ai = new GoogleGenAI({ apiKey: cfg.apiKey });
    this.model = cfg.model ?? getAgencyRegistry().resolveProvider("red_team").model;
  }

  /**
   * Runs up to MAX_ROUNDS of adversarial auditing.
   *
   * If a WEAKEN verdict is returned, the revised conjecture is re-audited
   * automatically. Returns the final verdict (APPROVE or REJECT).
   *
   * @param conjecture  The Lean 4 theorem signature + description to audit.
   * @param evidence    The EvidenceReport from the Explorer.
   * @returns           The final RedTeamResult (always APPROVE or REJECT).
   */
  async audit(
    conjecture: { signature: string; description: string },
    evidence: EvidenceReport,
  ): Promise<{ final: RedTeamResult; history: RedTeamResult[] }> {
    const history: RedTeamResult[] = [];
    let current = conjecture;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      console.log(`\n[RedTeam] Round ${round}/${MAX_ROUNDS} — auditing conjecture...`);
      const result = await this.singleAudit(current, evidence, round);
      history.push(result);

      if (result.verdict === "APPROVE" || result.verdict === "REJECT") {
        console.log(`[RedTeam] Round ${round} verdict: ${result.verdict}`);
        if (result.verdict === "REJECT") {
          console.log(`[RedTeam] Rationale: ${result.rationale}`);
        }
        return { final: result, history };
      }

      // WEAKEN: update conjecture with the suggested revision
      if (result.suggested_revision) {
        console.log(`[RedTeam] Round ${round} verdict: WEAKEN → revising conjecture...`);
        console.log(`[RedTeam] Rationale: ${result.rationale}`);
        current = {
          signature: result.suggested_revision,
          description: `Revised (round ${round}): ${result.rationale}`,
        };
      } else {
        // WEAKEN without a revision is treated as REJECT
        console.log(`[RedTeam] WEAKEN without revision — treating as REJECT`);
        return {
          final: { ...result, verdict: "REJECT" },
          history,
        };
      }
    }

    // Exhausted rounds without APPROVE → REJECT
    const finalReject: RedTeamResult = {
      verdict: "REJECT",
      rationale: `Red team could not converge on a sound conjecture after ${MAX_ROUNDS} rounds.`,
      round: MAX_ROUNDS,
    };
    history.push(finalReject);
    return { final: finalReject, history };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async singleAudit(
    conjecture: { signature: string; description: string },
    evidence: EvidenceReport,
    round: number,
  ): Promise<RedTeamResult> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        verdict: { type: Type.STRING, enum: ["APPROVE", "WEAKEN", "REJECT"] },
        rationale: { type: Type.STRING },
        suggested_revision: { type: Type.STRING },
      },
      required: ["verdict", "rationale"],
    };

    const evidenceSummary = [
      `Hypothesis: ${evidence.hypothesis}`,
      `Synthesis: ${evidence.synthesis}`,
      `Anomalies: ${evidence.anomalies.join(", ") || "none"}`,
      `Kills: ${evidence.kills.join(", ") || "none"}`,
    ].join("\n");

    const prompt = `You are a rigorous mathematical red-team auditor. Your job is to find flaws in proposed mathematical conjectures before they waste compute on formal proof search.

CONJECTURE UNDER REVIEW:
Lean 4 Signature: ${conjecture.signature}
Description: ${conjecture.description}

EMPIRICAL EVIDENCE:
${evidenceSummary}

YOUR TASK:
Critically evaluate this conjecture. Look for:
1. Counterexamples (even in small cases)
2. Hypotheses that are too broad (needs additional conditions)
3. Conclusions that don't follow from the evidence
4. Known theorems that already cover this case
5. Lean 4 type errors or impossible signatures

VERDICT OPTIONS:
- APPROVE: The conjecture is plausible, well-scoped, and worth pursuing with formal proof search.
- WEAKEN: The conjecture has a fixable flaw. Provide a corrected 'suggested_revision' (the revised Lean 4 signature).
- REJECT: The conjecture is fatally flawed (false, trivial, or unprovable with current tools).

Be a tough but fair critic. If genuinely uncertain, prefer WEAKEN over REJECT.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction:
          "You are the Red Team Auditor. Output strict JSON. Be skeptical but precise.",
        temperature: 0.3,
      },
    });

    if (!response.text) {
      return {
        verdict: "REJECT",
        rationale: "Red team agent failed to produce a verdict.",
        round,
      };
    }

    const raw = JSON.parse(response.text) as {
      verdict: RedTeamVerdict;
      rationale: string;
      suggested_revision?: string;
    };

    return { ...raw, round };
  }
}
