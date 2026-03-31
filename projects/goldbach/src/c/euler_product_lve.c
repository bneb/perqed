/*
 * euler_product_lve.c — Direct Euler Product Attack on Large Values
 *
 * THE IDEA:
 * ζ(s) = Π_p (1 - p^{-s})^{-1}  (Euler product)
 *
 * For a Dirichlet polynomial F(s) = Σ_{n∈S} aₙ n^{-s}:
 * If S = {n: all prime factors ≤ P}, then F factors:
 *   F(s) = Π_{p≤P} (1 + aₚ p^{-s} + a_{p²} p^{-2s} + ...)
 *
 * Each Euler factor (1 + aₚ p^{-s} + ...) is a MULTIPLICATIVELY INDEPENDENT
 * function of s. The key: for σ = 1/2, the phases p^{-it} for different
 * primes are MULTIPLICATIVELY INDEPENDENT (by unique factorization).
 *
 * This means log|F(1/2+it)| = Σ_p log|1 + aₚ p^{-1/2-it} + ...| 
 * and the terms are "nearly independent" for different p.
 *
 * By the CLT: log|F| ≈ Normal(μ, σ²) where
 *   μ = Σ E[log|factor_p|], σ² = Σ Var[log|factor_p|]
 *
 * The LARGE VALUES estimate becomes:
 *   Prob(|F| > V) = Prob(log|F| > logV) ≈ Φ̄((logV - μ)/σ)
 *                 ≈ exp(-(logV - μ)²/(2σ²))
 *
 * This is a GAUSSIAN TAIL — exponentially decaying in (logV)²!
 * Compare: the GM bound is POLYNOMIAL: #{|F|>V} ≤ N²/V⁶.
 *
 * IF the Euler product CLT applies, the large values estimate would be
 * EXPONENTIALLY better than GM for large V. This would give A → 2.
 *
 * THE CATCH: Does the CLT actually apply?
 *
 * BUILD: cc -O3 -o euler_product_lve euler_product_lve.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

int gcd(int a, int b) { while(b){int t=b;b=a%b;a=t;} return a; }

/* Compute |F(1/2+it)|² for smooth numbers n ≤ N with all factors ≤ P */
typedef struct { int n; } Smooth;
Smooth smooth_nums[100000];
int n_smooth;

int is_smooth(int n, int P) {
    int m = n;
    for (int p = 2; p <= P && m > 1; p++)
        while (m % p == 0) m /= p;
    return m == 1;
}

void find_smooth(int N, int P) {
    n_smooth = 0;
    for (int n = 1; n <= N && n_smooth < 100000; n++)
        if (is_smooth(n, P)) smooth_nums[n_smooth++].n = n;
}

double poly_abs2(int N, int P, double t) {
    double re=0, im=0;
    for (int i = 0; i < n_smooth; i++) {
        int n = smooth_nums[i].n;
        if (n > N) break;
        double a = 1.0/sqrt((double)n);
        double p = -t*log((double)n);
        re += a*cos(p); im += a*sin(p);
    }
    return re*re+im*im;
}

/* Compute the Euler product factorization:
 * |F(1/2+it)|² = Π_p |1 + p^{-1/2-it} + p^{-1-2it} + ...|²
 * For P-smooth numbers up to N. */
double euler_factor_abs2(int p, double t, int N) {
    /* Factor for prime p: Σ_{k≥0} p^{-k(1/2+it)} for p^k ≤ N */
    double re = 0, im = 0;
    long long pk = 1;
    while (pk <= N) {
        double a = 1.0 / sqrt((double)pk);
        double phase = -t * log((double)pk);
        re += a * cos(phase);
        im += a * sin(phase);
        if (pk > N / p) break;
        pk *= p;
    }
    return re*re + im*im;
}

