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
  TacticExecutionInput,
} from "./actors";

// Re-export the actor implementations for the default (non-test) machine
import {
  ideationActor as defaultIdeationActor,
  validationActor as defaultValidationActor,
  sandboxActor as defaultSandboxActor,
  smtActor as defaultSmtActor,
  refinementActor as defaultRefinementActor,
  tacticGeneratorActor as defaultTacticGeneratorActor,
  leanVerificationActor as defaultLeanVerificationActor,
  errorCorrectionActor as defaultErrorCorrectionActor,
  scribeActor as defaultScribeActor,
  redTeamActor as defaultRedTeamActor,
} from "./actors";
import { ProofTree } from "../tree";
import type { AttemptLog, AgentRole } from "../types";

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
  ideationRetries: 0,
  refinementRetries: 0,
  refinementHistory: [],
  lastValidationError: null,
  evidence: null,
  sandboxSignal: null,
  counterExample: null,
  currentEnergy: null,
  smtModel: null,
  approvedConjecture: null,
  lakatosianHistory: [],
  redTeamHistory: [],
  leanAst: null,
  leanProof: null,
  proofRetries: 0,
  lastCompilerError: null,
  proofTree: null,
  attemptLogs: [],
  lastTacticState: "",
  currentAgentRole: null,
  globalIteration: 0,
  maxGlobalIterations: 15,
  proofStatus: null,
  reportPath: null,
};

// ──────────────────────────────────────────────
// Machine Definition
// ──────────────────────────────────────────────

