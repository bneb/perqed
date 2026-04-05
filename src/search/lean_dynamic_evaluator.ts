import { ProofTree } from "../tree";
import { LeanREPLBridge } from "../lean_repl";
import { LeanPRMScorer } from "../agents/lean_prm_scorer";
import { AgentFactory } from "../agents/factory";
import { AgentRouter } from "../agents/router";
import type { AttemptLog } from "../types";

export interface MCTSEvaluationResult {
  status: "PROVED" | "FAILED" | "EXHAUSTED" | "NEEDS_LEMMA";
  proofPath?: string[];
  finalTree: ProofTree;
  lemmaStatement?: string;
}

export class LeanDynamicEvaluator {
  private repl: LeanREPLBridge;
  private prm: LeanPRMScorer;
  private factory: AgentFactory;
  private maxIterations: number;
  private apiKey: string;

  constructor(workspaceDir: string, apiKey: string, maxIterations: number = 30) {
    this.repl = new LeanREPLBridge(workspaceDir);
    this.prm = new LeanPRMScorer();
    this.factory = new AgentFactory({ geminiApiKey: apiKey });
    this.maxIterations = maxIterations;
    this.apiKey = apiKey;
  }

  async runMCTSSearch(
    conjecture: { signature: string; description: string },
    proofTree: ProofTree,
    prunedContext?: string
  ): Promise<MCTSEvaluationResult> {
    
    // Initialize root in REPL
    const preamble = `import Mathlib\nopen Nat\n\ntheorem approved_conjecture ${conjecture.signature} := by\n`;
    const initRes = await this.repl.sendCmd({ cmd: preamble });
    if (!initRes.env) {
      console.error("[MCTS] Failed to initialize theorem in REPL. Environment ID missing.");
      this.repl.kill();
      return { status: "FAILED", finalTree: proofTree };
    }

    // Set root envId
    const root = proofTree.getNode(proofTree.rootId);
    if (root) root.envId = initRes.env;

    let currentIteration = 0;

    while (currentIteration < this.maxIterations) {
      currentIteration++;

      // 1. Selection (UCT)
      const openNodes = proofTree.getBestOpenNodes(1);
      if (openNodes.length === 0) {
        console.log("[MCTS] Search space exhausted. No open nodes remain.");
        break;
      }
      const activeNode = openNodes[0]!;
      
      console.log(`\n[MCTS] Iteration ${currentIteration} - Exploring Node ${activeNode.id.substring(0,6)} (Depth: ${activeNode.depth}, Score: ${activeNode.value.toFixed(2)})`);

      // 2. Tactic Generation (Expansion Candidates)
      const currentGoals = activeNode.leanState;
      const signals = {
        totalAttempts: proofTree.getNodeCount(),
        consecutiveFailures: activeNode.errorHistory.length,
        globalFailures: proofTree.getGlobalTreeFailures(),
        goalCount: AgentRouter.parseGoalCount(currentGoals),
        isStuckInLoop: false,
        lastErrors: [],
        hasArchitectDirective: false,
        identicalErrorCount: 0,
        totalTacticianCalls: proofTree.getNodeCount(),
        hasSubgoalProposal: false
      };
      
      const role = AgentRouter.determineNextAgent(signals);
      const agent = this.factory.getAgent(role, signals);

      const contextStr = role === "ARCHITECT"
         ? `${prunedContext}\n\n## Theorem: approved_conjecture ${conjecture.signature}\n\n## Current Goals:\n${currentGoals}`
         : `## Theorem: approved_conjecture ${conjecture.signature}\n\n## Current Goals:\n${currentGoals}`;

      let generatedTactics: string[] = [];
      try {
        const response = await agent.generateMove(contextStr) as any;
        if (response.action === "PROPOSE_SUBGOAL" && response.sub_lemma_signature) {
           console.log(`\n[MCTS] LLM Requested Architectural Subgoal: ${response.sub_lemma_signature}`);
           this.repl.kill();
           return {
             status: "NEEDS_LEMMA",
             lemmaStatement: response.sub_lemma_signature,
             finalTree: proofTree
           };
        }
        generatedTactics = response.lean_tactics?.map((t: any) => t.tactic) ?? [response.tactics];
      } catch (e: any) {
        console.error(`[MCTS] Tactician generation failed: ${e.message}`);
        proofTree.recordError(`LLM Error: ${e.message}`);
        proofTree.markDeadEnd(activeNode.id);
        proofTree.backpropagate(activeNode.id, 0.0);
        continue;
      }

      // We treat multiple proposed tactics as simultaneous child expansions
      let expandedNodesFound = false;

      // 3. Execution (REPL Simulation) & Scoring
      for (const tactic of generatedTactics) {
        if (!tactic) continue;
        
        console.log(`       -> Tactic: \`${tactic}\``);
        const replRes = await this.repl.sendCmd({ env: activeNode.envId, tactic });

        // Synthesize the resulting state
        let newState = "";
        let isError = false;

        if (replRes.messages && replRes.messages.length > 0) {
           const errs = replRes.messages.filter(m => m.severity === "error");
           if (errs.length > 0) {
              newState = "error: " + errs[0].data;
              isError = true;
           } else {
              newState = (replRes.goals ?? []).join("\n") || "no goals";
           }
        } else {
           newState = (replRes.goals ?? []).join("\n") || "no goals";
        }

        // 4. Value Estimation
        const score = await this.prm.scoreTransition(activeNode.leanState, tactic, newState);

        // 5. Tree Expansion
        const childNodes = proofTree.expand(activeNode.id, [{
           tactic,
           state: newState,
           envId: isError ? undefined : replRes.env,
        }]);
        const childNode = childNodes[0]!;
        
        expandedNodesFound = true;

        // 6. Backpropagation
        proofTree.backpropagate(childNode.id, score);

        // Success Check
        if (newState.includes("no goals") && !isError) {
          console.log(`\n🎉 [MCTS] Proved! Winning path found at depth ${childNode.depth}`);
          proofTree.markSolved(childNode.id);
          this.repl.kill();
          return {
             status: "PROVED",
             proofPath: proofTree.getWinningPath(childNode.id).map(n => n.tacticApplied!).filter(Boolean),
             finalTree: proofTree
          };
        }
      }

      // If no valid tactic was expanded, mark as dead end
      if (!expandedNodesFound) {
        proofTree.markDeadEnd(activeNode.id);
      } else {
        // Reset working status back to OPEN for future iterations if it didn't solve it
        activeNode.status = "OPEN";
      }
    }

    this.repl.kill();
    return {
       status: "EXHAUSTED",
       finalTree: proofTree
    };
  }

  public kill(): void {
    if (this.repl) {
      this.repl.kill();
    }
  }
}
