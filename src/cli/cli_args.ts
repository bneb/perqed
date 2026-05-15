export interface CliArgs {
  prompt?: string;
  configPath?: string;
  noconfirm: boolean;
  /** Force ARCHITECT into Wiles Mode (Conceptual Diversification) from iteration 0. */
  wiles: boolean;
  /** Override the maximum number of architect replanning pivots (default 5). */
  maxPivots: number;
  /** Run the Auto-Curriculum Daemon (autonomous research loop). */
  daemon: boolean;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args = argv;
  const promptArg = args.find((a) => a.startsWith("--prompt="));
  const promptFileArg = args.find((a) => a.startsWith("--prompt_file="));
  const configArg = args.find((a) => a.startsWith("--config="));
  const maxPivotsArg = args.find((a) => a.startsWith("--max-pivots="));
  const noconfirm = args.includes("--noconfirm");
  const wiles = true; // Default to true so Perqed operates as a generalist
  const daemon = args.includes("--daemon");

  const maxPivots = maxPivotsArg ? parseInt(maxPivotsArg.replace("--max-pivots=", ""), 10) : 5;

  // --daemon bypasses the prompt/config requirement
  if (!daemon && !promptArg && !promptFileArg && !configArg) {
    console.error("Usage:");
    console.error("  perqed --prompt=\"<problem description>\"");
    console.error("  perqed --prompt_file=<path/to/prompt.txt>");
    console.error("  perqed --config=<path/to/run_config.json>");
    console.error("  perqed --prompt=\"...\" --noconfirm");
    console.error("  perqed --prompt=\"...\" --max-pivots=1000");
    console.error("  perqed --daemon                  # Auto-Curriculum: autonomous research loop");
    process.exit(1);
  }

  let finalPrompt = promptArg?.replace("--prompt=", "");
  if (!finalPrompt && promptFileArg) {
    const fs = require("node:fs");
    const filePath = promptFileArg.replace("--prompt_file=", "");
    try {
      finalPrompt = fs.readFileSync(filePath, "utf-8").trim();
    } catch (e: any) {
      console.error(`❌ Failed to read prompt file ${filePath}: ${e.message}`);
      process.exit(1);
    }
  }

  return {
    prompt: finalPrompt,
    configPath: configArg?.replace("--config=", ""),
    noconfirm,
    wiles,
    maxPivots,
    daemon,
  };
}
