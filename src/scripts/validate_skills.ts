import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSkillFile } from "../skills/skill_validator";

const root = join(import.meta.dir, "../../.agents/skills");
const skills = [
  "direct_proof",
  "proof_by_contradiction",
  "mathematical_induction",
  "proof_by_contraposition",
  "explicit_construction",
  "epsilon_delta_bounding",
  "proof_by_exhaustion",
  "bijections_and_isomorphisms",
  "polynomial_time_reductions",
  "pigeonhole_principle",
  "cantors_diagonalization",
  "probabilistic_method",
  "extremal_principle_infinite_descent",
  "invariants_and_monovariants",
  "double_counting",
  "fixed_point_arguments",
  "duality_arguments",
  "generating_functions",
  "compactness_arguments",
  "maximality_zorns_lemma",
  "local_to_global_hasse_principle",
  "analytic_continuation",
  "homological_cohomological_arguments",
  "geometric_flow_homotopy",
  "forcing_set_theory_independence",
];

let pass = 0;
let fail = 0;

for (const s of skills) {
  const path = join(root, s, "SKILL.md");
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    console.error("MISSING: " + s);
    fail++;
    continue;
  }
  const result = validateSkillFile(content);
  if (result.valid) {
    console.log("PASS: " + s);
    pass++;
  } else {
    console.error("FAIL: " + s + " -- " + result.errors.join("; "));
    fail++;
  }
}

console.log("\n" + pass + " pass, " + fail + " fail");
if (fail > 0) process.exit(1);
