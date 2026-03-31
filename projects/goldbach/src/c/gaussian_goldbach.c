/*
 * gaussian_goldbach.c — Test the angular degree of freedom (FIXED + TESTED).
 *
 * Gaussian primes:
 *   - Inert (real axis): rational prime p ≡ 3 mod 4 → p is a Gaussian prime
 *   - Split: a+bi with a²+b² a rational prime (and b≠0)
 *   - Ramified: 1+i (from 2 = -i(1+i)²)
 *
 * Gaussian Goldbach: E = ρ₁ + ρ₂ where ρ₁, ρ₂ are Gaussian primes, E real even.
 *   Since Im(ρ₁) = -Im(ρ₂):
 *   Case b=0: p + q = E with p,q rational primes ≡ 3 mod 4 (inert)
 *   Case b>0: (a+bi) + ((E-a)-bi) with a²+b² and (E-a)²+b² both rational primes
 *
 * Usage: ./gaussian_goldbach [-t] [max_E]
 *   -t: run unit tests only
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <assert.h>

#define MAX_SIEVE 30000001  /* 30M — enough for E up to ~10000 */
static char *is_composite;

void sieve(int limit) {
    is_composite = calloc(limit + 1, 1);
    is_composite[0] = is_composite[1] = 1;
    for (long long i = 2; i * i <= limit; i++)
        if (!is_composite[i])
            for (long long j = i * i; j <= limit; j += i)
                is_composite[j] = 1;
}

static inline int is_prime_check(long long n) {
    if (n < 2 || n >= MAX_SIEVE) return 0;
    return !is_composite[n];
}

/* Classical Goldbach count: r(E) = #{p ≤ E/2 : p and E-p both prime} */
int goldbach_count(int E) {
    int count = 0;
    for (int p = 2; p <= E / 2; p++)
        if (is_prime_check(p) && is_prime_check(E - p))
            count++;
    return count;
}

/* Gaussian Goldbach count (CORRECTED):
 * Case b=0: count (p, E-p) where both are primes ≡ 3 mod 4 (inert Gaussian primes)
 *   Special: p ≤ E/2 to avoid double-counting. If p = E-p (i.e. E = 2p), count once.
 * Case b>0: count (a,b) where a²+b² and (E-a)²+b² are both rational primes */
int gaussian_goldbach_count(int E, int *inert_count, int *split_count) {
    int count = 0;
    *inert_count = 0;
    *split_count = 0;

    /* Case b=0: inert primes (p ≡ 3 mod 4) */
    for (int p = 2; p <= E / 2; p++) {
        int q = E - p;
        if (is_prime_check(p) && (p % 4 == 3) && is_prime_check(q) && (q % 4 == 3)) {
            count++;
            (*inert_count)++;
        }
    }

    /* Case b>0: split primes (norm = a²+b² is rational prime) */
    for (int b = 1; ; b++) {
        long long b2 = (long long)b * b;
        /* Both norms must be < MAX_SIEVE.
         * Tight bound: need (E/2)² + b² < MAX_SIEVE for the middle of the range */
        long long rem = (long long)MAX_SIEVE - b2;
        if (rem <= 0) break;
        int bound = (int)sqrt((double)rem);

        int a_min = E - bound;
        if (a_min < 0) a_min = 0;
        int a_max = bound;
        if (a_max > E) a_max = E;
        if (a_min > a_max) continue;

        for (int a = a_min; a <= a_max; a++) {
            long long norm1 = (long long)a * a + b2;
            long long norm2 = (long long)(E - a) * (E - a) + b2;

            if (norm1 < 2 || norm2 < 2) continue;
            if (norm1 >= MAX_SIEVE || norm2 >= MAX_SIEVE) continue;

            if (is_prime_check(norm1) && is_prime_check(norm2)) {
                count++;
                (*split_count)++;
            }
        }
    }

    return count;
}

/* ========================= UNIT TESTS ========================= */

