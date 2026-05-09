import { ProofTree } from "../tree";
import { LeanREPLBridge } from "../lean_repl";
import { LeanPRMScorer } from "../agents/lean_prm_scorer";
import { AgentFactory } from "../agents/factory";
import { AgentRouter } from "../agents/router";
import type { AttemptLog } from "../types";

import { VerifiedVault } from "../vault";

export interface MCTSEvaluationResult {
  status: "PROVED" | "FAILED" | "EXHAUSTED" | "NEEDS_LEMMA" | "REQUEST_PROBE" | "REQUEST_LITERATURE" | "FALSIFIED";
  proofPath?: string[];
  finalTree: ProofTree;
  lemmaStatement?: string;
  hypothesis?: string;
  concept?: string;
  domain?: string;
  counterexample?: string;
}

export class LeanDynamicEvaluator {
  private repl: LeanREPLBridge;
  private prm: LeanPRMScorer;
  private factory: AgentFactory;
  private maxIterations: number;
  private apiKey: string;
  private workspaceDir: string;

  constructor(workspaceDir: string, apiKey: string, maxIterations: number = 30, problemDifficulty: 'normal' | 'hard' = 'normal', agentFactory?: any) {
    this.workspaceDir = workspaceDir;
    this.repl = new LeanREPLBridge(workspaceDir);
    this.prm = new LeanPRMScorer();
    console.log(`[DEBUG] LeanDynamicEvaluator constructor called with agentFactory=${!!agentFactory}`);
    this.factory = agentFactory ?? new AgentFactory({ geminiApiKey: apiKey, problemDifficulty });
    this.maxIterations = maxIterations;
    this.apiKey = apiKey;
  }

  public close(): void {
    this.repl.close();
  }

