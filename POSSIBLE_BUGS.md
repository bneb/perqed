# Possible Bugs in `perqed` Codebase

This document summarizes potential bugs and issues found via static analysis (TypeScript compiler) and codebase keyword searches (TODO/FIXME/BUG).

## 1. TypeScript Compilation Errors
The following errors were identified in the TypeScript build step (`tsc_errors_summary.txt`), indicating potential runtime bugs or strict typing violations:

### 1.1 Undefined/Null Safety Issues
* **`TS18048` & `TS2532`**: Variables `'best'`, `'c'`, `'p'` and 37 other object references are possibly `undefined`. These can lead to runtime crashes if not guarded properly.

### 1.2 Missing Modules/Names
* **`TS2304`**: Cannot find name `'self'`. (6 occurrences)
* **`TS2307`**: Cannot find module `'../math/cycle_finder'` or its corresponding type declarations.
* **`TS2307`**: Cannot find module `'../math/graph6'` or its corresponding type declarations.

### 1.3 Type Incompatibilities & Missing Properties
* **`TS2322`**: `RoutingSignals` interface mismatch. The provided object has properties like `identicalErrorCount` and `totalTacticianCalls` that are not assignable.
* **`TS2339`**: Property `'draftPaper'` does not exist on type `'ScribeAgent'`. (3 occurrences)
* **`TS2739`**: `ProofNode` objects are missing required properties: `'splitType'` and `'value'`.
* **`TS2353`**: Object literal specifies unknown property `'onInit'` for type `'RamseySearchConfig'`.

### 1.4 Mocking & Fetch Issues
* **`TS2352` & `TS2741`**: Numerous type conversion issues when mocking `fetch`. The mock implementations are missing the `'preconnect'` property required by `typeof fetch`.

### 1.5 Access Modifiers & Arguments
* **`TS2673`**: Constructor of class `'EvaluatorRouter'` is private and is being incorrectly accessed from outside the class declaration. (13 occurrences)
* **`TS2554`**: Incorrect number of arguments passed to functions (Expected 1, got 2; Expected 1-2, got 3).

### 1.6 Implicit 'Any' Types
* **`TS7006`**: Parameters `'a'`, `'adj'`, `'s'` implicitly have an `'any'` type.

---

## 2. Codebase TODOs and FIXMEs
Several `TODO` comments exist indicating incomplete logic or temporary workarounds:

* **`src/librarian/auto_curriculum.ts`** (L203)
  * `// TODO: write to verified_lib/` - Missing persistence logic for verified theorems.
* **`src/agents/formalist_extension.ts`** (L84)
  * `-- TODO: Replace with Tactician spray or manual proof` - Hardcoded or missing proof step needs automation replacement.

---

## 3. Historic Bugs (Monitored in Tests)
The following bugs have been identified in comments and tests, suggesting they are historically fragile areas. If regressions occur, these areas should be checked:

* **Librarian Bugs** (`src/librarian/librarian_utils.ts` & `tests/librarian.test.ts`):
  * *Bug 1:* Inconsistent absolute DB path used between seeder and `executeRun()`.
  * *Bug 2:* Type-aware rendering was missing/incorrect (`[Paper]` for ARXIV vs `[Lemma]` for MATHLIB).
  * *Bug 3:* `ArxivLibrarian.count()` implementation issues with the zero vector queries and metadata sidecars.
  * *Bug 4:* Raw prompt normalization was failing, stripping code blocks before embedding generation.
  * *Bug 5:* Vector search offline fallback (`seed_literature.json`) mechanism failures.
* **VDW Orchestrator / Z3 Island Search Bugs** (`src/search/vdw_orchestrator.ts`):
  * *Bug 1:* Z3 firing when `bestE=0` (witness already found), causing a restart storm.
  * *Bug 2:* Stagnation restarts firing when global best energy is `0`.
  * *Bug 3:* Islands mistakenly restarting themselves when they were the global best.
  * *Bug 4:* Z3 firing repeatedly on unchanged partitions, wasting resources.
* **Partition Energy Bug** (`tests/partition_energy.test.ts`):
  * Rule parsing with missing `return` statements generated `undefined` and returned false `E=0` witnesses.
