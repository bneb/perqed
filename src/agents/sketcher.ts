import { GoogleGenerativeAI } from "@google/generative-ai";
import { LeanBridge } from "../lean_bridge";

/**
 * The SketcherAgent serves as a Translation Layer ("Draft-Sketch-Prove").
 * It intercepts informal mathematical bounds and drafts syntactically valid
 * Lean 4 skeletons populated exclusively with "sorry". 
 * 
 * If Lean throws a hard syntax error, the agent intercepts the stderr trace
 * and autonomously repairs the outline before the main Orchestrator ever sees it.
 */
export class SketcherAgent {
  private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
  private readonly leanBridge: LeanBridge;

  constructor(apiKey: string, workspaceDir?: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // We bind it immediately to Flash 2.5 because it's insanely fast and cheap, 
    // perfect for rapid syntax generation loops.
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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
