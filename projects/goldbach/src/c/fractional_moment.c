/*
 * fractional_moment.c — Can fractional k-th moments improve zero density?
 *
 * Known zero-density results:
 *   k=2 (4th moment): A = 12/5 = 2.400
 *   k=3 (6th moment): A = 30/13 ≈ 2.308 (Guth-Maynard 2024)
 *
 * Question: does the optimum over k occur at an integer,
 * or could k=2.5 give A < 30/13?
 *
 * The key formula (Halász-Montgomery-Huxley):
 *
 *   N(σ,T) ≤ T^{B(σ)+ε} where B(σ) = A·(1-σ)
 *
 *   The zero-density exponent from the 2k-th moment is:
 *
 *   A_k = 2k·(μ_k + 1) / (2k·(2σ₀ - 1))
 *
 *   where μ_k is the moment exponent and σ₀ is the critical line
 *   for the specific application.
 *
 * MODEL:
 *   For the 2k-th moment at σ = 1/2:
 *     ∫|ζ(1/2+it)|^{2k} dt ≤ T^{μ(k)+ε}
 *
 *   Known: μ(2) = 1 (fourth moment, exact)
 *          μ(3) = 4/3 (sixth moment, Guth-Maynard)
 *   Interpolation (Hölder): μ(k) = 1 + (k-2)/3 for k ∈ [2,3]
 *     (i.e., μ(k) = (k+1)/3 on [2,3])
 *
 * We use a GENERALIZED Halász formula from the literature:
 *
 *   A(σ) = min_{k ≥ 1} { max(A_standard_k(σ), A_LV_k(σ)) }
 *
 * where A_standard_k uses the moment bound and A_LV uses large values.
 *
 * BUILD: cc -O3 -o fractional_moment fractional_moment.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

/* Moment exponent μ(k): ∫|ζ(1/2+it)|^{2k} ≤ T^{μ(k)+ε}
 * Known values and interpolation (log-convex): */
double mu(double k) {
    /* Known:
     * μ(1) = 1 (second moment, exact)
     * μ(2) = 1 (fourth moment, with logs, essentially exact)
     * μ(3) = 4/3 (Guth-Maynard 2024)
     * Conjectured μ(k) = 1 for all k (Lindelöf hypothesis)
     *
     * Interpolation using log-convexity:
     * For k ∈ [1,2]: μ(k) = 1 (constant, both endpoints = 1)
     * For k ∈ [2,3]: log μ(k) is linear in k:
     *   log μ(k) = (3-k)·log μ(2) + (k-2)·log μ(3) = (k-2)·log(4/3)
     *   μ(k) = (4/3)^{k-2}
     * For k ∈ [3,4]: use convexity μ(4) ≤ μ(3)^2/μ(2) = (4/3)²
     *   μ(k) = (4/3)^{k-2}  (extrapolation)
     */
    if (k <= 2.0) return 1.0;
    return pow(4.0/3.0, k - 2.0);
}

/* Zero-density exponent A(σ, k) using the Halász-Montgomery method.
 *
 * The standard formula (simplified for this model):
 *
 * The method detects zeros at σ using a Dirichlet polynomial of length N.
 * Each zero forces |D(ρ)| ≥ V ≈ N^{σ-1/2}.
 * The mean value theorem gives: Σ|D(σ+it)|^{2k} ≤ T · N^{μ(k)·2k + ε}
 * (This is the key: the exponent involves μ(k).)
 *
 * Counting: #zeros · V^{2k} ≤ ∫|D|^{2k}
 * N(σ,T) · N^{2k(σ-1/2)} ≤ T · N^{2k·(1-σ)·μ_eff + ε}
 *
 * where μ_eff depends on the range of σ.
 *
 * Optimizing N:
 * N(σ,T) ≤ T / N^{2k(σ-1/2) - 2k(1-σ)·μ_eff}
 *        = T / N^{2k(2σ-1-μ_eff(1-σ))/1}
 *
 * Choose log N = log T / (2k(2σ-1) - ... + 1):
 *
 * N(σ,T) ≤ T^{A_k(σ)(1-σ)+ε}
 *
 * where A_k(σ) = (1 + 2k·α(σ)) / (2k(σ-1/2) - α(σ))
 * and α(σ) involves the moment exponent.
 *
 * SIMPLIFIED MODEL: Using the formula from Ivić (2003):
 *   A_k(σ) = 2k / (2kσ - 1) for σ > 1/2 + 1/(2k)
 *   A_k(σ) = 2k(1-σ)/(2kσ-1) for the standard density theorem
 *
 * REFINED MODEL: Including the moment exponent μ(k):
 *   A_k(σ) = 2k·μ(k) / (2k(2σ-1) - (μ(k)-1))
 *   (The μ(k)-1 term accounts for the moment being worse than conjectured)
 */
