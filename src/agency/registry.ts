/**
 * agency/registry.ts — The Single Source of Truth for All Model Resolution
 *
 * Loads agency.json, validates it against the Zod schema, and provides
 * capability-based provider resolution with escalation chain walking.
 */

import { AgencyTopologySchema, type AgencyTopology, type CapabilityTag, type Provider } from "./schema";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ──────────────────────────────────────────────
// Built-in Fallback Topology
// ──────────────────────────────────────────────

const BUILTIN_TOPOLOGY: AgencyTopology = {
  agency_topology: {
    default_tier: "L0",
    escalation_policy: "sequential_chain",
    max_parse_retries: 2,
    providers: {
      L0_thinker: {
        engine: "ollama",
        model: "deepseek-prover-v2:7b-q8",
        endpoint: "http://127.0.0.1:11434",
        capabilities: ["reasoning", "lean4", "chat", "conjecture", "red_team", "formalization"],
        fallback_for: [],
      },
      L0_typist: {
        engine: "ollama",
        model: "qwen2.5-coder",
        endpoint: "http://127.0.0.1:11434",
        capabilities: ["bash", "file_edit", "python", "compilation"],
        fallback_for: [],
      },
      L1_micro: {
        engine: "gemini",
        model: "gemini-2.5-flash",
        api_env_var: "GEMINI_API_KEY",
        capabilities: ["reasoning", "lean4", "chat", "python", "conjecture", "red_team", "formalization", "latex", "compilation"],
        fallback_for: ["L0_thinker", "L0_typist"],
      },
      L2_standard: {
        engine: "gemini",
        model: "gemini-3.1-flash-lite-preview",
        api_env_var: "GEMINI_API_KEY",
        capabilities: ["reasoning", "lean4", "chat", "python", "conjecture", "red_team", "formalization", "latex", "compilation"],
        fallback_for: ["L1_micro"],
      },
      L3_complex: {
        engine: "gemini",
        model: "gemini-2.5-pro",
        api_env_var: "GEMINI_API_KEY",
        capabilities: ["reasoning", "lean4", "chat", "conjecture", "latex", "compilation", "formalization"],
        fallback_for: ["L2_standard"],
      },
      L4_frontier: {
        engine: "gemini",
        model: "gemini-3.1-pro-preview",
        api_env_var: "GEMINI_API_KEY",
        capabilities: ["reasoning", "lean4", "chat", "conjecture", "latex", "compilation", "formalization"],
        fallback_for: ["L3_complex"],
      },
    },
  },
};

// ──────────────────────────────────────────────
// AgencyRegistry
// ──────────────────────────────────────────────

export class AgencyRegistry {
  private readonly topology: AgencyTopology;
  private readonly providers: Map<string, Provider>;
  /** For each provider ID, the ordered list of fallback provider IDs. */
  private readonly escalationChains: Map<string, string[]>;

  constructor(configPath?: string) {
    const raw = this.loadConfig(configPath);
    this.topology = AgencyTopologySchema.parse(raw);
    this.providers = new Map();
    this.escalationChains = new Map();
    this.buildProviderMap();
    this.buildEscalationChains();
  }

  // ── Config Loading ──────────────────────────────────────────────────────