  async runMCTSSearch(
    conjecture: { signature: string; description: string },
    proofTree: ProofTree,
    prunedContext?: string,
    isEmpiricalWitness: boolean = false
  ): Promise<MCTSEvaluationResult> {

    console.log(`[MCTS] ══════ LeanDynamicEvaluator v2 (two-step REPL) ══════`);
    console.log(`[MCTS] Signature length: ${conjecture.signature.length} chars`);
    console.log(`[MCTS] Signature preview: ${conjecture.signature.substring(0, 120)}...`);
    // Initialize root in REPL — Two-step protocol:
    //   Step 1: Send imports to create the environment
    //   Step 2: Send the theorem body (open + theorem := by) using that env
    //
    // IMPORTANT: `import Mathlib` (the umbrella import) silently fails in
    // the REPL because the newer Mathlib.lean uses `module` syntax. We must
    // expand it to targeted sub-module imports that cover the types used
    // in this theorem (StrictMono, Summable, tsum, ℚ cast).
    const vaultPreamble = VerifiedVault.getVaultPreamble(this.workspaceDir);

    // Extract import lines from the Autoformalizer output
    const importLines = conjecture.signature
      .split("\n")
      .filter(l => /^import\s+/.test(l.trim()))
      .map(l => l.trim());

    // If the only import is the umbrella `import Mathlib`, expand to targeted imports
    const MATHLIB_FALLBACK_IMPORTS = [
      "import Mathlib.Order.Monotone.Basic",        // StrictMono
      "import Mathlib.Topology.Algebra.InfiniteSum.Basic", // Summable, tsum, ∑'
      "import Mathlib.Data.Rat.Cast.Defs",           // ℚ → ℝ cast
      "import Mathlib.Data.Real.Basic",              // ℝ
      "import Mathlib.Analysis.SpecificLimits.Basic", // Series convergence
      "import Mathlib.Data.Nat.Basic",               // ℕ basics
    ];

    let resolvedImports: string[];
    if (importLines.length === 0 || (importLines.length === 1 && importLines[0] === "import Mathlib")) {
      console.log("[MCTS] Expanding umbrella `import Mathlib` to targeted sub-module imports");
      resolvedImports = MATHLIB_FALLBACK_IMPORTS;
    } else {
      resolvedImports = importLines;
    }

    // Step 1: Import
    const importCmd = [...resolvedImports, vaultPreamble].filter(Boolean).join("\n").trim();
    console.log(`[MCTS] Step 1 — Import command:\n${importCmd.split("\n").map(l => "  " + l).join("\n")}`);
    const importRes = await this.repl.sendCmd({ cmd: importCmd });

    // Check for import errors (env 0 with no errors is valid for imports)
    const importErrors = (importRes.messages ?? []).filter(m => m.severity === "error");
    if (importErrors.length > 0) {
      console.error(`[MCTS] Import errors: ${importErrors.map(m => m.data).join("; ")}`);
      this.repl.close();
      return { status: "FAILED", finalTree: proofTree };
    }
    console.log(`[MCTS] Step 1 — Import succeeded. env=${importRes.env}`);

    // Step 2: Send the theorem body using the import env
    let moduleBody = conjecture.signature
      .replace(/^import\s+.*$/gm, "")       // Strip all import lines (handled in step 1)
      .replace(/:=\s*by\s+sorry\s*$/, ":= by\n")  // Replace sorry with open tactic block
      .trim();

    // Lean 3 → Lean 4 syntax sanitizer
    // The Autoformalizer may produce Lean 3 syntax that compiles under the
    // umbrella `import Mathlib` (via compatibility layers) but fails under
    // targeted imports. Fix the most common patterns:
    moduleBody = moduleBody
      .replace(/λ\s+(\w+)\s*,/g, "fun $1 =>")    // λ n, → fun n =>
      .replace(/\bsummable\b/g, "Summable")       // summable → Summable
      .replace(/\bhas_sum\b/g, "HasSum")           // has_sum → HasSum
      .replace(/\bfinset\.sum\b/g, "Finset.sum");  // finset.sum → Finset.sum

    // Fallback: if the regex didn't match, ensure the block ends with `:= by\n`
    // Ensure the block ends with `:= by\n  sorry` to generate a proofState
    if (moduleBody.match(/:=\s*by\s*$/)) {
      moduleBody += "\n  sorry";
    } else if (!moduleBody.match(/:=\s*by\s+sorry\s*$/)) {
      moduleBody += " := by\n  sorry";
    }

    console.log("[MCTS] Step 2 — Theorem body sent to REPL:\n" + moduleBody.split("\n").map((l,i) => `  ${i+1}: ${l}`).join("\n"));
    const initRes = await this.repl.sendCmd({ cmd: moduleBody, env: importRes.env });

    // Check for REAL errors (not "uses sorry" warnings which are expected)
    const initErrors = (initRes.messages ?? [])
      .filter(m => m.severity === "error");

    if (initErrors.length > 0) {
      const errMsgs = initErrors.map(m => `L${m.pos.line}:${m.pos.column} ${m.data}`).join("\n  ");
      console.error(`[MCTS] Theorem initialization had fatal errors:\n  ${errMsgs}`);
      this.repl.close();
      return { status: "FAILED", finalTree: proofTree };
    }

    // Extract proofState from the sorries response
    const sorries = (initRes as any).sorries ?? [];
    if (sorries.length === 0 || sorries[0].proofState === undefined) {
      console.error(`[MCTS] No proofState returned from sorry. Full response: ${JSON.stringify(initRes)}`);
      this.repl.close();
      return { status: "FAILED", finalTree: proofTree };
    }

    let globalProofPath: string[] = [];

    // Iterate through all sorry blocks
    for (let sorryIndex = 0; sorryIndex < sorries.length; sorryIndex++) {
      const initialProofState = sorries[sorryIndex].proofState;
      const initialGoal = sorries[sorryIndex].goal ?? "unknown";

      console.log(`\n======================================================`);
      console.log(`[MCTS] 🏁 STARTING LEMMA ${sorryIndex + 1}/${sorries.length}`);
      console.log(`[MCTS]    proofState=${initialProofState}`);
      console.log(`[MCTS]    Goal: ${initialGoal.split('\n')[0]}...`);
      console.log(`======================================================\n`);

      proofTree.reset(initialGoal, initialProofState);

      let currentIteration = 0;
      let lemmaSolved = false;
      let lemmaPath: string[] = [];

      while (currentIteration < this.maxIterations) {
        currentIteration++;

        // 1. Selection (UCT)
        const openNodes = proofTree.getBestOpenNodes(1);
        if (openNodes.length === 0) {
          console.log(`[MCTS] Search space exhausted for lemma ${sorryIndex + 1}.`);
          break;
        }
        const activeNode = openNodes[0]!;
        
        console.log(`\n[MCTS] Iteration ${currentIteration} - Exploring Node ${activeNode.id.substring(0,6)} (Depth: ${activeNode.depth}, Score: ${activeNode.value.toFixed(2)})`);

        // 2. Tactic Generation (Expansion Candidates)
        const currentGoals = activeNode.leanState;
        
        // Compute identical error count from node history
        let identicalErrorCount = 0;
        const errHist = activeNode.errorHistory;
        if (errHist.length > 0) {
          const lastErr = errHist[errHist.length - 1]!;
          identicalErrorCount = 1;
          for (let i = errHist.length - 2; i >= 0; i--) {
            if (errHist[i] === lastErr) identicalErrorCount++;
            else break;
          }
        }
        
        const signals = {
          totalAttempts: currentIteration - 1,
          consecutiveFailures: activeNode.errorHistory.length,
          globalFailures: proofTree.getGlobalTreeFailures(),
          goalCount: AgentRouter.parseGoalCount(currentGoals),
          isStuckInLoop: identicalErrorCount >= 3,
          lastErrors: errHist.slice(-3),
          hasArchitectDirective: false,
          identicalErrorCount,
          totalProverCalls: proofTree.getNodeCount(),
          hasSubgoalProposal: false
        };
        
        const role = AgentRouter.determineNextAgent(signals);
        const agent = this.factory.getAgent(role, signals);
        console.log(`[MCTS]   → Agent: ${role} | Model: ${(agent as any).modelTier ?? (agent as any).agent?.config?.model ?? "local"} | Failures: ${signals.consecutiveFailures}/${signals.globalFailures}`);

        // Build error feedback block so the LLM doesn't repeat failed tactics
        const recentErrors = errHist.slice(-3);
        const errorFeedback = recentErrors.length > 0
          ? `\n\n[PREVIOUS FAILED TACTICS — DO NOT REPEAT THESE]\n${recentErrors.map((e, i) => `${i + 1}. ${e.slice(0, 300)}`).join("\n")}\n\nIMPORTANT: The above tactics all FAILED. You MUST try a fundamentally different approach. If omega fails on coerced types (↑), try: simp, exact Nat.add_lt_add_right, push_cast, or refine with explicit proof terms.`
          : "";

        const escalationContext = role !== "PROVER" 
          ? `\n\n[SYSTEM ESCALATION METADATA]
You have been invoked because the previous fast-tactic modeling failed.
- Consecutive Failures: ${signals.consecutiveFailures}
- Identical Errors Detected: ${identicalErrorCount > 0 ? 'Yes (' + identicalErrorCount + 'x)' : 'No'}
- Current Goal Count: ${signals.goalCount}
Please step back and provide a higher-level structural Lean 4 tactic sequence (like 'induction' or 'by_cases') to unblock the tree.` 
          : "";

        const contextStr = role === "ARCHITECT"
           ? `${prunedContext}\n\n## Theorem: approved_conjecture ${conjecture.signature}\n\n## Current Goals:\n${currentGoals}${errorFeedback}${escalationContext}`
           : `## Theorem: approved_conjecture ${conjecture.signature}\n\n## Current Goals:\n${currentGoals}${errorFeedback}${escalationContext}`;

        let generatedTactics: string[] = [];
        try {
          const response = await agent.generateMove(contextStr) as any;
          if (response.action === "REQUEST_EMPIRICAL_PROBE") {
             console.log(`\n[MCTS] Architect Requested Empirical Probe: ${response.new_directive}`);
             this.repl.close();
             return {
               status: "REQUEST_PROBE",
               hypothesis: conjecture.signature,
               domain: "combinatorial",
               finalTree: proofTree
             };
          }
          if (response.action === "REQUEST_LITERATURE") {
             console.log(`\n[MCTS] Architect Requested Literature Search: ${response.new_directive}`);
             this.repl.close();
             return {
               status: "REQUEST_LITERATURE",
               concept: response.new_directive,
               finalTree: proofTree
             };
          }
          if (response.action === "FALSIFIED") {
             console.log(`\n[MCTS] Architect Declared Falsification: ${response.analysis}`);
             this.repl.close();
             return {
               status: "FALSIFIED",
               counterexample: response.analysis,
               finalTree: proofTree
             };
          }
          if (response.action === "PROPOSE_SUBGOAL" && response.sub_lemma_signature) {
             console.log(`\n[MCTS] LLM Requested Architectural Subgoal: ${response.sub_lemma_signature}`);
             this.repl.close();
             return {
               status: "NEEDS_LEMMA",
               lemmaStatement: response.sub_lemma_signature,
               finalTree: proofTree
             };
          }
          if (response.action === "GIVE_UP") {
             if (currentIteration < 15) {
                console.log(`\n⚠️ [MCTS] ARCHITECT gave up too early (iteration ${currentIteration}). Rejecting and forcing exploration.`);
                proofTree.markDeadEnd(activeNode.id);
                proofTree.backpropagate(activeNode.id, 0.0);
                continue;
             } else {
                console.log(`\n🛑 ARCHITECT has given up: ${response.reasoning}`);
                this.repl.close();
                return { status: "EXHAUSTED", finalTree: proofTree };
             }
          }
          if (response.action === "BACKTRACK") {
             console.log(`\n⏪ BACKTRACK: Marking node ${response.target_node_id || activeNode.id} as DEAD_END`);
             const targetId = response.target_node_id || activeNode.id;
             proofTree.markDeadEnd(targetId);
             proofTree.backpropagate(targetId, 0.0);
             continue;
          }
          generatedTactics = response.lean_tactics?.map((t: any) => t.tactic) ?? (response.tactics ? [response.tactics] : []);
          if (generatedTactics.length === 0 || generatedTactics.every(t => !t)) {
             throw new Error("Model successfully parsed JSON but returned an empty array of tactics.");
          }

        } catch (e: any) {
          console.error(`[MCTS] Tactician generation failed: ${e.message}`);
          proofTree.recordError(`LLM Error: ${e.message}`);
          activeNode.errorHistory.push(e.message);
          proofTree.backpropagate(activeNode.id, 0.0);
          console.log(`[MCTS] Node ${activeNode.id.substring(0,6)} kept OPEN for escalation. Consecutive failures: ${activeNode.errorHistory.length}`);
          activeNode.status = "OPEN";
          continue;
        }

        // 3. Execution (REPL Simulation) & Scoring
        // Filter out empty tactics
        const validTactics = generatedTactics.filter(t => !!t);
        if (validTactics.length === 0) continue;

        // Prepare batch payloads
        // Compound tactics (delimited by ';') cannot be evaluated in a single REPL step natively
        // unless they are wrapped in a block. We will send them as sequential commands within their own independent closures.

        let expandedNodesFound = false;
        // We use Promise.all to map over the raw tactics concurrently.
        // Inside each map, if it's a compound tactic, we await its parts sequentially.
        const evaluations = validTactics.map(async (rawTactic) => {
           console.log(`       [MCTS] Evaluating tactic: \`${rawTactic.substring(0, 40)}\` against proofState=${activeNode.envId}...`);
           const tacticParts = rawTactic.split(/;\s*/).map(t => t.trim()).filter(Boolean);
           
           let currentProofState = activeNode.envId;
           let newState = "";
           let isError = false;
           let newProofState: number | undefined;

           for (let i = 0; i < tacticParts.length; i++) {
              const tac = tacticParts[i]!;
              let replRes: any;
              try {
                // By sending a single payload array of length 1, we reuse sendBatchCmd's async queuing mechanism
                const resArray = await this.repl.sendBatchCmd([{ proofState: currentProofState, tactic: tac }]);
                replRes = resArray[0];
              } catch (e: any) {
                return { rawTactic, isError: true, newState: "error: " + e.message, newProofState: undefined };
              }

              const replError = replRes.message;
              if (replError && !replRes.proofState && replError !== undefined) {
                console.log(`       -> REPL Error: ${replError.substring(0, 120)}`);
                newState = "error: " + replError;
                isError = true;
                newProofState = undefined;
                break;
              }

              const proofStatus = replRes.proofStatus;
              const goals = replRes.goals as string[] | undefined;
              newProofState = replRes.proofState;

              const errs = (replRes.messages ?? []).filter((m: any) => m.severity === "error");
              if (errs.length > 0) {
                newState = "error: " + errs[0]?.data;
                isError = true;
                break;
              } else if (proofStatus === "Completed" || (goals && goals.length === 0)) {
                newState = "no goals";
                break;
              } else if (goals && goals.length > 0) {
                newState = goals.join("\n");
                currentProofState = newProofState!;
              } else {
                newState = "unknown state";
                isError = true;
                break;
              }
           }
           return { rawTactic, isError, newState, newProofState };
        });

        const batchResults = await Promise.all(evaluations);

        // Process batch results
        for (const result of batchResults) {
          const { rawTactic, isError, newState, newProofState } = result;
          
          console.log(`       -> Final: ${isError ? "ERROR" : "OK"} | proofState=${newProofState} | ${newState.substring(0, 100)}`);

          // 4. Value Estimation
          const score = await this.prm.scoreTransition(activeNode.leanState, rawTactic, newState);

          // 5. Tree Expansion
          const childNodes = proofTree.expand(activeNode.id, [{
             tactic: rawTactic,
             state: newState,
             envId: isError ? undefined : newProofState,
          }]);
          const childNode = childNodes[0]!;
          
          expandedNodesFound = true;

          // 6. Backpropagation
          proofTree.backpropagate(childNode.id, score);

          // Success Check
          if (newState.includes("no goals") && !isError) {
            proofTree.markSolved(childNode.id);
            const rawPath = proofTree.getWinningPath(childNode.id).map(n => n.tacticApplied!).filter(Boolean);

            const isFinalSorry = sorryIndex === sorries.length - 1;
            const trivialTactics = new Set(["decide", "simp", "simp_all", "omega", "linarith", "ring", "tauto", "rfl"]);
            const isTrivial = rawPath.every(t => {
               const baseTactic = t.trim().split(/[\s\[]/)[0]!;
               return trivialTactics.has(baseTactic);
            });
            
            if (isTrivial && !isEmpiricalWitness && isFinalSorry) {
               console.log(`\n[MCTS] Rejected: Theorem is mathematically true but trivial (proven by [${rawPath.join(", ")}]).`);
               this.repl.close();
               return {
                  status: "FALSIFIED",
                  counterexample: `Theorem is trivial (proved entirely by automated decision procedures: ${rawPath.join(", ")}).`,
                  finalTree: proofTree
               };
            }

            console.log(`\n🎉 [MCTS] Lemma ${sorryIndex + 1} proved! Winning path found at depth ${childNode.depth}`);
            lemmaSolved = true;
            lemmaPath = rawPath;
            break;
          }
        }

        if (lemmaSolved) break;

        if (!expandedNodesFound) {
          proofTree.markDeadEnd(activeNode.id);
        } else {
          activeNode.status = "OPEN";
        }
      }

      if (!lemmaSolved) {
         console.log(`\n🛑 [MCTS] Failed to prove lemma ${sorryIndex + 1} after ${currentIteration} iterations.`);
         this.repl.close();
         return { status: "EXHAUSTED", finalTree: proofTree };
      }

      globalProofPath.push(...lemmaPath);
    }

    this.repl.close();
    return {
       status: "PROVED",
       proofPath: globalProofPath,
       finalTree: proofTree
    };
  }

  public kill(): void {
    if (this.repl) {
      this.repl.close();
    }
  }
}