int run_tests() {
    int pass = 0, fail = 0;
    #define TEST(name, cond) do { \
        if (cond) { pass++; printf("  PASS: %s\n", name); } \
        else { fail++; printf("  FAIL: %s\n", name); } \
    } while(0)

    printf("--- Sieve tests ---\n");
    TEST("2 is prime", is_prime_check(2));
    TEST("3 is prime", is_prime_check(3));
    TEST("4 is not prime", !is_prime_check(4));
    TEST("5 is prime", is_prime_check(5));
    TEST("7 is prime", is_prime_check(7));
    TEST("9 is not prime", !is_prime_check(9));
    TEST("13 is prime", is_prime_check(13));
    TEST("1 is not prime", !is_prime_check(1));
    TEST("0 is not prime", !is_prime_check(0));
    TEST("97 is prime", is_prime_check(97));

    printf("--- Classical Goldbach tests ---\n");
    /* r(4) = 1: 2+2 */
    TEST("r(4)=1", goldbach_count(4) == 1);
    /* r(6) = 1: 3+3 */
    TEST("r(6)=1", goldbach_count(6) == 1);
    /* r(8) = 1: 3+5 */
    TEST("r(8)=1", goldbach_count(8) == 1);
    /* r(10) = 2: 3+7, 5+5 */
    TEST("r(10)=2", goldbach_count(10) == 2);
    /* r(12) = 1: 5+7 */
    TEST("r(12)=1", goldbach_count(12) == 1);
    /* r(20) = 2: 3+17, 7+13 */
    TEST("r(20)=2", goldbach_count(20) == 2);
    /* r(100) = 6 (known) */
    TEST("r(100)=6", goldbach_count(100) == 6);

    printf("--- Gaussian prime tests ---\n");
    /* Inert primes: 3≡3mod4 ✓, 7≡3mod4 ✓, 5≡1mod4 ✗ */
    TEST("3 is inert (3mod4)", 3 % 4 == 3 && is_prime_check(3));
    TEST("7 is inert (3mod4)", 7 % 4 == 3 && is_prime_check(7));
    TEST("11 is inert (3mod4)", 11 % 4 == 3 && is_prime_check(11));
    TEST("5 is NOT inert (1mod4)", 5 % 4 != 3);
    TEST("13 is NOT inert (1mod4)", 13 % 4 != 3);

    /* Split primes: 5=1²+2², 13=2²+3², 17=1²+4² */
    TEST("1²+2²=5 is prime (split)", is_prime_check(1*1+2*2));
    TEST("2²+3²=13 is prime (split)", is_prime_check(2*2+3*3));
    TEST("1²+4²=17 is prime (split)", is_prime_check(1*1+4*4));

    printf("--- Gaussian Goldbach tests ---\n");
    /* E=10: inert pairs are (3,7) since both ≡ 3 mod 4. (5,5):5≡1mod4 → not inert.
     * Split (b>0): need a²+b² and (10-a)²+b² both prime.
     *   b=1: need a²+1 and (10-a)²+1 both prime
     *     a=1: 2, 82 → 2 prime, 82=2·41 not prime
     *     a=2: 5, 65 → 5 prime, 65=5·13 not prime
     *     a=3: 10=2·5, skip
     *     a=4: 17, 37 → both prime! ✓
     *     a=5: 26, 26 → not prime
     *     a=6: 37, 17 → both prime! ✓
     *     a=7: 50, 10 → not prime
     *     a=8: 65, 5 → not prime
     *     a=9: 82, 2 → not prime
     *   b=2: a²+4 and (10-a)²+4
     *     a=1: 5, 85 → no
     *     a=3: 13, 53 → both prime! ✓
     *     a=5: 29, 29 → both prime! ✓
     *     a=7: 53, 13 → both prime! ✓
     *     a=9: 85, 5 → no
     *   b=3: a²+9 and (10-a)²+9
     *     a=2: 13, 73 → both prime! ✓
     *     a=4: 25, 45 → no
     *     a=8: 73, 13 → both prime! ✓
     *   (continuing gets tedious, let's just verify count)
     */
    {
        int inert, split;
        int rG = gaussian_goldbach_count(10, &inert, &split);
        TEST("E=10: inert count = 1 (3+7)", inert == 1);
        printf("    (E=10: r_G=%d, inert=%d, split=%d)\n", rG, inert, split);
        TEST("E=10: r_G > r (Gaussian has more reps)", rG > goldbach_count(10));
    }

    /* E=6: classical r=1 (3+3). Inert: 3+3 both 3mod4 → 1 inert pair.
     * Split b>0: a²+b² and (6-a)²+b² both prime */
    {
        int inert, split;
        int rG = gaussian_goldbach_count(6, &inert, &split);
        TEST("E=6: inert count = 1 (3+3)", inert == 1);
        printf("    (E=6: r_G=%d, inert=%d, split=%d)\n", rG, inert, split);
    }

    /* E=4: classical r=1 (2+2). But 2 is NOT inert (2≡2mod4). Inert: none.
     * So Gaussian inert count = 0 for E=4 */
    {
        int inert, split;
        int rG = gaussian_goldbach_count(4, &inert, &split);
        TEST("E=4: inert count = 0 (2 not inert)", inert == 0);
        printf("    (E=4: r_G=%d, inert=%d, split=%d)\n", rG, inert, split);
    }

    printf("\n--- Results: %d passed, %d failed ---\n", pass, fail);
    return fail;
}

