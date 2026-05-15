import { LeanBridge } from "../lean_bridge";
import { getAgencyRegistry } from "../agency";
import { VectorDatabase, TABLE_MATHLIB } from "../embeddings/vector_store";
import { LocalEmbedder } from "../embeddings/embedder";

export interface AutoformalizerConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  leanBridge: LeanBridge;
  maxRetries?: number;
}

export const COMPILER_SYSTEM_PROMPT_LEAN = `You are an expert Lean 4 Autoformalization compiler. Your ONLY job is to translate informal mathematical English into strict, type-safe Lean 4 definitions and theorem signatures.

CRITICAL RULES:
1. YOU ARE NOT A PEER REVIEWER. You must assume the user's mathematical statement is true. Never refuse to formalize a statement because you believe it to be false or an open problem.
2. BE STRICTLY TYPE-SAFE. Use Mathlib for real numbers (ℝ), rational numbers (ℚ), and infinite series (tsum).
3. Output ONLY valid Lean 4 code wrapped in \`\`\`lean ... \`\`\` blocks.
4. Output all signatures ending with \`:= by sorry\`.
5. ALWAYS use \`import Mathlib\` at the top. You have full access to Mathlib.
6. FORBIDDEN: NEVER use \`opaque\`, \`axiom\`, or \`constant\`. If you don't know the Mathlib name for a concept, search for its standard mathematical name (e.g., \`Summable\`, \`HasSum\`, \`tsum\`).
7. Keep it MINIMAL but COMPLETE. If the user provides an explicit Lean 4 signature, ensure it uses standard types from Mathlib.
8. Handling Real Numbers: Use \`ℝ\`. For series, use \`tsum\` and \`Summable\`. Do NOT write targeted imports like \`import Mathlib.Data.Real.Basic\` — only \`import Mathlib\` is allowed.
9. The construction should be un-obscured. For Erdős Problem #265, use \`∑' n, 1 / (a n : ℝ)\` and strictly use \`∃ q : ℚ, (q : ℝ) = (∑' ...)\` to denote rationality. DO NOT use \`IsRational\` as it is not a standard typeclass in this context.
10. LEAN 4 SYNTAX ONLY: Use \`fun n =>\` or \`fun n ↦\`, NEVER \`λ n,\`. Use capital \`Summable\` (NOT lowercase \`summable\`). Use \`Finset.sum\` not \`finset.sum\`. Lean 3 syntax like \`λ\` with comma is INVALID.
11. ARCHITECTURAL LEMMATIZATION: Do NOT emit a single monolithic theorem. You MUST break down the proof into 2-5 bite-sized \`lemma\` definitions (each ending in \`:= by sorry\`), followed by the main \`theorem\` (also ending in \`:= by sorry\`) that relies on those lemmas.
`;

export class AutoformalizerAgent {
  private config: Required<AutoformalizerConfig>;
  private db: VectorDatabase | null = null;

  constructor(config: AutoformalizerConfig) {
    this.config = {
      apiKey: config.apiKey ?? process.env.GEMINI_API_KEY ?? "",
      model: config.model ?? getAgencyRegistry().resolveProvider("formalization").model,
      baseUrl: config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta/models",
      leanBridge: config.leanBridge,
      maxRetries: config.maxRetries ?? 5,
    };
  }

  private extractLeanCode(text: string): string {
    // Attempt to match bounded code block
    const match = text.match(/```[lL]ean\s*([\s\S]*?)```/);
    let code = match ? match[1]!.trim() : text.trim();
    
    // Fallback cleanup in case the LLM forgot the closing backticks
    code = code.replace(/^```[lL]ean\s*/, "");
    code = code.replace(/```\s*$/, "");
    
    return code.trim();
  }

  /**
   * Mechanically normalize imports: strip all `import Mathlib.*` lines and
   * replace with a single `import Mathlib`. This prevents compiler failures
   * caused by LLMs guessing non-existent targeted Mathlib module paths.
   */
  private normalizeImports(code: string): string {
    const lines = code.split("\n");
    const filtered = lines.filter(l => !l.match(/^\s*import\s+Mathlib/));
    // Prepend the umbrella import
    return "import Mathlib\n" + filtered.join("\n");
  }

