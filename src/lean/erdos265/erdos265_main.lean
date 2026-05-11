/-!
# Erdős 265: Project Status and Dependency Map

## Target Theorem
`erdos_265` in `problem_statement.lean`:
  The sum Σ 1/s_k (Sylvester sequence) is irrational.

## Proof Architecture

We pursue two independent strategies. Neither is complete.

### Strategy A: The Mahler Method (`transcendence_dichotomy.lean`)

The Sylvester sum Σ 1/s_k equals F(1/2) where F is a Mahler function
satisfying F(w) = w/(1+w) + F(φ(w)).  Nishioka's theorem (1996) says
that if F is not a rational function, then F(α) is transcendental
for algebraic α with |α| < 1.

```
erdos_265
  ← [GAP] F(1/2) = Σ 1/s_k        (not formalized)
  ← erdos265_irrational_Rs          (proven mod Nishioka)
      ← F_is_not_rational           ✅ PROVEN (continuity + density + FTA)
      ← nishioka_transcendence      ⚠️  sorry (Mathlib gap: transcendence theory)
```

**What's proven**: Any continuous function satisfying the Mahler equation
is not a rational function (P/Q). This uses:
  1. F·Q = P everywhere (continuous extension past poles via density)
  2. Q has no roots (coprimality contradiction)
  3. Q is constant (FTA over ℂ)
  4. 0 = 1/2 at the fixed point w = 1

**What's not proven**:
  - Nishioka's theorem (deep transcendence theory, not in Mathlib)
  - The connection Σ 1/s_k = F(1/2) (series convergence + Mahler identity)
  - That the actual Mahler function is continuous (it's analytic, but not formalized)

### Strategy B: The Integer Squeeze (`residual_growth_bound.lean` + `irrational_L.lean`)

If `limsup s_k^{1/2^k} > 1`, then the integer residuals tracking the
tail sum are forced to converge, hence become eventually constant (integer
rigidity), hence bounded.  Bounded residuals trigger an algebraic collapse.

```
erdos_265
  ← [GAP] Connection to limsup bound   (not formalized)
  ← limsupGtOneImpliesResidualBounded   (proven mod sorry)
      ← asymptoticSqueezeLimit           ⚠️  sorry (real analysis limit)
      ← integerConvergenceRigidity       ✅ PROVEN
      ← eventuallyConstBounded           ✅ PROVEN
  ← inductiveCollapse                    ✅ PROVEN (but hypothesis never satisfied)
      ← [GAP] ExactCoupling holds        (not formalized)
```

**What's proven**:
  - Integer sequences converging in ℝ are eventually constant
  - The algebraic collapse identity (conditional on ExactCoupling)

**What's not proven**:
  - `asymptoticSqueezeLimit` (the limit of tailResidual under doubly-exponential growth)
  - That `ExactCoupling` ever holds for the Sylvester sequence
  - The connection from bounded residuals to the original problem

## Sorry/Gap Inventory

| Gap | Location | Type | Difficulty |
|-----|----------|------|------------|
| `nishioka_transcendence` | transcendence_dichotomy.lean:60 | sorry | Hard (Mathlib gap) |
| `asymptoticSqueezeLimit` | residual_growth_bound.lean:75 | sorry | Medium (real analysis) |
| `sylvester_erdos_identity` | problem_statement.lean | sorry | Easy (telescoping) |
| F(1/2) = Σ 1/s_k | not stated | gap | Medium (series convergence) |
| F is continuous | assumed as hypothesis | gap | Medium (analytic function theory) |
| ExactCoupling holds | not stated | gap | Unknown |
| Connection to limsup | not stated | gap | Hard |
-/
