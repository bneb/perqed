/**
 * Sprint 13b: Seed LanceDB with Foundational Mathlib Premises
 *
 * Embeds 5 foundational Lean 4 theorems using Ollama's nomic-embed-text
 * and writes them to the local LanceDB vector store.
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Model pulled: `ollama pull nomic-embed-text`
 *
 * Usage:
 *   bun run src/scripts/seed_mathlib.ts
 */

import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase, type Premise } from "../embeddings/vector_store";

const seedData = [
  {
    id: "nat_add_zero",
    theoremSignature: "theorem nat_add_zero (n : Nat) : n + 0 = n",
    successfulTactic: "rfl",
    type: "MATHLIB" as const,
  },
  {
    id: "nat_add_succ",
    theoremSignature:
      "theorem nat_add_succ (n m : Nat) : n + Nat.succ m = Nat.succ (n + m)",
    successfulTactic: "rfl",
    type: "MATHLIB" as const,
  },
  {
    id: "nat_add_comm",
    theoremSignature:
      "theorem nat_add_comm (n m : Nat) : n + m = m + n",
    successfulTactic:
      "induction n with | zero => simp [nat_add_zero] | succ n' ih => simp [nat_add_succ, ih]",
    type: "MATHLIB" as const,
  },
  {
    id: "nat_mul_zero",
    theoremSignature: "theorem nat_mul_zero (n : Nat) : n * 0 = 0",
    successfulTactic:
      "induction n with | zero => rfl | succ n' ih => simp [Nat.mul, ih]",
    type: "MATHLIB" as const,
  },
  {
    id: "nat_mul_comm",
    theoremSignature:
      "theorem nat_mul_comm (n m : Nat) : n * m = m * n",
    successfulTactic:
      "induction n with | zero => simp [nat_mul_zero] | succ n' ih => simp [Nat.mul, ih, nat_add_comm]",
    type: "MATHLIB" as const,
  },
];

async function main() {
  console.log("🌱 Seeding LanceDB with foundational Mathlib premises...\n");

  const embedder = new LocalEmbedder();
  const db = new VectorDatabase();
  await db.initialize();

  const premises: Premise[] = [];

  for (const item of seedData) {
    process.stdout.write(`  Embedding [${item.id}]... `);
    const vector = await embedder.embed(item.theoremSignature);

    if (vector.length === 0) {
      console.log("❌ Failed to embed. Is Ollama running with nomic-embed-text?");
      console.log("  Try: ollama pull nomic-embed-text && ollama serve");
      process.exit(1);
    }

    premises.push({
      id: item.id,
      theoremSignature: item.theoremSignature,
      successfulTactic: item.successfulTactic,
      vector,
    });
    console.log(`✅ (${vector.length}-dim)`);
  }

  console.log(`\n💾 Writing ${premises.length} premises to LanceDB...`);
  await db.addPremises(premises);
  console.log("🎉 Seeding complete! The Librarian is ready.\n");

  // Verification: search for a test query
  console.log("🔍 Verification — searching for 'nat addition commutativity'...");
  const testVector = await embedder.embed("nat addition commutativity");
  const matches = await db.search(testVector, 3);

  if (matches.length > 0) {
    console.log(`  Found ${matches.length} match(es):`);
    matches.forEach((m, i) => {
      console.log(`  [${i + 1}] ${m.theoremSignature}`);
      console.log(`      Tactic: \`${m.successfulTactic}\``);
    });
  } else {
    console.log("  ⚠️ No matches found. Vector search may need debugging.");
  }
}

main().catch((err) => {
  console.error("💥 Seed script failed:", err);
  process.exit(1);
});