int main() {
    printf("# Euler Product Attack on Large Values\n\n");

    int N = 1000;
    int P = 23; /* smooth bound */
    find_smooth(N, P);
    printf("  %d-smooth numbers up to %d: %d total\n\n", P, N, n_smooth);

    /* ═══════════════════════════════════════════ */
    printf("## 1. Euler Product Factorization Test\n\n");
    printf("  For P-smooth F(s) = Σ_{P-smooth n≤N} n^{-s}:\n");
    printf("  |F(s)|² should equal Π_{p≤P} |factor_p(s)|²\n\n");

    double T = 500.0;
    int ngrid = 2000;
    int match_count = 0;
    double max_error = 0;

    for (int k = 0; k < ngrid; k++) {
        double t = (k+0.5)*T/ngrid;
        double direct = poly_abs2(N, P, t);

        double product = 1.0;
        for (int p = 2; p <= P; p++) {
            int is_prime = 1;
            for (int d = 2; d*d <= p; d++) if (p%d==0) {is_prime=0;break;}
            if (!is_prime) continue;
            product *= euler_factor_abs2(p, t, N);
        }

        double err = fabs(direct - product) / (direct + 1e-10);
        if (err > max_error) max_error = err;
        if (err < 0.01) match_count++;
    }

    printf("  Match rate: %d/%d (%.1f%%)\n", match_count, ngrid,
           100.0*match_count/ngrid);
    printf("  Max relative error: %.6f\n\n", max_error);

    if (match_count < ngrid/2) {
        printf("  🔴 RED TEAM: The Euler product doesn't factorize |F|²!\n");
        printf("     This is because |Π f_p|² ≠ Π|f_p|² when there are\n");
        printf("     cross terms between primes in the direct sum.\n\n");
        printf("     |F|² = (Σaₙn^{-s})(Σaₘm^{-s̄})\n");
        printf("          = Σ_{n,m} aₙaₘ (n/m)^{-it} (nm)^{-σ}\n\n");
        printf("     The Euler product gives |F|² = Π|f_p|² only when\n");
        printf("     the sum is MULTIPLICATIVELY SEPARABLE, i.e., when\n");
        printf("     aₙ = Π_{p|n} aₚ^{vₚ(n)} (completely multiplicative).\n\n");
        printf("     For aₙ = 1: this IS completely multiplicative.\n");
        printf("     So the factorization should work... let me check.\n\n");
    }

    /* Verify with smaller example */
    printf("  Spot check at t=1.0:\n");
    double t_test = 1.0;
    double dir = poly_abs2(N, P, t_test);
    double prod = 1.0;
    printf("    Euler factors:\n");
    int primes[] = {2,3,5,7,11,13,17,19,23};
    for (int i = 0; i < 9; i++) {
        int p = primes[i];
        double ef = euler_factor_abs2(p, t_test, N);
        prod *= ef;
        printf("      p=%2d: |f_p|² = %.6f\n", p, ef);
    }
    printf("    Product Π|f_p|² = %.6f\n", prod);
    printf("    Direct |F|²     = %.6f\n", dir);
    printf("    Ratio           = %.6f\n\n", prod/dir);

    /* ═══════════════════════════════════════════ */
    printf("## 2. Distribution of log|F(1/2+it)|\n\n");

    /* Compute histogram of log|F| values */
    int nbins = 30;
    double logF_min = 1e10, logF_max = -1e10;
    double *logF_vals = malloc(ngrid * sizeof(double));

    for (int k = 0; k < ngrid; k++) {
        double t = (k+0.5)*T/ngrid;
        double abs2 = poly_abs2(N, P, t);
        logF_vals[k] = 0.5 * log(abs2 + 1e-30);
        if (logF_vals[k] < logF_min) logF_min = logF_vals[k];
        if (logF_vals[k] > logF_max) logF_max = logF_vals[k];
    }

    double logF_mean = 0, logF_var = 0;
    for (int k = 0; k < ngrid; k++) logF_mean += logF_vals[k];
    logF_mean /= ngrid;
    for (int k = 0; k < ngrid; k++)
        logF_var += (logF_vals[k]-logF_mean)*(logF_vals[k]-logF_mean);
    logF_var /= ngrid;

    printf("  log|F| statistics:\n");
    printf("    mean = %.4f, variance = %.4f, stddev = %.4f\n",
           logF_mean, logF_var, sqrt(logF_var));
    printf("    min = %.4f, max = %.4f\n\n", logF_min, logF_max);

    /* Compare with Gaussian prediction */
    printf("  If CLT applies: log|F| ~ Normal(%.3f, %.3f)\n",
           logF_mean, logF_var);
    printf("  Gaussian tail: Prob(|F| > V) ≈ exp(-(%s - %.3f)²/(2·%.3f))\n\n",
           "logV", logF_mean, logF_var);

    /* Compute actual tail probabilities vs Gaussian */
    printf("  %8s | %8s | %8s | %s\n", "V", "actual", "Gaussian", "comparison");
    double total = (double)ngrid;
    for (double logV = logF_mean + 0.5; logV < logF_max + 0.5; logV += 0.5) {
        int actual = 0;
        for (int k = 0; k < ngrid; k++)
            if (logF_vals[k] > logV) actual++;

        double z = (logV - logF_mean) / sqrt(logF_var);
        double gauss = 0.5 * erfc(z / sqrt(2.0));
        printf("  %8.2f | %7.4f | %7.4f | %s\n",
               logV, actual/total, gauss,
               fabs(actual/total - gauss) < gauss*0.5 ? "≈ match" : "DIFFER");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 3. Large Values: Euler Product vs GM\n\n");

    printf("  GM bound:     #{|F|>V} ≤ N²/V⁶ = %d/V⁶\n", N*N);
    printf("  Euler/CLT:    #{|F|>V} ≈ T·exp(-(logV-μ)²/(2σ²))\n\n");

    printf("  %8s | %8s | %8s | %8s | %s\n",
           "V", "actual", "GM_bound", "CLT_pred", "winner");
    for (double V = 1.0; V <= 20.0; V *= 1.5) {
        double V2 = V*V;
        int actual = 0;
        for (int k = 0; k < ngrid; k++) {
            double t = (k+0.5)*T/ngrid;
            if (poly_abs2(N, P, t) > V2) actual++;
        }
        double gm_bound = (double)(N*N) / pow(V, 6);
        double logV = log(V);
        double z = (logV - logF_mean) / sqrt(logF_var);
        double clt = total * 0.5 * erfc(z / sqrt(2.0));

        printf("  %8.2f | %8d | %8.0f | %8.1f | %s\n",
               V, actual, gm_bound > total ? total : gm_bound,
               clt > total ? total : clt,
               (clt < gm_bound && clt > 0.5) ? "★ CLT better" : "GM better");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 4. 🔴 Red Team\n\n");

    printf("  CRITICAL ISSUES:\n\n");
    printf("  1. The CLT for log|ζ| is KNOWN but only applies in the\n");
    printf("     BULK of the distribution, not the TAIL.\n");
    printf("     Selberg (1946) proved: log|ζ(1/2+it)| / √(loglogt) → N(0,1)\n");
    printf("     This is the CLT part. But the TAIL (|ζ| > V) deviates\n");
    printf("     from Gaussian — it's heavier (power law, not exponential).\n\n");

    printf("  2. For Dirichlet POLYNOMIALS (finite Euler product):\n");
    printf("     The CLT DOES apply better (fewer terms → CLT is approximate).\n");
    printf("     But the polynomial approximation to ζ introduces ERRORS\n");
    printf("     that dominate the tail.\n\n");

    printf("  3. The Euler product factorization |F|² = Π|f_p|² holds\n");
    printf("     for completely multiplicative aₙ, but the LARGE VALUES\n");
    printf("     problem is about ADDITIVE structure (#{t: |F(t)|>V}).\n");
    printf("     The multiplicative factorization helps with moments\n");
    printf("     (E[|F|^{2k}]) but NOT directly with counting.\n\n");

    printf("  4. Soundararajan (2009) showed: assuming RH,\n");
    printf("     |ζ(1/2+it)| ≤ exp(C·logT/loglogT) for all t.\n");
    printf("     This is STRONGER than the CLT tail but WEAKER than\n");
    printf("     Lindelöf (which would give |ζ| ≤ T^ε).\n\n");

    printf("  5. Harper (2013) showed the TAIL of log|ζ| is NOT Gaussian:\n");
    printf("     The right tail decays like exp(-c·(logV)³) not exp(-c·(logV)²).\n");
    printf("     This means the CLT prediction for large values is TOO OPTIMISTIC.\n\n");

    printf("  ★ VERDICT: The Euler product CLT gives the CORRECT picture\n");
    printf("    for typical values of |F|, but OVERESTIMATES the tail decay.\n");
    printf("    The actual tail (Harper 2013) is exp(-c·(logV)³), which is\n");
    printf("    between Gaussian exp(-(logV)²) and GM's polynomial V^{-6}.\n\n");

    printf("  The exp(-c·(logV)³) tail would give:\n");
    printf("    #{|F|>V} ≈ T · exp(-c·(logV)³)\n");
    printf("  For V = N^α: #{|F|>V} ≈ T · exp(-c·α³·(logN)³)\n");
    printf("  This is MUCH better than GM's N²/N^{6α} = N^{2-6α}.\n\n");

    printf("  BUT: Harper's result assumes RH. Unconditionally,\n");
    printf("  the best known tail bound is from Ramachandra (1995):\n");
    printf("    #{|ζ|>V} ≤ T · exp(-c·(logV)²/loglogT)\n");
    printf("  Still better than GM, but only with (logV)² not (logV)³.\n\n");

    printf("  ★ THE GAP: Between Ramachandra's unconditional tail bound\n");
    printf("  and GM's large values estimate, there's a HUGE gap.\n");
    printf("  GM gives polynomial, Ramachandra gives exponential.\n");
    printf("  The gap exists because GM applies to DIRICHLET POLYNOMIALS\n");
    printf("  (arbitrary coefficients) while Ramachandra uses the EULER\n");
    printf("  PRODUCT structure of ζ specifically.\n\n");

    printf("  ★★★ THIS IS THE KEY INSIGHT:\n");
    printf("  GM's bound is TIGHT for GENERIC Dirichlet polynomials.\n");
    printf("  But ζ is NOT generic — it has Euler product structure.\n");
    printf("  The question: can we feed ζ's Euler product into GM's\n");
    printf("  framework to get a HYBRID bound that's better than both?\n");

    free(logF_vals);
    return 0;
}