  private loadConfig(configPath?: string): unknown {
    // Explicit path
    if (configPath && existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, "utf8"));
    }

    // Search up from CWD for agency.json
    const candidates = [
      join(process.cwd(), "agency.json"),
      join(process.cwd(), "..", "agency.json"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return JSON.parse(readFileSync(candidate, "utf8"));
      }
    }

    // Fall back to built-in
    console.warn("[AgencyRegistry] No agency.json found — using built-in defaults.");
    return BUILTIN_TOPOLOGY;
  }

  // ── Provider Map Construction ───────────────────────────────────────────

  private buildProviderMap(): void {
    const entries = this.topology.agency_topology.providers;
    for (const [id, providerData] of Object.entries(entries)) {
      this.providers.set(id, { ...providerData, id });
    }
  }

  // ── Escalation Chain Construction ───────────────────────────────────────

  /**
   * Build the escalation chain for each provider by walking `fallback_for` relations.
   *
   * If provider B has `fallback_for: ["A"]`, then B is in A's escalation chain.
   * Chains are ordered by provider key name (L0 → L1 → L2 → L3 → L4).
   */
  private buildEscalationChains(): void {
    // For each provider, find all providers that have it in their fallback_for list
    for (const [sourceId] of this.providers) {
      const chain: string[] = [];
      let currentId = sourceId;

      // Walk forward: find who falls back FROM currentId (i.e., who has currentId in their fallback_for)
      const visited = new Set<string>();
      visited.add(currentId);

      while (true) {
        // Find the provider whose fallback_for contains currentId
        let nextId: string | null = null;
        for (const [candidateId, candidateProvider] of this.providers) {
          if (candidateProvider.fallback_for?.includes(currentId) && !visited.has(candidateId)) {
            nextId = candidateId;
            break;
          }
        }

        if (!nextId) break;

        chain.push(nextId);
        visited.add(nextId);
        currentId = nextId;
      }

      this.escalationChains.set(sourceId, chain);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Resolve the best provider for a given capability requirement.
   *
   * @param capability     - The capability tag to match (e.g., "reasoning", "python")
   * @param preferLocal    - If true, prefer Ollama providers first (default: false)
   * @param escalationLevel - How many tiers to skip past the initial match (default: 0)
   * @returns The resolved Provider definition
   * @throws Error if no provider supports the requested capability
   */
  resolveProvider(capability: CapabilityTag, preferLocal: boolean = false, escalationLevel: number = 0): Provider {
    // Collect all providers that support this capability
    const candidates: Provider[] = [];
    for (const [, provider] of this.providers) {
      if (provider.capabilities.includes(capability)) {
        candidates.push(provider);
      }
    }

    if (candidates.length === 0) {
      throw new Error(`[AgencyRegistry] No provider supports capability "${capability}".`);
    }

    // Sort: local engines first if preferLocal, then by tier level (key name sort)
    candidates.sort((a, b) => {
      if (preferLocal) {
        const aLocal = a.engine === "ollama" ? 0 : 1;
        const bLocal = b.engine === "ollama" ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
      } else {
        // Prefer cloud (gemini) first when not preferring local
        const aCloud = a.engine !== "ollama" ? 0 : 1;
        const bCloud = b.engine !== "ollama" ? 0 : 1;
        if (aCloud !== bCloud) return aCloud - bCloud;
      }
      // Secondary sort by provider ID (alphabetical → L0 < L1 < L2 etc.)
      return (a.id ?? "").localeCompare(b.id ?? "");
    });

    // Apply escalation level
    const idx = Math.min(escalationLevel, candidates.length - 1);
    return candidates[idx]!;
  }

  /**
   * Get the escalation chain for a provider ID.
   * Returns the ordered list of fallback provider IDs.
   */
  getEscalationChain(providerId: string): string[] {
    return this.escalationChains.get(providerId) ?? [];
  }

  /**
   * Get a provider by its explicit ID.
   * @throws Error if the provider ID is not found.
   */
  getProvider(id: string): Provider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`[AgencyRegistry] Provider "${id}" not found.`);
    }
    return provider;
  }

  /**
   * Get the model string for a provider.
   */
  getModel(id: string): string {
    return this.getProvider(id).model;
  }

  /**
   * Get the API key for a cloud provider by reading from process.env at call time.
   * @throws Error if the provider has no api_env_var or the env var is not set.
   */
  getApiKey(id: string): string {
    const provider = this.getProvider(id);
    if (!provider.api_env_var) {
      throw new Error(`[AgencyRegistry] Provider "${id}" has no api_env_var configured.`);
    }
    const key = process.env[provider.api_env_var];
    if (!key) {
      throw new Error(`[AgencyRegistry] Environment variable "${provider.api_env_var}" is not set (required by provider "${id}").`);
    }
    return key;
  }

  /**
   * Get the endpoint for a local provider.
   */
  getEndpoint(id: string): string {
    const provider = this.getProvider(id);
    return provider.endpoint ?? "http://127.0.0.1:11434";
  }

  /**
   * Get the max parse retries from the topology config.
   */
  get maxParseRetries(): number {
    return this.topology.agency_topology.max_parse_retries;
  }

  /**
   * Get the escalation policy.
   */
  get escalationPolicy(): string {
    return this.topology.agency_topology.escalation_policy;
  }

  /**
   * List all registered provider IDs.
   */
  listProviderIds(): string[] {
    return [...this.providers.keys()];
  }
}
