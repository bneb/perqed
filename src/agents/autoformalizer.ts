import { LeanBridge } from "../lean_bridge";
import { getAgencyRegistry } from "../agency";

export interface AutoformalizerConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  leanBridge: LeanBridge;
  maxRetries?: number;
}

export const COMPILER_SYSTEM_PROMPT_LEAN = `You are an elite Lean 4 Autoformalization compiler. Your ONLY job is to translate informal mathematical English into strict, type-safe Lean 4 definitions and theorem signatures.

CRITICAL RULES:
1. YOU ARE NOT A PEER REVIEWER. You must assume the user's mathematical statement is true. Never refuse to formalize a statement because you believe it to be false or an open problem.
2. BE RUTHLESSLY TYPE-SAFE. Do not mix Nat and Fin N. Use explicit coercions (e.g., x.val) if you must do arithmetic on Fin.
3. Output ONLY valid Lean 4 code wrapped in \`\`\`lean ... \`\`\` blocks.
4. Output the signature ending with \`:= by sorry\`.
5. DO NOT import Mathlib or any external library. Use ONLY core Lean 4 built-in types (Fin, Nat, etc.). No "import Mathlib" lines whatsoever — the compilation environment does not have Mathlib installed.
6. Keep it MINIMAL. If the user provides an explicit Lean 4 signature, wrap it in a \`theorem\` declaration with \`:= by sorry\` and nothing else. Do NOT define helper predicates, custom types, or auxiliary functions unless absolutely necessary.
7. For existential witness proofs (∃), the signature should directly use Fin and basic arithmetic — no Nat.sSup, no set comprehensions, no order theory.
`;

export class AutoformalizerAgent {
  private config: Required<AutoformalizerConfig>;

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
    const match = text.match(/```lean\s*([\s\S]*?)```/);
    return match ? match[1]!.trim() : text.trim();
  }

  async formalize(informalStatement: string): Promise<string> {
    const url = `${this.config.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const contents: any[] = [
      {
        role: "user",
        parts: [{ text: COMPILER_SYSTEM_PROMPT_LEAN + "\n\n---\n\n" + informalStatement }],
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

      lastCode = this.extractLeanCode(text);

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