export const researchMachine = setup({
  types: {
    context: {} as ResearchContext,
    events: {} as
      | { type: "START"; prompt: string; apiKey: string; workspaceDir: string; outputDir: string; publishableMode: boolean }
      | { type: "WAKE_AT_FORMAL"; prompt: string; apiKey: string; workspaceDir: string; outputDir: string; signature: string; objective?: string; maxIterations?: number }
      | { type: "xstate.done.actor.ideation"; output: IdeationOutput }
      | { type: "xstate.done.actor.validation"; output: ValidationOutput }
      | { type: "xstate.done.actor.sandbox"; output: SandboxOutput }
      | { type: "xstate.done.actor.smt"; output: SMTOutput }
      | { type: "xstate.done.actor.refinement"; output: RefinementOutput }
      | { type: "xstate.done.actor.redTeamActor"; output: RedTeamOutput }
      | { type: "xstate.done.actor.tacticGenerator"; output: { role: AgentRole; response: any } }
      | { type: "xstate.done.actor.lean"; output: LeanOutput }
      | { type: "xstate.done.actor.errorCorrection"; output: ErrorCorrectionOutput }
      | { type: "xstate.done.actor.scribe"; output: ScribeOutput },
  },

  actors: {
    ideationActor: defaultIdeationActor,
    validationActor: defaultValidationActor,
    sandboxActor: defaultSandboxActor,
    smtActor: defaultSmtActor,
    refinementActor: defaultRefinementActor,
    tacticGeneratorActor: defaultTacticGeneratorActor,
    leanVerificationActor: defaultLeanVerificationActor,
    errorCorrectionActor: defaultErrorCorrectionActor,
    scribeActor: defaultScribeActor,
    redTeamActor: defaultRedTeamActor,
  },

  guards: {
    canRetryIdeation: ({ context }) => context.ideationRetries < 3,
    canRetryProof: ({ context }) => context.proofRetries < 3,
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
      if (event.type === "xstate.done.actor.smt") {
        return event.output.status === "SAT";
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
      if (event.type === "xstate.done.actor.lean") {
        return event.output.status === "COMPILER_ERROR";
      }
      return false;
    },
    isFixed: ({ event }) => {
      if (event.type === "xstate.done.actor.errorCorrection") {
        return event.output.status === "FIXED";
      }
      return false;
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
      // Triggered by onDone transition of FormalVerification compound node
      return {
        proofStatus: "PROVED" as const,
      };
    }),
    setCompilerError: assign(({ context, event }) => {
      if (event.type === "xstate.done.actor.lean") {
        return {
          lastCompilerError: event.output.error,
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
    markFailed: assign({
      proofStatus: "FAILED" as const,
    }),
    logTransition: ({ context, event }) => {
      if (process.env.DEBUG) {
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
            actions: ["setSandboxResult", "logTransition"],
          },
          {
            guard: "isPlateau",
            target: "SMT_Resolution",
            actions: ["setSandboxResult", "logTransition"],
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
            target: "HypothesisRefinement",
            actions: ["setSMTResult", "logTransition"],
          }
        ],
        onError: {
          target: "EmpiricalSandbox",
          actions: "logTransition",
        },
      },
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
        input: ({ context }: { context: ResearchContext }) => ({ conjecture: context.approvedConjecture?.signature ?? context.hypothesis ?? "" }),
        onDone: [
          {
            guard: ({ event }: { event: any }) => event.output.status === "COUNTER_EXAMPLE_FOUND",
            target: "Ideation",
            actions: assign({
              lakatosianHistory: ({ context, event }: { context: ResearchContext; event: any }) => [
                ...context.lakatosianHistory,
                { 
                  failedConjecture: context.approvedConjecture?.signature ?? context.hypothesis ?? "", 
                  killerEdgeCase: event.output.counterExamplePayload 
                }
              ]
            })
          },
          {
            target: "FormalVerification",
          }
        ],
        onError: { target: "ErrorCorrection" }
      }
    },

    FormalVerification: {
      initial: "Initialize",
      states: {
        Initialize: {
          entry: "initProofTree",
          after: { 0: "Routing" },
        },
        Routing: {
          always: [
            { guard: ({ context }) => context.globalIteration >= context.maxGlobalIterations, target: "Exhausted" },
            { target: "Inference" }
          ],
        },
        Inference: {
          entry: "updateIteration",
          invoke: {
            id: "tacticGenerator",
            src: "tacticGeneratorActor",
            input: ({ context }) => ({
              conjecture: context.approvedConjecture ?? {
                 signature: context.hypothesis ?? "unknown",
                 description: "",
              },
              outputDir: context.outputDir || context.workspaceDir,
              apiKey: context.apiKey,
              attemptLogs: context.attemptLogs,
              lastTacticState: context.lastTacticState,
              proofTree: context.proofTree,
              role: "TACTICIAN",
            }),
            onDone: {
              target: "Execution",
              actions: "setTacticMove",
            },
            onError: {
              target: "#perqedResearch.ErrorCorrection",
              actions: ["logAttemptFailure", "setCompilerError"]
            },
          },
        },
        Execution: {
          invoke: {
            id: "leanVerification",
            src: "leanVerificationActor",
            input: ({ context, event }) => {
               const response = (event as any).output.response;
               const tactic = response.lean_tactics?.[0]?.tactic ?? response.tactics ?? "skip";
               (context as any).currentTactic = tactic;
               return {
                tactic,
                signature: context.approvedConjecture?.signature ?? context.hypothesis ?? "unknown",
                theoremName: "approved_conjecture",
                outputDir: context.outputDir || context.workspaceDir,
              };
            },
            onDone: [
              {
                guard: ({ event }) => (event as any).output.isComplete,
                target: "Complete",
                actions: "logAttemptSuccess"
              },
              {
                target: "Routing",
                actions: "logAttemptSuccess"
              }
            ],
            onError: {
              target: "Routing",
              actions: "logAttemptFailure"
            }
          }
        },
        Complete: {
          type: "final",
        },
        Exhausted: {
          type: "final",
        }
      },
      onDone: [
        {
          target: "ScribeReport",
          actions: ["setProofComplete", "logTransition"],
        }
      ]
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
          plan: context.plan!,
          evidence: context.evidence!,
          conjecture: context.approvedConjecture,
          proofStatus: context.proofStatus ?? "SKIPPED",
          outputDir: context.outputDir || context.workspaceDir,
          apiKey: context.apiKey,
          redTeamHistory: context.redTeamHistory,
          refinementHistory: context.refinementHistory,
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
