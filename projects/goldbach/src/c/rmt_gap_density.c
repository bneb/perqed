/*
 * rmt_gap_density.c — Pushing RMT: Gap Bounds → Density Improvement?
 *
 * THE SPECIFIC QUESTION:
 *   Montgomery's pair correlation (PROVED for support [-1,1], under RH)
 *   gives: Var(#{zeros in interval}) ≤ (2/π²)logL + C.
 *
 *   By Chebyshev: P(gap ≥ L mean spacings) ≤ C·logL/L².
 *   For Poisson: P(gap ≥ L) ≤ 1/L.
 *
 *   Does the improved gap bound translate to a better zero-density estimate?
 *
 *   Key chain:
 *   [Montgomery (proved, conditional on RH)]
 *     → [Variance bound on zero counts]
 *       → [Gap probability bound]
 *         → [Off-line zero → gap (via Jensen/Littlewood)]
 *           → [N(σ,T) bound]
 *             → [Better than GM's A=30/13?]
 *
 * BUILD: cc -O3 -o rmt_gap_density rmt_gap_density.c -lm
 */
#include <stdio.h>
#include <math.h>

int main() {
    printf("# RMT Gap Bounds → Zero Density: The Full Chain\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 1. Gap Probability from Pair Correlation\n\n");

    printf("  Montgomery (1973, conditional on RH):\n");
    printf("    For L mean spacings, the number of zeros N_L satisfies:\n");
    printf("    E[N_L] = L, Var(N_L) ≤ (2/π²)logL + C\n\n");

    printf("  By Chebyshev's inequality:\n");
    printf("    P(N_L = 0) = P(N_L - L ≤ -L) ≤ Var(N_L)/L²\n");
    printf("    ≤ ((2/π²)logL + C) / L²\n\n");

    printf("  Comparison of gap bounds:\n\n");
    printf("  %8s | %12s | %12s | %12s | %s\n",
           "L", "P(Poisson)", "P(GUE-Cheb)", "P(GUE-exact)", "improvement");

    double L_vals[] = {2, 5, 10, 20, 50, 100, 500, 1000, 0};
    for (int i = 0; L_vals[i] > 0; i++) {
        double L = L_vals[i];
        double p_poisson = exp(-L);         /* Poisson gap prob */
        double p_cheb = (2/(M_PI*M_PI)*log(L) + 1) / (L*L);  /* Chebyshev */
        double p_gue = exp(-M_PI*M_PI*L*L/4);  /* GUE exact (Wigner surmise) */

        printf("  %8.0f | %12.2e | %12.2e | %12.2e | %.1f×\n",
               L, p_poisson, p_cheb, p_gue,
               p_poisson > 0 ? p_cheb / p_poisson : 0);
    }

    printf("\n  Note: The Chebyshev bound is MUCH WEAKER than the true\n");
    printf("  GUE gap probability (which decays as e^{-cL²}).\n");
    printf("  Chebyshev from pair correlation gives P ∝ logL/L².\n");
    printf("  The true GUE answer (from Fredholm determinant) is e^{-cL²}.\n\n");

    printf("  🔴 The Chebyshev bound from RESTRICTED pair correlation\n");
    printf("     is polynomially decaying (1/L²), not exponentially.\n");
    printf("     This is because we only have 2-point information,\n");
    printf("     not the full determinantal structure.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 2. Off-Line Zero → Gap Connection\n\n");

    printf("  CLAIM: A zero at β+iγ (β > σ > 1/2) forces a gap\n");
    printf("  of size ≥ c(β-1/2)·logT in the on-line zero sequence.\n\n");

    printf("  WHY? By Littlewood's lemma (conditional on RH):\n");
    printf("    log|ζ(s)| = Σ_ρ log|s-ρ| + smooth terms\n");
    printf("  A zero at β+iγ contributes:\n");
    printf("    log|(1/2+it) - (β+iγ)| = log√((β-1/2)² + (t-γ)²)\n\n");

    printf("  For t near γ: this is ≈ log(β-1/2), which is LARGE negative.\n");
    printf("  The other on-line zeros ρ' = 1/2+iγ' contribute:\n");
    printf("    Σ log|t-γ'|\n");
    printf("  For this sum to compensate the large negative term,\n");
    printf("  there must be nearby on-line zeros (small |t-γ'|).\n\n");

    printf("  Actually, wait. Let me reconsider.\n\n");

    printf("  The CORRECT connection uses Jensen's formula:\n");
    printf("    N(T,T+H) ≈ (H/2π)logT + S(T+H) - S(T)\n");
    printf("  where S(T) = (1/π)arg ζ(1/2+iT).\n\n");

    printf("  An off-line zero at β+iγ causes S(t) to change by ~1\n");
    printf("  near t=γ (argument principle). This DISPLACES the count\n");
    printf("  N(T,T+H) by ±1, but doesn't create a GAP per se.\n\n");

    printf("  🔴 SELF RED TEAM:\n");
    printf("  The connection 'off-line zero → gap' is NOT direct.\n");
    printf("  An off-line zero affects the argument of ζ, not the\n");
    printf("  spacing of nearby zeros. The displacement is O(1),\n");
    printf("  not O((β-1/2)·logT).\n\n");

    printf("  The CORRECT connection is through the DENSITY of zeros:\n");
    printf("  If there are N(σ,T) off-line zeros, each 'absorbs'\n");
    printf("  one zero from the on-line count. So:\n");
    printf("    #{on-line zeros in [0,T]} ≈ (T/2π)logT - N(σ,T)\n\n");

    printf("  But this doesn't give gap bounds. It gives the MEAN.\n");
    printf("  The gap is about LOCAL fluctuations, not the mean.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 3. Red Team: The Fatal Flaw\n\n");

    printf("  The chain was:\n");
    printf("    Montgomery → gap bounds → off-line zero → N(σ,T) bound\n\n");

    printf("  🔴 FATAL FLAW: The second arrow is BACKWARDS.\n\n");

    printf("  We were trying:\n");
    printf("    OFF-LINE ZERO → forces LARGE GAP in on-line zeros\n");
    printf("    LARGE GAP is rare (by GUE) → few off-line zeros\n\n");

    printf("  But actually:\n");
    printf("    (1) Off-line zero does NOT force a large on-line gap\n");
    printf("    (2) The connection is through the mean count, not gaps\n");
    printf("    (3) Gap rarity bounds fluctuations, not the mean N(σ,T)\n\n");

    printf("  The correct logic should be:\n");
    printf("    N(σ,T) = mean + fluctuation\n");
    printf("    GUE gives: fluctuation = O(√loglogT)\n");
    printf("    So: N(σ,T) = mean + O(√loglogT)\n\n");

    printf("  The MEAN is determined by:\n");
    printf("    E[N(σ,T)] = ??? (this is what zero-density estimates bound!)\n\n");

    printf("  GUE repulsion constrains fluctuations, NOT the mean.\n");
    printf("  To bound the mean, we need large values estimates (GM).\n");
    printf("  GUE doesn't help with that.\n\n");

    printf("  🔴 VERDICT: Zero repulsion → gap bounds → density\n");
    printf("     has a BROKEN arrow. Gaps constrain fluctuations,\n");
    printf("     not the mean. The mean IS N(σ,T), which is what\n");
    printf("     we're trying to bound.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 4. Can We Save This?\n\n");

    printf("  The argument fails because repulsion constrains\n");
    printf("  FLUCTUATIONS (variance), not the MEAN (density).\n\n");

    printf("  Is there ANY way repulsion helps with the mean?\n\n");

    printf("  IN RMT: Yes! Eigenvalue RIGIDITY (Erdős-Yau 2012):\n");
    printf("    Each eigenvalue λ_i is within O(N^{-2/3+ε}/i^{1/3})\n");
    printf("    of its classical position.\n");
    printf("    This means: eigenvalues can't drift far from expected.\n\n");

    printf("  For ζ: eigenvalue rigidity would say:\n");
    printf("    Each zero γ_n is within O((logT)^{-2/3+ε}) of\n");
    printf("    the n-th zero position predicted by the smooth count.\n\n");

    printf("  This DOES constrain Re(ρ)! If γ_n is 'rigid', and the\n");
    printf("  smooth count places it on σ = 1/2, then Re(ρ_n) ≈ 1/2\n");
    printf("  with deviation O((logT)^{-2/3+ε}).\n\n");

    printf("  ★ Eigenvalue rigidity for ζ ⟹ RH up to error (logT)^{-2/3}.\n");
    printf("    This would give: N(σ,T) = 0 for σ > 1/2 + (logT)^{-2/3}.\n");
    printf("    Which is STRONGER than the Density Hypothesis!\n\n");

    printf("  🔴 BUT: Proving eigenvalue rigidity for ζ is as hard as RH.\n");
    printf("     In RMT: rigidity comes from the explicit interaction\n");
    printf("     potential V(x) = Σᵢ<ⱼ log|λᵢ-λⱼ|.\n");
    printf("     For ζ: there is no known interaction potential.\n");
    printf("     The repulsion is an OBSERVATION, not a consequence\n");
    printf("     of a known Hamiltonian.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 5. What's Left? The Unconditional Fragment\n\n");

    printf("  We can salvage a small piece:\n\n");

    printf("  UNCONDITIONAL RESULT (Goldston-Montgomery, 1987):\n");
    printf("    Σ_{0<γ≤T} (γ' - γ)² = (1 + o(1)) · T · (2π/logT)²\n");
    printf("  where γ' is the next zero above γ.\n\n");

    printf("  This says: the AVERAGE squared gap is (2π/logT)²,\n");
    printf("  i.e., gaps are typically of size ~1/logT (as expected).\n\n");

    printf("  The variance of gaps: from pair correlation (conditional):\n");
    printf("    Var(gap) = O(1/(logT)²)\n");
    printf("  So gaps are concentrated around their mean.\n\n");

    printf("  For Goldbach: the exceptional set E(x) ≤ x^{1-c/loglogx}\n");
    printf("  comes from Huxley's A = 12/5. If we could improve A,\n");
    printf("  E(x) shrinks. But GUE doesn't improve A.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 6. Final Honest Assessment\n\n");

    printf("  ┌────────────────────────────────────────────────────────┐\n");
    printf("  │ Element                     │ Status                   │\n");
    printf("  ├─────────────────────────────┼──────────────────────────┤\n");
    printf("  │ GUE → fluctuation bound     │ ✅ WORKS (conditional)   │\n");
    printf("  │ Fluctuation → density bound │ 🔴 BROKEN (wrong arrow)  │\n");
    printf("  │ Off-line zero → large gap   │ 🔴 WRONG (O(1) displace) │\n");
    printf("  │ Eigenvalue rigidity → σ≈1/2 │ ✅ but = RH (circular)  │\n");
    printf("  │ Beats GM's A=30/13          │ 🔴 NO                   │\n");
    printf("  └─────────────────────────────┴──────────────────────────┘\n\n");

    printf("  The RMT direction is BEAUTIFUL mathematics but doesn't\n");
    printf("  escape the fundamental issue: to bound N(σ,T) you need\n");
    printf("  to control the MEAN number of off-line zeros, which\n");
    printf("  requires large values estimates (not repulsion).\n\n");

    printf("  Repulsion controls FLUCTUATIONS around the mean.\n");
    printf("  GM controls the MEAN itself.\n");
    printf("  These are ORTHOGONAL contributions.\n\n");

    printf("  ★ A GENUINE (modest) contribution:\n");
    printf("    IF N(σ,T) ≤ T^{A(1-σ)} (GM), THEN by GUE:\n");
    printf("    N(σ,T) = T^{A(1-σ)} · (1 + O(√(loglogT/T^{A(1-σ)})))\n");
    printf("    i.e., the count is asymptotically EXACT.\n");
    printf("    This is a refinement of GM, not an improvement.\n\n");

    printf("  The red team's summary of 19 total approaches:\n\n");
    printf("  13 zero-density approaches → all killed\n");
    printf("  3 additive combinatorics → confirmed HL, nothing new\n");
    printf("  2 bridge attempts → notation changes / restatements\n");
    printf("  1 RMT approach → orthogonal (fluctuation ≠ mean)\n\n");

    printf("  Total approaches: 19. Genuine results: 1 Lean theorem,\n");
    printf("  1 obstruction map, 6+4 spec. No improvement to A.\n");

    return 0;
}
