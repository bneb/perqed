/**
 * Hybrid Roster: AgentFactory — Signals-Based Specialist Instantiation
 *
 * 4-Tier Escalation:
 *   TACTICIAN (local Ollama)  → default tactic spray
 *   REASONER  (Gemini cloud)  → tactical unblocking
 *   ARCHITECT (Gemini cloud)  → structural planning
 *
 * Gemini model tiers selected by RoutingSignals:
 *   < M (4) failures: gemini-2.5-flash (free tier)
 *   ≥ M failures:     gemini-3.1-flash-lite-preview (paid flash)
 *   ≥ N (6) failures: gemini-3.1-pro-preview (break glass)
 */

import type { AgentRole, RoutingSignals } from "../types";
import type { FormalistResponse } from "../schemas";
import { FormalistAgent, type FormalistConfig } from "./formalist";
import { GeminiAgent, type GeminiModelTier } from "./gemini";

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
  geminiApiKey: "",
  tacticianSystemPrompt: "You are a Lean 4 theorem prover. When given a theorem, output ONLY the tactic(s) to complete the proof. No explanations. No markdown. Just the tactic code.",
  thresholdM: 4,
  thresholdN: 6,
};

// ──────────────────────────────────────────────
// Agent Factory
// ──────────────────────────────────────────────

export class AgentFactory {
  private readonly config: Required<FactoryConfig>;

  /** Escalation threshold: advance to paid Flash-Lite. */
  readonly THRESHOLD_M: number;
  /** Escalation threshold: break glass to Pro. */
  readonly THRESHOLD_N: number;

  constructor(config: FactoryConfig = {}) {
    this.config = { ...DEFAULT_FACTORY_CONFIG, ...config } as Required<FactoryConfig>;
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
          model: "deepseek-prover-v2:7b-q8",
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
          ? "gemini-3.1-flash-lite-preview"
          : "gemini-2.5-flash";

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
          ? "gemini-3.1-pro-preview"
          : "gemini-2.5-flash";

        return new GeminiSpecialist("ARCHITECT", architectTier, apiKey);
      }

      default:
        throw new Error(`Unknown agent role: ${role}`);
    }
  }
}
