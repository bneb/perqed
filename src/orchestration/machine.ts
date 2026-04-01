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
  SMTOutput,
  FalsificationOutput,
  LeanOutput,
  ErrorCorrectionOutput,
  ScribeOutput,
} from "./types";
import type {
  IdeationInput,
  ValidationInput,
  SandboxInput,
  SMTInput,
  FalsificationInput,
  LeanInput,
  ErrorCorrectionInput,
  ScribeInput,
} from "./actors";

// Re-export the actor implementations for the default (non-test) machine
import {
  ideationActor as defaultIdeationActor,
  validationActor as defaultValidationActor,
  sandboxActor as defaultSandboxActor,
  smtActor as defaultSmtActor,
  falsificationActor as defaultFalsificationActor,
  leanActor as defaultLeanActor,
  errorCorrectionActor as defaultErrorCorrectionActor,
  scribeActor as defaultScribeActor,
} from "./actors";

// ──────────────────────────────────────────────
// Initial Context Factory
// ──────────────────────────────────────────────

const INITIAL_CONTEXT: ResearchContext = {
  prompt: "",
  apiKey: "",
  workspaceDir: "",
  outputDir: "",
  literature: [],
  plan: null,
  hypothesis: null,
  noveltyClassification: "UNCLASSIFIED",
  ideationRetries: 0,
  lastValidationError: null,
  evidence: null,
  sandboxSignal: null,
  counterExample: null,
  currentEnergy: null,
  smtModel: null,
  approvedConjecture: null,
  redTeamHistory: [],
  leanAst: null,
  leanProof: null,
  proofRetries: 0,
  lastCompilerError: null,
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
      | { type: "START"; prompt: string; apiKey: string; workspaceDir: string; outputDir: string }
      | { type: "xstate.done.actor.ideation"; output: IdeationOutput }
      | { type: "xstate.done.actor.validation"; output: ValidationOutput }
      | { type: "xstate.done.actor.sandbox"; output: SandboxOutput }
      | { type: "xstate.done.actor.smt"; output: SMTOutput }
      | { type: "xstate.done.actor.falsification"; output: FalsificationOutput }
      | { type: "xstate.done.actor.lean"; output: LeanOutput }
      | { type: "xstate.done.actor.errorCorrection"; output: ErrorCorrectionOutput }
      | { type: "xstate.done.actor.scribe"; output: ScribeOutput },
  },

  actors: {
    ideationActor: defaultIdeationActor,
    validationActor: defaultValidationActor,
    sandboxActor: defaultSandboxActor,
    smtActor: defaultSmtActor,
    falsificationActor: defaultFalsificationActor,
    leanActor: defaultLeanActor,
    errorCorrectionActor: defaultErrorCorrectionActor,
    scribeActor: defaultScribeActor,
  },

  guards: {
    canRetryIdeation: ({ context }) => context.ideationRetries < 3,
    canRetryProof: ({ context }) => context.proofRetries < 3,
    isKnownTheorem: ({ event }) => {
      if ("output" in event && "classification" in (event as any).output) {
        return (event as any).output.classification === "KNOWN_THEOREM";
      }
      return false;
    },
    isKnownAndCanRetry: ({ context, event }) => {
      if ("output" in event && "classification" in (event as any).output) {
        return (
          (event as any).output.classification === "KNOWN_THEOREM" &&
          context.ideationRetries < 2  // will be incremented to < 3
        );
      }
      return false;
    },
    isKnownAndExhausted: ({ context, event }) => {
      if ("output" in event && "classification" in (event as any).output) {
        return (
          (event as any).output.classification === "KNOWN_THEOREM" &&
          context.ideationRetries >= 2
        );
      }
      return false;
    },
    isWitness: ({ event }) => {
      if ("output" in event && "signal" in (event as any).output) {
        return (event as any).output.signal === "WITNESS_FOUND";
      }
      return false;
    },
    isPlateau: ({ event }) => {
      if ("output" in event && "signal" in (event as any).output) {
        return (event as any).output.signal === "PLATEAU_DETECTED";
      }
      return false;
    },
    isCleanKill: ({ event }) => {
      if ("output" in event && "signal" in (event as any).output) {
        return (event as any).output.signal === "CLEAN_KILL";
      }
      return false;
    },
    isSAT: ({ event }) => {
      if ("output" in event && "status" in (event as any).output) {
        return (event as any).output.status === "SAT";
      }
      return false;
    },
    isProofComplete: ({ event }) => {
      if ("output" in event && "status" in (event as any).output) {
        return (event as any).output.status === "PROOF_COMPLETE";
      }
      return false;
    },
    isCompilerError: ({ event }) => {
      if ("output" in event && "status" in (event as any).output) {
        return (event as any).output.status === "COMPILER_ERROR";
      }
      return false;
    },
    isFixed: ({ event }) => {
      if ("output" in event && "status" in (event as any).output) {
        return (event as any).output.status === "FIXED";
      }
      return false;
    },
  },

  actions: {
    setPrompt: assign(({ event }) => {
      if (event.type === "START") {
        return {
          prompt: event.prompt,
          apiKey: event.apiKey,
          workspaceDir: event.workspaceDir,
          outputDir: event.outputDir,
        };
      }
      return {};
    }),
    setIdeationResult: assign(({ event }) => {
      const output = (event as any).output as IdeationOutput;
      return {
        hypothesis: output.hypothesis,
        noveltyClassification: output.classification,
        plan: output.plan,
        literature: output.literature,
      };
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
    setValidatedAST: assign({
      leanAst: ({ event }) => (event as any).output?.ast ?? null,
    }),
    setSandboxResult: assign(({ event }) => {
      const output = (event as any).output as SandboxOutput;
      return {
        evidence: output.evidence,
        sandboxSignal: output.signal,
        currentEnergy: output.energy,
        counterExample: output.data,
        approvedConjecture: output.approvedConjecture ?? null,
        redTeamHistory: output.redTeamHistory ?? [],
      };
    }),
    setSMTResult: assign({
      smtModel: ({ event }) => (event as any).output?.model ?? null,
    }),
    setFalsificationResult: assign(({ event }) => {
      const output = (event as any).output as FalsificationOutput;
      return {
        approvedConjecture: output.approvedConjecture,
        redTeamHistory: output.redTeamHistory,
      };
    }),
    setProofComplete: assign(({ event }) => {
      const output = (event as any).output as LeanOutput;
      return {
        proofStatus: "PROVED" as const,
        leanProof: output.proof,
      };
    }),
    setCompilerError: assign(({ context, event }) => {
      const output = (event as any).output as LeanOutput;
      return {
        lastCompilerError: output.error,
        proofRetries: context.proofRetries + 1,
      };
    }),
    setFixedProof: assign({
      leanProof: ({ event }) => (event as any).output?.proof ?? null,
    }),
    setReportPath: assign({
      reportPath: ({ event }) => (event as any).output?.reportPath ?? null,
    }),
    markFailed: assign({
      proofStatus: "FAILED" as const,
    }),
    logTransition: ({ context, event }) => {
      console.log(
        `🔄 [Machine] Event: ${event.type} | Retries: idea=${context.ideationRetries} proof=${context.proofRetries}`,
      );
    },
  },
}).createMachine({
  id: "perqedResearch",
  initial: "Idle",
  context: INITIAL_CONTEXT,

  states: {
    // ── Idle ──────────────────────────────────────────────────────────────
    Idle: {
      on: {
        START: {
          target: "Ideation",
          actions: "setPrompt",
        },
      },
    },

    // ── Ideation ─────────────────────────────────────────────────────────
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
        }),
        onDone: [
          // KNOWN_THEOREM + can retry → self-loop
          {
            guard: "isKnownAndCanRetry",
            target: "Ideation",
            reenter: true,
            actions: ["setIdeationResult", "incrementIdeationRetry", "logTransition"],
          },
          // KNOWN_THEOREM + exhausted → exit
          {
            guard: "isKnownAndExhausted",
            target: "ExitGracefully",
            actions: ["setIdeationResult", "incrementIdeationRetry"],
          },
          // Novel → proceed to validation
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

    // ── Validation ───────────────────────────────────────────────────────
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
          // Hallucination + can retry → back to ideation
          {
            guard: "canRetryIdeation",
            target: "Ideation",
            actions: ["setValidationError", "incrementIdeationRetry", "logTransition"],
          },
          // Exhausted
          {
            target: "TerminalFailure",
            actions: ["setValidationError", "logTransition"],
          },
        ],
      },
    },

    // ── EmpiricalSandbox ─────────────────────────────────────────────────
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
          // WITNESS_FOUND → FormalVerification
          {
            guard: "isWitness",
            target: "FormalVerification",
            actions: ["setSandboxResult", "logTransition"],
          },
          // PLATEAU_DETECTED → SMT_Resolution
          {
            guard: "isPlateau",
            target: "SMT_Resolution",
            actions: ["setSandboxResult", "logTransition"],
          },
          // CLEAN_KILL → FalsificationFork
          {
            guard: "isCleanKill",
            target: "FalsificationFork",
            actions: ["setSandboxResult", "logTransition"],
          },
          // Fallback → FormalVerification
          {
            target: "FormalVerification",
            actions: ["setSandboxResult", "logTransition"],
          },
        ],
        onError: {
          target: "TerminalFailure",
          actions: "logTransition",
        },
      },
    },

    // ── SMT_Resolution ───────────────────────────────────────────────────
    SMT_Resolution: {
      invoke: {
        id: "smt",
        src: "smtActor",
        input: ({ context }) => ({
          smtScript: context.smtModel ?? "(check-sat)",
        }),
        onDone: [
          // SAT → FormalVerification
          {
            guard: "isSAT",
            target: "FormalVerification",
            actions: ["setSMTResult", "logTransition"],
          },
          // UNSAT → resume SA
          {
            target: "EmpiricalSandbox",
            actions: ["setSMTResult", "logTransition"],
          },
        ],
        onError: {
          target: "EmpiricalSandbox",
          actions: "logTransition",
        },
      },
    },

    // ── FalsificationFork ────────────────────────────────────────────────
    FalsificationFork: {
      invoke: {
        id: "falsification",
        src: "falsificationActor",
        input: ({ context }) => ({
          counterExample: context.counterExample,
          literature: context.literature,
          apiKey: context.apiKey,
        }),
        onDone: {
          target: "FormalVerification",
          actions: ["setFalsificationResult", "logTransition"],
        },
        onError: {
          target: "TerminalFailure",
          actions: "logTransition",
        },
      },
    },

    // ── FormalVerification ────────────────────────────────────────────────
    FormalVerification: {
      invoke: {
        id: "lean",
        src: "leanActor",
        input: ({ context }) => ({
          conjecture: context.approvedConjecture ?? {
            signature: context.hypothesis ?? "",
            description: context.plan?.extension_hypothesis ?? "",
          },
          outputDir: context.outputDir || context.workspaceDir,
          apiKey: context.apiKey,
        }),
        onDone: [
          // PROOF_COMPLETE → ScribeReport
          {
            guard: "isProofComplete",
            target: "ScribeReport",
            actions: ["setProofComplete", "logTransition"],
          },
          // COMPILER_ERROR + can retry → ErrorCorrection
          {
            guard: ({ context }) => context.proofRetries < 2,
            target: "ErrorCorrection",
            actions: ["setCompilerError", "logTransition"],
          },
          // COMPILER_ERROR + exhausted → TerminalFailure
          {
            target: "TerminalFailure",
            actions: ["setCompilerError", "markFailed", "logTransition"],
          },
        ],
        onError: {
          target: "TerminalFailure",
          actions: ["markFailed", "logTransition"],
        },
      },
    },

    // ── ErrorCorrection ──────────────────────────────────────────────────
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
          // FIXED → back to FormalVerification
          {
            guard: "isFixed",
            target: "FormalVerification",
            actions: ["setFixedProof", "logTransition"],
          },
          // UNFIXABLE → TerminalFailure
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

    // ── ScribeReport ─────────────────────────────────────────────────────
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
        }),
        onDone: {
          target: "Done",
          actions: ["setReportPath", "logTransition"],
        },
        onError: {
          // Scribe failure is non-fatal — still mark as done
          target: "Done",
          actions: "logTransition",
        },
      },
    },

    // ── Terminal States ──────────────────────────────────────────────────
    Done: { type: "final" },
    ExitGracefully: { type: "final" },
    TerminalFailure: { type: "final" },
  },
});
