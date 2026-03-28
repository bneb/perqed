/*
 * monotone_weights.c — Decompose pₙ = Σ wᵢ·pᵢ (i < n)
 * with MONOTONE DECREASING positive weights: w₁ > w₂ > ... > w_{n-1} > 0.
 *
 * Several optimization objectives:
 * A. Min w₁ (minimize the largest weight)
 * B. Min Σwᵢ (minimize total weight)
 * C. Min w₁ - w_{n-1} (minimize weight spread)
 * D. The UNIQUE solution when we also fix w_{n-1} = ε → 0
 *
 * For the monotone constraint, we use the substitution:
 *   dᵢ = wᵢ - w_{i+1} ≥ 0 for i = 1,...,n-2
 *   d_{n-1} = w_{n-1} ≥ 0
 *
 * Then: wᵢ = d_i + d_{i+1} + ... + d_{n-1} = Σ_{j≥i} dⱼ
 * And: Σ wᵢ·pᵢ = Σ dⱼ · (Σ_{i≤j} pᵢ) = Σ dⱼ · Sⱼ
 * where Sⱼ = p₁ + p₂ + ... + pⱼ (partial sums).
 *
 * So: pₙ = Σ dⱼ · Sⱼ with dⱼ ≥ 0.
 * This is a non-negative combination of PARTIAL SUMS of primes!
 *
 * BUILD: cc -O3 -o monotone_weights monotone_weights.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_P 10000
int primes[MAX_P], nprimes = 0;
long long partial_sum[MAX_P]; /* Sⱼ = p₁+...+pⱼ */

void gen_primes(int limit) {
    char *s = calloc(limit+1, 1); s[0]=s[1]=1;
    for (int i=2; i<=limit; i++) {
        if (!s[i]) { primes[nprimes++]=i; if(nprimes>=MAX_P) break;
            for (long long j=(long long)i*i;j<=limit;j+=i) s[(int)j]=1; }
    }
    free(s);
    partial_sum[0] = primes[0];
    for (int i = 1; i < nprimes; i++)
        partial_sum[i] = partial_sum[i-1] + primes[i];
}

