import type { ResearchContext } from "./types";
import type { ProofTree } from "../tree";

/**
 * Condense massive unstructured historical arrays into a highly compressed,
 * high-signal "Execution Context" to prevent LLM attention dilution.
 */
export function pruneContext(context: ResearchContext): string {
  let condensed = "";

  // 1. Lakatosian Edge Cases (Empirical Refinements)
  if (context.lakatosianHistory && context.lakatosianHistory.length > 0) {
    condensed += "== ADVERSARIAL COUNTER-EXAMPLES (AVOID) ==\n";
    // We only take the most recent 3 cases to prevent excessive bloat
    const recentKills = context.lakatosianHistory.slice(-3);
    for (const h of recentKills) {
      // Just extract the stripped description or bounds of the edge case if possible,
      // instead of raw JSON dumps which cost tokens.
      const snippet = typeof h.killerEdgeCase === "string" 
         ? h.killerEdgeCase.slice(0, 150) 
         : JSON.stringify(h.killerEdgeCase).slice(0, 150);
         
      condensed += `- Failed: ${h.failedConjecture.split("\n")[0]}\n`;
      condensed += `  Edge Case: ${snippet}...\n`;
    }
    condensed += "\n";
  }

  // 2. Active Lemma Extraction
  if (context.lemmaStack && context.lemmaStack.length > 0) {
    condensed += "== RECURSIVE LEMMA DECOMPOSITION STACK ==\n";
    let indent = "";
    for (let i = 0; i < context.lemmaStack.length; i++) {
       const l = context.lemmaStack[i]!;
       condensed += `${indent}[L${i+1}] Decoupled Parent Goal: ${l.conjecture.signature}\n`;
       indent += "  ";
    }
    condensed += "\n";
  }

  if (!condensed) {
     return "Execution Context: Clean Initialization. No accumulated adversary states or lemma stacks.";
  }

  return condensed.trim();
}
