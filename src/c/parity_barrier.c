/*
 * parity_barrier.c — The OTHER Barrier to Binary Goldbach
 *
 * We spent 27 approaches on zero-density (A = 30/13).
 * But even with DH (A=2), binary Goldbach is not proven!
 * The SECOND barrier is the PARITY PROBLEM of sieve theory.
 *
 * Sieve methods show: N = p + P₂ (Chen, 1966)
 * where P₂ has at most 2 prime factors.
 * But sieves CANNOT upgrade P₂ to P₁ (actual prime).
 *
 * Why? Sieves count by INCLUSION-EXCLUSION and inherently
 * confuse "n has k prime factors" with "n has k±1 prime factors."
 * This is the PARITY BARRIER.
 *
 * Can we break it for Goldbach specifically?
 *
 * BUILD: cc -O3 -o parity_barrier parity_barrier.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 1000001
static char sieve[MAX_N];
int omega[MAX_N]; /* number of distinct prime factors */

void init(int limit) {
    memset(sieve, 0, limit+1);
    memset(omega, 0, sizeof(int)*(limit+1));
    sieve[0]=sieve[1]=1;
    for (int i = 2; i <= limit; i++) {
        if (!sieve[i]) {
            for (int j = i; j <= limit; j += i) {
                if (j > i) sieve[j] = 1;
                omega[j]++;
            }
        }
    }
}

int is_prime(int n) { return n >= 2 && !sieve[n]; }

