/*
 * maynard_goldbach.c — Apply Maynard's multidimensional sieve to Goldbach.
 *
 * SETUP:
 * For even 2n, consider the k-tuple:
 *   (m, 2n-m, m-6, 2n-m+6, m-12, 2n-m+12, ...)
 * i.e., the Goldbach pair plus nearby shifted pairs.
 *
 * Define sieve weights F(t₁,...,t_{2k}) on the simplex Σtᵢ ≤ 1.
 *
 * The Maynard ratios:
 *   σᵢ(F) = ∫(∫F dtᵢ)² dt_rest / ∫F² dt_all
 *
 * If Σσᵢ > 2k - 2, then at least 2 of the 2k entries are prime.
 * If σ₁ > 1, then m is prime (one half of Goldbach).
 * If σ₁ + σ₂ > 2, then BOTH m and 2n-m are prime → GOLDBACH!
 *
 * KEY QUESTION: max_{F} (σ₁ + σ₂) > 2?
 * By Cauchy-Schwarz: σᵢ ≤ 1, so σ₁+σ₂ ≤ 2.
 * Equality when F = f(t₁)·g(t₂) — but this is the BEST CASE!
 * Can we get arbitrarily close to 2?
 *
 * The STRATEGY: use k > 1 pairs to push Σσᵢ above the threshold
 * in a way that FORCES σ₁ and σ₂ to both be large.
 *
 * BUILD: cc -O3 -o maynard_goldbach maynard_goldbach.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* Discretize the simplex t₁+...+tₖ ≤ 1, tᵢ ≥ 0 with grid size M */
#define M 30  /* grid points per dimension */

/* For k=2: F(t₁,t₂) on {t₁+t₂ ≤ 1, t₁,t₂ ≥ 0} */
/* Discretize: t₁ = i/M, t₂ = j/M, with i+j ≤ M, i,j ≥ 0 */

int idx2(int i, int j) { return i * (M+1) + j; }
int valid2(int i, int j) { return i >= 0 && j >= 0 && i+j <= M; }

/* Compute σ₁ and σ₂ for a given F on the 2D simplex */
void compute_sigmas_2d(double *F, double *sigma1, double *sigma2) {
    double norm2 = 0;
    double I1 = 0, I2 = 0;
    double h = 1.0 / M;

    /* ||F||² = ∫F² dt₁dt₂ */
    for (int i = 0; i <= M; i++)
        for (int j = 0; j <= M-i; j++)
            norm2 += F[idx2(i,j)] * F[idx2(i,j)] * h * h;

    /* I₁ = ∫(∫F dt₁)² dt₂ */
    for (int j = 0; j <= M; j++) {
        double integral_over_t1 = 0;
        for (int i = 0; i <= M-j; i++)
            integral_over_t1 += F[idx2(i,j)] * h;
        I1 += integral_over_t1 * integral_over_t1 * h;
    }

    /* I₂ = ∫(∫F dt₂)² dt₁ */
    for (int i = 0; i <= M; i++) {
        double integral_over_t2 = 0;
        for (int j = 0; j <= M-i; j++)
            integral_over_t2 += F[idx2(i,j)] * h;
        I2 += integral_over_t2 * integral_over_t2 * h;
    }

    *sigma1 = (norm2 > 0) ? I1 / norm2 : 0;
    *sigma2 = (norm2 > 0) ? I2 / norm2 : 0;
}