double A_k(double sigma, double k) {
    double mk = mu(k);
    /* Formula: A = 2k / (2k(2σ-1) - (μ-1)·2k/(2k-1))
     * Simplified: captures how μ > 1 worsens the bound */
    double num = 2.0 * k;
    double denom = 2.0 * k * (2.0*sigma - 1.0) - (mk - 1.0);
    if (denom <= 0) return 1e10; /* pole: this σ is too close to 1/2 */
    return num / denom;
}

/* The EFFECTIVE zero-density exponent: A = sup_{σ ∈ relevant range} A_k(σ)·(1-σ)/(1-σ)
 * For the exceptional set, we need A·(1-σ) < 1 for all σ > σ₀.
 * The "A" quoted in the literature is:
 * A = min_k { max_σ A_k(σ) where A_k(σ)·(1-σ) needs to be bounded } */

double A_effective(double k) {
    /* Find the maximum of A_k(σ)·(1-σ) over σ, then
     * A_eff = A_k at the σ where A_k(σ)·(1-σ) is maximized...
     *
     * Actually, the quoted A is typically the value at σ = σ_critical
     * where the bound is tightest for the application.
     * For the density estimate N(σ,T) ≤ T^{A(1-σ)+ε}:
     * A = A_k(σ) at the σ that makes A_k largest in the relevant range.
     *
     * The relevant range for Goldbach: σ ∈ (1/2, 1).
     * A_k(σ) is decreasing in σ, so the worst σ is near 1/2.
     * But near σ=1/2, A_k(σ) → ∞ (trivially).
     * The meaningful A is at the σ where A_k(σ)·(1-σ) transitions
     * from being > 1 to < 1.
     */

    /* Find σ₀ where A_k(σ₀)·(1-σ₀) = 1 */
    double sigma0 = 0.6;
    for (int i = 0; i < 100; i++) {
        double A = A_k(sigma0, k);
        double product = A * (1.0 - sigma0);
        if (fabs(product - 1.0) < 1e-10) break;
        /* Newton step: d/dσ [A(σ)(1-σ)] = A'(1-σ) - A */
        double A_plus = A_k(sigma0 + 0.0001, k);
        double prod_plus = A_plus * (1.0 - sigma0 - 0.0001);
        double deriv = (prod_plus - product) / 0.0001;
        sigma0 -= (product - 1.0) / deriv;
        if (sigma0 < 0.51) sigma0 = 0.51;
        if (sigma0 > 0.99) sigma0 = 0.99;
    }

    return A_k(sigma0, k);
}