int main() {
    gen_primes(200000);

    printf("# Monotone Weight Decomposition: pₙ = Σ wᵢ·pᵢ, w₁>w₂>...>w_{n-1}>0\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## Key Insight: Partial Sum Formulation\n\n");
    printf("  Substituting dᵢ = wᵢ - w_{i+1} ≥ 0:\n");
    printf("    pₙ = Σⱼ dⱼ · Sⱼ where Sⱼ = p₁+...+pⱼ\n\n");
    printf("  So: pₙ is a NON-NEGATIVE combination of partial sums S₁,S₂,...\n");
    printf("  S₁=2, S₂=5, S₃=10, S₄=17, S₅=28, S₆=41, ...\n\n");

    /* Show partial sums */
    printf("  First partial sums:\n  ");
    for (int i = 0; i < 20; i++) printf("%lld ", partial_sum[i]);
    printf("\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## A. Greedy on Partial Sums (min terms)\n\n");
    printf("  %5s %7s | %6s | %s\n", "n", "pₙ", "#terms", "decomposition dⱼ·Sⱼ");

    for (int n = 2; n < nprimes && n <= 5000; n++) {
        if (n > 30 && n % 500 != 0 && n != 100 && n != 1000) continue;
        int pn = primes[n];
        long long rem = pn;
        int terms = 0;
        char buf[256] = "";
        int buflen = 0;

        /* Greedy: use largest Sⱼ (j < n) that fits */
        for (int j = n - 1; j >= 0 && rem > 0; j--) {
            if (partial_sum[j] <= rem) {
                int count = (int)(rem / partial_sum[j]);
                rem -= count * partial_sum[j];
                terms++;
                if (buflen < 200)
                    buflen += snprintf(buf+buflen, 256-buflen, "%d·S%d ", count, j+1);
            }
        }
        printf("  %5d %7d | %6d | %s%s\n", n+1, pn, terms, buf,
               rem ? "(FAIL)" : "✓");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## B. Min-Max Weight (LP via greedy on partial sums)\n\n");
    printf("  For uniform weights (all wᵢ = c): c = pₙ / Σpᵢ\n");
    printf("  %5s %7s | %12s | %12s | %10s\n",
           "n", "pₙ", "Σp_{<n}", "c=pₙ/Σp", "c·p_{n-1}");

    for (int n = 2; n < nprimes && n <= 5000; n++) {
        if (n > 30 && n % 500 != 0 && n != 100 && n != 1000) continue;
        double c = (double)primes[n] / partial_sum[n-1];
        double contrib_last = c * primes[n-1];
        printf("  %5d %7d | %12lld | %12.8f | %10.4f\n",
               n+1, primes[n], partial_sum[n-1], c, contrib_last);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## C. Uniform Weight Ratio pₙ/S_{n-1} as N→∞\n\n");
    printf("  S_{n-1} = Σ_{i<n} pᵢ ~ (n²/2)·log(n) (by PNT)\n");
    printf("  pₙ ~ n·log(n)\n");
    printf("  Ratio c = pₙ/S_{n-1} ~ 2/n → 0 as n→∞\n\n");
    printf("  This means UNIFORM monotone weights become infinitesimally small.\n");
    printf("  The weight on each prime → 0, but the sum → pₙ.\n\n");

    printf("  Verified:\n");
    printf("  %8s | %12s | %12s | %8s\n", "n", "pₙ/S_{n-1}", "2/n", "ratio");
    for (int n = 10; n < nprimes && n <= 5000; n *= 2) {
        double c = (double)primes[n] / partial_sum[n-1];
        double pred = 2.0 / n;
        printf("  %8d | %12.8f | %12.8f | %8.4f\n", n, c, pred, c/pred);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## D. The Partial Sum Representation Theorem\n\n");
    printf("  CLAIM: pₙ can ALWAYS be written as a non-negative integer\n");
    printf("  combination of {S₁,S₂,...,S_{n-1}} for n ≥ 3.\n\n");

    /* Check this claim */
    int failures = 0;
    for (int n = 2; n < nprimes && n <= 5000; n++) {
        int pn = primes[n];
        long long rem = pn;
        for (int j = n-1; j >= 0 && rem > 0; j--) {
            if (partial_sum[j] <= rem)
                rem -= (rem / partial_sum[j]) * partial_sum[j];
        }
        if (rem != 0) {
            printf("  FAILURE at n=%d, pₙ=%d, remainder=%lld\n", n+1, pn, rem);
            failures++;
        }
    }
    printf("  Checked n=3..%d: %d failures\n",
           (nprimes < 5001 ? nprimes : 5001), failures);

    if (failures > 0) {
        printf("\n  Failing cases (pₙ not representable by partial sums):\n");
        for (int n = 2; n < nprimes && n <= 200; n++) {
            int pn = primes[n];
            long long rem = pn;
            for (int j = n-1; j >= 0 && rem > 0; j--)
                if (partial_sum[j] <= rem)
                    rem -= (rem / partial_sum[j]) * partial_sum[j];
            if (rem != 0)
                printf("    p_%d = %d, remainder = %lld, S values: %lld..%lld\n",
                       n+1, pn, rem, partial_sum[0], partial_sum[n-1]);
        }
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## E. Structure of the Weight Curve\n\n");
    printf("  For the MINIMUM-SPREAD monotone decomposition of p_1001:\n");

    int n_test = 1000;
    /* Use the uniform weight c = pₙ/S_{n-1} as starting point,
     * then adjust to make it strictly decreasing.
     * Set wᵢ = c + ε·(n-1-i)/(n-1) for a small ε perturbation. */
    double c = (double)primes[n_test] / partial_sum[n_test - 1];
    double eps = c * 0.01; /* 1% perturbation for strict monotonicity */

    printf("  Base uniform weight c = %.8f\n", c);
    printf("  Perturbation ε = %.10f\n\n", eps);
    printf("  %6s %6s %14s %14s\n", "i/n", "pᵢ", "wᵢ", "wᵢ·pᵢ");

    double check_sum = 0;
    for (int i = 0; i < n_test; i++) {
        double w = c + eps * (n_test - 1 - i) / (double)(n_test - 1);
        double contrib = w * primes[i];
        check_sum += contrib;
        if (i % 100 == 0 || i == n_test - 1)
            printf("  %6.2f %6d %14.10f %14.6f\n",
                   (double)i/n_test, primes[i], w, contrib);
    }
    /* The perturbed sum won't equal pₙ exactly; compute correction */
    double error = check_sum - primes[n_test];
    printf("\n  Sum = %.4f, target = %d, error = %.4f\n", check_sum, primes[n_test], error);
    printf("  (Need to rescale weights to correct for perturbation error)\n");

    return 0;
}
