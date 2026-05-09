import { AgentFactory, type SpecialistAgent, type SpecialistResponse } from "../../src/agents/factory";
import type { AgentRole, RoutingSignals } from "../../src/types";

export class MockAgent implements SpecialistAgent {
  readonly role: AgentRole;
  private handler: (context: string) => Promise<SpecialistResponse>;
  calls: string[] = [];

  constructor(role: AgentRole, handler: (context: string) => Promise<SpecialistResponse>) {
    this.role = role;
    this.handler = handler;
  }

  async generateMove(context: string): Promise<SpecialistResponse> {
    this.calls.push(context.slice(0, 100));
    return this.handler(context);
  }
}

export class MockAgentFactory extends AgentFactory {
  private agents: Map<string, MockAgent> = new Map();

  constructor(handlers: Record<string, (context: string) => Promise<SpecialistResponse>>) {
    super({ geminiApiKey: "mock" });
    for (const [role, handler] of Object.entries(handlers)) {
      this.agents.set(role, new MockAgent(role as AgentRole, handler));
    }
  }

  override getAgent(role: AgentRole, signals: RoutingSignals): SpecialistAgent {
    const agent = this.agents.get(role);
    if (!agent) {
      // Return a dummy agent if not mocked, to prevent hitting LLM
      return new MockAgent(role, async () => ({
        thoughts: "Dummy",
        action: "GIVE_UP"
      }) as any);
    }
    return agent;
  }
}
