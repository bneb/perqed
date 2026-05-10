import { TrytetClient } from "./src/execution/trytet_client";

async function runTrytetIntegration() {
  console.log("==========================================");
  console.log("Trytet Engine v3.0 Integration Test");
  console.log("==========================================\n");

  const client = new TrytetClient();
  console.log("[Test] Submitting experimental Python probe to local WebAssembly sandbox...");
  
  const timerStart = Date.now();
  const result = await client.executeWasm({
    code: "print('Hello from the mathematically constrained deterministic sandbox!')",
    image: "python-3.11.wasm", // Will automatically fall back to python_mock.wasm if missing
    timeoutMs: 15000
  });
  const elapsed = Date.now() - timerStart;

  console.log(`\n[Test] Execution completed in ${elapsed}ms.`);
  console.log("--- EXECUTION PROFILE ---");
  console.log(`Status / Exit Code: ${result.exitCode}`);
  console.log(`Timed Out:          ${result.timedOut}`);
  if (result.stdout.trim()) {
    console.log(`\n[STDOUT]\n${result.stdout.trim()}`);
  }
  if (result.stderr.trim()) {
    console.log(`\n[STDERR]\n${result.stderr.trim()}`);
  }
  console.log("==========================================");
}

runTrytetIntegration().catch(console.error);
