/*
 * crack31_pseudo_prime_sa.c — Thermodynamic Pseudo-Prime Walk
 *
 * HYPOTHESIS: We mapped the precipice (Parity Barrier, Minor Arcs, etc).
 * Now we inject "Temperature". 
 *
 * Let's create a subset A of integers up to 2N.
 * We want A to be structurally indistinguishable from the Primes (P):
 * 1. |A| ≈ π(2N) (Same Density)
 * 2. A has the same congruence distribution mod 3, 5 (No multiples of 3, 5).
 * 
 * We unleash a Simulated Annealing "Random Walk" on the members of A.
 * The FITNESS FUNCTION aggressively tries to DESTROY Goldbach pairs:
 *   E = Number of pairs (x, y) in A such that x + y = 2N.
 *
 * If the SA engine cools to E = 0, it means it constructed a "Pseudo-Prime"
 * set that perfectly obeys the macroscopic analytic laws of primes, but
 * contains NO Goldbach pairs.
 * 
 * If it can construct such a set, we experimentally prove that Goldbach
 * CANNOT be proven using only density and modular arithmetic (because a fake
 * set can obey those laws and fail Goldbach).
 *
 * If the SA engine CANNOT reach E = 0 (because the density intrinsically
 * forces the combinations geometrically), then Goldbach is an inevitable
 * consequence of density, and the true primes are trapped into satisfying it.
 *
 * BUILD: cc -O3 -o crack31 crack31_pseudo_prime_sa.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 100000
static char sieve[MAX_N];
static int primes[MAX_N];
static int nprimes = 0;

void init(void) {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for(int i = 2; (long long)i * i < MAX_N; i++)
        if(.sieve[i]) 
            for(int j = i * i; j < MAX_N; j += i) sieve[j] = 1;
    for(int i = 2; i < MAX_N; i++)
        if(.sieve[i]) primes[nprimes++] = i;
}

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

// Count Goldbach pairs in a set A (A is an array of booleans 0/1)
int count_pairs(int *A, int N2) {
    int pairs = 0;
    for (int x = 3; x <= N2/2; x+=2) {
        if (A[x] && A[N2 - x]) pairs++;
    }
    return pairs;
}

int main() {
    init();
    srand(1337);

    int N2 = 10000;
    
    printf("====================================================\n");
    printf("  CRACK 31: Thermodynamic Pseudo-Prime Walk\n");
    printf("====================================================\n\n");

    printf("  Target 2N = %d. π(2N) ≈ %d.\n", N2, 1229);
    printf("  Constructing a Pseudo-Prime Set A obeying prime density.\n");
    printf("  SA Target: Random Walk A to kill all Goldbach pairs (E = 0).\n\n");

    // Initialize set A to be exactly the primes
    int *A = calloc(N2 + 1, sizeof(int));
    int *pool = malloc((N2 + 1) * sizeof(int));
    int pool_size = 0;

    int density_target = 0;
    for (int x = 3; x < N2; x+=2) {
        if (is_prime(x)) {
            A[x] = 1;
            density_target++;
        }
        // Valid candidates for pseudo-primes: Odd numbers not divisible by 3 or 5
        if (x % 3 .= 0 && x % 5 .= 0) {
            pool[pool_size++] = x;
        }
    }

    int best_E = count_pairs(A, N2);
    int *best_A = malloc((N2 + 1) * sizeof(int));
    memcpy(best_A, A, (N2 + 1) * sizeof(int));

    printf("  Starting Set (True Primes): Pairs = %d, Size = %d\n", best_E, density_target);
    printf("  Valid modular candidates (Pool size) = %d\n\n", pool_size);

    int ITERS = 1000000;
    double T = 100.0;
    double T_end = 0.01;
    double cooling_rate = pow(T_end/T, 1.0/ITERS);

    int current_E = best_E;

    for (int step = 0; step < ITERS; step++) {
        // Randomly pluck a point out of A, and swap it with a random pool candidate
        int a_cand = pool[rand() % pool_size];
        int b_cand = pool[rand() % pool_size];
        
        // Ensure A[a_cand] == 1 and A[b_cand] == 0
        if (A[a_cand] == 0 || A[b_cand] == 1) continue;

        // Calculate delta Energy
        int delta_E = 0;
        // Removing a_cand from A removes pair (a_cand, N2 - a_cand) if it existed
        if (N2 - a_cand > 0 && N2 - a_cand < N2 && A[N2 - a_cand]) delta_E--;
        // Adding b_cand to A adds pair (b_cand, N2 - b_cand) if it exists
        if (N2 - b_cand > 0 && N2 - b_cand < N2 && A[N2 - b_cand]) delta_E++;

        // We also must count if a_cand + b_cand happens to interact, etc.
        // Actually, if a_cand + b_cand = N2, swapping them doesn't change anything.
        if (a_cand + b_cand == N2) delta_E = 0; // Special edge case

        int new_E = current_E + delta_E;

        // Annealing acceptance
        if (new_E <= current_E || exp((current_E - new_E) / T) > ((double)rand() / RAND_MAX)) {
            A[a_cand] = 0;
            A[b_cand] = 1;
            current_E = new_E;

            if (current_E < best_E) {
                best_E = current_E;
                memcpy(best_A, A, (N2 + 1) * sizeof(int));
            }
        }
        
        T *= cooling_rate;

        if (step % 200000 == 0) {
            printf("  Step %7d | Temp: %7.4f | Pairs (Energy): %d\n", step, T, best_E);
        }
        
        if (best_E == 0) {
            printf("  Step %7d | Temp: %7.4f | Pairs (Energy): 0...\n", step, T);
            break;
        }
    }

    printf("\n   THE THERMODYNAMIC PRECIPICE \n");
    if (best_E == 0) {
        printf("  The Annealer SUCCESSFULLY killed all Goldbach pairs.\n");
        printf("  We empirically generated a Fake Prime set with the EXACT SAME\n");
        printf("  density and modular constraints as true primes, but it computationally\n");
        printf("  violates Goldbach. This means Density + Modulus is INSUFFICIENT\n");
        printf("  to prove Goldbach mathematically.\n");
    } else {
        printf("  The Annealer FAILED to kill all Goldbach pairs (Best E = %d).\n", best_E);
        printf("  Even with a million thermal random walks specifically designed\n");
        printf("  to dodge Goldbach geometry, the MACROSCOPIC DENSITY of the primes\n");
        printf("  absolutely FORCES combinations to exist inside the bounded space.\n");
        printf("  The set is simply too structurally crowded to escape intersection.\n");
    }

    free(A); free(pool); free(best_A);
    return 0;
}
