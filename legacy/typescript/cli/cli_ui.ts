
import type { RunConfig } from "./perqed";

export function displayConfig(config: RunConfig, configPath: string) {
  console.log("✅ ARCHITECT produced run configuration:\n");
  console.log(`  Run Name:  ${config.run_name}`);
  console.log(`  Problem:   ${config.problem_description}`);
  console.log(`  Theorem:   ${config.theorem_name}`);
  console.log(`  Budget:    ${config.max_iterations} iterations`);
  console.log(`  Signature: ${config.theorem_signature.slice(0, 100)}...`);
  console.log(`  Config:    ${configPath}`);
  console.log();
}

export async function confirmOrAbort(): Promise<void> {
  console.log("Continue with this plan? [Y/n] (or use --noconfirm to skip)");
  process.stdout.write("> ");

  const response = await new Promise<string>((resolve) => {
    const handler = (chunk: Buffer) => {
      process.stdin.removeListener("data", handler);
      process.stdin.pause();
      resolve(chunk.toString().trim().toLowerCase());
    };
    process.stdin.resume();
    process.stdin.once("data", handler);
  });

  if (response && response !== "y" && response !== "yes") {
    console.log("\n🛑 Aborted. Config saved — re-run with --config= to resume.");
    process.exit(0);
  }
  console.log();
}
