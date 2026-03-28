/*
 * crack567_fresh.c — Three Fresh Angles at Once
 *
 * CRACK 5: Siegel Zero Conditional
 *   Can we prove: "No Siegel zeros → Goldbach for large N"?
 *   This is weaker than GRH and might be a new conditional.
 *
 * CRACK 7: Unique Goldbach Representations (r(N)=1)
 *   Find all N with exactly 1 Goldbach pair. Are there finitely many?
 *   The last N with r(N)=1 would be a beautiful structural result.
 *
 * CRACK 8: The GPY/Maynard-Tao Angle
 *   Can the Maynard-Tao sieve weights give a LOWER bound on r(N)?
 *   They proved: infinitely many prime tuples. Can we adapt to sums?
 *
 * BUILD: cc -O3 -o crack567_fresh crack567_fresh.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000001
static char sieve[MAX_N];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_N;i++)
        if(.sieve[i]) for(int j=i*i;j<MAX_N;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_N && .sieve[n]; }

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 5/7/8: Three Fresh Angles\n");
    printf("====================================================\n\n");

    int limit = 2000000;

    /* ═══════ CRACK 7: UNIQUE GOLDBACH REPRESENTATIONS ═══════ */
    printf("## CRACK 7: Unique Goldbach Representations (r(N) = 1)\n\n");

    printf("  Even N where N = p + q has EXACTLY ONE solution:\n\n");

    printf("  %10s | %6s | %20s\n", "N", "r(N)", "the pair");

    int last_unique = 0, count_unique = 0;

    for (int N = 4; N <= limit; N += 2) {
        int r = 0;
        int p1 = 0, q1 = 0;
        for (int p = 2; p <= N/2; p++) {
            if (is_prime(p) && is_prime(N-p)) {
                r++;
                if (r == 1) { p1 = p; q1 = N-p; }
                if (r > 1) break; /* only care about r=1 */
            }
        }
        if (r == 1) {
            count_unique++;
            last_unique = N;
            if (N <= 100 || (N > 100 && N <= 1000 && count_unique % 5 == 0)
                || N > 1000) {
                printf("  %10d | %6d | %d + %d\n", N, r, p1, q1);
            }
        }
    }

    printf("\n  Total N with r(N) = 1 up to %d: %d\n", limit, count_unique);
    printf("  Largest N with r(N) = 1: %d\n\n", last_unique);

    /* Distribution of r(N) = 1 among small values */
    printf("  Are unique representations finite?\n\n");

    printf("  %12s | %8s\n", "range", "#unique");
    int ranges[][2] = {{4,100},{100,1000},{1000,10000},{10000,100000},
                       {100000,1000000},{1000000,2000000},{0,0}};
    for (int ri = 0; ranges[ri][0]; ri++) {
        int cnt = 0;
        for (int N = ranges[ri][0]; N <= ranges[ri][1]; N += 2) {
            int r = 0;
            for (int p = 2; p <= N/2; p++) {
                if (is_prime(p) && is_prime(N-p)) {
                    r++;
                    if (r > 1) break;
                }
            }
            if (r == 1) cnt++;
        }
        printf("  [%7d,%7d] | %8d\n", ranges[ri][0], ranges[ri][1], cnt);
    }

    /* ═══════ CRACK 7b: LOW REPRESENTATION NUMBERS ═══════ */
    printf("\n## CRACK 7b: Numbers with Few Representations\n\n");

    printf("  Distribution of r(N) for N up to %d:\n\n", limit);

    int r_counts[50]; memset(r_counts, 0, sizeof(r_counts));
    int max_r_counted = 0;

    for (int N = 4; N <= limit; N += 2) {
        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;
        if (r < 50) r_counts[r]++;
        if (r > max_r_counted) max_r_counted = r;
    }

    printf("  %6s | %8s\n", "r(N)", "count");
    for (int r = 0; r < 20; r++) {
        if (r_counts[r] > 0)
            printf("  %6d | %8d\n", r, r_counts[r]);
    }

    /* ═══════ CRACK 5: SIEGEL ZERO ANALYSIS ═══════ */
    printf("\n## CRACK 5: Siegel Zero → Goldbach\n\n");

    printf("  A Siegel zero is a real zero β of L(s,χ) very close to 1.\n");
    printf("  If it exists, it causes primes to be BIASED in APs.\n\n");

    printf("  KNOWN: If no Siegel zeros exist, then:\n");
    printf("  • Primes are equidistributed mod q for all q ≤ N^{1/2-ε}\n");
    printf("  • The error term in BV is better: θ = 1/2 becomes effective\n");
    printf("  • Goldbach's exceptional set E(X) = O(X^{1-δ}) for explicit δ\n\n");

    printf("  QUESTION: Does 'no Siegel zeros' → binary Goldbach?\n\n");

    printf("  ANALYSIS:\n");
    printf("  Without Siegel zeros, we get effective BV at θ = 1/2.\n");
    printf("  But binary Goldbach needs θ = 1 (or close to it).\n");
    printf("  'No Siegel zeros' gives us θ = 1/2 EFFECTIVELY,\n");
    printf("  which is the SAME as unconditional BV but with\n");
    printf("  better constants.\n\n");

    printf("  The issue: binary Goldbach needs POWER savings\n");
    printf("  on the minor arcs, not just effective log savings.\n");
    printf("  Siegel zeros only affect the QUALITY of θ = 1/2,\n");
    printf("  not the VALUE of θ.\n\n");

    printf("  KNOWN CONDITIONAL HIERARCHY:\n");
    printf("  GRH → Goldbach (for large N) [Deshouillers et al.]\n");
    printf("  EH (θ=1) → Goldbach [well-known]\n");
    printf("  BV (θ=1/2) → almost all N [Goldston-Pintz-Yildirim?]\n\n");

    printf("  WHERE 'no Siegel zeros' FITS:\n");
    printf("  No Siegel zeros → effective BV(1/2) → same strength\n");
    printf("  as unconditional for Goldbach purposes.\n\n");

    printf("   CRACK 5 VERDICT: 'No Siegel zeros → Goldbach'\n");
    printf("  is NOT a new conditional. It doesn't give more than\n");
    printf("  what we already have unconditionally.\n");
    printf("  The gap is θ = 1/2 vs θ = 1, and Siegel zeros\n");
    printf("  don't change θ.\n\n");

    /* ═══════ CRACK 8: MAYNARD-TAO ANGLE ═══════ */
    printf("## CRACK 8: The Maynard-Tao Angle\n\n");

    printf("  Maynard-Tao proved: for any m, there exist infinitely\n");
    printf("  many n such that at least m of {n+h₁,...,n+hₖ} are prime.\n\n");

    printf("  For Goldbach: we want n AND N-n both prime.\n");
    printf("  This is a 'shifted' version: the tuple is (n, N-n).\n\n");

    printf("  PROBLEM: (n, N-n) is NOT an admissible tuple.\n");
    printf("  An admissible k-tuple {h₁,...,hₖ} requires that for\n");
    printf("  every prime p, some residue class mod p is avoided.\n");
    printf("  For (n, N-n): if p | N, then n + (N-n) = N ≡ 0 mod p,\n");
    printf("  so BOTH entries can't avoid 0 mod p. NOT admissible.\n\n");

    printf("  HOWEVER: the Maynard-Tao method works for DENSE sets.\n");
    printf("  It uses optimized sieve weights to detect primes.\n");
    printf("  The key quantity is:\n");
    printf("  S = Σ_{n~N} (Σ_d λ_d)² · 1_{n prime} · 1_{N-n prime}\n\n");

    printf("  If we could show S > 0 for some weight choice,\n");
    printf("  that would prove Goldbach for N.\n\n");

    printf("  THE OBSTACLE: The sieve weights λ_d are chosen to\n");
    printf("  maximize the ratio of 'prime pairs detected' to\n");
    printf("  'total weight'. The parity barrier ensures that\n");
    printf("  the sieve weights can't distinguish primes from\n");
    printf("  products of two primes.\n\n");

    printf("  COMPARISON:\n");
    printf("  Twin primes (n, n+2): admissible, GPY gives lower\n");
    printf("    bound on primes in tuples → bounded gaps.\n");
    printf("  Goldbach (n, N-n): NOT admissible for individual N.\n");
    printf("    But averaged over N, the density argument works.\n\n");

    printf("  WHAT MAYNARD-TAO ACTUALLY GIVES FOR GOLDBACH:\n");
    printf("  Nothing new. The averaging-over-N that makes their\n");
    printf("  method work gives the SAME result as the circle\n");
    printf("  method: almost all even N are sums of two primes.\n\n");

    printf("  For INDIVIDUAL N: the method needs θ > 1/2 + δ\n");
    printf("  for some δ, or parity-breaking — exactly the same\n");
    printf("  barriers we've been hitting.\n\n");

    printf("   CRACK 8 VERDICT: Maynard-Tao doesn't help for\n");
    printf("  individual N (Goldbach). It helps for 'almost all N'\n");
    printf("  which is already known.\n\n");

    /* ═══════ SYNTHESIS ═══════ */
    printf("====================================================\n");
    printf("## SYNTHESIS\n\n");

    printf("  CRACK 5 (Siegel zero):  DEAD. θ unchanged.\n");
    printf("  CRACK 7 (unique repr):  INTERESTING DATA.\n");
    printf("  CRACK 8 (Maynard-Tao):  DEAD. Same barriers.\n\n");

    printf("  The ONLY interesting output is CRACK 7:\n");
    printf("  r(N)=1 numbers seem to be FINITE.\n");
    printf("  If the last one is at N=%d, that's a COMPUTABLE result.\n\n", last_unique);

    printf("  STATEMENT (empirically true, needs proof):\n");
    printf("  'For all even N > %d, r(N) ≥ 2.'\n\n", last_unique);

    printf("  This is WEAKER than Goldbach but has the advantage\n");
    printf("  of being about a QUANTITATIVE lower bound, not just\n");
    printf("  existence. And it's verifiable to larger N.\n");

    return 0;
}
