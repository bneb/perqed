/**
 * agency/schema.ts — Zod Schemas for the Agency Topology Configuration
 *
 * Defines the declarative JSON schema that replaces all hardcoded model
 * strings across the codebase. A single `agency.json` at the project root
 * controls every LLM provider, its capabilities, and the escalation chain.
 */

import { z } from "zod";

// ──────────────────────────────────────────────
// Capability Tags
// ──────────────────────────────────────────────

/**
 * Capability tags describe what a provider can do.
 * Used by the AgencyRegistry to match agent roles to providers.
 */
export const CapabilityTag = z.enum([
  "reasoning",     // Mathematical reasoning, proof strategy, theorem proving
  "lean4",         // Lean 4 tactic generation and formal verification
  "chat",          // General chat / instruction following
  "bash",          // Shell command generation, script writing
  "file_edit",     // Code editing, refactoring
  "python",        // Python script generation (Explorer sandbox)
  "latex",         // LaTeX document generation (Scribe)
  "conjecture",    // Mathematical conjecture formulation
  "red_team",      // Adversarial auditing of conjectures
  "formalization", // Informal-to-formal mathematical translation
  "compilation",   // C++/JS energy function synthesis
]);
export type CapabilityTag = z.infer<typeof CapabilityTag>;

// ──────────────────────────────────────────────
// Engine Types
// ──────────────────────────────────────────────

/**
 * Engine type determines which client adapter to use.
 */
export const EngineType = z.enum([
  "ollama",        // Local Ollama instance (FormalistAgent pattern)
  "gemini",        // Google Gemini API (@google/genai SDK)
  "gemini_rest",   // Google Gemini REST API (ArchitectClient pattern)
  "openai_compat", // Any OpenAI-compatible endpoint (future-proofing)
]);
export type EngineType = z.infer<typeof EngineType>;

// ──────────────────────────────────────────────
// Provider Definition
// ──────────────────────────────────────────────

/**
 * A single provider definition in the topology.
 */
export const ProviderSchema = z.object({
  /** Unique identifier for this provider (injected at parse time, not in JSON) */
  id: z.string().optional(),
  /** Which LLM engine adapter to use */
  engine: EngineType,
  /** Model identifier (e.g., "gemma:4b", "gemini-2.5-flash") */
  model: z.string(),
  /** For local engines: the HTTP endpoint */
  endpoint: z.string().optional(),
  /** For cloud engines: the env var name holding the API key */
  api_env_var: z.string().optional(),
  /** What this provider can do */
  capabilities: z.array(CapabilityTag),
  /** Provider IDs this provider falls back to on failure */
  fallback_for: z.array(z.string()).default([]),
  /** Optional: Ollama API mode override */
  ollama_mode: z.enum(["chat", "completion"]).optional(),
  /** Optional: default temperature override */
  temperature: z.number().min(0).max(2).optional(),
  /** Optional: max output tokens */
  max_tokens: z.number().optional(),
});
export type Provider = z.infer<typeof ProviderSchema>;

// ──────────────────────────────────────────────
// Top-Level Agency Topology
// ──────────────────────────────────────────────

/**
 * The top-level agency topology configuration.
 * Parsed from `agency.json` at the project root.
 */
export const AgencyTopologySchema = z.object({
  agency_topology: z.object({
    /** The default tier prefix to use when no escalation is needed */
    default_tier: z.string(),
    /** Escalation strategy */
    escalation_policy: z.enum(["sequential_chain", "parallel_race", "none"]).default("sequential_chain"),
    /** Max parse/retry attempts per provider before escalating */
    max_parse_retries: z.number().default(2),
    /** Provider definitions, keyed by provider ID */
    providers: z.record(z.string(), ProviderSchema.omit({ id: true })),
  }),
});
export type AgencyTopology = z.infer<typeof AgencyTopologySchema>;
