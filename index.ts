// Re-export the public API
export { WorkspaceManager } from "./src/workspace";
export { SolverBridge } from "./src/solver";
export { LocalAgent, type LocalAgentConfig } from "./src/llm_client";
export { ArchitectClient, type ArchitectClientConfig } from "./src/architect_client";
export { AgentResponseSchema, ArchitectResponseSchema, TacticSchema, LeanTacticSchema, FormalistResponseSchema } from "./src/schemas";
export { runProverLoop } from "./src/orchestrator";
export { LeanBridge } from "./src/lean_bridge";