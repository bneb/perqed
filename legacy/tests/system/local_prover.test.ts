import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { LocalProverClient } from "../../src/agency/local_prover_client";
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";

describe("Native Pipeline: DeepSeek VRAM Socket Bridge", () => {
  let daemon: ChildProcess;
    
  beforeAll(async () => {
     // Spin up dummy server bridging into UNIX scope natively
     const pythonScript = path.join(__dirname, "../../src/python/tactic_server.py");
     daemon = spawn("python3", [pythonScript]);
     
     // Give the python system bound 1 second to create `/tmp/tactic.sock`
     await new Promise(r => setTimeout(r, 1000));
  });
  
  afterAll(() => {
     if (daemon) {
         daemon.kill();
     }
  });

  test("Queries the Tactic Daemon generating instant proxy fallbacks natively", async () => {
      process.env.USE_LOCAL_PROVER = "true";
      const payload = await LocalProverClient.queryTacticDaemon("induction n with d hd", "generation");
      
      expect(payload).toBeDefined();
      expect(typeof payload).toBe("string");
      
      // Ensure the proxy properly unwraps the text execution block
      const deserialized = JSON.parse(payload);
      expect(deserialized.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(deserialized.lean_tactics[0].tactic).toBe("sorry");
  });

  test("Mock GenAI interface passes correct error correction overrides", async () => {
      process.env.USE_LOCAL_PROVER = "true";
      const dummyGenAi = LocalProverClient.createMockGenAI() as any;
      const response = await dummyGenAi.models.generateContent({ contents: "Fix syntax error at line 4" });
      
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Mocked GPU Response");
  });
});
