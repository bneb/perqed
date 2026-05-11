/-!
# Erdős 265: Project Status and Dependency Map

## Target Theorem
`erdos_265` in `problem_statement.lean`:
  The sum Σ 1/s_k (Sylvester sequence) is irrational.

## Proof Architecture

The proof strategy is entirely based on the elegant, self-contained **Direct Liouville Irrationality Argument** (`irrational_Rs.lean`).

### Strategy A: Direct Liouville Irrationality (`irrational_Rs.lean`)

We avoid the monumental complexity of Mahler's method (Becker/Nishioka) and prove that the sequence $f = \sum 1/(b_k+1)$ is irrational directly.

The proof relies on:
1. Constructing the Least Common Multiple of denominators $D_n$.
2. Finding a telescoping bound on the tail sum.
3. Exploiting the oddness of the Sylvester sequence to prove $\gcd(D_n, b_n+1) \ge 4$.
4. Showing that the ratio $r_n = D_n / b_n$ decays geometrically.
5. Obtaining the Diophantine contradiction $0 < B_n < 1$ for an integer $B_n$.

## Sorry/Gap Inventory

| Gap | Location | Type | Difficulty | Status |
|-----|----------|------|------------|--------|
| `D_mul_S_is_int` | irrational_Rs.lean | sum | Easy | ✔️ PROVEN |
| `b_telescope` | irrational_Rs.lean | ring | Easy | ✔️ PROVEN |
| `beta_n_bound` | irrational_Rs.lean | sum | Medium | ❌ Pending |
| `b_add_one_mod_four` | irrational_Rs.lean | mod | Easy | ✔️ PROVEN |
| `eight_dvd_D` | irrational_Rs.lean | dvd | Easy | ✔️ PROVEN |
| `r_decay` | irrational_Rs.lean | ineq | Medium | ❌ Pending (Algebra verified in test script) |
| `tendsto_r` | irrational_Rs.lean | lim | Easy | ❌ Pending |
| `Rs_irrational` | irrational_Rs.lean | logic| Easy | ❌ Pending |
-/
