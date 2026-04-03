import { GoogleGenAI, Type } from "@google/genai";
import { ArxivLibrarian } from "../librarian/arxiv_librarian";
import type { IdeationOutput } from "../orchestration/types";
import { getAgencyRegistry } from "../agency";

export class IdeatorAgent {
  private readonly ai: GoogleGenAI;
  private readonly workspaceDir: string;
  private readonly model: string;

  constructor(apiKey?: string, workspaceDir: string = ".") {
    const key = apiKey || process.env.GEMINI_API_KEY || "";
    if (!key) {
      throw new Error("IdeatorAgent requires a Gemini API key. Set it in GEMINI_API_KEY env or pass it.");
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.workspaceDir = workspaceDir;
    // Escalate to Tier 3 (L3_complex) which maps to gemini-2.5-pro for deep reasoning
    this.model = getAgencyRegistry().resolveProvider("reasoning", false, 2).model;
  }

  /**
   * Orchestrates the entire cognitive flow for Ideation.
   */
  async ideate(prompt: string, lastValidationError?: string | null, publishableMode: boolean = false, refinementContext?: string, crossPollinate: boolean = false): Promise<IdeationOutput> {
    const parsedQuery = await this.extractSearchQuery(prompt);
    console.log(`[Librarian] Extracted arXiv query: "${parsedQuery}"`);

    // 1. Seed the literature DB
    const librarian = new ArxivLibrarian({
      queries: [parsedQuery],
      maxPerQuery: 10,
      dbPath: `${this.workspaceDir}/lancedb`,
    });
    await librarian.run();

    // 2. Query top matches using the cleaned keyword
    let seedPaper;
    let searchResults = await librarian.searchDatabase(parsedQuery, { limit: 10 });
    
    const explicitIdMatch = parsedQuery.startsWith("id:") ? `arxiv-${parsedQuery.slice(3)}` : null;
    let poolSize = Math.min(3, searchResults.length);
    let randomIndex = Math.floor(Math.random() * Math.max(1, poolSize));
    
    // If we have an explicit ID requested, enforce picking exactly that paper.
    // The librarian.searchDatabase handles exact ID extraction now.
    if (explicitIdMatch) {
      const perfectMatch = searchResults.find(r => r.id.startsWith(explicitIdMatch));
      if (perfectMatch) {
        seedPaper = perfectMatch;
      }
    }
    
    if (!seedPaper) {
      seedPaper = searchResults[randomIndex];
    }

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
    
    let secondPaper = null;
    if (crossPollinate) {
      console.log(`[Ideation] Cross-Pollination Crucible ACTIVE. Searching for orthogonal paper...`);
      let pool = await librarian.searchDatabase("algebraic structure topology isomorphism graph combinatorial", { limit: 20 });
      let distinctPool = pool.filter(p => p.id !== seedPaper?.id);
      if (distinctPool.length > 0) {
        secondPaper = distinctPool[Math.floor(Math.random() * Math.min(5, distinctPool.length))];
        console.log(`[Ideation] Selected Secondary Crucible Seed: "${secondPaper.paperTitle}"`);
      }
    }

    console.log(`[Ideation] Synthesizing strategy... (${publishableMode ? "Generalized Publishable Mode" : "Finite Computable Mode"})`);

    // 3. Build strategy
    return await this.generateStrategy(
      prompt, title, arxivId, abstract, 
      lastValidationError, publishableMode, refinementContext, 
      crossPollinate, secondPaper?.paperTitle, secondPaper?.id?.replace("arxiv-", ""), secondPaper?.paperAbstract
    );
  }

  private async extractSearchQuery(prompt: string): Promise<string> {
    const arxivIdMatch = prompt.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:)(\d{4}\.\d{4,5}(?:v\d+)?)/i);
    if (arxivIdMatch) {
      return `id:${arxivIdMatch[1]}`;
    }

    try {
      const queryResponse = await this.ai.models.generateContent({
        model: this.model,
        contents: `Extract the core mathematical topic from this prompt as a targeted 2-4 word keyword query for the arXiv API. 
Exclude words like "find", "arxiv", "paper", "recent", "random", "proof", "conjecture", "extension".
Only output the raw search phrase.
Prompt: "${prompt}"`,
        config: { temperature: 0.1 },
      });
      return queryResponse.text?.trim().replace(/"/g, "") || prompt;
    } catch (e) {
      return prompt;
    }
  }

  private async generateStrategy(
    prompt: string,
    title: string,
    arxivId: string,
    abstract: string,
    lastValidationError?: string | null,
    publishableMode: boolean = false,
    refinementContext?: string,
    crossPollinate: boolean = false,
    title2?: string | null,
    arxivId2?: string | null,
    abstract2?: string | null
  ): Promise<IdeationOutput> {
    let historyFeedback = refinementContext ? `\n\n${refinementContext}` : "";
    if (lastValidationError) {
      historyFeedback = `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastValidationError}\nPlease formulate a DIFFERENT hypothesis using only standard Mathlib definitions.`;
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

    const systemPrompt = `You are an elite mathematical architect.
Read the following abstract from a real arXiv paper:

Title: ${title}
arXiv ID: ${arxivId}
Abstract: ${abstract}
${crossPollinate && title2 ? `
---
CRUCIBLE CROSS-POLLINATION ACTIVE:
You must also read this secondary paper from an orthogonal domain:

Title: ${title2}
arXiv ID: ${arxivId2}
Abstract: ${abstract2}

ORTHOGONALITY DIRECTIVE ("THINK BIG & AUTONOMOUS"):
Groundbreaking PhD-level mathematics happens by importing the algebraic machinery of Domain A into the topological landscape of Domain B (Functorial Translation). 
You must synthesize these TWO completely distinct papers. Find the structural isomorphism between them, and formulate a novel hypothesis that uses the secondary paper's machinery to shatter constraints or generalize mechanisms in the primary paper.` : ""}

YOUR TASK:
1. Identify a potential extension related to this exact paper(s).
2. Formulate a hypothesis that extends this work. If cross-pollinating, explicitly synthesize both domains.
3. Classify novelty: "NOVEL_DISCOVERY" if this is genuinely new, "KNOWN_THEOREM" if this is already established.
4. Pick 7 distinct mathematical domains to probe.

${publishableMode 
  ? `CRITICAL: Formulate a generalized structural theorem (e.g., asymptotic bounds, generalized property across all N). Do NOT artificially shrink the hypothesis to a specific toy computation or finite edge case. Assume it will be formally verified using standard algebraic and logic tactics (simp, omega, linarith, induction). The theorem MUST be formulated using standard Mathlib definitions without inventing new functions.`
  : `CRITICAL: The hypothesis MUST be finitely computable by native_decide. Do NOT invent new functions.`
}
${historyFeedback}`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: systemPrompt,
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
        prompt,
        seed_paper: raw.seed_paper,
        extension_hypothesis: raw.extension_hypothesis,
        domains_to_probe: raw.domains_to_probe,
        lean_target_sketch: raw.lean_target_sketch,
      },
      literature: [title, ...(title2 ? [title2] : [])],
    };
  }
}