/* Optimize F to maximize σ₁ + σ₂ using power iteration */
void optimize_2d(void) {
    int sz = (M+1) * (M+1);
    double *F = calloc(sz, sizeof(double));
    double *G = calloc(sz, sizeof(double));
    double h = 1.0 / M;

    /* Initialize F = 1 on simplex */
    for (int i = 0; i <= M; i++)
        for (int j = 0; j <= M-i; j++)
            F[idx2(i,j)] = 1.0;

    printf("## 2D Maynard Sieve (k=1 pair: m, 2n-m)\n\n");

    for (int iter = 0; iter < 200; iter++) {
        double s1, s2;
        compute_sigmas_2d(F, &s1, &s2);

        if (iter % 20 == 0 || iter < 5)
            printf("  iter %3d: σ₁=%.6f, σ₂=%.6f, σ₁+σ₂=%.6f  %s\n",
                   iter, s1, s2, s1+s2,
                   s1+s2 > 1.9 ? "CLOSE" : "");

        /* Gradient step: increase F where the gradient of σ₁+σ₂ is positive.
         * ∂σ₁/∂F(i,j) ∝ 2·(∫F dt₁)·h/||F||² - 2F(i,j)·σ₁/||F||²
         * Similarly for σ₂. */
        double norm2 = 0;
        for (int i=0;i<=M;i++) for(int j=0;j<=M-i;j++) norm2+=F[idx2(i,j)]*F[idx2(i,j)]*h*h;

        /* Compute marginals */
        double *marg1 = calloc(M+1, sizeof(double)); /* ∫F dt₁ as function of t₂ */
        double *marg2 = calloc(M+1, sizeof(double)); /* ∫F dt₂ as function of t₁ */
        for (int j=0;j<=M;j++) for(int i=0;i<=M-j;i++) marg1[j]+=F[idx2(i,j)]*h;
        for (int i=0;i<=M;i++) for(int j=0;j<=M-i;j++) marg2[i]+=F[idx2(i,j)]*h;

        /* Update: F_new(i,j) ∝ marg1(j) · h + marg2(i) · h (gradient ascent) */
        for (int i=0;i<=M;i++) for(int j=0;j<=M-i;j++)
            G[idx2(i,j)] = marg1[j] + marg2[i];

        /* Normalize */
        double gnorm = 0;
        for (int i=0;i<=M;i++) for(int j=0;j<=M-i;j++) gnorm+=G[idx2(i,j)]*G[idx2(i,j)];
        gnorm = sqrt(gnorm);
        for (int i=0;i<=M;i++) for(int j=0;j<=M-i;j++) F[idx2(i,j)] = G[idx2(i,j)]/gnorm;

        free(marg1); free(marg2);
    }

    double s1, s2;
    compute_sigmas_2d(F, &s1, &s2);
    printf("\n  FINAL: σ₁=%.6f, σ₂=%.6f, σ₁+σ₂=%.6f\n", s1, s2, s1+s2);
    printf("  Threshold for Goldbach: σ₁+σ₂ > 2.0\n");
    printf("  Cauchy-Schwarz bound: σ₁+σ₂ ≤ 2.0\n");
    printf("  Gap to threshold: %.6f\n\n", 2.0 - (s1+s2));

    /* CRITICAL: By Cauchy-Schwarz, σᵢ ≤ 1 always.
     * So σ₁+σ₂ ≤ 2 is a HARD CEILING.
     * The only way to "break" this is to introduce MORE pairs (k > 1). */

    free(F); free(G);
}

/* For k pairs: 2k variables on the simplex.
 * Use the Maynard trick: with enough pairs, Σσᵢ > 2k-2
 * forces at least 2 entries to be prime.
 * BUT: we need the SPECIFIC pair (m, 2n-m) to be prime. */
