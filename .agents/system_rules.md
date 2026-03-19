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

---

> **See also**: `.cursorrules` — identity, philosophy, mathematical invariants,
> and communication protocol for the Frontier Lab Researcher persona.

---

## Rule 6: Ground Truth Principle (Surrogate Safety)

**Failure mode**: A neural network surrogate predicts a low-energy state. The system updates `memeticSeed` and `memeticSeedEnergy` with the *predicted* energy — silently poisoning the search state with an unverified value.

**Rule**: Any state variable representing ground-truth search progress (`memeticSeed`, `bestEnergy`, any tabu hash) must only be updated after **exact evaluation** by the physics engine (C++ evaluator, TypeScript `ramseyEnergy`, or Z3).

- **NEVER** use a surrogate's predicted value to update canonical state.
- After the surrogate funnel produces a candidate, call `EvaluatorRouter.evaluate({RAMSEY_CLIQUES})` on that candidate.
- Only if `exactEnergy < currentBestEnergy` do you promote the candidate.
- Log both the predicted and exact energy. Track calibration drift over time.

**Test invariant**: After the surrogate funnel executes, assert:
```typescript
expect(memeticSeedEnergy).toBe(ramseyEnergy(memeticSeed, r, s));
```

---

## Rule 7: Concurrent Pipeline Safety (Fire-and-Forget Boundaries)

**Failure mode**: A `void (async () => {...})()` fire-and-forget block mutates shared state (e.g., `memeticSeed`) while the main loop is also reading it — creating a TOCTOU race in the memetic handoff.

**Rule**: Fire-and-forget blocks are acceptable **only** for telemetry, journal writes, and JIT pre-warming where a mutation race is harmless or idempotent. For any block that mutates search state:

- Either `await` it in the main loop (preferred for state correctness), or
- Guard the mutation behind a lock/atomic (e.g., a shared `Int32Array` flag via `Atomics.compareExchange`).
- Document every fire-and-forget block with a comment stating *why* the race is safe.
- **NEVER** swallow errors silently in fire-and-forget blocks that touch canonical state. Use `console.error` at minimum; use typed error channels in production paths.

---

## Rule 8: Algebraic Fallback Protocol (Wiles Mode)

**Failure mode**: Wiles Mode (LLM Algebraic Builder) exhausts its attempt budget, and the system terminates without leveraging the SA Island Model — discarding the best algebraic near-miss as a warm-start.

**Rule**: When any high-level reasoning mode (Wiles, MCTS, Z3-only) exhausts its budget without finding E=0:

1. **Log the transition** to the research journal (`type: "observation"`, claim explains the fallback).
2. **Preserve the best candidate** produced by the exhausted mode as `memeticSeed`.
3. **Fall through** to the next-lower mode in the hierarchy: Wiles → SA → Z3-LNS.
4. Do **not** hard-block a lower mode with a `!wilesMode` guard or equivalent flag after exhaustion.

The hierarchy is: `Wiles (algebraic) → SA Island Model (stochastic) → MicroSAT Z3-LNS (exact patch) → Lean 4 (formal proof)`. Each layer can escalate up or fall through down, but never terminates without exhausting the layers below it.

---

## Rule 9: Git Commit Message Safety

**Failure mode**: Using `git commit -m "..."` with multi-line or special-character messages (∃, →, backticks, quotes) causes zsh shell escaping errors that corrupt the commit or break the terminal.

**Rule**: **Always** write commit messages to a tmp file and use `git commit -F`.

```
# Step 1: write_to_file tool → /tmp/commit_msg.txt
# Step 2: run_command
git -C /path/to/repo add <files> && git -C /path/to/repo commit -F /tmp/commit_msg.txt && git -C /path/to/repo push
```

- Use `write_to_file` (not echo/cat/heredoc) to create the message file
- Use `git -C /path/to/repo` instead of `cd && git` to avoid shell state issues
- `-m` is only acceptable for single-line messages with no special characters
- See `.agents/skills/git-commit/SKILL.md` for full reference
