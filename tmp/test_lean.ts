import { LeanBridge } from "../src/lean_bridge";

async function run() {
  const bridge = new LeanBridge();
  await bridge.initialize();
  const source = `There exists a prime q (e.g., q could be 37 or 41), an elliptic curve E defined over the finit
:= by sorry

def main : IO Unit := IO.println "SYNTAX_CHECK"
`;
  console.time("executeLean");
  const result = await bridge.executeLean(source, 5000);
  console.timeEnd("executeLean");
  console.log("Result:", result);
  await bridge.shutdown();
}

run();
