import { TrytetClient } from "./src/execution/trytet_client";
async function run() {
  const t = new TrytetClient();
  const res = await t.executeWasm({
    code: "from z3 import *; print('ok')",
    image: "python-3.11.wasm",
    timeoutMs: 5000,
  });
  console.log("Exit:", res.exitCode);
  console.log("Out:", res.stdout);
  console.log("Err:", res.stderr);
}
run();