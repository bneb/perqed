/*
 * prime_lincomb.c — Express pₙ as a linear combination of p₁,...,p_{n-1}.
 *
 * For each prime pₙ, compute weights w₁,...,w_{n-1} such that:
 *   pₙ = w₁·p₁ + w₂·p₂ + ... + w_{n-1}·p_{n-1}
 *
 * DECOMPOSITIONS:
 * 1. Least-squares (min Σwᵢ²): w_i = pₙ · pᵢ / Σpⱼ²
 * 2. Positive greedy: subtract largest pᵢ that fits, repeat
 * 3. Sparse (fewest nonzero weights): greedy with largest first
 * 4. Bounded: min max|wᵢ| subject to Σwᵢpᵢ = pₙ
 *
 * BUILD: cc -O3 -o prime_lincomb prime_lincomb.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_PRIMES 10000

static int primes[MAX_PRIMES];
static int num_primes = 0;

void gen_primes(int limit) {
    char *sieve = calloc(limit + 1, 1);
    sieve[0] = sieve[1] = 1;
    for (int i = 2; i <= limit; i++) {
        if (!sieve[i]) {
            primes[num_primes++] = i;
            if (num_primes >= MAX_PRIMES) break;
            for (long long j = (long long)i*i; j <= limit; j += i)
                sieve[(int)j] = 1;
        }
    }
    free(sieve);
}

int main() {
    gen_primes(200000);
    printf("# Prime Linear Combination Analysis\n");
    printf("# pₙ = Σ wᵢ·pᵢ for i < n\n\n");

    /* ═══════════════════════════════════════════ */
    /* 1. LEAST-SQUARES: w_i = pₙ · pᵢ / Σpⱼ²  */
    /* ═══════════════════════════════════════════ */
    printf("## 1. Least-Squares Decomposition (min Σwᵢ²)\n\n");
    printf("  %5s  %7s | %10s %10s %10s | %10s\n",
           "n", "pₙ", "w₁ (p=2)", "w_mid", "w_{n-1}", "Σwᵢ²");

    for (int n = 2; n < num_primes && n <= 5000; n++) {
        if (n > 20 && n % 500 != 0 && n != 100 && n != 1000) continue;
        int pn = primes[n];
        double sum_sq = 0;
        for (int i = 0; i < n; i++)
            sum_sq += (double)primes[i] * primes[i];

        double w1 = (double)pn * primes[0] / sum_sq;
        double w_mid = (double)pn * primes[n/2] / sum_sq;
        double w_last = (double)pn * primes[n-1] / sum_sq;
        double total_wsq = (double)pn * pn / sum_sq;

        printf("  %5d  %7d | %10.6f %10.6f %10.6f | %10.4f\n",
               n+1, pn, w1, w_mid, w_last, total_wsq);
    }

    /* ═══════════════════════════════════════════ */
    /* 2. POSITIVE GREEDY: use largest pᵢ ≤ remainder  */
    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Positive Greedy Decomposition\n\n");
    printf("  %5s  %7s | %6s | %s\n", "n", "pₙ", "#terms", "decomposition (last 5)");

    for (int n = 2; n < num_primes && n <= 5000; n++) {
        if (n > 20 && n % 500 != 0 && n != 100 && n != 1000) continue;
        int pn = primes[n];
        int remainder = pn;
        int terms = 0;
        int used[20]; int used_count = 0;  /* track last few */

        while (remainder > 0) {
            /* Find largest prime < n that fits */
            int best = -1;
            for (int i = n - 1; i >= 0; i--) {
                if (primes[i] <= remainder) { best = i; break; }
            }
            if (best < 0) break;
            remainder -= primes[best];
            terms++;
            if (used_count < 20) used[used_count++] = primes[best];
        }

        printf("  %5d  %7d | %6d | ", n+1, pn, terms);
        for (int i = 0; i < (used_count < 5 ? used_count : 5); i++)
            printf("%d ", used[i]);
        if (remainder != 0) printf("(remainder=%d!)", remainder);
        printf("\n");
    }

    /* ═══════════════════════════════════════════ */
    /* 3. SPARSE: fewest non-zero weights         */
    /* ═══════════════════════════════════════════ */
    printf("\n## 3. Sparsest Representation (fewest terms)\n\n");
    printf("  Every prime pₙ can be written as a·2 + b·3 (Frobenius):\n");
    for (int n = 1; n < 30 && n < num_primes; n++) {
        int pn = primes[n];
        /* Find non-negative a,b with 2a + 3b = pn */
        int best_a = -1, best_b = -1;
        for (int b = pn/3; b >= 0; b--) {
            int rem = pn - 3*b;
            if (rem >= 0 && rem % 2 == 0) {
                best_a = rem / 2; best_b = b;
                break;
            }
        }
        printf("  p_%d = %d = %d·(2) + %d·(3)\n", n+1, pn, best_a, best_b);
    }

    /* ═══════════════════════════════════════════ */
    /* 4. WEIGHT DISTRIBUTION ANALYSIS            */
    /* ═══════════════════════════════════════════ */
    printf("\n## 4. Weight Distribution (LS weights as function of i/n)\n\n");
    printf("  Least-squares: w_i = pₙ · pᵢ / Σpⱼ²\n");
    printf("  Since pᵢ ~ i·log(i): w_i ∝ i·log(i) / Σ(j·log(j))²\n\n");

    /* For a large n, show the weight curve */
    int n_test = 1000;
    int pn = primes[n_test];
    double sum_sq = 0;
    for (int i = 0; i < n_test; i++)
        sum_sq += (double)primes[i] * primes[i];

    printf("  Weight curve for p_%d = %d:\n", n_test+1, pn);
    printf("  %6s  %6s  %12s  %12s\n", "i/n", "pᵢ", "w_i (LS)", "cumulative");
    double cumul = 0;
    for (int i = 0; i < n_test; i++) {
        double w = (double)pn * primes[i] / sum_sq;
        cumul += w * primes[i];
        if (i % 100 == 0 || i == n_test - 1) {
            printf("  %6.2f  %6d  %12.8f  %12.4f\n",
                   (double)i/n_test, primes[i], w, cumul);
        }
    }

    /* ═══════════════════════════════════════════ */
    /* 5. GOLDBACH CONNECTION                     */
    /* ═══════════════════════════════════════════ */
    printf("\n## 5. Goldbach Connection\n\n");
    printf("  If pₙ = Σ wᵢ·pᵢ with all wᵢ ∈ {0,1} and exactly 2 nonzero:\n");
    printf("  Then pₙ = pᵢ + pⱼ → pₙ is a Goldbach number!\n\n");
    printf("  But primes are odd (except 2), so pᵢ+pⱼ is even → pₙ can't be\n");
    printf("  a sum of exactly 2 primes (since pₙ is odd for n≥2).\n\n");
    printf("  HOWEVER: 2·pₙ = pᵢ + pⱼ IS the Goldbach question for even 2pₙ.\n");
    printf("  So: which primes pₙ satisfy 2pₙ = pᵢ + pⱼ (both prime, i,j < n)?\n\n");

    int goldbach_count = 0;
    for (int n = 1; n < num_primes && n < 5000; n++) {
        int target = 2 * primes[n];
        int found = 0;
        for (int i = 0; i < n && !found; i++) {
            int complement = target - primes[i];
            /* Check if complement is prime and among p₁,...,p_{n-1} */
            for (int j = i; j < n; j++) {
                if (primes[j] == complement) { found = 1; break; }
                if (primes[j] > complement) break;
            }
        }
        if (found) goldbach_count++;
    }
    printf("  Of first %d primes: %d have 2pₙ = pᵢ + pⱼ (%.1f%%)\n",
           (num_primes < 5000 ? num_primes : 5000) - 1,
           goldbach_count,
           100.0 * goldbach_count / 4999);

    /* ═══════════════════════════════════════════ */
    /* 6. RESTRICTED WEIGHTS: w ∈ [-B, B]         */
    /* ═══════════════════════════════════════════ */
    printf("\n## 6. Bounded Weights: min B s.t. pₙ = Σ wᵢpᵢ, |wᵢ| ≤ B\n\n");
    printf("  With just p₁=2, p₂=3: any n = a·2 + b·3\n");
    printf("  Min max(|a|,|b|) for pₙ:\n");
    for (int n = 1; n < 30 && n < num_primes; n++) {
        int pn = primes[n];
        /* min max(|a|,|b|) s.t. 2a + 3b = pn, using extended gcd */
        int best_max = pn;
        for (int b = -pn; b <= pn; b++) {
            int rem = pn - 3*b;
            if (rem % 2 == 0) {
                int a = rem / 2;
                int mx = abs(a) > abs(b) ? abs(a) : abs(b);
                if (mx < best_max) best_max = mx;
            }
        }
        printf("  p_%2d = %5d: min B = %d\n", n+1, pn, best_max);
    }

    return 0;
}
