/**
 * Hybrid Roster: AgentFactory — Signals-Based Specialist Instantiation
 *
 * 4-Tier Escalation:
 *   TACTICIAN (local Ollama)  → default tactic generation
 *   REASONER  (Gemini cloud)  → tactical unblocking
 *   ARCHITECT (Gemini cloud)  → structural planning
 *   HUMAN     (manual input)  → human-in-the-loop
 *
 * Model tiers are resolved from the AgencyRegistry (agency.json).
 * When no registry is provided, falls back to hardcoded defaults
 * for backward compatibility.
 */

import type { AgentRole, RoutingSignals } from "../types";
import type { FormalistResponse } from "../schemas";
import { FormalistAgent, type FormalistConfig } from "./formalist";
import { GeminiAgent, type GeminiModelTier } from "./gemini";
import { HumanAgent } from "./human";
import { getAgencyRegistry, type AgencyRegistry } from "../agency";

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
  /** Ollama endpoint (default: http://127.0.0.1:11434) */
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
  /**
   * Problem difficulty hint. When 'hard' (non-constructive / unknown problem class),
   * the factory starts REASONER and ARCHITECT at higher tiers and lowers
   * escalation thresholds so frontier models engage earlier.
   */
  problemDifficulty?: 'normal' | 'hard';
}

const DEFAULT_FACTORY_CONFIG = {
  ollamaEndpoint: "http://127.0.0.1:11434",
  ollamaModel: "deepseek-prover-v2:7b-q8",
  geminiApiKey: "",
  tacticianSystemPrompt: "You are a Lean 4 theorem prover. When given a theorem, output ONLY the tactic(s) to complete the proof. No explanations. No markdown. Just the tactic code.\n\nCRITICAL WARNING: Keep your <think> phase extremely brief (under 300 words). If you think for too long, the system will time out and crash. Plan your first step and immediately output the tactic.\n\nThe Computational Fast-Path Heuristic:\nBefore attempting any complex logical deduction (intro, by_contra, induction), your FIRST node expansion in the MCTS tree MUST attempt Lean 4's computational and automation tactics.\n\nIf the theorem involves finite arithmetic, equalities, or bounded evaluations, you must immediately try one of the following:\n\nrfl (if it evaluates by definitional equality)\ndecide (if it is a decidable proposition)\nnorm_num (the ultimate hammer for numerical arithmetic)\nring (for polynomial algebra)\nomega (for integer/natural number linear arithmetic)\n\nDo not overcomplicate finite bounds. Let the Lean kernel compute them.",
  thresholdM: 4,
  thresholdN: 6,
  problemDifficulty: 'normal' as const,
};

// ──────────────────────────────────────────────
// Agent Factory
// ──────────────────────────────────────────────

export class AgentFactory {
  private readonly config: Required<FactoryConfig>;
  private readonly registry: AgencyRegistry;

  /** Escalation threshold: advance to paid Flash-Lite. */
  readonly THRESHOLD_M: number;
  /** Escalation threshold: break glass to Pro. */
  readonly THRESHOLD_N: number;

  constructor(config: FactoryConfig = {}, registry?: AgencyRegistry) {
    this.registry = registry ?? getAgencyRegistry();

    // When a registry is present, derive defaults from it
    const registryDefaults = {
      ollamaEndpoint: this.registry.getEndpoint("L0_prover"),
      ollamaModel: this.registry.getModel("L0_prover"),
    };

    this.config = { ...DEFAULT_FACTORY_CONFIG, ...registryDefaults, ...config } as Required<FactoryConfig>;
    // For hard problems (non-constructive / unknown), halve the escalation thresholds
    // so frontier models engage much earlier in the search.
    const isHard = this.config.problemDifficulty === 'hard';
    this.THRESHOLD_M = isHard ? Math.max(2, Math.floor(this.config.thresholdM / 2)) : this.config.thresholdM;
    this.THRESHOLD_N = isHard ? Math.max(2, Math.floor(this.config.thresholdN / 2)) : this.config.thresholdN;
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
      case "HUMAN":
        return new HumanAgent();

      case "PROVER": {
        const provider = this.registry.getProvider("L0_prover");
        return new FormalistSpecialist("PROVER", {
          endpoint: this.config.ollamaEndpoint,
          model: provider.model ?? this.config.ollamaModel,
          temperature: provider.temperature ?? 0.3,
          numPredict: provider.max_tokens ?? 4096,
          mode: provider.ollama_mode ?? "completion",
          systemPrompt: this.config.tacticianSystemPrompt,
        }, 3);
      }

      case "ARCHITECT": {
        const apiKey = this.resolveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            "ARCHITECT role requires a Gemini API key. Set geminiApiKey in FactoryConfig or GEMINI_API_KEY env var."
          );
        }

        // L0: Local FormalistAgent (gemma4:26b)
        // L1: Gemini 2.5 Flash
        // L2: Gemini 3.1 Pro Preview
        // For 'hard' problems, THRESHOLD_M and THRESHOLD_N are already halved,
        // so cloud escalation happens faster — but we always start local.
        
        let escalationLevel = 0;
        if (signals.globalFailures >= this.THRESHOLD_N) {
          escalationLevel = 2;
        } else if (signals.globalFailures >= this.THRESHOLD_M) {
          escalationLevel = 1;
        }

        if (escalationLevel === 0) {
          // Use L0 local Architect
          const provider = this.registry.getProvider("L0_architect");
          return new FormalistSpecialist("ARCHITECT", {
            endpoint: this.config.ollamaEndpoint,
            model: provider.model ?? "gemma4:26b",
            temperature: provider.temperature ?? 0.3,
            numPredict: provider.max_tokens ?? 4096,
            mode: provider.ollama_mode ?? "chat",
            // The local architect needs a system prompt indicating it is a high level reasoning agent
            systemPrompt: `You are an expert Lean 4 Architect and Reasoner. Analyze the proof state and provide a sequence of tactics to unblock the prover.
Your output MUST be a valid JSON object matching this schema EXACTLY:
{
  "thoughts": "String: Your reasoning process",
  "action": "PROPOSE_LEAN_TACTICS",
  "lean_tactics": [
    { "tactic": "String: A single Lean tactic (e.g. 'omega', 'split')", "informal_sketch": "String: explanation", "confidence_score": 0.9 }
  ]
}
Do NOT use 'tactic_sequence' or 'tactics'. Use 'lean_tactics'.`
          }, 3);
        } else {
          // Escalate to Cloud
          const architectTier: GeminiModelTier = this.resolveEscalatedModel("reasoning", escalationLevel);
          return new GeminiSpecialist("ARCHITECT", architectTier, apiKey);
        }
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
    try {
      return this.registry.resolveProvider(capability as any, false, 0).model as GeminiModelTier;
    } catch {
      return "gemini-2.5-flash";
    }
  }

  /**
   * Resolve an escalated cloud model for a capability.
   * escalationLevel=1 skips the base tier, =2 skips the next, etc.
   * Falls back to hardcoded defaults if no registry is present.
   */
  private resolveEscalatedModel(capability: string, escalationLevel: number): GeminiModelTier {
    try {
      return this.registry.resolveProvider(capability as any, false, escalationLevel).model as GeminiModelTier;
    } catch {
      // Hardcoded fallbacks (backward compat)
      return escalationLevel >= 3 ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-lite-preview";
    }
  }
}

}
