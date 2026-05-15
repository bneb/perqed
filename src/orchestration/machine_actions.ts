import { assign } from "xstate";
import { ProofTree } from "../tree";
import { LakatosianVault } from "../vault/lakatosian_vault";
import { TransitionBuffer } from "../ml/replay_buffer";
import { VerifiedVault } from "../vault";
import type { ResearchContext } from "./types";
import type { AgentRole } from "../types";

export const machineActions: any = {
  setPrompt: assign(({ event }) => {
    if (event.type === "START" || event.type === "WAKE_AT_FORMAL") {
      return {
        prompt: (event as any).prompt,
        apiKey: (event as any).apiKey,
        workspaceDir: (event as any).workspaceDir,
        outputDir: (event as any).outputDir,
        publishableMode: (event as any).publishableMode ?? false,
        crossPollinate: (event as any).crossPollinate ?? false,
        agentFactory: (event as any).agentFactory,
        plan: undefined,
      };
    }
    return {};
  }),
  setLegacyTheorem: assign(({ event }) => {
    if (event.type === "WAKE_AT_FORMAL") {
      return {
        approvedConjecture: {
          signature: (event as any).signature,
          description: (event as any).objective || "Legacy theorem",
        },
        maxGlobalIterations: (event as any).maxIterations || 15,
        searchConfig: {
          problem_class: (event as any).problemClass,
        } as any,
      };
    }
    return {};
  }),
  setIdeationResult: assign(({ event }) => {
    if (event.type === "xstate.done.actor.ideation") {
      return {
        hypothesis: (event as any).output.hypothesis,
        noveltyClassification: (event as any).output.classification,
        plan: (event as any).output.plan,
        literature: (event as any).output.literature,
      };
    }
    return {};
  }),
  incrementIdeationRetry: assign({
    ideationRetries: ({ context }) => (context as ResearchContext).ideationRetries + 1,
  }),
  incrementSaPlateau: assign({
    saPlateauCount: ({ context }) => (context as ResearchContext).saPlateauCount + 1,
  }),
  resetSaPlateau: assign({
    saPlateauCount: 0,
  }),
  setValidationError: assign({
    lastValidationError: ({ event }) => {
      if ("error" in event) return String((event as any).error);
      return "Unknown validation error";
    },
  }),
  setValidatedAST: assign(({ event }) => {
    if (event.type === "xstate.done.actor.validation") {
      return { leanAst: (event as any).output.ast };
    }
    return {};
  }),
  setCompiledSkeleton: assign(({ context, event }) => {
    if (event.type === "xstate.done.actor.sketcher") {
      return {
         approvedConjecture: {
           // Forcing the new formal skeleton over whatever the hypothesis string was!
           signature: ((event as any).output as any).compiledSkeleton,
           description: (context as ResearchContext).approvedConjecture?.description ?? "Compiled Draft-Sketch-Prove Signature",
         }
      };
    }
    return {};
  }),
  setSandboxResult: assign(({ event }) => {
    if (event.type === "xstate.done.actor.sandbox") {
      return {
        evidence: (event as any).output.evidence,
        sandboxSignal: (event as any).output.signal,
        currentEnergy: (event as any).output.energy,
        counterExample: (event as any).output.data,
        approvedConjecture: (event as any).output.approvedConjecture ?? null,
        redTeamHistory: (event as any).output.redTeamHistory ?? [],
      };
    }
    return {};
  }),
  setSMTResult: assign(({ event }) => {
    if (event.type === "xstate.done.actor.smt") {
      return { smtModel: (event as any).output.model };
    }
    return {};
  }),
  setSAResult: assign(({ event }) => {
    if (event.type === "xstate.done.actor.sa") {
      return { 
        saModel: (event as any).output.model,
        saEnergy: (event as any).output.bestEnergy 
      };
    }
    return {};
  }),
  setRefinementResult: assign(({ context, event }) => {
    if (event.type === "xstate.done.actor.refinement") {
      return {
        hypothesis: (event as any).output.hypothesis,
        noveltyClassification: (event as any).output.classification,
        plan: (event as any).output.plan,
        refinementHistory: [
           ...(context as ResearchContext).refinementHistory,
           `FAILED: ${(context as ResearchContext).hypothesis}\nREFINED TO: ${(event as any).output.hypothesis}`
        ]
      };
    }
    return {};
  }),
  setProofComplete: assign(({ event }) => {
    console.log("[DEBUG] setProofComplete called!");
    return {
      proofStatus: "PROVED" as const,
    };
  }),
  setCompilerError: assign(({ context, event }) => {
    console.error(`[DEBUG] setCompilerError triggered! Error:`, (event as any).data || (event as any).error || event);
    if (event.type === "xstate.error.actor.leanDynamicActor") {
      return {
        lastCompilerError: String((event as any).error || (event as any).data),
        proofRetries: (context as ResearchContext).proofRetries + 1,
      };
    }
    return {};
  }),
  setFixedProof: assign(({ event }) => {
    if (event.type === "xstate.done.actor.errorCorrection") {
      return { leanProof: (event as any).output.proof };
    }
    return {};
  }),
  setReportPath: assign(({ event }) => {
    if (event.type === "xstate.done.actor.scribe") {
      return { reportPath: (event as any).output.reportPath };
    }
    return {};
  }),
  harvestSFTData: ({ context }: any) => {
    if (context.proofTree && context.proofTree.getActiveNode()) {
      try {
        const solvedNodeId = context.proofTree.getActiveNode().id;
        const winningPath = context.proofTree.getWinningPath(solvedNodeId);
        
        const { SFTHarvester } = require("../scripts/harvest_sft");
        const datasetPath = require("node:path").join(context.workspaceDir, "data", "sft_dataset.jsonl");

        for (let i = 0; i < winningPath.length - 1; i++) {
          const stateNode = winningPath[i]!;
          const tacticNode = winningPath[i+1]!;
          
          if (stateNode.leanState && tacticNode.tacticApplied && !tacticNode.tacticApplied.includes("lemma injected recursively")) {
            SFTHarvester.appendToJsonl(
              datasetPath,
              stateNode.leanState,
              tacticNode.tacticApplied
            );
          }
        }
        console.log(`[SFT Harvester] Automatically exported ${winningPath.length - 1} successful (State → Tactic) pairs to SFT dataset.`);
      } catch (err: any) {
        console.error(`[SFT Harvester] Failed to harvest data: ${err.message}`);
      }
    }
  },
  markFailed: assign({
    proofStatus: "FAILED" as const,
  }),
  recordToGraveyard: ({ context, event }: any) => {
    const killer = (event as any).output?.counterExamplePayload;
    const signature = context.approvedConjecture?.signature ?? context.hypothesis ?? "";
    LakatosianVault.recordFailure(context.workspaceDir, signature, killer);
  },
  recordPyTorchTrace: ({ context, event }: any) => {
    const output = (event as any).output;
    const modelMatrix = output.model ?? output.data;
    const energy = output.bestEnergy ?? output.energy ?? 0;
    
    const sig = context.approvedConjecture?.signature ?? context.hypothesis ?? "";
    TransitionBuffer.recordPlay(context.workspaceDir, sig, modelMatrix, energy);
  },
  pushLemma: assign(({ context, event }: any) => {
    const output = (event as any).output;
    const snapshot = {
       conjecture: context.approvedConjecture ?? { signature: context.hypothesis ?? "unknown", description: "fallback" },
       treeSnapshot: context.proofTree!,
    };
    return {
       lemmaStack: [...context.lemmaStack, snapshot],
       approvedConjecture: { signature: output.lemmaStatement, description: "Dynamic Lemma: " + output.lemmaStatement }
    };
  }),
  persistToVault: ({ context }: any) => {
     const resolvedSignature = context.approvedConjecture?.signature ?? "";
     const resolvedTreePath = context.proofTree!.getWinningPath(context.proofTree!.getActiveNode().id).map((n: any) => n.tacticApplied!).filter(Boolean);
     VerifiedVault.appendLemma(context.workspaceDir, resolvedSignature, resolvedTreePath);
  },
  popLemma: assign(({ context }: any) => {
     const popped = context.lemmaStack[context.lemmaStack.length - 1]!;
     
     const parentTree = popped.treeSnapshot;
     const parentConjecture = popped.conjecture;
     const activeNode = parentTree.getActiveNode();
     
     const resolvedSignature = context.approvedConjecture?.signature ?? "";
     const child = parentTree.addChild(activeNode.id, `have lemma_resolved : ${resolvedSignature} := sorry`, `(lemma injected recursively)`);
     parentTree.setActiveNode(child.id);

     return {
        lemmaStack: context.lemmaStack.slice(0, -1),
        proofTree: parentTree,
        approvedConjecture: parentConjecture,
     };
  }),
  logTransition: ({ context, event }: any) => {
    if (process.env.DEBUG === "true") {
      console.log(
        `🔄 [Machine] Event: ${event.type} | Retries: idea=${context.ideationRetries} proof=${context.proofRetries} iter=${context.globalIteration}`,
      );
    }
  },
  initProofTree: assign({
    proofTree: ({ context }: any) => {
      const signature = context.approvedConjecture?.signature ?? context.hypothesis ?? "";
      return new ProofTree(`⊢ ${signature}`);
    },
    globalIteration: 0,
    attemptLogs: [],
  }),
  updateIteration: assign({
    globalIteration: ({ context }: any) => context.globalIteration + 1,
  }),
  setTacticMove: assign(({ event }: any) => {
    if (event.type === "xstate.done.actor.tacticGenerator") {
       return {
         currentAgentRole: event.output.role,
       };
    }
    return {};
  }),
  logAttemptSuccess: assign(({ context, event }: any) => {
    const output = (event as any).output;
    const newLog = {
      agent: context.currentAgentRole!,
      action: "PROPOSE_LEAN_TACTICS",
      success: output.isComplete,
      error: output.isComplete ? undefined : (output.error ?? "Lean rejected tactic"),
      timestamp: Date.now(),
    };
    
    if (context.proofTree) {
       const activeNode = context.proofTree.getActiveNode();
       const tactic = (context as any).currentTactic ?? "unknown";
       const child = context.proofTree.addChild(activeNode.id, tactic, output.isComplete ? "no goals" : (output.error ?? "still goals"));
       if (output.isComplete) {
          child.status = "SOLVED";
          context.proofTree.setActiveNode(child.id);
       }
    }

    return {
      attemptLogs: [...context.attemptLogs, newLog],
      lastTacticState: output.rawOutput ?? "",
    };
  }),
  logAttemptFailure: assign(({ context, event }: any) => {
     const newLog = {
      agent: context.currentAgentRole!,
      action: "PROPOSE_LEAN_TACTICS",
      success: false,
      error: String((event as any).error),
      timestamp: Date.now(),
    };
    return {
      attemptLogs: [...context.attemptLogs, newLog],
    };
  }),
  trackFormalStart: assign({
    lastFormalVerificationStart: () => Date.now(),
  }),
  incrementRapidFailureCount: assign(({ context }: any) => {
    const now = Date.now();
    const elapsed = context.lastFormalVerificationStart ? now - context.lastFormalVerificationStart : Infinity;
    if (elapsed < 1000) {
      console.warn(`⚠️ [Machine] Rapid failure detected! Elapsed: ${elapsed}ms. Count: ${context.rapidFailureCount + 1}`);
      return { rapidFailureCount: context.rapidFailureCount + 1 };
    }
    return { rapidFailureCount: 0 };
  }),
  logRapidFailure: ({ context }: any) => {
    console.error(`🛑 [Machine] CATASTROPHIC FAILURE: Infinite loop detected in FormalVerification. Rapid failure count: ${context.rapidFailureCount + 1}`);
  },
};
