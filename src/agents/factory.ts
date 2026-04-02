/**
 * Hybrid Roster: AgentFactory — Signals-Based Specialist Instantiation
 *
 * 4-Tier Escalation:
 *   TACTICIAN (local Ollama)  → default tactic spray
 *   REASONER  (Gemini cloud)  → tactical unblocking
 *   ARCHITECT (Gemini cloud)  → structural planning
 *
 * Model tiers are resolved from the AgencyRegistry (agency.json).
 * When no registry is provided, falls back to hardcoded defaults
 * for backward compatibility.
 */

import type { AgentRole, RoutingSignals } from "../types";
import type { FormalistResponse } from "../schemas";
import { FormalistAgent, type FormalistConfig } from "./formalist";
import { GeminiAgent, type GeminiModelTier } from "./gemini";
import type { AgencyRegistry } from "../agency/registry";

// ──────────────────────────────────────────────
// Specialist Agent Interface
// ──────────────────────────────────────────────

/** Response type: unified across all specialists. */
export type SpecialistResponse = FormalistResponse | Record<string, any>;

/**
 * A unified interface for all specialist agents.
 * The orchestrator calls generateMove() regardless of which model is behind it.
 */
export interface SpecialistAgent {
  readonly role: AgentRole;
  generateMove(context: string, retries?: number): Promise<SpecialistResponse>;
}

// ──────────────────────────────────────────────
// Specialist Wrappers
// ──────────────────────────────────────────────

/**
 * Wraps FormalistAgent as a SpecialistAgent.
 * Used for TACTICIAN only (local Ollama model).
 */
class FormalistSpecialist implements SpecialistAgent {
  readonly role: AgentRole;
  private readonly agent: FormalistAgent;
  private readonly defaultRetries: number;

  constructor(role: AgentRole, config: Partial<FormalistConfig>, retries: number = 3) {
    this.role = role;
    this.agent = new FormalistAgent(config);
    this.defaultRetries = retries;
  }

  async generateMove(context: string, retries?: number): Promise<FormalistResponse> {
    return this.agent.generateMove(context, retries ?? this.defaultRetries);
  }

  /** Access to the underlying agent for telemetry (lastThinking, etc.) */
  get formalist(): FormalistAgent {
    return this.agent;
  }
}

/**
 * Wraps GeminiAgent as a SpecialistAgent.
 * Used for REASONER and ARCHITECT roles (Gemini cloud).
 */
class GeminiSpecialist implements SpecialistAgent {
  readonly role: AgentRole;
  readonly modelTier: GeminiModelTier;
  private readonly agent: GeminiAgent;

  constructor(role: AgentRole, modelTier: GeminiModelTier, apiKey: string) {
    this.role = role;
    this.modelTier = modelTier;
    this.agent = new GeminiAgent(role, modelTier, apiKey);
  }

  async generateMove(context: string, retries?: number): Promise<any> {
    return this.agent.generateMove(context, retries);
  }
}

// ──────────────────────────────────────────────
// Factory Configuration
// ──────────────────────────────────────────────

export interface FactoryConfig {
  /** Ollama endpoint (default: http://localhost:11434) */
  ollamaEndpoint?: string;
  /** Ollama model (default: deepseek-prover-v2:7b-q8) */
  ollamaModel?: string;
  /** Gemini API key (required for REASONER & ARCHITECT). Falls back to process.env.GEMINI_API_KEY. */
  geminiApiKey?: string;
  /** Tactician system prompt (short, tactic-focused) */
  tacticianSystemPrompt?: string;
  /** Advanced Flash threshold M (default: 4) */
  thresholdM?: number;
  /** Break Glass Pro threshold N (default: 6) */
  thresholdN?: number;
}

const DEFAULT_FACTORY_CONFIG = {
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "deepseek-prover-v2:7b-q8",
  geminiApiKey: "",
  tacticianSystemPrompt: "You are a Lean 4 theorem prover. When given a theorem, output ONLY the tactic(s) to complete the proof. No explanations. No markdown. Just the tactic code.\n\nThe Computational Fast-Path Heuristic:\nBefore attempting any complex logical deduction (intro, by_contra, induction), your FIRST node expansion in the MCTS tree MUST attempt Lean 4's computational and automation tactics.\n\nIf the theorem involves finite arithmetic, equalities, or bounded evaluations, you must immediately try one of the following:\n\nrfl (if it evaluates by definitional equality)\ndecide (if it is a decidable proposition)\nnorm_num (the ultimate hammer for numerical arithmetic)\nring (for polynomial algebra)\nomega (for integer/natural number linear arithmetic)\n\nDo not overcomplicate finite bounds. Let the Lean kernel compute them.",
  thresholdM: 4,
  thresholdN: 6,
};

