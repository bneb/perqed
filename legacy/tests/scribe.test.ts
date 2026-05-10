/**
 * Sprint 16: ScribeAgent Tests (TDD RED → GREEN)
 *
 * Tests the Gemini-based formal-to-LaTeX translator with mocked API calls.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { ScribeAgent } from "../src/agents/scribe";
import type { ProofNode } from "../src/tree";
import type { ResearchPlan, EvidenceReport, RedTeamResult } from "../src/agents/research_types";

// Mock a winning path for testing
const MOCK_WINNING_PATH: ProofNode[] = [
  {
    id: "root-id",
    parentId: null,
    tacticApplied: null,
    leanState: "⊢ n + m = m + n",
    status: "OPEN",
    childrenIds: ["step1-id"],
    depth: 0,
    visits: 1,
    errorHistory: [],
    splitType: "AND",
    value: 0.0,
  },
  {
    id: "step1-id",
    parentId: "root-id",
    tacticApplied: "induction n with | zero => simp | succ n ih => simp [ih]",
    leanState: "no goals",
    status: "SOLVED",
    childrenIds: [],
    depth: 1,
    visits: 1,
    errorHistory: [],
    splitType: "AND",
    value: 0.0,
  },
];

const MOCK_PLAN: ResearchPlan = {
  prompt: "Prove commutativity of addition",
  seed_paper: { title: "On Addition", arxivId: "0000.00000", abstract: "We study addition." },
  extension_hypothesis: "n + m = m + n for all natural numbers",
  domains_to_probe: ["algebra"],
  lean_target_sketch: "theorem nat_add_comm (n m : Nat) : n + m = m + n",
};

const MOCK_EVIDENCE: EvidenceReport = {
  hypothesis: "n + m = m + n",
  results: [],
  anomalies: [],
  kills: [],
  synthesis: "Addition is commutative.",
};

const MOCK_RESEARCH_DATA = {
  plan: MOCK_PLAN,
  evidence: MOCK_EVIDENCE,
  approvedConjecture: { signature: "theorem nat_add_comm", description: "Commutativity of addition" },
  redTeamHistory: [] as RedTeamResult[],
  proofStatus: "PROVED" as const,
  winningPath: MOCK_WINNING_PATH,
};

const MOCK_LATEX = `\\documentclass{amsart}
\\usepackage{amsmath, amssymb}
\\title{On the Commutativity of Natural Number Addition}
\\author{Perqed AI}
\\begin{document}
\\maketitle
\\begin{abstract}
We present a formal, machine-verified proof of the commutativity of addition on the natural numbers.
\\end{abstract}
\\begin{theorem}
For all natural numbers $n$ and $m$, we have $n + m = m + n$.
\\end{theorem}
\\begin{proof}
We proceed by induction on $n$. The base case follows immediately by simplification.
For the inductive step, we apply the inductive hypothesis and simplify.
\\end{proof}
\\end{document}`;

describe("ScribeAgent", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("draftPaper returns valid LaTeX from Gemini response", async () => {
    globalThis.fetch = (async (_url: any, _opts: any) => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: MOCK_LATEX }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const scribe = new ScribeAgent("fake-api-key");
    const result = await scribe.draftResearchPaper(MOCK_RESEARCH_DATA);

    expect(result).toContain("\\documentclass{amsart}");
    expect(result).toContain("\\begin{theorem}");
    expect(result).toContain("\\begin{proof}");
    expect(result).toContain("\\end{document}");
  });

  test("strips markdown code fences from Gemini response", async () => {
    const wrappedLatex = "```latex\n" + MOCK_LATEX + "\n```";

    globalThis.fetch = (async (_url: any, _opts: any) => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: wrappedLatex }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const scribe = new ScribeAgent("fake-api-key");
    const result = await scribe.draftResearchPaper(MOCK_RESEARCH_DATA);

    // Should NOT contain markdown fences
    expect(result).not.toContain("```");
    // Should still start with documentclass
    expect(result).toContain("\\documentclass{amsart}");
  });

  test("includes trace data in the prompt sent to Gemini", async () => {
    let capturedBody = "";
    globalThis.fetch = (async (_url: any, opts: any) => {
      capturedBody = typeof opts?.body === "string" ? opts.body : await new Response(opts?.body).text();
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: MOCK_LATEX }] } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const scribe = new ScribeAgent("fake-api-key");
    await scribe.draftResearchPaper(MOCK_RESEARCH_DATA);

    // The prompt should include the theorem and tactic trace
    expect(capturedBody).toContain("nat_add_comm");
    expect(capturedBody).toContain("induction n");
  });
});
