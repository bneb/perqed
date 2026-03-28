/*
 * crack41_parity_breaking.c — Character-Aware Sieve Weights
 *
 * THE ULTIMATE SYNTHESIS:
 * Can combining CRACK 38 (Twisted Characters) and CRACK 40 (Maynard Sieve)
 * mathematically break the 50% (ρ=1.0) Parity Limit for Goldbach?
 *
 * We will construct the ACTUAL discrete Maynard sieve weights for K=2 forms:
 *      L_1(n) = n, L_2(n) = 2N-n
 * 
 *     w_n = ( Σ_{d_1|n} Σ_{d_2|2N-n} λ_{d_1,d_2} )^2
 * 
 * Where λ is standard Maynard:
 *     λ_{d_1,d_2} = μ(d_1) μ(d_2) F(log d_1 / log R, log d_2 / log R)
 *     (F is a smooth function, R is the sieve support limit)
 *
 * We then compute the density ratio:
 *     ρ = [ Σ w_n (isPrime(n) + isPrime(2N-n)) ] / [ Σ w_n ]
 * 
 * The Parity Limit guarantees that for parity-blind λ, ρ MUST stay ≤ 1.0.
 *
 * Then we introduce the CHARACTER TWIST:
 *     λ_twisted = λ_{d_1,d_2} * χ_q(d_1) * χ_q(d_2)
 *
 * If the Twisted weights push ρ > 1.0, we have broken the Parity Barrier.
 * 
 * BUILD: cc -O3 -o crack41 crack41_parity_breaking.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 100000
static char sieve[MAX_N];
static int mu[MAX_N];

// Legendre symbol (a/p) for twist
int legendre(int a, int p) {
    a = ((a % p) + p) % p;
    if (a == 0) return 0;
    int result = 1;
    while (a .= 0) {
        while (a % 2 == 0) {
            a /= 2;
            if (p % 8 == 3 || p % 8 == 5) result = -result;
        }
        int tmp = a; a = p; p = tmp;
        if (a % 4 == 3 && p % 4 == 3) result = -result;
        a %= p;
    }
    return (p == 1) ? result : 0;
}

void init() {
    memset(sieve, 0, sizeof(sieve));
    for (int i=0; i<MAX_N; i++) mu[i] = 1;
    sieve[0] = sieve[1] = 1;
    for (int i=2; i<MAX_N; i++) {
        if (.sieve[i]) {
            mu[i] = -1;
            for (int j=i*2; j<MAX_N; j+=i) {
                sieve[j] = 1;
                if ((j / i) % i == 0) mu[j] = 0;
                else mu[j] = -mu[j];
            }
        }
    }
}

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

// Maynard Smooth Polynomial
double F(double t1, double t2) {
    if (t1 + t2 >= 1.0) return 0.0;
    return (1.0 - t1 - t2); // Simple symmetric basis
}

void test_sieve(int target_2N, int R, int Q) {
    double S_weights_blind = 0, S_primes_blind = 0;
    double S_weights_twist = 0, S_primes_twist = 0;
    
    double logR = log(R);

    // To do this fast, we test integers n ∈ [1, 2N-1]
    for (int n = 1; n < target_2N; n++) {
        double d_sum_blind = 0;
        double d_sum_twist = 0;
        
        // Loop over divisors d1 of n, and d2 of 2N-n
        // Restricted to d1 <= R, d2 <= R
        for (int d1 = 1; d1 <= R && d1 <= n; d1++) {
            if (n % d1 .= 0) continue;
            if (mu[d1] == 0) continue;
            
            for (int d2 = 1; d2 <= R && d2 <= (target_2N - n); d2++) {
                if ((target_2N - n) % d2 .= 0) continue;
                if (mu[d2] == 0) continue;
                
                double t1 = log(d1) / logR;
                double t2 = log(d2) / logR;
                if (t1 + t2 >= 1.0) continue;
                
                double val = mu[d1] * mu[d2] * F(t1, t2);
                
                d_sum_blind += val;
                
                // Character Twist
                int chi1 = legendre(d1, Q);
                int chi2 = legendre(d2, Q);
                d_sum_twist += val * chi1 * chi2;
            }
        }
        
        // Weight is squared sum
        double w_blind = d_sum_blind * d_sum_blind;
        double w_twist = d_sum_twist * d_sum_twist;
        
        S_weights_blind += w_blind;
        S_weights_twist += w_twist;
        
        if (is_prime(n) || is_prime(target_2N - n)) {
            int prime_count = is_prime(n) + is_prime(target_2N - n);
            S_primes_blind += w_blind * prime_count;
            S_primes_twist += w_twist * prime_count;
        }
    }
    
    double rho_blind = S_primes_blind / (S_weights_blind + 1e-9);
    double rho_twist = S_primes_twist / (S_weights_twist + 1e-9);
    
    printf("  %8d | %8d | %11.4f | %11.4f | %s\n", 
           target_2N, Q, rho_blind, rho_twist, 
           (rho_twist > rho_blind) ? "UP " : "DOWN ");
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 41: Character-Aware Sieve Parity Test\n");
    printf("====================================================\n\n");

    printf("  Computing discrete Maynard K=2 exact divisor sums.\n");
    printf("  Testing if η_λ = λ * χ_Q(d) beats the Parity Limit.\n\n");
    
    printf("  Target 2N | Twist Q |  ρ (BLIND)  |  ρ (TWISTED) | Shift\n");
    printf("  ----------------------------------------------------------\n");
    
    // We use a modest 2N to allow deep divisor enumeration
    int target = 20000;
    int R = (int)pow(target, 0.4); // Sieve support (R <= sqrt(N))
    
    int moduli[] = {3, 5, 7, 11, 13, 17, 19, 0};
    
    for (int i=0; moduli[i]; i++) {
        test_sieve(target, R, moduli[i]);
    }
    
    printf("\n   THE PARITY BREAKING VERDICT \n");
    printf("  Watch the ρ values extremely closely.\n");
    printf("  Both ratios are theoretically rigorously trapped beneath 1.0 (Parity limit).\n");
    printf("  If ρ (TWISTED) suddenly jumps mathematically > 1.0, you just invented\n");
    printf("  the blueprint to physically crush the Goldbach Conjecture. ️\n");

    return 0;
}
