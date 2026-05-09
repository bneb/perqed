/**
 * orchestration/machine.ts — The Perqed v3.0 Research State Machine
 *
 * A 10-state XState v5 machine built with setup().createMachine().
 * Replaces the procedural await-chain in ResearchDirector.run().
 *
 * State Topology:
 *   Idle → Ideation → Validation → EmpiricalSandbox → FormalVerification → ScribeReport → Done
 *                                       ↓                     ↑
 *                                 SMT_Resolution ──────────────┘
 *                                       ↓
 *                               FalsificationFork ─────────────┘
 *                                                              ↓
 *                                                       ErrorCorrection
 *                                                              ↓
 *                                                       TerminalFailure
 */

import { setup, assign, fromPromise } from "xstate";
import type {
  ResearchContext,
  IdeationOutput,
  ValidationOutput,
  SandboxOutput,
  RefinementOutput,
  SMTOutput,
  RedTeamOutput,
  LeanOutput,
  ErrorCorrectionOutput,
  ScribeOutput,
} from "./types";
import type {
  IdeationInput,
  ValidationInput,
  SandboxInput,
  SMTInput,
  RefinementInput,
  LeanInput,
  ErrorCorrectionInput,
  ScribeInput,
  RedTeamInput,
} from "./actors";

// Re-export the actor implementations for the default (non-test) machine
import {
  ideationActor as defaultIdeationActor,
  validationActor as defaultValidationActor,
  sandboxActor as defaultSandboxActor,
  smtActor as defaultSmtActor,
  refinementActor as defaultRefinementActor,
  leanDynamicActor as defaultLeanDynamicActor,
  errorCorrectionActor as defaultErrorCorrectionActor,
  scribeActor as defaultScribeActor,
  redTeamActor as defaultRedTeamActor,
  sketcherActor as defaultSketcherActor,
  saResolutionActor as defaultSaResolutionActor,
  provisionerActor as defaultProvisionerActor,
} from "./actors";
import { flagAlgebraActor } from "./actors/flag_algebra_actor";
import { ProofTree } from "../tree";
import type { AttemptLog, AgentRole } from "../types";
import { VerifiedVault } from "../vault";
import { LakatosianVault } from "../vault/lakatosian_vault";
import { TransitionBuffer } from "../ml/replay_buffer";

// ──────────────────────────────────────────────
// Initial Context Factory
// ──────────────────────────────────────────────

const INITIAL_CONTEXT: ResearchContext = {
  prompt: "",
  apiKey: "",
  workspaceDir: "",
  outputDir: "",
  publishableMode: false,
  crossPollinate: false,
  literature: [],
  plan: null,
  hypothesis: null,
  noveltyClassification: "UNCLASSIFIED",
  saPlateauCount: 0,
  ideationRetries: 0,
  refinementRetries: 0,
  refinementHistory: [],
  lastValidationError: null,
  evidence: null,
  sandboxSignal: null,
  counterExample: null,
  currentEnergy: null,
  smtModel: null,
  saModel: null,
  saEnergy: null,
  approvedConjecture: null,
  lakatosianHistory: [],
  redTeamHistory: [],
  leanAst: null,
  leanProof: null,
  proofRetries: 0,
  lastCompilerError: null,
  lemmaStack: [],
  proofTree: null,
  attemptLogs: [],
  lastTacticState: "",
  currentAgentRole: null,
  globalIteration: 0,
  maxGlobalIterations: 15,
  proofStatus: null,
  reportPath: null,
  rapidFailureCount: 0,
};

// ──────────────────────────────────────────────
// Machine Definition
// ──────────────────────────────────────────────

