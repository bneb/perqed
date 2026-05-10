/**
 * agency/index.ts — Singleton Accessor + Re-exports
 *
 * Provides a lazily-initialized global AgencyRegistry singleton
 * so all agent classes can resolve providers without explicit wiring.
 */

export { AgencyRegistry } from "./registry";
export { AgencyTopologySchema, CapabilityTag, EngineType, ProviderSchema } from "./schema";
export type { AgencyTopology, Provider } from "./schema";

import { AgencyRegistry } from "./registry";

let _instance: AgencyRegistry | null = null;

/**
 * Get the global AgencyRegistry singleton.
 * Lazily loads agency.json from the project root on first call.
 */
export function getAgencyRegistry(): AgencyRegistry {
  if (!_instance) {
    _instance = new AgencyRegistry();
  }
  return _instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetAgencyRegistry(): void {
  _instance = null;
}
