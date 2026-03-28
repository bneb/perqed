/*
 * crack22_mod30.c — Exhaustive Modular Deductions (Primorials)
 *
 * HYPOTHESIS: Can we choose M such that M-p is ALWAYS divisible
 * by small primes? (e.g., use mod 30 to exhaustively exclude cases).
 *
 * APPROACH:
 * For a primorial basis P_k = 2 * 3 * 5 * ... * q_k.
 * M is some even integer.
 * Can we choose M (mod P_k) such that for ALL primes p,
 * M - p shares a factor with P_k? (i.e., gcd(M-p, P_k) > 1).
 *
 * Let's calculate for every possible even M mod P_k:
 * How many of the φ(P_k) coprime classes for 'p' result in
 * gcd(M-p, P_k) == 1 ?
 *
 * If ANY M has 0 classes, we have a complete exclusion.
 * If the minimum classes > 0, then by Dirichlet's Theorem,
 * there are infinitely many primes p that ESCAPE the small factors,
 * meaning M-p can only be composite if it's factored by primes > q_k.
 *
 * BUILD: cc -O3 -o crack22 crack22_mod30.c
 */

#include <stdio.h>
#include <stdlib.h>

int gcd(int a, int b) { return b == 0 ? a : gcd(b, a%b); }

int main() {
    printf("====================================================\n");
    printf("  CRACK 22: Primorial Modulus Exhaustion\n");
    printf("====================================================\n\n");

    int primes[] = {2, 3, 5, 7, 11, 13, 17};
    int num_p = 7;
    long long Pk = 1;

    for (int k = 0; k < num_p; k++) {
        Pk *= primes[k];
        
        long long phi = 1;
        for (int i = 0; i <= k; i++) phi *= (primes[i] - 1);

        printf("  Basis P_%d = %lld (Primes up to %d)\n", k+1, Pk, primes[k]);
        printf("  Number of coprime prime-classes φ(P_k) = %lld\n", phi);

        long long min_escapes = phi + 1;
        long long max_escapes = 0;
        long long best_M = -1;

        for (long long M = 0; M < Pk; M += 2) { // M must be even
            long long escapes = 0;
            
            for (long long p = 1; p < Pk; p++) {
                if (gcd(p, Pk) == 1) { // p is a valid prime-class
                    long long diff = (M - p + Pk) % Pk;
                    if (gcd(diff, Pk) == 1) { // M-p escapes all prime factors in P_k.
                        escapes++;
                    }
                }
            }

            if (escapes < min_escapes) {
                min_escapes = escapes;
                best_M = M;
            }
            if (escapes > max_escapes) {
                max_escapes = escapes;
            }
        }

        printf("  MIN escaping prime-classes across all even M: %lld\n", min_escapes);
        printf("  MAX escaping prime-classes across all even M: %lld\n", max_escapes);
        
        // Compute expectation: φ(Pk) * Π (1 - 1/(q-1)) ? Actually it's simpler.
        // Let's just output the theoretical formula:
        long long theoretical_min = 1;
        for (int i = 1; i <= k; i++) theoretical_min *= (primes[i] - 2);
        
        printf("  Theoretical Minimum Formula Π_{q|Pk, q>2} (q-2): %lld\n", theoretical_min);
        printf("  --------------------------------------------------\n");
    }

    printf("\n   FATAL CONCLUSION \n");
    printf("  For ANY even M, the number of prime-classes 'p' that\n");
    printf("  force M-p to be coprime to EVERYTHING up to q_k is: \n");
    printf("     N(escapes) ≥ Π_{q|P_k, q>2} (q - 2)\n\n");
    printf("  Because (q-2) > 0 for all q > 2, this product NEVER HITS ZERO.\n");
    printf("  By Dirichlet's Theorem, there are INFINITELY many primes in each class.\n");
    printf("  So you can NEVER exhaustively trap M-p into small prime factors.\n");

    return 0;
}
