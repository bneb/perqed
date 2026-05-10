import { runFormalVerificationOnly } from "./src/orchestration/runner";
import { join } from "node:path";

async function main() {
  const result = await runFormalVerificationOnly(
    "Prove that for any natural number n, n + 0 = n",
    {
      apiKey: process.env.GEMINI_API_KEY || "",
      workspaceDir: join(process.cwd(), "agent_workspace"),
      maxIterations: 1,
    }
  );
  console.log("Status:", result.proofStatus);
  process.exit(0);
}
main();
