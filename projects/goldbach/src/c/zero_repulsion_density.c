/*
 * zero_repulsion_density.c — RMT Zero Repulsion → Zero Density
 *
 * THE IDEA (genuinely different from everything before):
 *
 * All previous approaches treat zeros INDEPENDENTLY:
 *   "How big can |F(ρ)| be for ONE zero ρ?"
 *
 * This approach uses the JOINT distribution:
 *   "Given zero repulsion, how MANY zeros can have Re(ρ) > σ?"
 *
 * Zero repulsion (Montgomery 1973): the pair correlation of ζ zeros
 * near the critical line is:
 *   R₂(α) = 1 - (sin(πα)/(πα))² + δ(α)
 *
 * This means: the probability of two zeros within distance r is
 * proportional to r² (not r as for independent points).
 *
 * For zero DENSITY: if we have N_σ zeros with Re(ρ) > σ in [T, 2T],
 * the repulsion forces them to be SEPARATED. This gives a packing
 * constraint: at most ~V/r² zeros fit in a box of volume V, where
 * r is the repulsion scale.
 *
 * THIS IS A SPHERE PACKING PROBLEM IN THE CRITICAL STRIP!
 *
 * The key connection: determinantal point processes have EXACT
 * formulas for gap probabilities (Fredholm determinants), which
 * give the probability of large gaps (= many zeros).
 *
 * BUILD: cc -O3 -o zero_repulsion_density zero_repulsion_density.c -lm
 */
#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

/* GUE pair correlation */
double R2(double alpha) {
    if (fabs(alpha) < 1e-10) return 0;  /* repulsion at 0 */
    double x = M_PI * alpha;
    double sinc = sin(x)/x;
    return 1 - sinc*sinc;
}

/* In a determinantal PP with kernel K, the expected number of points
 * in an interval [a,b] is ∫_a^b K(x,x) dx = (b-a) · ρ (avg density).
 * The VARIANCE is ∫∫ K(x,y)² dx dy = ∫∫ (sin(πρ(x-y))/(πρ(x-y)))² dxdy
 * For an interval of length L (in units of mean spacing):
 * Var(N_L) ≈ (2/π²) logL + C  (logarithmic! Much slower than Poisson = L) */
double gue_variance(double L) {
    /* Var(N) for interval of length L mean spacings in GUE */
    /* From Mehta: Var ≈ (2/π²)(logL + 1 + γ_E - log(2π)) for large L */
    if (L < 1) return L*(1-L);  /* small interval */
    return (2.0/(M_PI*M_PI)) * (log(L) + 1.0 + 0.5772 - log(2*M_PI));
}