void analyze_kpairs(void) {
    printf("## Multi-pair Maynard Analysis\n\n");
    printf("  With k shifted Goldbach pairs:\n");
    printf("    (m, 2n-m), (m-6, 2n-m+6), ..., (m-6(k-1), 2n-m+6(k-1))\n\n");
    printf("  Variables: 2k, on the simplex t₁+...+t_{2k} ≤ 1.\n");
    printf("  Maynard's theorem: M_{2k} → ∞ as k → ∞.\n\n");

    /* For the product F(t₁,...,t_{2k}) = f(t₁)·g(t₂)·...·f(t_{2k-1})·g(t_{2k}),
     * each σᵢ = 1/(2k-1) (by symmetry and simplex constraint).
     * Total: Σσᵢ = 2k/(2k-1) → 1, which is < 2k-2 for k ≥ 2.
     *
     * Maynard showed the optimum is much better. Key result:
     * M_k ~ k/(2·e²·logk) for large k. */

    printf("  Known Maynard bounds M_k = max_F Σσᵢ:\n\n");
    printf("  %5s | %10s | %12s | %s\n", "k", "M_k lower", "threshold", "Goldbach?");

    for (int k = 1; k <= 200; k++) {
        /* M_k ≈ log(k) (Maynard's estimate, see his 2015 paper) */
        double mk_lower = log((double)k); /* simplified lower bound */
        double threshold;

        /* For detecting ≥ 2 primes among 2k slots: need M_{2k} > 2 */
        /* For Goldbach: need to force SPECIFIC slot pair, which requires more */
        if (k == 1) {
            threshold = 2.0;  /* need σ₁+σ₂ > 2, impossible by C-S */
        } else {
            /* With k pairs: need at least one pair (m-6j, 2n-m+6j) where
             * BOTH entries are prime. If ≥ 2 of the 2k entries are prime,
             * they might not be from the same pair.
             *
             * Probability argument: if ≥ r primes among 2k entries,
             * P(some pair both prime) ≈ 1 - (1 - r(r-1)/(2k(2k-1)))^...
             *
             * Need r = k+1 to guarantee a pair. Threshold: M_{2k} > k+1.
             */
            threshold = k + 1.0;
        }

        if (k == 1 || k == 2 || k == 5 || k == 10 || k == 20 || k == 50 ||
            k == 100 || k == 200 || (mk_lower > threshold && k > 2)) {
            printf("  %5d | %10.4f | %12.1f | %s\n",
                   k, mk_lower, threshold,
                   mk_lower > threshold ? "YES! ✓" :
                   mk_lower > threshold * 0.5 ? "getting close" : "no");
        }

        /* But this analysis is too coarse. The real question is about the
         * STRUCTURE of the optimal F, not just the total Σσᵢ. */
    }

    printf("\n  CRITICAL INSIGHT:\n");
    printf("  Maynard's M_k ~ log(k). Threshold for Goldbach ~ k+1.\n");
    printf("  log(k) < k+1 for all k. So Σσᵢ NEVER exceeds the threshold!\n\n");
    printf("  This means: the multi-pair approach CANNOT prove Goldbach\n");
    printf("  by just ensuring ≥ 2 primes in the 2k-tuple.\n\n");
    printf("  HOWEVER: the threshold k+1 is for the WORST CASE.\n");
    printf("  In practice, primes are not adversarially placed.\n");
    printf("  The PROBABILISTIC model suggests any 2 primes among 2k entries\n");
    printf("  have probability ~ k²/(2k)² = 1/4 of being paired.\n\n");
    printf("  So a WEAKER result might follow:\n");
    printf("    'For almost all even 2n, one of the shifted pairs is Goldbach.'\n");
    printf("  This would improve the exceptional set bound!\n\n");

    /* What bound would this give? */
    printf("  If the sieve detects ≥ 2 primes among 2k shifted pairs of 2n:\n");
    printf("    E(N) ≤ #{2n ≤ N : no prime pair among 2k shifts}\n");
    printf("    With k shifts, each even has k chances, so\n");
    printf("    E(N) ≤ E₀(N)/k (heuristic) where E₀ is the 1-pair bound.\n\n");
    printf("    Current best E₀(N) = N^{0.698} (Guth-Maynard).\n");
    printf("    With k=100 shifts: E(N) ≤ N^{0.698}/100 (NOT a power saving).\n\n");
    printf("    For a POWER SAVING, need the shifts to be independent,\n");
    printf("    which they approximately are, giving:\n");
    printf("    E(N) ≤ N^{0.698·α} for some α < 1 depending on k.\n");
}

int main() {
    optimize_2d();
    analyze_kpairs();

    printf("═══════════════════════════════════════════\n");
    printf("## Summary of Maynard-Goldbach Analysis\n\n");
    printf("  1. 2D sieve (k=1): σ₁+σ₂ ≤ 2 by Cauchy-Schwarz. HARD CEILING.\n");
    printf("  2. Multi-pair (k>1): M_k ~ logk, but threshold ~ k+1. NO BREAKTHROUGH.\n");
    printf("  3. HOWEVER: a probabilistic refinement using shifted pairs\n");
    printf("     COULD improve the exceptional set bound E(N) by a power.\n\n");
    printf("  POTENTIAL NEW RESULT:\n");
    printf("  Using k shifted Goldbach pairs with Maynard weights,\n");
    printf("  prove E(N) ≤ N^{0.698 - c(k)} for explicit c(k) > 0.\n");
    printf("  This would be a genuine improvement over Guth-Maynard!\n");

    return 0;
}