// ──────────────────────────────────────────────
// Agent Factory
// ──────────────────────────────────────────────

export class AgentFactory {
  private readonly config: Required<FactoryConfig>;
  private readonly registry: AgencyRegistry | null;

  /** Escalation threshold: advance to paid Flash-Lite. */
  readonly THRESHOLD_M: number;
  /** Escalation threshold: break glass to Pro. */
  readonly THRESHOLD_N: number;

  constructor(config: FactoryConfig = {}, registry?: AgencyRegistry) {
    this.registry = registry ?? null;

    // When a registry is present, derive defaults from it
    const registryDefaults = registry
      ? {
          ollamaEndpoint: registry.getEndpoint("L0_thinker"),
          ollamaModel: registry.getModel("L0_thinker"),
        }
      : {};

    this.config = { ...DEFAULT_FACTORY_CONFIG, ...registryDefaults, ...config } as Required<FactoryConfig>;
    this.THRESHOLD_M = this.config.thresholdM;
    this.THRESHOLD_N = this.config.thresholdN;
  }

  /** Resolve API key: explicit config > process.env > empty */
  private resolveGeminiApiKey(): string {
    return this.config.geminiApiKey || process.env.GEMINI_API_KEY || "";
  }

  /**
   * Create a SpecialistAgent for the given role, selecting the Gemini
   * tier based on routing signals.
   *
   * - TACTICIAN: Always local (deepseek-prover-v2:7b-q8)
   * - REASONER:  Gemini 2.5 Flash (free) or 3.1 Flash-Lite (paid, ≥M failures)
   * - ARCHITECT: Gemini 2.5 Flash (free) or 3.1 Pro (break glass, ≥N failures)
   */
  getAgent(role: AgentRole, signals: RoutingSignals): SpecialistAgent {
    switch (role) {
      case "TACTICIAN":
        return new FormalistSpecialist("TACTICIAN", {
          endpoint: this.config.ollamaEndpoint,
          model: this.config.ollamaModel,
          temperature: 0.3,
          numPredict: 256,
          mode: "completion",
          systemPrompt: this.config.tacticianSystemPrompt,
        }, 3);

      case "REASONER": {
        const apiKey = this.resolveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            "REASONER role requires a Gemini API key. Set geminiApiKey in FactoryConfig or GEMINI_API_KEY env var."
          );
        }

        const reasonerTier: GeminiModelTier = signals.consecutiveFailures >= this.THRESHOLD_M
          ? this.resolveEscalatedModel("reasoning", 1)
          : this.resolveBaseCloudModel("reasoning");

        return new GeminiSpecialist("REASONER", reasonerTier, apiKey);
      }

      case "ARCHITECT": {
        const apiKey = this.resolveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            "ARCHITECT role requires a Gemini API key. Set geminiApiKey in FactoryConfig or GEMINI_API_KEY env var."
          );
        }

        const architectTier: GeminiModelTier = signals.globalFailures >= this.THRESHOLD_N
          ? this.resolveEscalatedModel("reasoning", 3)
          : this.resolveBaseCloudModel("reasoning");

        return new GeminiSpecialist("ARCHITECT", architectTier, apiKey);
      }

      default:
        throw new Error(`Unknown agent role: ${role}`);
    }
  }

  // ── Registry-Aware Model Resolution ──────────────────────────────────

  /**
   * Resolve the base (non-escalated) cloud model for a capability.
   * Falls back to hardcoded defaults if no registry is present.
   */
  private resolveBaseCloudModel(capability: string): GeminiModelTier {
    if (this.registry) {
      try {
        return this.registry.resolveProvider(capability as any, false, 0).model as GeminiModelTier;
      } catch {
        // Fall through to default
      }
    }
    return "gemini-2.5-flash";
  }

  /**
   * Resolve an escalated cloud model for a capability.
   * escalationLevel=1 skips the base tier, =2 skips the next, etc.
   * Falls back to hardcoded defaults if no registry is present.
   */
  private resolveEscalatedModel(capability: string, escalationLevel: number): GeminiModelTier {
    if (this.registry) {
      try {
        return this.registry.resolveProvider(capability as any, false, escalationLevel).model as GeminiModelTier;
      } catch {
        // Fall through to default
      }
    }
    // Hardcoded fallbacks (backward compat)
    return escalationLevel >= 3 ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-lite-preview";
  }
}
