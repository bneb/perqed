import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export class TrytetInstaller {
  /**
   * Resolves the path to the `tet` binary, actively building it via `cargo`
   * if it doesn't exist and the neighboring repository is available.
   */
  static resolveBinary(): string {
    // 1. Env Override
    if (process.env.TRYTET_BIN_PATH && existsSync(process.env.TRYTET_BIN_PATH)) {
      return process.env.TRYTET_BIN_PATH;
    }

    const cwd = process.cwd();
    const localBinDir = join(cwd, ".bin");
    const localBinFile = join(localBinDir, "tet");

    // 2. Local Embedded Cache
    if (existsSync(localBinFile)) {
      return localBinFile;
    }

    // 3. Global System Path
    const whichAttempt = spawnSync("which", ["tet"]);
    if (whichAttempt.status === 0 && whichAttempt.stdout.length > 0) {
      return whichAttempt.stdout.toString().trim();
    }

    // 4. Fallback Auto-Builder
    const trytetDir = join(cwd, "..", "trytet");
    const cargoToml = join(trytetDir, "Cargo.toml");

    if (existsSync(cargoToml)) {
      console.log(`[TrytetInstaller] Global 'tet-core' not found. Compiling native Wasm engine via Cargo from ${trytetDir}...`);
      
      const buildResult = spawnSync("cargo", ["build", "--release", "--bin", "tet-core"], {
        cwd: trytetDir,
        stdio: "inherit",
      });

      if (buildResult.status !== 0) {
        throw new Error(`[TrytetInstaller] Failed to compile Trytet via cargo. Exit code: ${buildResult.status}`);
      }

      if (!existsSync(localBinDir)) {
        mkdirSync(localBinDir, { recursive: true });
      }

      const releaseBin = join(trytetDir, "target", "release", "tet-core");
      if (existsSync(releaseBin)) {
        copyFileSync(releaseBin, localBinFile);
        console.log(`[TrytetInstaller] Successfully embedded native engine at ${localBinFile}`);
        return localBinFile;
      } else {
         throw new Error(`[TrytetInstaller] Cargo build succeeded but target/release/tet-core was not found.`);
      }
    }

    throw new Error(
      "[TrytetInstaller] CRITICAL: The `tet` binary could not be found, and ../trytet does not exist to build from source. Please ensure Trytet is installed."
    );
  }
}
