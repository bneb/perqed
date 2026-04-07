import { test, expect, mock } from "bun:test";

mock.module("readline/promises", () => {
    return {
        createInterface: () => ({
            question: async () => "intro h; exact h",
            close: () => {}
        })
    };
});

import { HumanAgent } from "../src/agents/human";

test("HumanAgent conforming to interface and returning typed input", async () => {
    const agent = new HumanAgent();
    // In human mode, the context string is printed but we just return the tactical payload
    const res = await agent.generateMove("Current goal: ⊢ 1 = 1");
    
    expect(res).toBeDefined();
    expect(res.tactics![0].code).toBe("intro h; exact h");
    expect(res.action).toBe("PROPOSE_TACTICS");
});
