import { GoogleGenerativeAI } from "@google/generative-ai";
import { LeanBridge } from "../lean_bridge";
import { getAgencyRegistry } from "../agency/index";
import { LocalProverClient } from "../agency/local_prover_client";
import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase } from "../embeddings/vector_store";

/**
 * The SketcherAgent serves as a Translation Layer ("Draft-Sketch-Prove").
 * It intercepts informal mathematical bounds and drafts syntactically valid
 * Lean 4 skeletons populated exclusively with "sorry". 
 * 
 * If Lean throws a hard syntax error, the agent intercepts the stderr trace
 * and autonomously repairs the outline before the main Orchestrator ever sees it.
 */
export class SketcherAgent {
  private readonly model: any;
  private readonly leanBridge: LeanBridge;
  private readonly embedder: LocalEmbedder;
  private readonly db: VectorDatabase;

  constructor(apiKey: string, workspaceDir?: string) {
    const genAI = process.env.USE_LOCAL_PROVER === "true" 
      ? LocalProverClient.createMockGenAI() as any
      : new GoogleGenerativeAI(apiKey);
    
    // If using the local proxy, we resolve the native formalization model (e.g. deepseek).
    const providerModel = process.env.USE_LOCAL_PROVER === "true"
      ? getAgencyRegistry().resolveProvider("formalization").model
      : getAgencyRegistry().resolveProvider("formalization", false).model;

    this.model = genAI.getGenerativeModel({
      model: providerModel,
      generationConfig: { temperature: 0.1 }
    });

    this.leanBridge = new LeanBridge(undefined, workspaceDir);
    this.embedder = new LocalEmbedder();
    this.db = new VectorDatabase("./data/perqed.lancedb");
  }