export const researchMachine = setup({
  types: {
    context: {} as ResearchContext,
    events: {} as
      | { type: "START"; prompt: string; apiKey: string; workspaceDir: string; outputDir: string; publishableMode: boolean }
      | { type: "WAKE_AT_FORMAL"; prompt: string; apiKey: string; workspaceDir: string; outputDir: string; signature: string; objective?: string; maxIterations?: number; problemClass?: string; agentFactory?: any }
      | { type: "xstate.done.actor.ideation"; output: IdeationOutput }
      | { type: "xstate.done.actor.validation"; output: ValidationOutput }
      | { type: "xstate.done.actor.sandbox"; output: SandboxOutput }
      | { type: "xstate.done.actor.sketcher"; output: any }
      | { type: "xstate.done.actor.smt"; output: SMTOutput }
      | { type: "xstate.done.actor.sa"; output: import("./types").SAOutput }
      | { type: "xstate.done.actor.flagAlgebraActor"; output: import("./types").FlagAlgebraOutput }
      | { type: "xstate.done.actor.refinement"; output: RefinementOutput }
      | { type: "xstate.done.actor.redTeamActor"; output: RedTeamOutput }
      | { type: "xstate.done.actor.tacticGenerator"; output: { role: AgentRole; response: any } }
      | { type: "xstate.done.actor.lean"; output: LeanOutput }
      | { type: "xstate.done.actor.leanDynamicActor"; output: LeanOutput }
      | { type: "xstate.error.actor.leanDynamicActor"; error?: any; data?: any }
      | { type: "xstate.done.actor.errorCorrection"; output: ErrorCorrectionOutput }
      | { type: "xstate.done.actor.scribe"; output: ScribeOutput },
  },

  actors: {
    ideationActor: defaultIdeationActor,
    validationActor: defaultValidationActor,
    sandboxActor: defaultSandboxActor,
    smtActor: defaultSmtActor,
    refinementActor: defaultRefinementActor,
    leanDynamicActor: defaultLeanDynamicActor,
    errorCorrectionActor: defaultErrorCorrectionActor,
    scribeActor: defaultScribeActor,
    redTeamActor: defaultRedTeamActor,
    sketcherActor: defaultSketcherActor,
    saResolutionActor: defaultSaResolutionActor,
    flagAlgebraActor: flagAlgebraActor,
    provisionerActor: defaultProvisionerActor,
  },

  guards: {
    canRetryIdeation: ({ context }) => context.ideationRetries < 3,
    canRetryProof: ({ context }) => context.proofRetries < 3,
    isRepeatedPlateau: ({ context }) => context.saPlateauCount >= 3,
    isKnownTheorem: ({ event }) => {
      if (event.type === "xstate.done.actor.ideation") {
        return event.output.classification === "KNOWN_THEOREM";
      }
      return false;
    },
    isKnownAndCanRetry: ({ context, event }) => {
      if (event.type === "xstate.done.actor.ideation") {
        return (
          event.output.classification === "KNOWN_THEOREM" &&
          context.ideationRetries < 2  // will be incremented to < 3
        );
      }
      return false;
    },
    isKnownAndExhausted: ({ context, event }) => {
      if (event.type === "xstate.done.actor.ideation") {
        return (
          event.output.classification === "KNOWN_THEOREM" &&
          context.ideationRetries >= 2
        );
      }
      return false;
    },
    isWitness: ({ event }) => {
      if (event.type === "xstate.done.actor.sandbox") {
        return event.output.signal === "WITNESS_FOUND";
      }
      return false;
    },
    isPlateau: ({ event }) => {
      if (event.type === "xstate.done.actor.sandbox") {
        return event.output.signal === "PLATEAU_DETECTED";
      }
      return false;
    },
    isCleanKill: ({ event }) => {
      if (event.type === "xstate.done.actor.sandbox") {
        return event.output.signal === "CLEAN_KILL";
      }
      return false;
    },
    isSAT: ({ event }) => {
      if (event.type === "xstate.done.actor.smt" || event.type === "xstate.done.actor.sa") {
        return event.output.status === "SAT";
      }
      return false;
    },
    isTimeout: ({ event }) => {
      if (event.type === "xstate.done.actor.smt") {
        return event.output.status === "TIMEOUT";
      }
      return false;
    },
    isProofComplete: ({ event }) => {
      if (event.type === "xstate.done.actor.lean") {
        return event.output.status === "PROOF_COMPLETE";
      }
      return false;
    },
    isCompilerError: ({ event }) => {
      if (event.type === "xstate.done.actor.leanDynamicActor") {
        return event.output.status === "COMPILER_ERROR";
      }
      return false;
    },
    isFixed: ({ event }) => {
      const output = (event as any).output;
      return output?.status === "FIXED";
    },
    isRapidFailure: ({ context, event }) => {
      const now = Date.now();
      const elapsed = context.lastFormalVerificationStart ? now - context.lastFormalVerificationStart : Infinity;
      // If failure happens in < 1000ms and we've already had 2 rapid failures, this is the 3rd.
      return elapsed < 1000 && context.rapidFailureCount >= 2;
    },
  },

  actions: {
    setPrompt: assign(({ event }) => {
      if (event.type === "START" || event.type === "WAKE_AT_FORMAL") {
        return {
          prompt: event.prompt,
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
            signature: event.signature,
            description: event.objective || "Legacy theorem",
          },
          maxGlobalIterations: event.maxIterations || 15,
          searchConfig: {
            problem_class: event.problemClass,
          } as any,
        };
      }
      return {};
    }),
    setIdeationResult: assign(({ event }) => {
      if (event.type === "xstate.done.actor.ideation") {
        return {
          hypothesis: event.output.hypothesis,
          noveltyClassification: event.output.classification,
          plan: event.output.plan,
          literature: event.output.literature,
        };
      }
      return {};
    }),
    incrementIdeationRetry: assign({
      ideationRetries: ({ context }) => context.ideationRetries + 1,
    }),
    incrementSaPlateau: assign({
      saPlateauCount: ({ context }) => context.saPlateauCount + 1,
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
        return { leanAst: event.output.ast };
      }
      return {};
    }),
    setCompiledSkeleton: assign(({ context, event }) => {
      if (event.type === "xstate.done.actor.sketcher") {
        return {
           approvedConjecture: {
             // Forcing the new formal skeleton over whatever the hypothesis string was!
             signature: (event.output as any).compiledSkeleton,
             description: context.approvedConjecture?.description ?? "Compiled Draft-Sketch-Prove Signature",
           }
        };
      }
      return {};
    }),
    setSandboxResult: assign(({ event }) => {
      if (event.type === "xstate.done.actor.sandbox") {
        return {
          evidence: event.output.evidence,
          sandboxSignal: event.output.signal,
          currentEnergy: event.output.energy,
          counterExample: event.output.data,
          approvedConjecture: event.output.approvedConjecture ?? null,
          redTeamHistory: event.output.redTeamHistory ?? [],
        };
      }
      return {};
    }),
    setSMTResult: assign(({ event }) => {
      if (event.type === "xstate.done.actor.smt") {
        return { smtModel: event.output.model };
      }
      return {};
    }),
    setSAResult: assign(({ event }) => {
      if (event.type === "xstate.done.actor.sa") {
        return { 
          saModel: event.output.model,
          saEnergy: event.output.bestEnergy 
        };
      }
      return {};
    }),
    setRefinementResult: assign(({ context, event }) => {
      if (event.type === "xstate.done.actor.refinement") {
        return {
          hypothesis: event.output.hypothesis,
          noveltyClassification: event.output.classification,
          plan: event.output.plan,
          refinementHistory: [
             ...context.refinementHistory,
             `FAILED: ${context.hypothesis}\nREFINED TO: ${event.output.hypothesis}`
          ]
        };
      }
      return {};
    }),
    setProofComplete: assign(({ event }) => {
      console.log("[DEBUG] setProofComplete called!");
      // Triggered by onDone transition of FormalVerification compound node
      return {
        proofStatus: "PROVED" as const,
      };
    }),
    setCompilerError: assign(({ context, event }) => {
      console.error(`[DEBUG] setCompilerError triggered! Error:`, (event as any).data || (event as any).error || event);
      if (event.type === "xstate.error.actor.leanDynamicActor") {
        return {
          lastCompilerError: String((event as any).error || (event as any).data),
          proofRetries: context.proofRetries + 1,
        };
      }
      return {};
    }),
    setFixedProof: assign(({ event }) => {
      if (event.type === "xstate.done.actor.errorCorrection") {
        return { leanProof: event.output.proof };
      }
      return {};
    }),
    setReportPath: assign(({ event }) => {
      if (event.type === "xstate.done.actor.scribe") {
        return { reportPath: event.output.reportPath };
      }
      return {};
    }),
    harvestSFTData: ({ context }) => {
      if (context.proofTree && context.proofTree.getActiveNode()) {
        try {
          const solvedNodeId = context.proofTree.getActiveNode().id;
          const winningPath = context.proofTree.getWinningPath(solvedNodeId);
          
          const { SFTHarvester } = require("../scripts/harvest_sft");
          const datasetPath = require("node:path").join(context.workspaceDir, "data", "sft_dataset.jsonl");

          // Skip root node, zip pairs of (parent state, child tactic)
          for (let i = 0; i < winningPath.length - 1; i++) {
            const stateNode = winningPath[i]!;
            const tacticNode = winningPath[i+1]!;
            
            // Only harvest if it was a direct tactic application, not an unrolling
            if (tacticNode.tacticApplied && !tacticNode.tacticApplied.includes("lemma injected recursively")) {
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
    recordToGraveyard: ({ context, event }) => {
      const killer = (event as any).output?.counterExamplePayload;
      const signature = context.approvedConjecture?.signature ?? context.hypothesis ?? "";
      LakatosianVault.recordFailure(context.workspaceDir, signature, killer);
    },
    recordPyTorchTrace: ({ context, event }) => {
      const output = (event as any).output;
      // Depending on if it's SA or Sandbox, the model/data structure differs slightly
      const modelMatrix = output.model ?? output.data;
      const energy = output.bestEnergy ?? output.energy ?? 0;
      
      const sig = context.approvedConjecture?.signature ?? context.hypothesis ?? "";
      TransitionBuffer.recordPlay(context.workspaceDir, sig, modelMatrix, energy);
    },
    pushLemma: assign(({ context, event }) => {
      const output = (event as any).output;
      // Push current state to the stack
      const snapshot = {
         conjecture: context.approvedConjecture ?? { signature: context.hypothesis ?? "unknown", description: "fallback" },
         treeSnapshot: context.proofTree!,
      };
      // Re-assign target to the new Lemma
      return {
         lemmaStack: [...context.lemmaStack, snapshot],
         approvedConjecture: { signature: output.lemmaStatement, description: "Dynamic Lemma: " + output.lemmaStatement }
      };
    }),
    persistToVault: ({ context }) => {
       const popped = context.lemmaStack[context.lemmaStack.length - 1]!;
       const resolvedSignature = context.approvedConjecture?.signature ?? "";
       const resolvedTreePath = context.proofTree!.getWinningPath(context.proofTree!.getActiveNode().id).map(n => n.tacticApplied!).filter(Boolean);
       VerifiedVault.appendLemma(context.workspaceDir, resolvedSignature, resolvedTreePath);
    },
    popLemma: assign(({ context }) => {
       const popped = context.lemmaStack[context.lemmaStack.length - 1]!;
       
       // Add the solved lemma as a verified node in the parent tree
       const parentTree = popped.treeSnapshot;
       const parentConjecture = popped.conjecture;
       const activeNode = parentTree.getActiveNode();
       
       // Simulate that creating the lemma and proving it constitutes a valid step
       const resolvedSignature = context.approvedConjecture?.signature ?? "";
       const child = parentTree.addChild(activeNode.id, `have lemma_resolved : ${resolvedSignature} := sorry`, `(lemma injected recursively)`);
       parentTree.setActiveNode(child.id);

       return {
          lemmaStack: context.lemmaStack.slice(0, -1),
          proofTree: parentTree,
          approvedConjecture: parentConjecture,
       };
    }),
    logTransition: ({ context, event }) => {
      if (process.env.DEBUG === "true") {
        console.log(
          `🔄 [Machine] Event: ${event.type} | Retries: idea=${context.ideationRetries} proof=${context.proofRetries} iter=${context.globalIteration}`,
        );
      }
    },
    initProofTree: assign({
      proofTree: ({ context }) => {
        const signature = context.approvedConjecture?.signature ?? context.hypothesis ?? "";
        return new ProofTree(`⊢ ${signature}`);
      },
      globalIteration: 0,
      attemptLogs: [],
    }),
    updateIteration: assign({
      globalIteration: ({ context }) => context.globalIteration + 1,
    }),
    setTacticMove: assign(({ event }) => {
      if (event.type === "xstate.done.actor.tacticGenerator") {
         return {
           currentAgentRole: event.output.role,
         };
      }
      return {};
    }),
    logAttemptSuccess: assign(({ context, event }) => {
      const output = (event as any).output;
      const newLog = {
        agent: context.currentAgentRole!,
        action: "PROPOSE_LEAN_TACTICS",
        success: output.isComplete,
        error: output.isComplete ? undefined : (output.error ?? "Lean rejected tactic"),
        timestamp: Date.now(),
      };
      
      // Update ProofTree 
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
    logAttemptFailure: assign(({ context, event }) => {
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
    incrementRapidFailureCount: assign(({ context }) => {
      const now = Date.now();
      const elapsed = context.lastFormalVerificationStart ? now - context.lastFormalVerificationStart : Infinity;
      if (elapsed < 1000) {
        console.warn(`⚠️ [Machine] Rapid failure detected! Elapsed: ${elapsed}ms. Count: ${context.rapidFailureCount + 1}`);
        return { rapidFailureCount: context.rapidFailureCount + 1 };
      }
      return { rapidFailureCount: 0 };
    }),
    logRapidFailure: ({ context }) => {
      console.error(`🛑 [Machine] CATASTROPHIC FAILURE: Infinite loop detected in FormalVerification. Rapid failure count: ${context.rapidFailureCount + 1}`);
    },
  },
}).createMachine({
  id: "perqedResearch",
  initial: "Idle",
  context: INITIAL_CONTEXT,

  states: {
    Idle: {
      on: {
        START: {
          target: "Ideation",
          actions: "setPrompt",
        },
        WAKE_AT_FORMAL: {
          target: "FormalVerification",
          actions: ["setPrompt", "setLegacyTheorem"],
        },
      },
    },

    Ideation: {
      invoke: {
        id: "ideation",
        src: "ideationActor",
        input: ({ context }) => ({
          prompt: context.prompt,
          retries: context.ideationRetries,
          apiKey: context.apiKey,
          workspaceDir: context.workspaceDir,
          lastValidationError: context.lastValidationError,
          publishableMode: context.publishableMode,
          crossPollinate: context.crossPollinate,
          lakatosianHistory: context.lakatosianHistory,
        }),
        onDone: [
          {
            guard: "isKnownAndCanRetry",
            target: "Ideation",
            reenter: true,
            actions: ["setIdeationResult", "incrementIdeationRetry", "logTransition"],
          },
          {
            guard: "isKnownAndExhausted",
            target: "ExitGracefully",
            actions: ["setIdeationResult", "incrementIdeationRetry"],
          },
          {
            target: "Validation",
            actions: ["setIdeationResult", "logTransition"],
          },
        ],
        onError: {
          target: "TerminalFailure",
          actions: "logTransition",
        },
      },
    },

    Validation: {
      invoke: {
        id: "validation",
        src: "validationActor",
        input: ({ context }) => ({
          hypothesis: context.hypothesis ?? "",
        }),
        onDone: {
          target: "EmpiricalSandbox",
          actions: ["setValidatedAST", "logTransition"],
        },
        onError: [
          {
            guard: "canRetryIdeation",
            target: "Ideation",
            actions: ["setValidationError", "incrementIdeationRetry", "logTransition"],
          },
          {
            target: "TerminalFailure",
            actions: ["setValidationError", "logTransition"],
          },
        ],
      },
    },

    EmpiricalSandbox: {
      invoke: {
        id: "sandbox",
        src: "sandboxActor",
        input: ({ context }) => ({
          hypothesis: context.hypothesis ?? "",
          domains: context.plan?.domains_to_probe ?? [],
          apiKey: context.apiKey,
          plan: context.plan!,
          evidence: context.evidence,
        }),
        onDone: [
          {
            guard: "isWitness",
            target: "FalsificationFork",
            actions: ["setSandboxResult", "recordPyTorchTrace", "logTransition"],
          },
          {
            guard: "isPlateau",
            target: "SMT_Resolution",
            actions: ["setSandboxResult", "recordPyTorchTrace", "logTransition"],
          },
          {
            guard: "isCleanKill",
            target: "HypothesisRefinement",
            actions: ["setSandboxResult", "logTransition"],
          },
          {
            target: "FalsificationFork",
            actions: ["setSandboxResult", "logTransition"],
          },
        ],
        onError: {
          target: "TerminalFailure",
          actions: "logTransition",
        },
      },
    },

    SMT_Resolution: {
      invoke: {
        id: "smt",
        src: "smtActor",
        input: ({ context }) => ({
          smtScript: context.smtModel ?? "(check-sat)",
        }),
        onDone: [
          {
            guard: "isSAT",
            target: "FalsificationFork",
            actions: ["setSMTResult", "logTransition"],
          },
          {
            guard: "isTimeout",
            target: "SA_Resolution",
            actions: ["setSMTResult", "logTransition"],
          },
          {
            target: "HypothesisRefinement",
            actions: ["setSMTResult", "logTransition"],
          }
        ],
        onError: {
          target: "SA_Resolution",
          actions: "logTransition",
        },
      },
    },

    SA_Resolution: {
      invoke: {
        id: "sa",
        src: "saResolutionActor",
        input: ({ context }) => {
          const h = (context.hypothesis || context.plan?.prompt || "N >= 36");
          const mN = h.match(/N\s*[=>]\s*(\d+)/i);
          const vertices = mN && mN[1] ? parseInt(mN[1]) : 36;
          const mR = h.match(/R\((\d+)\s*,\s*\d+\)/i);
          const r = mR && mR[1] ? parseInt(mR[1]) : 4;
          const mS = h.match(/R\(\d+\s*,\s*(\d+)\)/i);
          const s = mS && mS[1] ? parseInt(mS[1]) : 6;
          return { hypothesis: h, vertices, r, s };
        },
        onDone: [
           {
             guard: "isSAT",
             target: "FalsificationFork",
             actions: ["setSAResult", "recordPyTorchTrace", "resetSaPlateau", "logTransition"],
           },
           {
             guard: "isRepeatedPlateau",
             target: "FlagAlgebra_Escalation",
             actions: ["setSAResult", "recordPyTorchTrace", "incrementSaPlateau", "logTransition"],
           },
           {
             target: "HypothesisRefinement",
             actions: ["setSAResult", "recordPyTorchTrace", "incrementSaPlateau", "logTransition"],
           }
        ],
        onError: {
           target: "HypothesisRefinement",
           actions: "logTransition",
        }
      }
    },

    FlagAlgebra_Escalation: {
      invoke: {
        id: "flagAlgebra",
        src: "flagAlgebraActor",
        input: ({ context }) => {
          const h = (context.hypothesis || "N >= 36");
          const mR = h.match(/R\((\d+)\s*,\s*\d+\)/i);
          const r = mR && mR[1] ? parseInt(mR[1]) : 5;
          const mS = h.match(/R\(\d+\s*,\s*(\d+)\)/i);
          const s = mS && mS[1] ? parseInt(mS[1]) : 5;
          return { target_r: r, target_s: s };
        },
        onDone: {
          target: "FalsificationFork",
          actions: [
            assign({
              approvedConjecture: ({ context, event }) => ({
                signature: context.hypothesis ?? "Flag Limit Reached",
                description: `SDP ASYMPTOTIC DENSITY LIMIT: [${(event.output as any).lowerBound} to ${(event.output as any).upperBound}]`
              }),
              saPlateauCount: 0
            }),
            "logTransition"
          ],
        },
        onError: {
          target: "HypothesisRefinement",
          actions: "logTransition"
        }
      }
    },

    HypothesisRefinement: {
      invoke: {
        id: "refinement",
        src: "refinementActor",
        input: ({ context }) => ({
          counterExample: context.counterExample,
          hypothesis: context.hypothesis ?? "",
          plan: context.plan!,
          literature: context.literature,
          apiKey: context.apiKey,
        }),
        onDone: [
          {
            guard: ({ context }) => context.refinementRetries >= 2,
            target: "ScribeReport",
            actions: [
               "setRefinementResult",
               assign({ refinementRetries: ({ context }) => context.refinementRetries + 1 }),
               "logTransition"
            ],
          },
          {
            target: "Validation",
            actions: [
              "setRefinementResult", 
              assign({ refinementRetries: ({ context }) => context.refinementRetries + 1 }),
              "logTransition"
            ],
          }
        ],
        onError: {
          target: "TerminalFailure",
          actions: "logTransition",
        }
      },
    },

    FalsificationFork: {
      invoke: {
        id: "redTeamActor",
        src: "redTeamActor",
        input: ({ context }: { context: ResearchContext }) => ({ 
          conjecture: context.approvedConjecture?.signature ?? context.hypothesis ?? "",
          domain: context.plan?.domains_to_probe?.[0] ?? ""
        }),
        onDone: [
          {
            guard: ({ event }: { event: any }) => event.output.status === "COUNTER_EXAMPLE_FOUND",
            target: "Ideation",
            actions: [
              "recordToGraveyard",
              assign({
                lakatosianHistory: ({ context, event }: { context: ResearchContext; event: any }) => [
                  ...context.lakatosianHistory,
                  { 
                    failedConjecture: context.approvedConjecture?.signature ?? context.hypothesis ?? "", 
                    killerEdgeCase: event.output.counterExamplePayload 
                  }
                ]
              })
            ]
          },
          {
            target: "Sketching",
          }
        ],
        onError: { target: "ErrorCorrection" }
      }
    },

    Sketching: {
      invoke: {
        id: "sketcher",
        src: "sketcherActor",
        input: ({ context }) => ({
          informalMath: context.approvedConjecture?.signature ?? context.hypothesis ?? "",
          apiKey: context.apiKey,
          workspaceDir: context.workspaceDir,
        }),
        onDone: {
          target: "FormalVerification",
          actions: ["setCompiledSkeleton", "logTransition"],
        },
        onError: {
          target: "TerminalFailure",
          actions: "logTransition",
        }
      }
    },

    FormalVerification: {
      initial: "Initialize",
      states: {
        Initialize: {
          entry: ["initProofTree", "trackFormalStart"],
          invoke: {
            id: "provisioner",
            src: "provisionerActor",
            input: ({ context }) => ({
              workspaceDir: context.workspaceDir,
              outputDir: context.outputDir || context.workspaceDir,
            }),
            onDone: "MCTSSearch",
            onError: "MCTSSearch", // Continue even if provisioning fails, though REPL will likely fail later
          }
        },
        MCTSSearch: {
          invoke: {
            id: "leanDynamicActor",
            src: "leanDynamicActor",
            input: ({ context }) => ({
              conjecture: context.approvedConjecture ?? {
                 signature: context.hypothesis ?? "unknown",
                 description: "",
              },
              outputDir: context.outputDir || context.workspaceDir,
              apiKey: context.apiKey,
              proofTree: context.proofTree!,
              maxIterations: context.maxGlobalIterations,
              prunedContext: require("./context_pruner").pruneContext(context),
              isEmpiricalWitness: context.sandboxSignal === "WITNESS_FOUND" || context.sandboxSignal === "CLEAN_KILL" || context.saModel !== null || context.smtModel !== null,
              problemDifficulty: (context as any).searchConfig?.problem_class === "unknown" ? "hard" as const : "normal" as const,
              agentFactory: context.agentFactory,
            }),
            onDone: [
              {
                guard: ({ event }) => (event as any).output.status === "PROVED",
                target: "CheckLemmaStack", 
              },
              {
                guard: ({ event }) => (event as any).output.status === "NEEDS_LEMMA",
                target: "PushLemmaAndRestart", 
                actions: "logTransition"
              },
              {
                guard: ({ event }) => (event as any).output.status === "REQUEST_PROBE",
                target: "#perqedResearch.EmpiricalSandbox", 
                actions: "logTransition"
              },
              {
                guard: ({ event }) => (event as any).output.status === "REQUEST_LITERATURE",
                target: "#perqedResearch.Ideation", 
                actions: "logTransition"
              },
              {
                guard: ({ event }) => (event as any).output.status === "FALSIFIED",
                target: "#perqedResearch.FalsificationFork", 
                actions: "logTransition"
              },
              {
                target: "Exhausted" // FAILED or EXHAUSTED
              }
            ],
            onError: [
              {
                guard: "isRapidFailure",
                target: "#perqedResearch.TerminalFailure",
                actions: ["setCompilerError", "logRapidFailure"]
              },
              {
                target: "#perqedResearch.ErrorCorrection",
                actions: ["setCompilerError", "incrementRapidFailureCount"] 
              }
            ]
          }
        },
        PushLemmaAndRestart: {
           entry: "pushLemma",
           after: { 0: "Initialize" } 
        },
        CheckLemmaStack: {
           always: [
             {
                guard: ({ context }) => context.lemmaStack.length > 0,
                target: "MCTSSearch",
                actions: ["persistToVault", "popLemma", "logTransition"]
             },
             {
                target: "Complete"
             }
           ]
        },
        Complete: {
          type: "final",
          entry: ["harvestSFTData", "setProofComplete"],
        },
        Exhausted: {
          type: "final",
          entry: "markFailed",
        }
      },
      onDone: {
        target: "ScribeReport",
        actions: "logTransition",
      }
    },

    ErrorCorrection: {
      invoke: {
        id: "errorCorrection",
        src: "errorCorrectionActor",
        input: ({ context }) => ({
          compilerTrace: context.lastCompilerError ?? "",
          conjecture: context.approvedConjecture ?? {
            signature: context.hypothesis ?? "",
            description: "",
          },
          apiKey: context.apiKey,
        }),
        onDone: [
          {
            guard: "isFixed",
            target: "FormalVerification",
            actions: ["setFixedProof", "logTransition"],
          },
          {
            target: "TerminalFailure",
            actions: ["markFailed", "logTransition"],
          },
        ],
        onError: {
          target: "TerminalFailure",
          actions: ["markFailed", "logTransition"],
        },
      },
    },

    ScribeReport: {
      invoke: {
        id: "scribe",
        src: "scribeActor",
        input: ({ context }) => ({
          workspaceDir: context.workspaceDir,
          approvedConjecture: context.approvedConjecture,
          hypothesis: context.hypothesis,
          saEnergy: context.saEnergy,
          flagAlgebraLimits: undefined, // Add if added to context later
          leanAst: context.leanAst,
          leanProof: context.leanProof,
          proofStatus: context.proofStatus,
        }),
        onDone: {
          target: "Done",
          actions: ["setReportPath", "logTransition"],
        },
        onError: {
          target: "Done",
          actions: "logTransition",
        },
      },
    },

    Done: { type: "final" },
    ExitGracefully: { type: "final" },
    TerminalFailure: { type: "final" },
  },
});
