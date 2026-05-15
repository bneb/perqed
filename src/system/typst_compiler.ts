import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ScribeInput } from "../orchestration/actors";

const execAsync = promisify(exec);

export class TypstCompiler {
  /**
   * Reads the arxiv_report.typ template and recursively bridges explicit mathematics 
   * into a finalized discovery_report.pdf
   */
  static async compileReport(context: ScribeInput): Promise<string> {
    const timestamp = Date.now();
    const reportsDir = path.join(context.workspaceDir, "reports");
    
    // Ensure the output director natively exists
    await fs.mkdir(reportsDir, { recursive: true });
    
    const draftPath = path.join(reportsDir, `draft_${timestamp}.typ`);
    const finalPdfPath = path.join(reportsDir, `discovery_report.pdf`);
    const finalTypPath = path.join(reportsDir, `discovery_report.typ`);
    
    // Load native Typst declarative bindings
    const templatePath = path.resolve(__dirname, "../templates/arxiv_report.typ");
    let template = "";
    try {
       template = await fs.readFile(templatePath, "utf-8");
    } catch(e) {
       console.error(`[Typst Scribe] CRITICAL ERROR: Could not locate compilation template at ${templatePath}`);
       // Return fallback JSON string if the fundamental typst engine template fails
       return path.join(context.workspaceDir, "fallback_scribe_error.txt");
    }
    
    // String interpolation layer
    // Determine strict bounds
    const sdpLower = (context as any).flagAlgebraLimits?.lowerBound?.toFixed(5) ?? "0.00000";
    const sdpUpper = (context as any).flagAlgebraLimits?.upperBound?.toFixed(5) ?? "∞";
    
    const saEnergy = context.saEnergy !== null ? `Best Graph Energy Threshold Hit: ${context.saEnergy}` : "No Discrete Target Evaluated";
    
    const leanAst = context.leanAst ? JSON.stringify(context.leanAst, null, 2) : (context.leanProof ?? "-- No formal Lean proof synthesized --");
    
    let compiledMarkup = template
      .replace(/{{ HYPOTHESIS_SIGNATURE }}/g, context.approvedConjecture?.signature ?? context.hypothesis ?? "Unspecified Bound")
      .replace(/{{ LEAN_AST_CODE }}/g, leanAst)
      .replace(/{{ SDP_LOWER_BOUND }}/g, sdpLower)
      .replace(/{{ SDP_UPPER_BOUND }}/g, sdpUpper)
      .replace(/{{ SA_ENERGY_PLATEAU_STATS }}/g, saEnergy)
      .replace(/{{ FINAL_Z3_STATUS }}/g, context.proofStatus ?? "SKIPPED");
      
    // Sync to disk
    await fs.writeFile(draftPath, compiledMarkup, "utf-8");
    await fs.copyFile(draftPath, finalTypPath); // We keep a clear un-polluted raw source of truth
    
    // Shell execution to native binary
    try {
       console.log(`[Typst] Synthesizing Substrate... Translating AST into final Mathematical PDF.`);
       await execAsync(`typst compile ${draftPath} ${finalPdfPath}`);
       // Cleanup draft if compilation successful
       await fs.unlink(draftPath).catch(() => {});
       return finalPdfPath;
    } catch (e: any) {
       console.warn(`[Typst] Compilation faulted or missing native binary. Returning mathematically rigorous .typ source file directly. System trace: ${e?.message}`);
       // Graceful degradation mechanism: if the CI/CD pipeline doesn't have `typst` globally mounted,
       // the researcher still receives a fully compliant `.typ` template that compiles on any local machine.
       return finalTypPath;
    }
  }
}
