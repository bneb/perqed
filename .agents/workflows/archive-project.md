---
description: How to archive a completed proof project into its own self-contained directory
---

# Archive a Completed Project

Use this workflow when a proof project is finalized (paper written, Lean proofs verified, witnesses saved). This moves all problem-specific files out of the active workspace into `projects/<project-id>/`.

## Prerequisites

- All Lean proofs compile without errors
- Test suite passes (`bun test`)
- Witness data is saved in `data/`

## Steps

1. Choose a lowercase-hyphenated project ID (e.g., `torus-decomposition`, `erdos-gyarfas`).

// turbo
2. Create the project directory structure:
```bash
mkdir -p projects/<project-id>/{src,lean,paper,data}
```

3. Move problem-specific source files (SA state, hunt scripts, energy functions) into `projects/<project-id>/src/`. Use `git mv` for tracked files:
```bash
git mv src/math/<problem_state>.ts projects/<project-id>/src/
git mv src/scripts/<problem_hunt>.ts projects/<project-id>/src/
```

4. Move Lean proofs:
```bash
git mv src/lean/<Problem>*.lean projects/<project-id>/lean/
```

5. Move paper and data:
```bash
git mv paper/<problem>*.tex projects/<project-id>/paper/
git mv paper/<problem>*.pdf projects/<project-id>/paper/
mv data/<problem>*.json projects/<project-id>/data/
mv data/<problem>*.log projects/<project-id>/data/
```

6. Move problem-specific tests:
```bash
git mv tests/<problem>*.test.ts projects/<project-id>/src/
```

7. Fix import paths in all moved files. Common patterns:
   - `../math/optim/SimulatedAnnealing` → `../../../src/math/optim/SimulatedAnnealing`
   - `../math/<old_name>` → `./<new_name>`
   - `../../data` → `../data`

8. Update `.gitignore` if the project has tracked PDFs:
```
!projects/<project-id>/paper/<name>.pdf
```

9. Update `README.md` project structure and any links pointing to moved files.

10. Update blog post and website links to use `projects/<project-id>/` paths.

11. If the old paths were shared externally (emails, arXiv, etc.), keep a backward-compatible copy at the old path.

// turbo
12. Run the test suite to verify nothing is broken:
```bash
bun test
```

// turbo
13. Verify Lean proofs compile from new location:
```bash
lake env lean projects/<project-id>/lean/<Proof>.lean
```

14. Add a `projects/<project-id>/README.md` with reproduction instructions.

15. Commit and push:
```bash
git add -A && git commit -F /tmp/commit_msg.txt && git push
```