  /**
   * Generates a fully compiling but logically unproven Lean 4 skeleton.
   */
  async sketchFormalOutline(informalMath: string): Promise<string> {
    const prompt = `You are the Formal Sketcher. Translate the following informal mathematics into a valid Lean 4 outline.
DO NOT attempt to prove the theorem. You MUST use the 'sorry' tactic for all proofs.
Ensure all necessary Mathlib imports are included at the top of the file.
Generate ONLY the valid Lean 4 code inside a markdown block. No conversational text.

### Mathlib4 Restrictions
You are operating under a strict Lean 4 Mathlib environment. You must obey these rules:
1. **Valid Imports Only:** Do not attempt to import specialized combinatorial graph modules. Modules like \`Mathlib.Combinatorics.SimpleGraph.Circulant\` or \`Mathlib.Combinatorics.Graph.Circulant\` are not available.
2. **No Automorphism Modules:** The structure of Mathlib4 has shifted. Do not try to call \`SimpleGraph.autGroup\` or import \`Mathlib.Combinatorics.SimpleGraph.Aut\`. It does not exist in our library tree. If you need graph symmetries, use raw integer modulus adjacency.
3. **MANUAL CONSTRUCTION:** If the informal math describes a specialized graph (e.g., a Circulant Graph, Paley Graph, or Ramsey Witness), you MUST manually construct its adjacency logic from fundamental types. 
4. **PRIMITIVES:** To model finite graphs, use \`ZMod N\`, \`Fin N\`, basic \`Matrix\`, or raw Adjacency Relations (\`(i j : ZMod N) -> Prop\`). Define the generating sets explicitly.
5. **SIMPLEGRAPH INITIALIZATION:** Because Mathlib4 has changed, you must initialize graphs EXACTLY using 'where' clauses (like \`SimpleGraph V where Adj := adj; symm := by sorry; loopless := by sorry\`). Do NOT use \`SimpleGraph.mk\`, \`SimpleGraph.from_rel\`, or any function application.
6. **NO PROOF TACTICS:** You MUST NOT use tactics like 'rewrite', 'introN', or facts like 'neg_sub_eq_sub' or 'Finset.sum_congr'. DO NOT try to prove \`symm\` or \`loopless\` manually. You must assign 'by sorry' to EVERY single proof obligation.
7. **DECIDABILITY & FINTYPES:** If your design creates sets or requires subsets (like Residue classes), ALWAYS add \`open Classical\` and \`noncomputable section\` at the top of your file to prevent \`DecidablePred\` synthesis errors!
8. **PRIME FACTS:** Methods like \`p.prime\` or \`Nat.prime\` DO NOT EXIST. If you need a prime \`p\` for \`ZMod p\` to behave well, you must take it as an instance \`[Fact (Nat.Prime p)]\` or state \`Nat.Prime p\`.

{{RAG_CONTEXT}}

<INFORMAL_MATH>
${informalMath}
</INFORMAL_MATH>`;

    let ragContext = "";
    try {
      if (await this.embedder.isAvailable()) {
        await this.db.initialize();
        const vector = await this.embedder.embed(informalMath, true);
        if (vector && vector.length > 0) {
          const results = await this.db.searchMathlib(vector, 5);
          if (results && results.length > 0) {
            ragContext = "<RETRIEVED_MATHLIB_TYPES>\n" +
              "The following Mathlib 4 core primitives are semantically relevant to your goal. " +
              "You are COMMANDED to strictly utilize these types if applicable instead of hallucinating novel graph modules.\n\n" +
              results.map(r => `Theorem: ${r.id}\nSignature: ${r.theoremSignature}`).join("\n---\n") +
              "\n</RETRIEVED_MATHLIB_TYPES>\n";
          }
        }
      }
    } catch (e: any) {
      console.warn(`[SketcherAgent] Graceful fallback: Could not fetch Mathlib RAG context (${e.message})`);
    }

    const finalPrompt = prompt.replace("{{RAG_CONTEXT}}", ragContext);
    
    // CORAL-inspired Parallel Competitive Sketching: 
    // Spawn 3 independent LLM workers racing to produce a valid structural bound.
    const runWorker = async (workerId: number): Promise<string> => {
      let sketch = await this.generateCode(finalPrompt);
      let retries = 3;

      while (retries > 0) {
        console.log(`[Sketcher Worker ${workerId}] Verifying structural syntax of drafted skeleton (retries left: ${retries})...`);
        
        const result = await this.leanBridge.verifyStructuralSkeleton(sketch);

        if (result.valid) {
          console.log(`[Sketcher Worker ${workerId}] 🏆 Successfully compiled Lean 4 skeleton. Detected ${result.sorryGoals.length} stubs.`);
          return sketch;
        }

        const executionResult = await this.leanBridge.executeLean(sketch, 15000);
        const traceContent = executionResult.rawOutput || executionResult.error || "No output provided (Silent failure)";
        
        console.warn(`[Sketcher Worker ${workerId}] Skeleton compilation failed. Auto-repairing...`);
        
        const repairPrompt = `The following Lean 4 code failed to compile. 
Fix the compiler errors. Respond ONLY with the fully repaired Lean 4 code block. DO NOT attempt to prove it.

If the compiler trace indicates \`unknown package\` or \`object file ... does not exist\` for a Mathlib module, you have hallucinated an import that does not exist. 
You MUST remove that import and manually implement the required logic (e.g., defining Graph Adjacency directly using \`ZMod N\` and \`SimpleGraph\`) using only standard \`import Mathlib\` or core hierarchy imports.

CRITICAL REMINDER: Do NOT attempt to use \`SimpleGraph.autGroup\` or import \`Mathlib.Combinatorics.SimpleGraph.Aut\`. It will fatally crash the Lean compiler. Keep it brutally simple.
Additionally, DO NOT attempt to write actual proofs! If you see type mismatch errors on functions like \`Finset.sum_congr\`, it means you tried to write a proof instead of using \`by sorry\`. You must use \`by sorry\` for EVERYTHING. Initialize graphs using \`where\` clauses, not \`SimpleGraph.mk\`.
Do NOT hallucinate methods like \`SimpleGraph.cliqueNumber\` (it does not exist in this form) or \`q.IsPrime\` or \`p.prime\` (use \`Nat.Prime q\` or \`Fact (Nat.Prime q)\`).
If the compiler failed to synthesize an instance of \`DecidablePred\` or \`Fintype\`, you must insert \`open Classical\` and \`noncomputable section\` at the top of the file to force classical logic!

Compiler Trace:
${traceContent}

Broken Code:
\`\`\`lean
${sketch}
\`\`\`
`;
        sketch = await this.generateCode(repairPrompt);
        retries--;
      }
      throw new Error(`Worker ${workerId} exhausted all retries`);
    };

    try {
       console.log(`[Sketcher] Launching 3 parallel workers for MCTS Formalization...`);
       return await Promise.any([runWorker(1), runWorker(2), runWorker(3)]);
    } catch (e) {
       throw new Error("SketcherAgent failed to produce a compiling Lean 4 syntax skeleton after all parallel workers exhausted their retries.");
    }
  }

  private async generateCode(prompt: string): Promise<string> {
    const response = await this.model.generateContent(prompt);
    const text = response.response.text();
    
    // Extract everything inside ```lean ... ``` or just take the raw string
    const match = text.match(/```(?:lean)?\n([\s\S]*?)```/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return text.trim();
  }
}
