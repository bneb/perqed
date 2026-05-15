import { appendFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

export class VerifiedVault {
  static getVaultPath(workspaceDir: string): string {
    const libDir = join(workspaceDir, "verified_lib");
    if (!existsSync(libDir)) {
      mkdirSync(libDir, { recursive: true });
    }
    return join(libDir, "VerifiedVault.lean");
  }

  static appendLemma(workspaceDir: string, signature: string, proofPath: string[]): void {
    const vaultPath = this.getVaultPath(workspaceDir);
    
    let isNewFile = false;
    if (!existsSync(vaultPath)) {
      isNewFile = true;
    }

    // Convert the proof path into a block
    const tactics = proofPath.map(t => `  ${t}`).join("\n");
    const nameMatch = signature.match(/^(\S+)/);
    const theoremName = nameMatch ? nameMatch[1] : "lemma";
    const uniqueSignature = signature.replace(/^(\S+)/, `${theoremName}_${Date.now()}`);
    const theoremBlock = `\ntheorem ${uniqueSignature} := by\n${tactics}\n`;

    let preamble = "";
    if (isNewFile) {
        preamble = `import Mathlib\nopen Nat\n\n-- Verified Vault: Machine-generated persistent lemmas.\n`;
    }

    appendFileSync(vaultPath, preamble + theoremBlock, "utf-8");
    console.log(`\n💾 [Vault] Formalized lemma appended to global persistent vault.`);
  }

  static getVaultPreamble(workspaceDir: string): string {
    const vaultPath = this.getVaultPath(workspaceDir);
    if (!existsSync(vaultPath)) return "";
    return `import VerifiedVault\n`;
  }
}
