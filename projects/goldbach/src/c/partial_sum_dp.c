/*
 * partial_sum_dp.c — Can pₙ be written as non-negative integer combination
 * of partial sums S₁=2, S₂=5, S₃=10, ...?
 *
 * Uses DYNAMIC PROGRAMMING (not greedy) for exact answer.
 *
 * BUILD: cc -O3 -o partial_sum_dp partial_sum_dp.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_P 10000
int primes[MAX_P], nprimes = 0;
long long psum[MAX_P];

void gen_primes(int limit) {
    char *s = calloc(limit+1,1); s[0]=s[1]=1;
    for (int i=2;i<=limit;i++){if(!s[i]){primes[nprimes++]=i;if(nprimes>=MAX_P)break;
        for(long long j=(long long)i*i;j<=limit;j+=i)s[(int)j]=1;}}
    free(s);
    psum[0]=primes[0];
    for(int i=1;i<nprimes;i++) psum[i]=psum[i-1]+primes[i];
}

int main() {
    gen_primes(200000);
    printf("# Partial Sum DP: pₙ = Σ dⱼ·Sⱼ (dⱼ ≥ 0)\n\n");

    int total_tested = 0, total_yes = 0, total_no = 0;
    int first_failures[100]; int nfail = 0;

    for (int n = 2; n < nprimes && n <= 5000; n++) {
        int pn = primes[n];
        int m = n; /* use S₁,...,S_{n-1} */

        /* DP: can we make pn from {S₁,...,S_{m-1}}?
         * dp[v] = 1 if v is achievable. */
        char *dp = calloc(pn + 1, 1);
        dp[0] = 1;

        for (int j = 0; j < m; j++) {
            int sj = (int)psum[j];
            if (sj > pn) break;
            /* Unbounded knapsack: can use Sⱼ any number of times */
            for (int v = sj; v <= pn; v++)
                if (dp[v - sj]) dp[v] = 1;
        }

        total_tested++;
        if (dp[pn]) {
            total_yes++;
        } else {
            total_no++;
            if (nfail < 100) first_failures[nfail++] = n;
        }

        /* Print progress */
        if (n <= 30 || n % 500 == 0 || n == 100 || n == 1000 || !dp[pn]) {
            if (n <= 30 || !dp[pn] || n % 1000 == 0)
                printf("  p_%d = %d: %s\n", n+1, pn, dp[pn] ? "✓ representable" : "✗ NOT representable");
        }

        free(dp);
    }

    printf("\n## Summary\n");
    printf("  Tested: %d primes (p₃ through p_%d)\n", total_tested, total_tested+2);
    printf("  Representable: %d (%.2f%%)\n", total_yes, 100.0*total_yes/total_tested);
    printf("  NOT representable: %d (%.2f%%)\n\n", total_no, 100.0*total_no/total_tested);

    if (nfail > 0) {
        printf("  Non-representable primes:\n  ");
        for (int i = 0; i < nfail && i < 50; i++)
            printf("%d ", primes[first_failures[i]]);
        printf("\n\n");

        /* Analyze: what do the non-representable primes have in common? */
        printf("  Mod analysis of non-representable primes:\n");
        int mod6[6] = {0};
        for (int i = 0; i < nfail; i++)
            mod6[primes[first_failures[i]] % 6]++;
        for (int i = 0; i < 6; i++)
            if (mod6[i]) printf("    ≡ %d mod 6: %d\n", i, mod6[i]);
    }

    /* Now: what if we allow RATIONAL (non-integer) coefficients?
     * Then pₙ = Σ dⱼ·Sⱼ with dⱼ ≥ 0, dⱼ ∈ ℝ.
     * This is ALWAYS possible if gcd(S₁,...) divides pₙ.
     * Since S₁ = 2 and S₂ = 5, gcd(2,5) = 1.
     * So every integer ≥ 0 is representable with REAL dⱼ ≥ 0.
     * With INTEGER dⱼ: Frobenius number of {2,5} = 2·5-2-5 = 3.
     * So every integer ≥ 4 is representable by {2,5} alone!
     */
    printf("\n## With just S₁=2 and S₂=5:\n");
    printf("  Frobenius number = 2·5 - 2 - 5 = 3\n");
    printf("  Every integer ≥ 4 is representable → every prime ≥ 5 ✓\n\n");

    /* Verify with just {S₁, S₂} = {2, 5} */
    int just_two_fail = 0;
    for (int n = 2; n < nprimes && n <= 5000; n++) {
        int pn = primes[n];
        int found = 0;
        for (int b = 0; 5*b <= pn; b++)
            if ((pn - 5*b) % 2 == 0 && (pn - 5*b) >= 0) { found = 1; break; }
        if (!found) just_two_fail++;
    }
    printf("  Using only {S₁=2, S₂=5}: %d failures out of %d\n", just_two_fail, total_tested);

    /* So: EVERY prime ≥ 5 has a monotone-weight decomposition!
     * The DP failures above must be wrong... let me check.
     * Oh wait — S₁ = 2, S₂ = 5 are the first two partial sums.
     * So if we can write pₙ = a·2 + b·5, then we have dⱼ with
     * d₁ = a, d₂ = b, all others 0. This gives:
     * w₁ = a+b, w₂ = b → w₁ > w₂ iff a > 0. ✓
     * So the monotone weight representation ALWAYS exists for prime > 3.
     */
    printf("\n## ★ THEOREM: Every prime pₙ ≥ 5 has a monotone-weight representation\n");
    printf("  Proof: pₙ = a·2 + b·5 with a,b ≥ 0 (since Frobenius(2,5)=3 and pₙ≥5).\n");
    printf("  Setting d₁=a, d₂=b, dⱼ=0 for j≥3:\n");
    printf("    w₁ = a+b, w₂ = b, wⱼ=0 for j≥3.\n");
    printf("    w₁ > w₂ iff a > 0, which holds since pₙ ≢ 0 mod 5 for prime pₙ>5.\n");
    printf("    wⱼ = 0 satisfies wⱼ ≤ w_{j-1} (not strict).\n\n");

    printf("  For STRICT monotonicity (all wᵢ STRICTLY decreasing):\n");
    printf("  Need at least n-1 distinct positive values. This requires\n");
    printf("  using more partial sums.\n\n");

    /* Compute the STRICTLY monotone case using perturbation from uniform */
    printf("## Strict Monotonicity: wᵢ > w_{i+1} for ALL i\n\n");
    printf("  Set wᵢ = c + ε·(n-1-i) where c,ε chosen so Σwᵢpᵢ = pₙ.\n\n");

    for (int n = 5; n < nprimes && n <= 5000; n++) {
        if (n > 30 && n % 500 != 0 && n != 100 && n != 1000) continue;
        int pn = primes[n];
        /* wᵢ = c + ε·(n-1-i)
         * Σ wᵢ·pᵢ = c·Σpᵢ + ε·Σ(n-1-i)·pᵢ = pₙ
         * Need c·A + ε·B = pₙ where:
         *   A = Σpᵢ = S_{n-1}
         *   B = Σ(n-1-i)·pᵢ */
        double A = (double)psum[n-1];
        double B = 0;
        for (int i = 0; i < n; i++) B += (double)(n-1-i) * primes[i];

        /* Want w_{n-1} = c > 0 and ε > 0.
         * c = (pₙ - ε·B) / A → positive when ε < pₙ/B
         * Choose ε = pₙ / (2·B) (half the max) */
        double eps = (double)pn / (2.0 * B);
        double c = ((double)pn - eps * B) / A;

        double w_first = c + eps * (n-1);
        double w_last = c;

        if (n <= 30 || n % 1000 == 0) {
            printf("  p_%d = %d: c=%.6f, ε=%.8f, w₁=%.6f, w_{n-1}=%.6f, ratio=%.2f\n",
                   n+1, pn, c, eps, w_first, w_last, w_first/w_last);
        }
    }

    printf("\n  As n→∞: c ~ pₙ/(2·S_{n-1}) ~ 1/n\n");
    printf("  ε ~ pₙ/(2·B) where B ~ n²·Σpᵢ/n ~ n·S_{n-1}\n");
    printf("  So ε ~ pₙ/(n·S_{n-1}) ~ 1/n²\n");
    printf("  w₁ = c + ε·(n-1) ~ 1/n + 1/n = 2/n\n");
    printf("  w_{n-1} = c ~ 1/n\n");
    printf("  Ratio w₁/w_{n-1} → 2 as n→∞\n");

    return 0;
}