  /**
   * Mechanically strip hallucinated proof blocks. If the LLM tries to write out
   * a full proof starting with `:= by ...` or `:= ...`, we truncate it and replace
   * it with `:= by sorry`.
   */
  private normalizeSorries(code: string): string {
    // Regex matches the start of a lemma/theorem/def, captures the signature up to `:=`,
    // and discards everything following it until the next top-level keyword.
    // This is a naive regex; a safer approach is to find all declarations and
    // aggressively replace their bodies if they look like proofs.
    
    let normalized = code;
    // Replace `:= by \n <anything>` with `:= by sorry`
    // We can't easily parse Lean, so we'll just look for blocks.
    // Actually, the LLM is instructed to end signatures with `:= by sorry`.
    // Let's use a regex to replace `:= by[\s\S]*?(?=\n\n(?:lemma|theorem|def|class|instance|inductive|structure|abbrev|example)\b|$)` with `:= by sorry`
    
    normalized = normalized.replace(
      /:=\s*by[\s\S]*?(?=\n(?:lemma|theorem|def|class|instance|inductive|structure|abbrev|example)\b|\n--|$)/g,
      ":= by sorry\n"
    );
    
    return normalized;
  }

  async formalize(informalStatement: string): Promise<string> {
    const url = `${this.config.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    let contextText = "";
    try {
      console.log(`   📚 [Autoformalizer] Searching for structural mathlib context...`);
      const embedder = new LocalEmbedder();
      if (await embedder.isAvailable()) {
        const queryVector = await embedder.embed(informalStatement);
        if (queryVector.length > 0) {
          if (!this.db) {
            this.db = new VectorDatabase("./data/perqed.lancedb", TABLE_MATHLIB);
            await this.db.initialize();
          }
          const results = await this.db.searchMathlib(queryVector, 3);
          
          if (results.length > 0) {
             contextText = "\n\nHere are some formally verified Mathlib examples that may be relevant to your formalization:\n";
             for (const r of results) {
                contextText += `- ${r.theoremSignature} \n  (docstring: ${r.successfulTactic || r.id})\n`;
             }
          }
        }
      } else {
        console.log(`   ⚠️ [Autoformalizer] Local embedder unavailable, skipping RAG context.`);
      }
    } catch (e: any) {
      console.log(`   ⚠️ [Autoformalizer] Context retrieval failed: ${e.message}`);
    }

    const contents: any[] = [
      {
        role: "user",
        parts: [{ text: COMPILER_SYSTEM_PROMPT_LEAN + contextText + "\n\n---\n\n" + informalStatement }],
      },
    ];

    let lastCode = "";

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const payload = {
        contents,
        generationConfig: {
          temperature: 0.1, // Keep it low for syntax generation
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("No text returned from Gemini API");
      }

      // Append model response to conversation history
      contents.push({ role: "model", parts: [{ text }] });

      lastCode = this.normalizeSorries(this.normalizeImports(this.extractLeanCode(text)));

      // Check for forbidden keywords
      const forbidden = ["opaque", "axiom", "constant"];
      const found = forbidden.find(k => lastCode.includes(k));
      if (found) {
        console.log(`   ⚠️ [Autoformalizer] Iteration ${attempt}: Forbidden keyword '${found}' detected.`);
        contents.push({
          role: "user",
          parts: [{ text: `FORBIDDEN KEYWORD DETECTED: You used '${found}'. You MUST NOT use opaque, axiom, or constant. Use standard Mathlib definitions instead. Please fix and output ONLY the corrected \`\`\`lean block.` }],
        });
        continue;
      }

      console.log(`   🧠 [Autoformalizer] Iteration ${attempt}: verifying signature syntax...`);

      // Structural verify using checkSyntax logic
      const checkSource = `${lastCode}\n\ndef main : IO Unit := IO.println "SYNTAX_CHECK"\n`;
      const leanResult = await this.config.leanBridge.executeLean(checkSource, 15000);

      // We consider it valid if it doesn't throw a hard compiler error 
      // (a warning about 'sorry' usage is expected and fine)
      if (!leanResult.error || !leanResult.error.includes("error:")) {
        console.log(`   ✅ [Autoformalizer] Signature compiled successfully.`);
        return lastCode;
      }

      console.log(`   ⚠️ [Autoformalizer] Compiler rejected signature. Feeding error back to LLM...`);
      
      // Append the compiler error and retry
      contents.push({
        role: "user",
        parts: [{ text: `COMPILER ERROR:\n${leanResult.error}\n\nPlease fix your Lean 4 code. Only output the corrected \`\`\`lean block.` }],
      });
    }

    throw new Error(`Autoformalizer failed to generate a valid Lean signature after ${this.config.maxRetries} attempts. Last code:\n${lastCode}`);
  }
}
