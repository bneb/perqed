/**
 * Sprint 8: AgentFactory — Specialist Instantiation
 *
 * Provides a uniform interface for all specialists and a factory
 * method to instantiate the correct agent for a given role.
 *
 * Each specialist implements SpecialistAgent so the orchestrator
 * can call them interchangeably.
 */

import type { AgentRole } from "../types";
import type { ArchitectTier } from "./router";
import type { FormalistResponse, ArchitectResponse } from "../schemas";
import { FormalistAgent, type FormalistConfig } from "./formalist";
import { ArchitectClient, type ArchitectClientConfig } from "../architect_client";

// ──────────────────────────────────────────────
// Specialist Agent Interface
// ──────────────────────────────────────────────

/** Response type: either a FormalistResponse (Tactician/Reasoner) or ArchitectResponse */
export type SpecialistResponse = FormalistResponse | ArchitectResponse;

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
 * Used for both TACTICIAN and REASONER roles.
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
 * Wraps ArchitectClient as a SpecialistAgent.
 * Used for the ARCHITECT role (Gemini cloud).
 */
class ArchitectSpecialist implements SpecialistAgent {
  readonly role: AgentRole = "ARCHITECT";
  private readonly client: ArchitectClient;

  constructor(config: ArchitectClientConfig) {
    this.client = new ArchitectClient(config);
  }

  async generateMove(context: string): Promise<ArchitectResponse> {
    return this.client.escalate(context);
  }
}

// ──────────────────────────────────────────────
// Factory Configuration
// ──────────────────────────────────────────────

export interface FactoryConfig {
  /** Ollama endpoint (default: http://localhost:11434) */
  ollamaEndpoint?: string;
  /** Gemini API key (required for ARCHITECT). Falls back to process.env.GEMINI_API_KEY. */
  geminiApiKey?: string;
  /** Gemini Pro model (default: gemini-2.5-pro) — used for heavy structural rethinks. */
  geminiProModel?: string;
  /** Gemini Flash model (default: gemini-2.5-flash) — used for proof plans and light checks. */
  geminiFlashModel?: string;
  /** Tactician system prompt (short, tactic-focused) */
  tacticianSystemPrompt?: string;
  /** Reasoner system prompt (full, JSON-focused) */
  reasonerSystemPrompt?: string;
}

const DEFAULT_FACTORY_CONFIG: Required<FactoryConfig> = {
  ollamaEndpoint: "http://localhost:11434",
  geminiApiKey: "",
  geminiProModel: "gemini-3.1-pro-preview",
  geminiFlashModel: "gemini-3-flash-preview",
  tacticianSystemPrompt: "You are a Lean 4 theorem prover. When given a theorem, output ONLY the tactic(s) to complete the proof. No explanations. No markdown. Just the tactic code.",
  reasonerSystemPrompt: "",  // Loaded from workspace at runtime
};

// ──────────────────────────────────────────────
// Agent Factory
// ──────────────────────────────────────────────

export class AgentFactory {
  private readonly config: Required<FactoryConfig>;

  constructor(config: FactoryConfig = {}) {
    this.config = { ...DEFAULT_FACTORY_CONFIG, ...config };
  }

  /** Resolve API key: explicit config > process.env > empty */
  private resolveGeminiApiKey(): string {
    return this.config.geminiApiKey || process.env.GEMINI_API_KEY || "";
  }

  /**
   * Create a SpecialistAgent for the given role.
   *
   * - TACTICIAN: deepseek-prover-v2:7b-q8 (fast, low temp, small output)
   * - REASONER:  deepseek-r1:8b (slow, higher temp, large output, JSON)
   * - ARCHITECT: Gemini via ArchitectClient (cloud, structural analysis)
   *
   * @param role - The specialist role to instantiate.
   * @param tier - For ARCHITECT: "FLASH" (default) or "PRO". Ignored for other roles.
   */
  getAgent(role: AgentRole, tier: ArchitectTier = "FLASH"): SpecialistAgent {
    switch (role) {
      case "TACTICIAN":
        return new FormalistSpecialist("TACTICIAN", {
          endpoint: this.config.ollamaEndpoint,
          model: "deepseek-prover-v2:7b-q8",
          temperature: 0.3,
          numPredict: 256,
          mode: "chat",
          systemPrompt: this.config.tacticianSystemPrompt,
        }, 1);  // Tactician: only 1 retry (fast iteration, let the loop retry)

      case "REASONER":
        return new FormalistSpecialist("REASONER", {
          endpoint: this.config.ollamaEndpoint,
          model: "deepseek-r1:8b",
          temperature: 0.6,
          numPredict: 4096,
          mode: "chat",
          systemPrompt: this.config.reasonerSystemPrompt,
        }, 3);  // Reasoner: 3 retries (slower, make each count)

      case "ARCHITECT": {
        const apiKey = this.resolveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            "ARCHITECT role requires a Gemini API key. Set geminiApiKey in FactoryConfig or GEMINI_API_KEY env var."
          );
        }
        const model = tier === "PRO"
          ? this.config.geminiProModel
          : this.config.geminiFlashModel;
        return new ArchitectSpecialist({
          apiKey,
          model,
        });
      }

      default:
        throw new Error(`Unknown agent role: ${role}`);
    }
  }
}
