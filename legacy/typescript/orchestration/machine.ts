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

import { machineActions } from "./machine_actions";

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

  actions: machineActions,
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