int main() {
    init(MAX_N-1);

    printf("═══════════════════════════════════════════════════\n");
    printf("  THE PARITY BARRIER: The OTHER Goldbach Obstacle\n");
    printf("═══════════════════════════════════════════════════\n\n");

    /* ════════════ THE PARITY PROBLEM ════════════ */
    printf("## 1. What Sieves CAN Do\n\n");

    printf("  CHEN'S THEOREM (1966):\n");
    printf("  Every sufficiently large even N = p + m\n");
    printf("  where p is prime and m has at most 2 prime factors.\n\n");

    printf("  Checking: for each even N, find representations:\n");
    printf("    N = p + q  (both prime) → GOLDBACH\n");
    printf("    N = p + q₁q₂ (p prime, q₁q₂ semiprime) → CHEN\n\n");

    int goldbach_count = 0, chen_only = 0, neither = 0;
    for (int N = 4; N <= 10000; N += 2) {
        int has_goldbach = 0, has_chen = 0;
        for (int p = 2; p <= N/2; p++) {
            if (!is_prime(p)) continue;
            int m = N - p;
            if (is_prime(m)) has_goldbach = 1;
            if (omega[m] <= 2 && m > 1) has_chen = 1;
        }
        if (has_goldbach) goldbach_count++;
        else if (has_chen) chen_only++;
        else neither++;
    }
    printf("  Even N ∈ [4, 10000]:\n");
    printf("    Goldbach representations: %d (%.1f%%)\n",
           goldbach_count, 100.0*goldbach_count/4999);
    printf("    Chen only (P₂ not prime): %d\n", chen_only);
    printf("    Neither: %d\n\n", neither);

    /* ════════════ PARITY VISUALIZATION ════════════ */
    printf("## 2. The Parity Distribution of N-p\n\n");

    printf("  For each N, count: among p ≤ N with N-p having\n");
    printf("  k prime factors, what fraction has k odd vs even?\n\n");

    printf("  If sieve could distinguish parity:\n");
    printf("    odd ω → weighted 1, even ω → weighted -1\n");
    printf("    Sum would detect primes (ω = 1, odd)\n\n");

    printf("  The Möbius function μ(n) = (-1)^{ω(n)}·[n squarefree]\n");
    printf("  captures parity. The sieve barrier is:\n");
    printf("    Σ_p μ(N-p) ≈ 0 (cancellation!)\n");
    printf("  vs what we want:\n");
    printf("    Σ_p 1_{N-p prime} ≈ C·N/log²N (positive!)\n\n");

    printf("  %8s | %8s | %8s | %8s | %s\n",
           "N", "Σμ(N-p)", "#p|N-p∈P", "ratio", "parity cancel?");

    int Ns[] = {100, 500, 1000, 5000, 10000, 50000, 100000, 0};
    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        if (N % 2 != 0) N++;
        int mu_sum = 0, prime_count = 0;
        for (int p = 2; p < N; p++) {
            if (!is_prime(p)) continue;
            int m = N - p;
            if (m < 2) continue;
            if (is_prime(m)) prime_count++;

            /* Compute μ(m) */
            int temp = m, mu_val = 1, sq_free = 1;
            for (int d = 2; d*d <= temp; d++) {
                if (temp % d == 0) {
                    mu_val *= -1;
                    temp /= d;
                    if (temp % d == 0) { sq_free = 0; break; }
                }
            }
            if (temp > 1) mu_val *= -1;
            if (!sq_free) mu_val = 0;
            mu_sum += mu_val;
        }
        printf("  %8d | %8d | %8d | %8.2f | %s\n",
               N, mu_sum, prime_count, (double)mu_sum/prime_count,
               fabs(mu_sum) < prime_count/2 ? "YES — heavy cancel" : "NO");
    }

    /* ════════════ BREAKING PARITY ════════════ */
    printf("\n## 3. Known Parity Breakers\n\n");

    printf("  Friedlander-Iwaniec (1998): primes of form a²+b⁴\n");
    printf("  Heath-Brown (2001): primes of form x³+2y³\n\n");

    printf("  Their technique: BILINEAR DECOMPOSITION.\n");
    printf("  Write n = m₁·m₂ and estimate:\n");
    printf("    Σ_{m₁~M₁} Σ_{m₂~M₂} a_{m₁}·b_{m₂}·1_{m₁m₂∈S}\n");
    printf("  where S is the target set (primes of special form).\n\n");

    printf("  The bilinear form exploits CANCELLATION between\n");
    printf("  the a_{m₁} and b_{m₂} that the sieve misses.\n\n");

    printf("  For Goldbach: S = {N-p : p prime, N-p prime}.\n");
    printf("  The bilinear decomposition would be:\n");
    printf("    Σ_{m₁m₂ = N-p} a_{m₁}·b_{m₂}·1_{N-p prime}\n\n");

    printf("  🔴 PROBLEM: N-p ranges over ALL integers ≤ N.\n");
    printf("  It's not of a SPECIAL FORM (like a²+b⁴).\n");
    printf("  The Friedlander-Iwaniec technique works because\n");
    printf("  a²+b⁴ has algebraic STRUCTURE (it's a norm form).\n");
    printf("  N-p has NO algebraic structure — it's generic.\n\n");

    printf("  This is why parity breaking for Goldbach is HARDER\n");
    printf("  than for Friedlander-Iwaniec.\n\n");

    /* ════════════ WHAT WOULD WORK ════════════ */
    printf("## 4. What Would Break Parity for Goldbach?\n\n");

    printf("  OPTION A: Prove a LEVEL OF DISTRIBUTION result\n");
    printf("  for primes in arithmetic progressions beyond x^{1/2}.\n\n");

    printf("  Bombieri-Vinogradov: level θ = 1/2 (proved)\n");
    printf("  Elliott-Halberstam: level θ = 1 (conjectured)\n\n");

    printf("  With Elliott-Halberstam:\n");
    printf("    N = p + q for all large even N (binary Goldbach!)\n");
    printf("  This was shown by:\n");
    printf("    Goldston-Pintz-Yıldırım (2005, conditional on EH)\n");
    printf("    Actually: GPY+EH gives bounded prime gaps, not Goldbach.\n\n");

    printf("  For Goldbach specifically with EH:\n");
    printf("    Chen's method + EH → binary Goldbach? Not clear.\n");
    printf("    The connection is through TYPE I and TYPE II sums.\n\n");

    printf("  OPTION B: Find a COMBINATORIAL PROOF.\n");
    printf("  Avoid sieves and analytic methods entirely.\n");
    printf("  Use the STRUCTURE of primes directly.\n\n");

    printf("  What structure? Primes are:\n");
    printf("  • Dense enough: π(N) ~ N/logN\n");
    printf("  • Well-distributed in residue classes (Dirichlet)\n");
    printf("  • Not concentrated in an arithmetic progression\n");
    printf("  • Have sumset A+A covering most even numbers\n\n");

    printf("  For A+A to cover ALL even numbers:\n");
    printf("  Need: for every even N, ∃ p,q ∈ A with p+q = N.\n");
    printf("  Sufficient: A is a SCHNIRELMANN basis of order 2.\n\n");

    printf("  Schnirelmann density: d(A) = inf_{n} A(n)/n\n");
    printf("  where A(n) = #{a ∈ A : a ≤ n}.\n\n");

    printf("  THEOREM (Schnirelmann 1930):\n");
    printf("    d(A) > 0 + additive 'almost everywhere'\n");
    printf("    → A is an additive basis of FINITE order.\n\n");

    printf("  For primes: d(A) = 0 (π(n)/n → 0).\n");
    printf("  So Schnirelmann doesn't directly apply.\n\n");

    printf("  But primes + {1} has d > 0 (Romanov).\n");
    printf("  And Vinogradov's theorem gives ternary Goldbach.\n\n");

    /* ════════════ COMPUTATIONAL EXPERIMENT ════════════ */
    printf("## 5. Computational: Can Additive Combinatorics Help?\n\n");

    printf("  Explore: the SUMSET STRUCTURE of primes.\n");
    printf("  For A = primes up to N, compute |A+A| / |possible even| .\n\n");

    printf("  %8s | %8s | %8s | %8s | %s\n",
           "N", "|primes|", "|A+A|", "coverage", "missing");

    int limits[] = {100, 500, 1000, 5000, 10000, 50000, 100000, 0};
    for (int li = 0; limits[li]; li++) {
        int N = limits[li];
        /* Count primes */
        int nprimes = 0;
        for (int p = 2; p <= N; p++) if (is_prime(p)) nprimes++;

        /* Count even numbers 4..2N that are p+q */
        /* Use a bitmap */
        int max_sum = 2*N;
        int covered = 0, total_even = 0;
        /* For efficiency, just check even numbers up to N */
        int missing = 0;
        for (int e = 4; e <= N; e += 2) {
            total_even++;
            int found = 0;
            for (int p = 2; p <= e/2; p++) {
                if (is_prime(p) && is_prime(e-p)) { found = 1; break; }
            }
            if (found) covered++;
            else missing++;
        }

        printf("  %8d | %8d | %8d | %7.3f%% | %d\n",
               N, nprimes, covered, 100.0*covered/total_even, missing);
    }

    printf("\n  Every even N in [4, 100000] is the sum of two primes.\n");
    printf("  (Verified up to 4×10¹⁸ computationally.)\n\n");

    /* ════════════ SYNTHESIS ════════════ */
    printf("## 6. The Two-Barrier Summary\n\n");

    printf("  BARRIER 1: Zero-Density (A = 30/13)\n");
    printf("  ────────────────────────────────────\n");
    printf("  Explored: 27 approaches, all blocked\n");
    printf("  Root cause: parabolic geometry of e(t·logn)\n");
    printf("  Status: STRUCTURAL (not technical)\n\n");

    printf("  BARRIER 2: Parity Problem\n");
    printf("  ─────────────────────────\n");
    printf("  Explored: sieves, bilinear decomposition, EH\n");
    printf("  Root cause: inclusion-exclusion can't detect Ω(n) mod 2\n");
    printf("  Status: STRUCTURAL (Selberg proved it's inherent to sieves)\n\n");

    printf("  To prove binary Goldbach, must break BOTH barriers.\n");
    printf("  Or find an approach that avoids BOTH.\n\n");

    printf("  Known approaches avoiding both:\n");
    printf("  (i)  Circle method + GRH → binary Goldbach\n");
    printf("       (avoids parity, uses GRH instead of zero-density)\n");
    printf("  (ii) Direct combinatorial proof\n");
    printf("       (avoids both, but no known approach)\n\n");

    printf("  ★ THE HONEST STATE OF THE ART:\n");
    printf("  Binary Goldbach is INACCESSIBLE by current methods.\n");
    printf("  It requires EITHER:\n");
    printf("    • GRH (too hard)\n");
    printf("    • DH + parity breaking (both structural barriers)\n");
    printf("    • A genuinely new idea that avoids all known obstacles\n\n");

    printf("  This IS the frontier of analytic number theory.\n");

    return 0;
}
