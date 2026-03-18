#!/usr/bin/env bun
/**
 * seed_skills.ts — Bootstrap the SKILL library.
 *
 * Writes the foundational `mathlib_premise_discovery` SKILL.md to disk.
 * This SKILL teaches the ARCHITECT to use Lean 4's native `exact?` /
 * `apply?` tactics for premise discovery rather than naive proof search.
 *
 * Usage:
 *   bun run src/scripts/seed_skills.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertValidSkillFile } from "../skills/skill_validator";

// ── Skill definition ───────────────────────────────────────────────────────

const MATHLIB_PREMISE_DISCOVERY_SKILL = `---
name: mathlib_premise_discovery
description: Uses Lean 4 native search tactics (exact?, apply?) to discover existing helper lemmas.
---

# Mathlib Premise Discovery

## Technique

Instead of proving standard identities from scratch, use Lean's native \`exact?\` or \`apply?\`
tactics to search the imported mathlib environment for a matching term.

Lean 4 has a comprehensive library of combinatorics, number theory, and graph theory results in
\`Mathlib\`. The \`exact?\` tactic searches for a closed-form proof term; \`apply?\` searches for
lemmas whose conclusion matches the current goal up to unification. Both tactics print the matching
lemma name to stdout so it can be copied into the proof.

The Perqed \`mathlib_query\` DAG node pre-filters the LanceDB mathlib_premises table using vector
similarity to surface the most semantically relevant candidates before the Lean compiler runs an
exhaustive search. This two-stage strategy (RAG shortlist + \`exact?\` verification) dramatically
reduces tactic search time.

## When to Apply

- The current proof goal is a standard algebraic identity (commutativity, associativity, etc.)
- The current goal involves a known graph theory bound (chromatic number, clique size, etc.)
- The current goal is an inequality over finite sets or natural numbers
- A previous tactic attempt reached a goal of the form \`⊢ A = B\` or \`⊢ A ≤ B\` where A, B are
  expressions built from library primitives
- Lean reports "unknown identifier" or "application type mismatch" for a lemma you're trying to use

## Worked Example

Proving \`n + 0 = n\` for natural numbers:

\`\`\`lean
example (n : Nat) : n + 0 = n := by
  exact?
  -- Lean suggests: exact Nat.add_zero n
\`\`\`

Proving a Ramsey-relevant clique monotonicity fact:

\`\`\`lean
example (G H : SimpleGraph V) (s : Set V) (hG : G.IsClique s) (hGH : G ≤ H) : H.IsClique s := by
  apply?
  -- Lean suggests: exact SimpleGraph.IsClique.mono hG hGH
\`\`\`

## Lean 4 Template

\`\`\`lean
-- Use exact? when you want a complete term
have h_helper : [TARGET_STATEMENT] := by exact?

-- Use apply? when you want to reduce the goal
apply?

-- After Lean prints the suggestion, replace the tactic:
have h_helper : [TARGET_STATEMENT] := [SUGGESTED_LEMMA] [ARGS]
rw [h_helper]
\`\`\`

## TypeScript Template

\`\`\`typescript
// DAG node config for mathlib_query + lean with contextFromNode injection:
const mathlibNode = {
  id: "mathlib_q",
  kind: "mathlib_query",
  label: "Search the mathlib_premises vector store",
  dependsOn: [],
  config: { query: "clique monotone subgraph", k: 5 },
  status: "pending",
};

const leanNode = {
  id: "lean_step",
  kind: "lean",
  label: "Verify the Ramsey bound using discovered premises",
  dependsOn: ["mathlib_q"],
  config: {
    theoremSignature: "theorem R_4_6_ge_36 : ramsey 4 6 ≥ 36",
    // Inject mathlib_query result into the LLM prompt for this node:
    contextFromNode: ["mathlib_q"],
  },
  status: "pending",
};
\`\`\`

## Key References

- Lean 4 Metaprogramming and Tactic Documentation (https://leanprover.github.io/lean4/)
- Mathlib4 library (https://leanprover-community.github.io/mathlib4_docs/)
- Buzzard, Kevin. "The Xena Project: Lean for Mathematicians." ICM Proceedings, 2022.
`;

// ── Write to disk ──────────────────────────────────────────────────────────

const SKILLS_ROOT = join(import.meta.dir, "../../.agents/skills");
const SKILL_DIR = join(SKILLS_ROOT, "mathlib_premise_discovery");

console.log("═══════════════════════════════════════════════");
console.log("  📐 PERQED — SKILL Library Seeding");
console.log("═══════════════════════════════════════════════");
console.log(`  Writing: mathlib_premise_discovery/SKILL.md`);
console.log("═══════════════════════════════════════════════\n");

// Validate content before writing (assertValidSkillFile throws on invalid)
assertValidSkillFile(MATHLIB_PREMISE_DISCOVERY_SKILL, "mathlib_premise_discovery/SKILL.md");

await mkdir(SKILL_DIR, { recursive: true });
const skillPath = join(SKILL_DIR, "SKILL.md");
await writeFile(skillPath, MATHLIB_PREMISE_DISCOVERY_SKILL, "utf-8");

console.log(`✅ Written to ${skillPath}`);
console.log("\n═══════════════════════════════════════════════\n");