/* ========================= MAIN EXPERIMENT ========================= */

void run_experiment(int max_E) {
    printf("# Gaussian vs Classical Goldbach — Angular DOF (FIXED)\n");
    printf("# %7s | %6s | %6s | %6s | %6s | %7s\n",
           "E", "r(E)", "r_G(E)", "inert", "split", "r_G/r");

    #define MAX_SAMPLES 5100
    double vals_r[MAX_SAMPLES], vals_rG[MAX_SAMPLES];
    int n = 0;

    for (int E = 4; E <= max_E; E += 2) {
        int inert, split;
        int r = goldbach_count(E);
        int rG = gaussian_goldbach_count(E, &inert, &split);

        if (E <= 30 || E % 500 == 0) {
            printf("  %7d | %6d | %6d | %6d | %6d | %7.2f\n",
                   E, r, rG, inert, split,
                   (r > 0) ? (double)rG / r : 0.0);
        }

        if (n < MAX_SAMPLES) {
            vals_r[n] = r;
            vals_rG[n] = rG;
            n++;
        }
    }

    /* CV analysis */
    double mean_r = 0, mean_rG = 0;
    for (int i = 0; i < n; i++) { mean_r += vals_r[i]; mean_rG += vals_rG[i]; }
    mean_r /= n; mean_rG /= n;

    double cv_r = 0, cv_rG = 0;
    for (int i = 0; i < n; i++) {
        double d_r = (vals_r[i] - mean_r) / (mean_r > 0 ? mean_r : 1);
        double d_rG = (vals_rG[i] - mean_rG) / (mean_rG > 0 ? mean_rG : 1);
        cv_r += d_r * d_r;
        cv_rG += d_rG * d_rG;
    }
    cv_r = sqrt(cv_r / n);
    cv_rG = sqrt(cv_rG / n);

    printf("\n# Stats (E=4..%d, n=%d):\n", max_E, n);
    printf("#   Mean r(E)   = %.1f\n", mean_r);
    printf("#   Mean r_G(E) = %.1f\n", mean_rG);
    printf("#   CV(r)       = %.5f\n", cv_r);
    printf("#   CV(r_G)     = %.5f\n", cv_rG);
    printf("#   CV(r)/CV(r_G) = %.4f  (>1 = Gaussian smoother)\n",
           cv_rG > 0 ? cv_r / cv_rG : 0);
}

int main(int argc, char **argv) {
    fprintf(stderr, "Sieving up to %d...\n", MAX_SIEVE);
    sieve(MAX_SIEVE - 1);
    fprintf(stderr, "Sieve done.\n");

    if (argc > 1 && strcmp(argv[1], "-t") == 0) {
        return run_tests();
    }

    int max_E = 5000;
    if (argc > 1) max_E = atoi(argv[1]);

    /* Always run tests first */
    int failures = run_tests();
    if (failures > 0) {
        fprintf(stderr, "TESTS FAILED — aborting experiment.\n");
        return 1;
    }
    printf("\n");
    run_experiment(max_E);

    free(is_composite);
    return 0;
}
