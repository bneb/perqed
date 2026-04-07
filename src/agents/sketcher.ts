import { GoogleGenerativeAI } from "@google/generative-ai";
import { LeanBridge } from "../lean_bridge";
import { getAgencyRegistry } from "../agency/index";
import { LocalProverClient } from "../agency/local_prover_client";

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

  constructor(apiKey: string, workspaceDir?: string) {
    const genAI = process.env.USE_LOCAL_PROVER === "true" 
      ? LocalProverClient.createMockGenAI() as any
      : new GoogleGenerativeAI(apiKey);
    
    // We bind it immediately to Flash 2.5 when using the Google SDK because it is insanely fast.
    // If using the local proxy, we resolve the native formalization model (e.g. deepseek).
    const providerModel = process.env.USE_LOCAL_PROVER === "true"
      ? getAgencyRegistry().resolveProvider("formalization").model
      : "gemini-2.5-flash";

    this.model = genAI.getGenerativeModel({
      model: providerModel,
      generationConfig: { temperature: 0.1 }
    });

    this.leanBridge = new LeanBridge(undefined, workspaceDir);
  }

  /**
   * Generates a fully compiling but logically unproven Lean 4 skeleton.
   */
  async sketchFormalOutline(informalMath: string): Promise<string> {
    const prompt = `You are the Formal Sketcher. Translate the following informal mathematics into a valid Lean 4 outline.
DO NOT attempt to prove the theorem. You MUST use the 'sorry' tactic for all proofs.
Ensure all necessary Mathlib imports are included at the top of the file.
Generate ONLY the valid Lean 4 code inside a markdown block. No conversational text.

### ⚠️ CRITICAL MATHLIB4 RESTRICTIONS ⚠️
You are operating under a strict Lean 4 Mathlib environment. You must obey these rules:
1. **NO IMAGINARY IMPORTS:** Do NOT attempt to import specialized combinatorial graph modules. Modules like \`Mathlib.Combinatorics.SimpleGraph.Circulant\` or \`Mathlib.Combinatorics.Graph.Circulant\` DO NOT EXIST.
2. **NO AUTOMORPHISM HALLUCINATIONS:** The structure of Mathlib4 has shifted. You MUST NOT try to call \`SimpleGraph.autGroup\` or import \`Mathlib.Combinatorics.SimpleGraph.Aut\`. It does not exist in our library tree. If you need graph symmetries, strictly use raw integer modulus adjacency.
3. **MANUAL CONSTRUCTION:** If the informal math describes a specialized graph (e.g., a Circulant Graph, Paley Graph, or Ramsey Witness), you MUST manually construct its adjacency logic from fundamental types. 
4. **PRIMITIVES:** To model finite graphs, use \`ZMod N\`, \`Fin N\`, basic \`Matrix\`, or raw Adjacency Relations (\`(i j : ZMod N) -> Prop\`). Define the generating sets explicitly.
5. **SIMPLEGRAPH INITIALIZATION:** Because Mathlib4 has changed, you must initialize graphs EXACTLY using 'where' clauses (like \`SimpleGraph V where Adj := adj; symm := by sorry; loopless := by sorry\`). Do NOT use \`SimpleGraph.mk\`, \`SimpleGraph.from_rel\`, or any function application.
6. **NO PROOF TACTICS:** You MUST NOT use tactics like 'rewrite', 'introN', or facts like 'neg_sub_eq_sub' or 'Finset.sum_congr'. DO NOT try to prove \`symm\` or \`loopless\` manually. You must assign 'by sorry' to EVERY single proof obligation.

Example of a valid manual Circulant graph construction in Lean 4:
\`\`\`lean
import Mathlib.Data.ZMod.Basic
import Mathlib.Combinatorics.SimpleGraph.Basic

def isCirculantEdge {N : ℕ} (S : Set (ZMod N)) (v w : ZMod N) : Prop :=
  (v - w) ∈ S ∨ (w - v) ∈ S

def myCirculantGraph (N : ℕ) (S : Set (ZMod N)) : SimpleGraph (ZMod N) where
  Adj v w := v ≠ w ∧ isCirculantEdge S v w
  symm := by sorry
  loopless := by sorry
\`\`\`
<INFORMAL_MATH>
${informalMath}
</INFORMAL_MATH>`;

    let sketch = await this.generateCode(prompt);
    let retries = 3;

    while (retries > 0) {
      console.log(`[Sketcher] Verifying structural syntax of drafted skeleton (retries left: ${retries})...`);
      
      // We pass the full generated code to verifyStructuralSkeleton.
      // This enforces that the Lean file compiles cleanly (exit code 0) 
      // but expects a 'uses \`sorry\`' warning.
      const result = await this.leanBridge.verifyStructuralSkeleton(sketch);

      if (result.valid) {
        console.log(`[Sketcher] Successfully compiled Lean 4 skeleton. Detected ${result.sorryGoals.length} stubs.`);
        return sketch;
      }

      // If invalid, we extract the raw compiler output directly to feed into the auto-repair loop!
      // To get the error, we just run executeLean on it to pull the actual trace.
      const executionResult = await this.leanBridge.executeLean(sketch, 15000);
      
      console.warn(`[Sketcher] Skeleton compilation failed. Auto-repairing...`);
      console.warn(`[Sketcher] COMPILER TRACE:\n${executionResult.rawOutput}`);
      
      const repairPrompt = `The following Lean 4 code failed to compile. 
Fix the compiler errors. Respond ONLY with the fully repaired Lean 4 code block. DO NOT attempt to prove it.

If the compiler trace indicates \`unknown package\` or \`object file ... does not exist\` for a Mathlib module, you have hallucinated an import that does not exist. 
You MUST remove that import and manually implement the required logic (e.g., defining Graph Adjacency directly using \`ZMod N\` and \`SimpleGraph\`) using only standard \`import Mathlib\` or core hierarchy imports.

CRITICAL REMINDER: Do NOT attempt to use \`SimpleGraph.autGroup\` or import \`Mathlib.Combinatorics.SimpleGraph.Aut\`. It will fatally crash the Lean compiler. Keep it brutally simple.
Additionally, DO NOT attempt to write actual proofs! If you see type mismatch errors on functions like \`Finset.sum_congr\`, it means you tried to write a proof instead of using \`by sorry\`. You must use \`by sorry\` for EVERYTHING. Initialize graphs using \`where\` clauses, not \`SimpleGraph.mk\`.
Do NOT hallucinate methods like \`SimpleGraph.cliqueNumber\` (it does not exist in this form) or \`q.IsPrime\` (use \`Nat.Prime q\` or \`Fact (Nat.Prime q)\`).

Compiler Trace:
${executionResult.rawOutput}

Broken Code:
\`\`\`lean
${sketch}
\`\`\`
`;
      sketch = await this.generateCode(repairPrompt);
      retries--;
    }

    throw new Error("SketcherAgent failed to produce a compiling Lean 4 syntax skeleton after 3 retries.");
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
