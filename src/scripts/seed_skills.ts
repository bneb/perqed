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

// ── Skill 2: Distributed Tabu Search ──────────────────────────────────────

const DISTRIBUTED_TABU_SEARCH_SKILL = `---
name: distributed_tabu_search
description: Uses Zobrist hashing to prevent Simulated Annealing workers from re-entering known sterile energy basins (glass floors) by triggering an aggressive thermal reheat.
---

# Distributed Tabu Search

## Technique

When heuristic search engines (like SA) repeatedly converge on the same local minima (glass floors),
we can map the adjacency matrix of those failures to a 64-bit Zobrist hash. By passing an array of
\`tabuHashes\` to the workers, they can incrementally compute their state hash in O(1) time and
execute an immediate thermal reheat (T = tabuPenaltyTemperature, default 3.0) if they step into a
forbidden basin.

The key insight: XOR is its own inverse. Toggling edge {u,v} costs exactly one XOR operation
regardless of graph size, so the tabu check adds zero asymptotic overhead to the inner SA loop.

Implementation lives in \`src/search/zobrist_hash.ts\` (\`ZobristHasher\`) and is wired into both
the unconstrained and circulant mutation branches of \`src/search/ramsey_worker.ts\`.

## When to Apply

Apply this skill when the \`journal.json\` shows multiple LNS/Z3 failures at the exact same minimal
energy level (e.g., multiple \`E=8\` UNSAT results on the same graph size \`n\`). Those repeated
failures indicate the SA workers keep gravitating to the same glass floor basin.

Extract the Zobrist hashes of those specific failed adjacency matrices and inject them into the
next SA run's \`tabuHashes\` array.

## Worked Example

If the journal shows \`LNS UNSAT\` at \`E=8\` for \`K_35\`, calculate the hash of that specific
failed adjacency matrix using \`ZobristHasher.computeInitial()\`, and inject it into the next run:

\`\`\`typescript
import { ZobristHasher } from "../search/zobrist_hash";
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

// Load the failed glass floor graph from the journal
const glassFloor: AdjacencyMatrix = loadFromJournal("lns_fail_n35_e8");
const hasher = new ZobristHasher(35);
const glassHash = hasher.computeInitial(glassFloor); // e.g., 14819238491823n
\`\`\`

## TypeScript Template

\`\`\`typescript
// Inside the DAG generation logic:
const tabuNode = {
  id: "sa_with_tabu",
  kind: "search",
  label: "SA search with glass floor avoidance",
  dependsOn: ["literature_review"],
  config: {
    vertices: 35,
    iterations: 500_000_000,
    workers: 8,
    // Hashes of known-sterile energy basins extracted from journal.json:
    tabuHashes: [14819238491823n, 8471923847192n],
    tabuPenaltyTemperature: 3.0,
  },
};
\`\`\`

## Key References

- Optimization by Simulated Annealing (Kirkpatrick et al., Science 1983)
- Tabu Search (Glover, ORSA Journal on Computing 1989)
- Zobrist, A. L. "A New Hashing Method with Application for Game Playing." ICCA Journal, 1990.
- \`src/search/zobrist_hash.ts\` — ZobristHasher implementation (Splitmix64 PRNG, O(1) toggleEdge)
- \`src/search/ramsey_worker.ts\` — SA loop with tabu detection in both mutation branches
`;

const TABU_SKILL_DIR = join(SKILLS_ROOT, "distributed_tabu_search");
console.log("  Writing: distributed_tabu_search/SKILL.md");

assertValidSkillFile(DISTRIBUTED_TABU_SEARCH_SKILL, "distributed_tabu_search/SKILL.md");

await mkdir(TABU_SKILL_DIR, { recursive: true });
const tabuSkillPath = join(TABU_SKILL_DIR, "SKILL.md");
await writeFile(tabuSkillPath, DISTRIBUTED_TABU_SEARCH_SKILL, "utf-8");

console.log(`✅ Written to ${tabuSkillPath}`);
console.log("\n═══════════════════════════════════════════════\n");
