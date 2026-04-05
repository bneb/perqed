import { LeanREPLBridge } from "../src/lean_repl";

async function main() {
  const repl = new LeanREPLBridge("/Users/kevin/projects/perqed");

  console.log("Sending import...");
  const res1 = await repl.sendCmd({ cmd: "import Mathlib\nopen Nat\n\n" });
  console.log("Res1:", res1);

  console.log("Sending theorem cmd...");
  const res2 = await repl.sendCmd({ env: res1.env, cmd: "theorem foo (n : Nat) : n + 0 = n := by\n" });
  console.log("Res2:", res2);

  // If res2 establishes a proof state and unassigned goals, we can send a tactic
  if (res2.env) {
    console.log("Sending tactic rfl...");
    const res3 = await repl.sendCmd({ env: res2.env, tactic: "rfl" });
    console.log("Res3:", res3);
  }

  repl.kill();
}

main().catch(console.error);
