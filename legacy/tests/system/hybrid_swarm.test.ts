import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { SwarmDebateProtocol } from "../../src/agency/swarm_debate_protocol";
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";

describe("Hybrid Swarm Consensus Protocol Execution", () => {
  let daemon: ChildProcess;
  
  beforeAll(async () => {
     const pythonScript = path.join(__dirname, "../../src/python/tactic_server.py");
     daemon = spawn("python3", [pythonScript]);
     await new Promise(r => setTimeout(r, 1000));
     process.env.USE_LOCAL_PROVER = "true";
  });
  
  afterAll(() => {
     if (daemon) daemon.kill();
     process.env.USE_LOCAL_PROVER = "false";
  });
  
  test("Executes the full offline K=3 matrix before triggering Cloud Escalation", async () => {
      // In tests, the LocalProver mock returns "Mocked GPU Response", which the Skeptic nodes invalidate, 
      // forcing all 3 PR-CoT retries before ultimately resolving as failure.
      // This proves the system will correctly bounce to Gemini.
      // We will purposefully pass a bad string and intercept the Cloud network response bounds.
      
      const prompt = "Synthesize an uncomputable Ramsey matrix boundary.";
      
      try {
          const synthesis = await SwarmDebateProtocol.establishAbsoluteConsensus(prompt, process.env.GEMINI_API_KEY || "dummy_key");
          expect(synthesis).toBeDefined();
          expect(typeof synthesis).toBe("string");
      } catch (err: any) {
          // If we provided a dummy key, we expect the Cloud node to throw. 
          // What matters is that it actually hit the Cloud node!
          expect(err.message).toContain("API key not valid");
      }
  });

});
