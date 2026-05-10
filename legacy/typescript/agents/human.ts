import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import type { AgentRole } from "../types";
import type { AgentResponse } from "../schemas";

export class HumanAgent {
  readonly role: AgentRole = "HUMAN";

  /**
   * Prompts the human operator via simple terminal readline to manually unblock
   * a mathematical tactic search barrier.
   */
  async generateMove(contextStr: string): Promise<AgentResponse> {
    console.log("\n========================================================");
    console.log("            🚨 HUMAN-IN-THE-LOOP OVERRIDE 🚨              ");
    console.log("========================================================");
    console.log(contextStr);
    console.log("========================================================\n");

    const rl = readline.createInterface({ input, output });
    
    // We safely pause and wait. To prevent zombie Wasm/Node processes if the human
    // forces a SIGINT (Ctrl+C), we bind an AbortController to safely close the Readline lock.
    const ac = new AbortController();
    const sigintHandler = () => {
       console.log("\n[HumanAgent] SIGINT received. Force-closing readline lock...");
       ac.abort();
    };
    process.once("SIGINT", sigintHandler);

    let answer = "sorry";
    try {
       answer = await rl.question("Enter Lean 4 Tactic > ", { signal: ac.signal });
    } catch (err: any) {
       if (err.name !== "AbortError") throw err;
    } finally {
       process.off("SIGINT", sigintHandler);
       rl.close();
    }

    return {
      thoughts: "Human explicitly commanding synthesis via interactive mode.",
      action: "PROPOSE_TACTICS",
      tactics: [
        {
          code: answer.trim(),
          informal_sketch: "Human override",
          confidence_score: 1.0,
        }
      ]
    };
  }
}