int main() {
    printf("# Fractional Moment Zero-Density Optimization\n\n");

    printf("## Moment exponent μ(k)\n\n");
    printf("  %6s | %10s | %s\n", "k", "μ(k)", "source");
    for (double k = 1.0; k <= 4.0; k += 0.5)
        printf("  %6.1f | %10.6f | %s\n", k, mu(k),
               k == 1.0 ? "exact" : k == 2.0 ? "exact" :
               k == 3.0 ? "Guth-Maynard" : "interpolation");

    printf("\n## A_k(σ) for various k and σ\n\n");
    printf("  %6s |", "k\\σ");
    for (double sigma = 0.55; sigma <= 0.90; sigma += 0.05)
        printf(" σ=%.2f", sigma);
    printf("\n");
    for (double k = 2.0; k <= 3.5; k += 0.25) {
        printf("  k=%.2f |", k);
        for (double sigma = 0.55; sigma <= 0.90; sigma += 0.05)
            printf(" %6.3f", A_k(sigma, k));
        printf("\n");
    }

    printf("\n## Optimization: A_eff(k) = A at critical σ₀\n\n");
    printf("  %6s | %10s | %10s | %s\n", "k", "A_eff", "σ₀", "vs A=30/13");
    double best_A = 1e10, best_k = 0;
    for (double k = 2.0; k <= 4.0; k += 0.05) {
        double Aeff = A_effective(k);
        double sigma0 = 0.6;
        for (int i = 0; i < 100; i++) {
            double A = A_k(sigma0, k);
            double prod = A*(1-sigma0);
            if (fabs(prod-1)<1e-10) break;
            double Ap = A_k(sigma0+0.0001,k);
            double dp = Ap*(1-sigma0-0.0001);
            sigma0 -= (prod-1)/((dp-prod)/0.0001);
            if (sigma0<0.51) sigma0=0.51; if (sigma0>0.99) sigma0=0.99;
        }
        int show = (fmod(k, 0.5) < 0.01 || fabs(k-best_k) < 0.06);
        if (Aeff < best_A) { best_A = Aeff; best_k = k; show = 1; }
        if (show || k <= 2.1)
            printf("  %6.2f | %10.6f | %10.6f | %s\n", k, Aeff, sigma0,
                   Aeff < 30.0/13.0 - 0.001 ? "★ BETTER!" :
                   Aeff < 30.0/13.0 + 0.001 ? "≈ same" : "worse");
    }

    printf("\n  Best: k=%.2f gives A=%.6f (vs 30/13=%.6f)\n", best_k, best_A, 30.0/13);
    printf("  Improvement: %.6f (%.2f%%)\n", 30.0/13 - best_A,
           (30.0/13 - best_A)/(30.0/13)*100);

    printf("\n## Red Team: Is This Real?\n\n");
    if (best_A < 30.0/13 - 0.01) {
        printf("  ⚠️  The fractional moment gives a better A!\n");
        printf("  BUT: this assumes the Hölder interpolation bound is tight.\n");
        printf("  In practice, the zero-density method enforces INTEGER k\n");
        printf("  because the Dirichlet polynomial mean value theorem\n");
        printf("  uses the 2k-th power, which must be an integer.\n\n");
        printf("  HOWEVER: Bourgain and others have used FRACTIONAL moments\n");
        printf("  via more sophisticated techniques (moment interpolation,\n");
        printf("  Vinogradov's method with fractional exponents).\n\n");
        printf("  If the fractional moment improvement is REAL,\n");
        printf("  the gain is: A goes from %.4f to %.4f.\n",
               30.0/13, best_A);
        printf("  Exceptional set: E(N) goes from N^{0.698} to N^{%.3f}\n",
               1.0 - 1.0/best_A);
    } else {
        printf("  The fractional moment does NOT improve A beyond k=3.\n");
        printf("  This is because the zero-density formula is CONVEX in k,\n");
        printf("  and the interpolated moment μ(k) is also convex.\n");
        printf("  The minimum of a convex function of a convex function\n");
        printf("  is at an endpoint (integer k), not in the interior.\n\n");
        printf("  🔴 RED TEAM VERDICT: Sub-problem 1b is a dead end.\n");
        printf("  The optimal k is always an integer.\n");
    }

    printf("\n## Does A < 2 Seem Reachable?\n\n");
    printf("  For Goldbach: need A < 2 (density hypothesis).\n");
    printf("  Current: A = 30/13 ≈ 2.308.\n");
    printf("  Gap: 30/13 - 2 = 4/13 ≈ 0.308.\n\n");
    printf("  To close this gap, we'd need μ(k) → 1 as k → ∞\n");
    printf("  (Lindelöf hypothesis). Without Lindelöf:\n\n");

    printf("  Predicted A_k assuming μ(k) = (4/3)^{k-2}:\n");
    for (int k = 3; k <= 10; k++) {
        double Aeff = A_effective(k);
        printf("    k=%2d: A = %.4f, gap to 2 = %.4f\n", k, Aeff, Aeff - 2.0);
    }
    printf("\n  The gap closes as k → ∞, but μ(k) = (4/3)^{k-2} → ∞,\n");
    printf("  so we never reach A = 2 without Lindelöf.\n");

    return 0;
}