int main() {
    printf("# Zero Repulsion → Zero Density: RMT Bridge\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 1. The Sphere Packing Analogy\n\n");

    printf("  Classical: N(σ,T) = #{ρ = β+iγ : β > σ, |γ| ≤ T}\n\n");

    printf("  Without repulsion (independent zeros):\n");
    printf("    Zeros are Poisson-distributed\n");
    printf("    Var(N) = E(N) = ρ·V (density × volume)\n");
    printf("    Fluctuations: N can be much larger than average\n\n");

    printf("  With GUE repulsion (Montgomery's conjecture):\n");
    printf("    Zeros repel: P(gap < r) ~ r² (not r)\n");
    printf("    Var(N) = (2/π²)log(N) ≪ N  (logarithmic!)\n");
    printf("    Fluctuations: N is VERY concentrated around its mean\n\n");

    printf("  ★ KEY INSIGHT: GUE variance grows logarithmically.\n");
    printf("    For Poisson: Var = Mean. For GUE: Var = (2/π²)log(Mean).\n");
    printf("    This means: the actual N(σ,T) is VERY close to its\n");
    printf("    expected value, with sub-polynomial fluctuations.\n\n");

    /* ═══════ Compute variance comparison ═══════ */
    printf("  Variance comparison (interval with k expected zeros):\n\n");
    printf("  %8s | %12s | %12s | %s\n",
           "E(N)", "Var(Poisson)", "Var(GUE)", "GUE/Poisson");

    double expected[] = {10, 100, 1000, 10000, 100000, 1e6, 1e10, 0};
    for (int i = 0; expected[i] > 0; i++) {
        double k = expected[i];
        double var_poi = k;
        double var_gue = gue_variance(k);
        printf("  %8.0f | %12.1f | %12.4f | %.6f\n",
               k, var_poi, var_gue, var_gue/var_poi);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. What Does This Mean for N(σ,T)?\n\n");

    printf("  N(σ,T) is roughly the number of zeros in a strip.\n");
    printf("  Current best: N(σ,T) ≤ T^{A(1-σ)+ε}  (GM: A=30/13).\n\n");

    printf("  With GUE repulsion:\n");
    printf("    E[N(σ,T)] = some function of σ,T (unknown exactly)\n");
    printf("    Var[N(σ,T)] ≈ (2/π²) log(E[N]) ≈ (2/π²) A(1-σ) logT\n\n");

    printf("  So: N(σ,T) = E[N] ± O(√(log(E[N])))\n");
    printf("      = E[N] · (1 ± O(√(loglogT)/√E[N]))\n\n");

    printf("  The RELATIVE fluctuation → 0 as T → ∞!\n");
    printf("  This means: N(σ,T) is asymptotically DETERMINISTIC.\n\n");

    printf("  🔴 SELF RED TEAM:\n");
    printf("    This is the FLUCTUATION, not the MEAN.\n");
    printf("    GUE repulsion constrains Var(N), not E(N).\n");
    printf("    We still need to know E[N(σ,T)].\n");
    printf("    If E[N(σ,T)] = T^{A(1-σ)}, GUE doesn't change A.\n");
    printf("    It just says N(σ,T) ≈ T^{A(1-σ)} with tiny fluctuations.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 3. Can Repulsion LOWER the Mean?\n\n");

    printf("  The mean E[N(σ,T)] comes from the DENSITY of zeros.\n");
    printf("  For the FULL zero ensemble on Re(s) = 1/2:\n");
    printf("    density ≈ (1/2π) logT (number per unit height)\n\n");

    printf("  For zeros with Re(ρ) > σ:\n");
    printf("    The density depends on HOW zeros drift off the line.\n");
    printf("    Classical: bounded by the large values estimate.\n\n");

    printf("  GUE repulsion says: zeros near the critical line REPEL\n");
    printf("  zeros trying to drift to Re(ρ) > σ. This is because\n");
    printf("  a zero at σ+it is 'surrounded' by on-line zeros that\n");
    printf("  push it back toward σ = 1/2.\n\n");

    printf("  QUANTIFYING: In a GUE model with N eigenvalues,\n");
    printf("  the probability of an eigenvalue at distance d from\n");
    printf("  the edge is ~ exp(-cN²d²) (Tracy-Widom).\n\n");

    printf("  For ζ: the 'edge' is σ = 1/2. The 'distance' is σ - 1/2.\n");
    printf("  The number of eigenvalues N ≈ (T/2π)logT.\n\n");

    double T = 1e6;
    double NN = T/(2*M_PI) * log(T);
    printf("  At T = 10⁶: N ≈ %.0f\n", NN);
    printf("  Tracy-Widom: P(eigenvalue at distance d) ~ exp(-cN²d²)\n");
    printf("  For σ = 0.6: d = 0.1, N²d² ≈ %.0e → exponentially rare!\n",
           NN*NN*0.01);
    printf("  For σ = 0.51: d = 0.01, N²d² ≈ %.0e → still huge!\n\n",
           NN*NN*0.0001);

    printf("  ★ If ζ zeros follow GUE edge statistics, then:\n");
    printf("    N(σ,T) ~ exp(-c(σ-1/2)² · (T logT)²)\n");
    printf("  This is ASTRONOMICALLY smaller than T^{A(1-σ)}!\n\n");

    printf("  In fact, this would give:\n");
    printf("    N(σ,T) ≤ exp(-c(σ-1/2)² · (logT)⁴)\n");
    printf("  which is sub-polynomial in T for any fixed σ > 1/2.\n\n");

    printf("  This would PROVE the Density Hypothesis — and more!\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 4. 🔴 RED TEAM: Why This Doesn't Work\n\n");

    printf("  ISSUE 1: Montgomery's pair correlation is CONJECTURAL.\n");
    printf("    It's only proved for test functions with support\n");
    printf("    in [-1, 1]. For larger support: unproven.\n");
    printf("    Using it to prove zero-density is circular.\n\n");

    printf("  ISSUE 2: GUE statistics are for zeros ON the critical line.\n");
    printf("    Off-line zeros (Re(ρ) > 1/2) are NOT modeled by GUE.\n");
    printf("    The GUE model assumes ALL zeros are on the line.\n");
    printf("    Applying Tracy-Widom to off-line zeros is a MODEL,\n");
    printf("    not a theorem.\n\n");

    printf("  ISSUE 3: Tracy-Widom is about the LARGEST eigenvalue.\n");
    printf("    In random matrix theory, TW describes the edge.\n");
    printf("    For ζ: the 'edge' would be σ = 1 (trivial bound)\n");
    printf("    or σ = 1/2 (if RH is true). The analog is unclear.\n\n");

    printf("  ISSUE 4: N²d² comparison is wrong.\n");
    printf("    ζ has infinitely many zeros. N → ∞ with T.\n");
    printf("    GUE with N eigenvalues has edge fluctuations ~ N^{-2/3}.\n");
    printf("    For ζ: the 'N' scale is ~ T logT, so edge fluctuation\n");
    printf("    is ~ (T logT)^{-2/3}. This is the scale at which\n");
    printf("    individual zeros might drift from σ=1/2.\n");
    printf("    But N(σ,T) counts zeros at FIXED σ > 1/2, not at\n");
    printf("    the fluctuating edge. These are different quantities.\n\n");

    printf("  🔴 VERDICT: The RMT → density argument ASSUMES RH-type\n");
    printf("    behavior (all zeros near σ=1/2) and then deduces\n");
    printf("    density bounds from it. This is CIRCULAR.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 5. What WOULD Make This Work?\n\n");

    printf("  The argument becomes non-circular if we can prove:\n");
    printf("    'ζ zeros satisfy LOCAL GUE statistics at scale δ'\n");
    printf("  for δ = 1/logT (the mean spacing).\n\n");

    printf("  This is PARTIALLY known:\n");
    printf("  • Montgomery (1973): pair correlation ∝ 1-(sinπα/πα)²\n");
    printf("    for test functions supported in [-1,1]. PROVED.\n");
    printf("  • Hejhal (1994): triple correlation matches GUE.\n");
    printf("    PROVED (for restricted support).\n");
    printf("  • Rudnick-Sarnak (1996): n-level correlation matches GUE.\n");
    printf("    PROVED (for restricted support).\n\n");

    printf("  What's MISSING:\n");
    printf("  • Pair correlation for UNRESTRICTED support\n");
    printf("  • GAP probabilities (Fredholm determinants)\n");
    printf("  • Connection between ON-LINE statistics and OFF-LINE zeros\n\n");

    printf("  The last point is crucial: even perfect GUE statistics\n");
    printf("  for zeros ON σ=1/2 don't directly constrain OFF-LINE zeros.\n");
    printf("  The functional equation relates ρ to 1-ρ̄, but doesn't\n");
    printf("  prevent zeros from being off-line in the first place.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 6. A CONDITIONAL Result: GUE → Density Hypothesis\n\n");

    printf("  THEOREM (conditional, probably known):\n");
    printf("  IF the zeros of ζ satisfy full GUE statistics\n");
    printf("  (pair correlation with unrestricted support),\n");
    printf("  THEN the Density Hypothesis holds.\n\n");

    printf("  PROOF SKETCH:\n");
    printf("  1. Full GUE ⟹ P(gap ≥ L) = det(I - K_L) ~ e^{-cL²}\n");
    printf("     where K_L is the sine kernel on [-L/2, L/2].\n");
    printf("  2. N(σ,T) counts zeros in [σ,1]×[0,T].\n");
    printf("     Each such zero has imaginary part γ, and near γ\n");
    printf("     there must be a gap of size ≥ (σ-1/2)·logT in the\n");
    printf("     sequence of ON-LINE zero spacings (Jensen's formula).\n");
    printf("  3. By GUE gap probability: P(gap ≥ L) ~ e^{-cL²}.\n");
    printf("     Number of opportunities: T·logT/(2π).\n");
    printf("     Expected number of large gaps: T·logT·e^{-c(σ-1/2)²log²T}\n");
    printf("  4. For σ > 1/2 fixed: this is sub-polynomial → DH.\n\n");

    printf("  🟡 This IS genuinely interesting, but:\n");
    printf("  (a) It requires the FULL GUE conjecture (unproven)\n");
    printf("  (b) Step 2 (gap → off-line zero) needs careful justification\n");
    printf("  (c) It's likely known to experts (Montgomery, Soundararajan)\n\n");

    printf("  ★ POTENTIAL CONTRIBUTION:\n");
    printf("  If we can formalize the chain:\n");
    printf("    Restricted pair correlation (Montgomery, PROVED)\n");
    printf("    → partial gap bounds\n");
    printf("    → partial zero-density improvement\n");
    printf("  this would be a GENUINE new result.\n\n");

    printf("  The key question: does RESTRICTED pair correlation\n");
    printf("  (support in [-1,1]) give ANYTHING for large gaps?\n\n");

    /* Actually compute what restricted support gives */
    printf("  Montgomery's theorem with support in [-1,1]:\n");
    printf("    Var(N_L) = (2/π²)logL + O(1) for SMOOTH test functions\n");
    printf("    supported in [-1,1].\n\n");

    printf("  For a raw count in an interval of L mean spacings:\n");
    printf("    E(N_L) = L\n");
    printf("    Var(N_L) ≤ (2/π²)logL + C (CONDITIONAL on full GUE)\n");
    printf("    Var(N_L) ≤ cL (UNCONDITIONAL, from mean value theorems)\n\n");

    printf("  The GAP between cL and (2/π²)logL is the improvement\n");
    printf("  that GUE statistics would give.\n\n");

    printf("  For zero density: N(σ,T) is related to zeros in a strip.\n");
    printf("  With L ≈ (σ-1/2)·logT (number of mean spacings in the strip),\n");
    printf("  the GUE variance is (2/π²)log((σ-1/2)logT) ≈ loglogT.\n");
    printf("  The Poisson variance is (σ-1/2)·logT.\n\n");

    printf("  N(σ,T) - E[N] = O(√(loglogT))  (GUE)\n");
    printf("  N(σ,T) - E[N] = O(√((σ-1/2)logT))  (Poisson)\n\n");

    printf("  GUE gives fluctuations √(loglogT) vs √((σ-1/2)logT).\n");
    printf("  This is a MASSIVE improvement in fluctuation control,\n");
    printf("  but doesn't change the MEAN.\n\n");

    printf("  ★★ THE REAL QUESTION: Can zero repulsion lower the MEAN?\n");
    printf("  This requires: a mechanism where repulsion PREVENTS\n");
    printf("  zeros from drifting to Re(ρ) > σ.\n");
    printf("  In RMT: eigenvalue rigidity (Erdős-Yau) shows eigenvalues\n");
    printf("  are 'locked' near their classical positions.\n");
    printf("  For ζ: this would lock zeros to σ = 1/2 → RH.\n");
    printf("  But proving eigenvalue rigidity for ζ IS proving RH.\n");

    return 0;
}
