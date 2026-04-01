import { GoogleGenAI, Type } from "@google/genai";
import { ArxivLibrarian } from "../librarian/arxiv_librarian";
import type { IdeationOutput } from "../orchestration/types";

export class IdeatorAgent {
  private readonly ai: GoogleGenAI;
  private readonly workspaceDir: string;

  constructor(apiKey?: string, workspaceDir: string = ".") {
    const key = apiKey || process.env.GEMINI_API_KEY || "";
    if (!key) {
      throw new Error("IdeatorAgent requires a Gemini API key. Set it in GEMINI_API_KEY env or pass it.");
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.workspaceDir = workspaceDir;
  }

  /**
   * Orchestrates the entire cognitive flow for Ideation.
   */
  async ideate(prompt: string, lastValidationError?: string | null): Promise<IdeationOutput> {
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
    const searchResults = await librarian.searchDatabase(parsedQuery, { limit: 10 });
    const poolSize = Math.min(3, searchResults.length);
    const randomIndex = Math.floor(Math.random() * Math.max(1, poolSize));
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

    // 3. Build strategy
    return await this.generateStrategy(prompt, title, arxivId, abstract, lastValidationError);
  }

  private async extractSearchQuery(prompt: string): Promise<string> {
    try {
      const queryResponse = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
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
    lastValidationError?: string | null
  ): Promise<IdeationOutput> {
    let historyFeedback = "";
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

YOUR TASK:
1. Identify a potential extension related to this exact paper.
2. Formulate a hypothesis that extends this work.
3. Classify novelty: "NOVEL_DISCOVERY" if this is genuinely new, "KNOWN_THEOREM" if this is already established.
4. Pick 7 distinct mathematical domains to probe.

CRITICAL: The hypothesis MUST be finitely computable by native_decide. Do NOT invent new functions.
${historyFeedback}`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-pro",
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
      literature: [title],
    };
  }
}
