/*
 * shifted_pairs_redteam.c — Build the argument AND red team it.
 *
 * CLAIM: k shifted Goldbach pairs with Maynard weights
 *        improve E(N) below N^{0.698}.
 *
 * We build the argument step by step, testing each step
 * computationally and red-teaming the logic.
 *
 * BUILD: cc -O3 -o shifted_pairs_redteam shifted_pairs_redteam.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_2N 2000002
static char is_composite[MAX_2N];
static int primes[200000]; int nprimes = 0;

void sieve(int limit) {
    memset(is_composite, 0, limit+1);
    is_composite[0] = is_composite[1] = 1;
    for (int i=2;(long long)i*i<=limit;i++)
        if (!is_composite[i]) for(int j=i*i;j<=limit;j+=i) is_composite[j]=1;
    for (int i=2;i<=limit;i++) if(!is_composite[i]) primes[nprimes++]=i;
}

int main() {
    sieve(MAX_2N - 2);
    int N = 500000;

    printf("═══════════════════════════════════════════════════════════════\n");
    printf("  SHIFTED PAIR GOLDBACH: CONSTRUCTION + RED TEAM\n");
    printf("═══════════════════════════════════════════════════════════════\n\n");

    /* ═════════════════════════════════════════════ */
    printf("## STEP 1: The Setup\n\n");
    printf("  For even 2n, consider k shifted pairs:\n");
    printf("    Pair j: (m-6j, 2n-m+6j) for j=0,1,...,k-1\n");
    printf("  Each pair sums to 2n. If both entries are prime → Goldbach.\n\n");

    /* RED TEAM STEP 1 */
    printf("  🔴 RED TEAM: These are k decompositions of the SAME 2n.\n");
    printf("     The residues (m-6j) mod p and (2n-m+6j) mod p are\n");
    printf("     determined by a SINGLE free variable: m mod p.\n");
    printf("     Adding pairs does NOT add independence mod p.\n\n");

    /* ═════════════════════════════════════════════ */
    printf("## STEP 2: Computational Test — Are Shifted Pairs Correlated?\n\n");

    /* For each even 2n ≤ 2N: check how many of the k=10 shifted pairs
     * are Goldbach (both entries prime). */
    int k = 10;
    int pair_counts[11] = {0}; /* pair_counts[j] = # evens with exactly j Goldbach pairs */
    int total_evens = 0;

    for (int n = 3; n <= N; n++) {
        int even = 2*n;
        int goldbach_pairs = 0;
        for (int j = 0; j < k; j++) {
            /* Try all m for this shift */
            int found = 0;
            for (int pi = 0; pi < nprimes; pi++) {
                int p = primes[pi];
                int shifted_p = p + 6*j;
                if (shifted_p >= even) break;
                int q = even - shifted_p;
                if (q >= 2 && q < MAX_2N && !is_composite[q]) {
                    found = 1;
                    break;
                }
            }
            /* Actually, shifted pair j means: (p, 2n-p) where p ≡ m-6j
             * But m is the SAME for all j.
             * Wait — I need to reconsider the setup.
             *
             * Actually, the k shifted pairs are NOT different m values.
             * Each pair is a DIFFERENT decomposition of 2n:
             *   Pair j uses a SPECIFIC partition: p + q = 2n where
             *   p is "close to" m-6j.
             *
             * But there's no constraint that forces the same m.
             * Each pair j independently asks: ∃ p prime with
             *   p ≡ something, 2n-p prime.
             *
             * So actually, each pair is just a DIFFERENT Goldbach
             * representation. The question is: among ALL representations
             * p+q=2n, does having many representations help?
             */
            goldbach_pairs += found;
        }
        /* Actually, with the above code, each "shifted pair" just
         * tests whether 2n = p + q with p starting from primes offset by 6j.
         * Since we test ALL primes, every shift gives the same answer!
         * This confirms the red team: shifts don't help. */
        pair_counts[goldbach_pairs < 10 ? goldbach_pairs : 10]++;
        total_evens++;
    }

    printf("  Testing k=%d shifts for 2n ≤ %d:\n", k, 2*N);
    for (int j = 0; j <= k; j++)
        if (pair_counts[j]) printf("    %d shifts have Goldbach: %d evens\n", j, pair_counts[j]);

    /* ═════════════════════════════════════════════ */
    printf("\n  🔴 RED TEAM STEP 2:\n");
    printf("     All shifts give the SAME answer because Goldbach for 2n\n");
    printf("     is a property of 2n itself, not of the shift.\n");
    printf("     Shifting the search doesn't create new opportunities.\n\n");

    /* ═════════════════════════════════════════════ */
    printf("## STEP 3: Alternative — DIFFERENT Even Numbers\n\n");
    printf("  Instead of shifting pairs of the SAME 2n, consider\n");
    printf("  NEARBY even numbers: 2n, 2n+2, 2n+4, ..., 2n+2(k-1).\n");
    printf("  If ANY of these is Goldbach, then there's Goldbach near 2n.\n\n");

    /* How often do k consecutive evens ALL fail Goldbach? */
    printf("  Testing: max run of consecutive non-Goldbach evens\n");
    int max_run = 0, current_run = 0;
    for (int n = 3; n <= N; n++) {
        int even = 2*n;
        int is_goldbach = 0;
        for (int pi = 0; pi < nprimes && primes[pi] <= even/2; pi++) {
            int q = even - primes[pi];
            if (q >= 2 && !is_composite[q]) { is_goldbach = 1; break; }
        }
        if (!is_goldbach) {
            current_run++;
            if (current_run > max_run) max_run = current_run;
        } else {
            current_run = 0;
        }
    }
    printf("  Max consecutive non-Goldbach evens in [6, %d]: %d\n", 2*N, max_run);
    printf("  (Expected: 0, since Goldbach holds up to 4×10^18)\n\n");

    printf("  🔴 RED TEAM STEP 3:\n");
    printf("     Since Goldbach holds for ALL tested evens, there are no\n");
    printf("     non-Goldbach evens to form runs. The 'nearby evens'\n");
    printf("     approach gives NO improvement because there's nothing\n");
    printf("     to improve computationally.\n\n");
    printf("     Theoretically: the exceptional set E(N) ≤ N^{0.698}\n");
    printf("     already means non-Goldbach evens are EXTREMELY sparse.\n");
    printf("     To improve this POWER, we'd need new analytic input.\n\n");

    /* ═════════════════════════════════════════════ */
    printf("## STEP 4: What Maynard's Sieve ACTUALLY Needs\n\n");
    printf("  Maynard's sieve for bounded gaps works because:\n");
    printf("  1. The k-tuple (n+h₁,...,n+hₖ) has k INDEPENDENT residues mod p\n");
    printf("  2. As k→∞, the 'dimension bonus' beats the parity barrier\n");
    printf("  3. The output is: ∃n such that ≥2 of n+hᵢ are prime\n\n");
    printf("  For Goldbach, the STRUCTURAL difference:\n");
    printf("  1. The pair (p, 2n-p) has ANTI-CORRELATED residues:\n");
    printf("     p mod q + (2n-p) mod q = 2n mod q (FIXED)\n");
    printf("  2. There's only 1 free variable (p mod q), not k\n");
    printf("  3. Adding shifted pairs doesn't add free variables\n\n");

    /* Verify the anti-correlation */
    printf("  Verification — residue classes mod small primes:\n");
    for (int q = 3; q <= 11; q += 2) {
        printf("    mod %d: for p+r=2n, (p mod %d, r mod %d) pairs:\n", q, q, q);
        printf("      ");
        for (int a = 0; a < q; a++) {
            int b = (100 - a) % q; /* 2n=100 as example */
            if (b < 0) b += q;
            printf("(%d,%d) ", a, b);
        }
        printf("\n      → Only %d distinct pairs, not %d² — ANTI-CORRELATED\n", q, q);
    }

    /* ═════════════════════════════════════════════ */
    printf("\n## VERDICT\n\n");
    printf("  🔴 The shifted pair approach DOES NOT WORK because:\n\n");
    printf("  1. All shifts decompose the SAME 2n → no new information\n");
    printf("  2. Residues are anti-correlated (p + q = 2n mod p) →\n");
    printf("     only 1 free residue class variable regardless of k\n");
    printf("  3. Maynard's sieve needs independent residue variables\n");
    printf("     to gain power from higher dimensions\n\n");
    printf("  The Goldbach constraint p + q = FIXED is fundamentally\n");
    printf("  different from the bounded gap constraint p - q = SMALL.\n");
    printf("  The sum constraint kills the independence that makes\n");
    printf("  the multidimensional sieve work.\n\n");
    printf("  This is NOT a failure of the sieve weights — it's a\n");
    printf("  STRUCTURAL obstruction inherent in the problem.\n");

    return 0;
}
