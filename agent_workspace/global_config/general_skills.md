# GENERAL SKILLS

## Response Format
You MUST respond with ONLY valid JSON matching this exact schema:

```json
{
  "thoughts": "<string: your OODA loop reasoning>",
  "action": "PROPOSE_TACTIC" | "GIVE_UP" | "SOLVED",
  "code": "<string: complete, standalone Python script>"
}
```

## Rules
1. Do NOT wrap your response in ```json``` or any markdown fences. Return raw JSON only.
2. The `code` field must contain a COMPLETE Python script — no fragments, no imports missing.
3. The `action` field must be exactly one of: `PROPOSE_TACTIC`, `GIVE_UP`, `SOLVED`.
4. Use `GIVE_UP` only when you have exhausted all approaches you can think of.
5. Use `SOLVED` only when you have confirmed `unsat` from Z3 for the negated conclusion.

---

## Meta-Tactics Available to the Search Engine

The Perqed engine exposes composable search tactics that you can select via `search_config`.

### Tactic 1: Simulated Annealing (SA)
- **When to use**: Large unconstrained search spaces (2^C(n,2) graphs), no known symmetry.
- **How to invoke**: Set `search_config.problem_class = "ramsey_coloring"` (no symmetry field).
- **Strength**: Flexible, handles any graph constraint. **Weakness**: Can hit glass floors in local minima.

### Tactic 2: Circulant SA (SA + Symmetry Reduction)
- **When to use**: When the witness is likely a circulant graph (all known R(4,6), R(3,9), R(3,10) witnesses are circulant).
- **How to invoke**: Set `search_config.symmetry = "circulant"` alongside `problem_class = "ramsey_coloring"`.
- **Effect**: Reduces R(4,6) search space from 2^595 → 2^17 (131,072 states).
- **Weakness**: SA still subject to local minima even in small space.

### Tactic 3: Z3 SMT Exact Solver (PRIMARY — use this first for circulant)
- **When to use**: Any time `symmetry = "circulant"` is set. Automatically invoked before SA.
- **How it works**: Encodes the circulant Ramsey problem as SAT over 17 boolean distance variables.
  All C(N,r) + C(N,s) clique constraints are precomputed and embedded as literal clause lists.
  Z3's CDCL engine solves exactly — no local minima, no glass floors.
- **Decision flow**:
  - `SAT` → witness found, AdjacencyMatrix reconstructed, SA skipped entirely.
  - `UNSAT` → circulant space provably empty; engine falls back to unconstrained SA.
  - `timeout` → engine falls back to SA (not UNSAT — the space may still contain a witness).
- **Requirement**: Python `z3-solver` package must be installed. Engine checks availability automatically.
- **Key fact**: The Exoo (1989) R(4,6) ≥ 36 witness, if circulant, will be found in seconds.

