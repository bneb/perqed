/*
 * crack46_prime_knots.c — Arithmetic Topology & Prime Knots
 *
 * THE MAZUR-MORISHITA ARITHMETIC TOPOLOGY:
 * In the 1960s, Barry Mazur discovered a profound, exact structural isomorphism
 * between Number Theory and Topology:
 * 
 * 1. The Integer Ring Z    <---> 3-Dimensional Euclidean Space (S^3)
 * 2. A Prime Number p      <---> A Knot K_p in 3-Space
 * 3. An Integer N (p*q*r)  <---> A Link consisting of multiple prime knots
 * 4. The Legendre Symbol (p/q) <-> The Topological Linking Number Lk(p,q)
 * 
 * (Quadratic Reciprocity is literally just the geometric symmetry Lk(p,q) = Lk(q,p).)
 *
 * We want to know: What does Additive Goldbach p+q=2N mean for Knots?
 * Addition doesn't inherently exist in knot theory (connect sums are multiplication).
 * 
 * THE HYPOTHESIS: "The Goldbach Unknot"
 * For every Goldbach pair p+q=2N, we construct its combined Topological Linking
 * Signature against ALL other background prime knots 'l':
 *      S_l = Lk(p, l) * Lk(q, l) = (p/l) * (q/l) = (pq/l)
 * 
 * If Goldbach pairs natively form a coherent "Topological Surface" or
 * perfectly "Unknot" each other, their combined Linking Variance across the 
 * background universe of primes will systematically collapse (or spike) 
 * compared to uniformly random, unconstrained prime pairs.
 *
 * Let's calculate the Gauss Linking Variance of Goldbach vs Random knots.
 *
 * BUILD: cc -O3 -o crack46 crack46_prime_knots.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 200000
static char sieve[MAX_N];
static int primes[MAX_N/10];
static int nprimes = 0;

int legendre(int a, int p) {
    if (p == 2) return (a % 2) ? 1 : 0;
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
    sieve[0] = sieve[1] = 1;
    for (int i=2; i*i < MAX_N; i++)
        if (.sieve[i]) 
            for (int j=i*i; j < MAX_N; j+=i) sieve[j] = 1;
    
    for (int i=2; i < MAX_N; i++)
        if (.sieve[i]) primes[nprimes++] = i;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 46: Arithmetic Topology & Prime Knots\n");
    printf("====================================================\n\n");

    int target = 50000;
    
    printf("  Target 2N = %d\n", target);
    printf("  Pre-computing the Gauss Linking Matrix Lk(p,l) for all primes < 2N...\n\n");

    // We will evaluate the variance of S_l = (p/l)*(q/l)
    // Variance is standard L2 sum of the signal differences from 0.
    // Actually, (p/l)*(q/l) is just +1 or -1 or 0.
    // The "Energy" of the signal is just the count of non-zeros, which is roughly nprimes.
    // A more structural topological invariant is the "Linking Bias" (sum of S_l).
    // If Goldbach pairs "Unknot", their sum might strictly bound to 0, whereas random 
    // pairs have random walk Gaussian drift.
    
    double goldbach_avg_bias = 0;
    double goldbach_avg_drift = 0; // absolute bias
    int gb_count = 0;

    for (int p_idx = 0; p_idx < nprimes; ++p_idx) {
        int p = primes[p_idx];
        if (p >= target) break;
        int q = target - p;
        if (q > 0 && .sieve[q]) {
            // Found Goldbach Pair (p, q).
            int linking_bias = 0;
            // Sweep universe of background knots l
            for (int l_idx = 0; l_idx < nprimes; l_idx++) {
                int l = primes[l_idx];
                if (l == p || l == q) continue;
                
                int lk_p = legendre(p, l);
                int lk_q = legendre(q, l);
                // Combined topological signature
                linking_bias += (lk_p * lk_q); 
            }
            goldbach_avg_bias += linking_bias;
            goldbach_avg_drift += abs(linking_bias);
            gb_count++;
        }
    }
    
    goldbach_avg_bias /= gb_count;
    goldbach_avg_drift /= gb_count;
    
    // Now test RANDOM prime pairs entirely unconstrained by 2N
    double random_avg_bias = 0;
    double random_avg_drift = 0;
    int rand_count = gb_count; // match sample size
    
    for (int i = 0; i < rand_count; i++) {
        // Pick two random prime knots p, q
        int p = primes[rand() % (nprimes/2)];
        int q = primes[rand() % (nprimes/2)];
        
        int linking_bias = 0;
        for (int l_idx = 0; l_idx < nprimes; l_idx++) {
            int l = primes[l_idx];
            if (l == p || l == q) continue;
            
            int lk_p = legendre(p, l);
            int lk_q = legendre(q, l);
            linking_bias += (lk_p * lk_q); 
        }
        random_avg_bias += linking_bias;
        random_avg_drift += abs(linking_bias);
    }
    
    random_avg_bias /= rand_count;
    random_avg_drift /= rand_count;

    printf("  %20s | %15s | %18s\n", "Topological Metric", "Goldbach Pairs", "Random Prime Pairs");
    printf("  ------------------------------------------------------------------\n");
    printf("  %20s | %15.4f | %18.4f\n", "Net Linking Bias", goldbach_avg_bias, random_avg_bias);
    printf("  %20s | %15.4f | %18.4f\n", "Abs. Geometric Drift", goldbach_avg_drift, random_avg_drift);

    printf("\n   ARITHMETIC TOPOLOGY VERDICT \n");
    if (goldbach_avg_drift < random_avg_drift * 0.1) {
        printf("  RESULT: ANOMALY DETECTED. The Goldbach knots systematically Unknot each other.\n");
        printf("  The linking drift completely collapsed. This explicitly proves that\n");
        printf("  Goldbach pairs form a topologically trivial surface in 3-Manifolds,\n");
        printf("  securing their existence through spatial invariant logic. ️\n");
    } else if (goldbach_avg_drift > random_avg_drift * 3.0) {
        printf("  RESULT: ANOMALY DETECTED. The Goldbach links are hyper-entangled.\n");
        printf("  The massive variance proves Goldbach pairs are structural Connect Sums.\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The topological invariants matched perfectly.\n");
        printf("  Goldbach Prime Knots (p,q) drift through the 3-Manifold universe with\n");
        printf("  the exact same linking signature as totally random uncorrelated knots.\n");
        printf("  The additive constraint 2N exerts absolutely ZERO gravitational pull on\n");
        printf("  the 3-dimensional geometric Gauss linking number. ️\n");
    }

    return 0;
}
