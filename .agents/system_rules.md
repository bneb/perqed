---
description: Core system rules for the Perqed autonomous proof agent, extracted from the m=4/m=6 torus decomposition sprint. These rules encode hard-won HITL interventions into automated guardrails.
---

# Perqed System Rules

These rules are mandatory for all Lean 4 formal verification work, stochastic search engine development, and performance-critical hot loops. They encode five failure modes discovered during the torus decomposition project where default LLM heuristics produced incorrect, slow, or formally unsound results.

---

## Rule 1: Trusted Computing Base Minimization

**Failure mode**: Defaulting to `native_decide` because it "just works" for large decidable propositions, without recognizing that it compiles Lean to C and executes via an external C compiler — adding GCC/Clang to the TCB.

**Rule**: In formal verification code intended for publication or archival:

- **NEVER** use `native_decide`. Always use `decide`.
- **NEVER** use `#eval` to "verify" a proposition. `#eval` runs in the interpreter, not the kernel.
- All verification must pass through Lean's trusted kernel. The kernel is the only arbiter of truth.
- If `decide` times out, increase `maxHeartbeats` — do not switch to `native_decide`.
- If a proposition is too large for `decide` even with generous heartbeats, decompose it into smaller lemmas (see Rule 2).

**Definitions must be Prop-valued and computable**:
- Use bounded finite iteration (`apply_n`, explicit `Fin` recursion) instead of abstract reachability (`Relation.TransGen`, `Relation.ReflTransGen`).
- Every definition the kernel must evaluate must reduce to concrete computation over `Fin n`, `Bool`, or `Nat` — never over typeclasses that require synthesis at scale.

---

## Rule 2: Typeclass Synthesis Budget

**Failure mode**: Writing a single master theorem as a massive nested conjunction over a product type (e.g., `∀ v : Fin m × Fin m × Fin m, P v ∧ Q v ∧ R v`), causing the `Decidable` instance synthesizer to recurse beyond its depth limit.

**Rule**: For decidable propositions over large finite types:

- **Shatter** master theorems into isolated, independently verified lemmas.
- Each lemma should verify one property per color/dimension (e.g., `edgesValid_red`, `disjoint_red_green`, `orbit_length_blue`).
- Compose the final result by referencing the individual lemmas, not by re-evaluating the sub-proofs.
- If `decide` fails with a `maxRecDepth` or `maxHeartbeats` error, the fix is always decomposition — never increasing recursion depth.
- Rule of thumb: if a single `decide` must check > 10,000 cases, split it.

---

## Rule 3: Zero Allocation in Hot Loops

**Failure mode**: Using `state.clone()`, `Array.from()`, `[...spread]`, `new Map()`, or similar allocating operations inside a mutation-evaluate-revert loop running at > 100K iterations/second.

**Rule**: In stochastic search engines (SA, MCTS, genetic algorithms):

- **NEVER** allocate inside the hot loop. No `.clone()`, no `.slice()`, no object construction.
- Use the **apply/revert** pattern: mutate state in place, evaluate, then revert if rejected. The revert operation must be O(1) and allocation-free.
- Store rollback data in pre-allocated, fixed-size buffers — not in dynamically created objects.
- Before optimizing hyperparameters, profile allocation rate. If GC pause time exceeds 5% of wall-clock time, you have an allocation bug, not a hyperparameter problem.
- **Test invariant**: Run the incremental evaluator in parallel with a full-recompute evaluator for the first N iterations. Assert exact agreement. N ≥ 10,000.

---

## Rule 4: Energy Function Soundness

**Failure mode**: Designing an energy function that has false zeros — states where E = 0 but the solution is invalid. In the torus case: counting only directed cycles without checking in-degree uniformity.

**Rule**: Before tuning any search hyperparameters:

- **Prove** (informally but rigorously) that E(σ) = 0 ⟺ σ is a valid solution. Write this proof down in a comment above the energy function.
- Identify necessary *and* sufficient conditions. A common trap: checking a necessary condition (cycle count) while missing a sufficient one (in-degree uniformity).
- If the search stalls at a nonzero energy plateau (e.g., E = 2):
  - First, determine what E = 2 *means* topologically/combinatorially.
  - Then decide whether hyperparameter tuning, a custom mutation operator, or a reheat strategy is appropriate.
  - Do NOT treat energy plateaus as generic "the search needs more time" problems. Diagnose before tuning.

---

## Rule 5: Separate Search from Verification

**Failure mode**: Conflating the search engine's "validation" with formal proof, or attempting to make the search engine itself formally verified.

**Rule**:

- The search engine is an **oracle**. It is allowed to be fast, heuristic, and unverified. Its only job is to produce a candidate witness.
- The formal proof is the **verifier**. It is allowed to be slow. Its only job is to check the witness.
- The oracle and verifier must share **zero code**. The witness is passed as raw data (arrays, integers), not as shared data structures or function calls.
- Never weaken the verifier to accommodate the oracle. If the oracle produces a witness the verifier can't check, fix the oracle.
- When writing the verifier, assume the oracle is adversarial — the proof must be valid even if the witness were hand-crafted by an attacker.
