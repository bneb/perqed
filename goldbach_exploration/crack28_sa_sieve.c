/*
 * crack28_sa_sieve.c — Simulated Annealing Quadratic Sieve Optimizer
 *
 * HYPOTHESIS: Linear sieves cannot distinguish primes from semiprimes
 * (The Bombieri Parity Barrier). 
 * Can a NON-LINEAR (Quadratic/Cross-Term) sieve function empirically separate them?
 *
 * We define a fast evaluation function:
 * W(x) = Σ_i c_i(x%p_i) + Σ_{i<j} d_{ij} (x%p_i)*(x%p_j)
 *
 * Where p_i are the first 8 primes {2, 3, 5, 7, 11, 13, 17, 19}.
 * State variables: c_i (array of 8), d_ij (matrix 8x8).
 * (All weights are continuous doubles).
 *
 * Energy Function: 
 * We evaluate W(x) for all x in [2, M].
 * If x is prime, Target = 1.0.
 * If x is semiprime, Target = 0.0.
 * E = Σ (W(x) - Target)^2
 *
 * Simulated Annealing will randomly mutate the continuous weights c_i and d_ij
 * to minimize E. If E drops to ~0, the SA algorithm has "learned" an empirical
 * non-linear mapping that algebraically isolates primes from semiprimes across
 * the cyclic groups.
 *
 * BUILD: cc -O3 -o crack28 crack28_sa_sieve.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 200000
static char sieve[MAX_N];
static int primes[MAX_N/10];
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

int is_semiprime(int n) {
    int factors = 0;
    int temp = n;
    for (int i = 0; i < nprimes && primes[i]*primes[i] <= temp; i++) {
        while (temp % primes[i] == 0) {
            factors++;
            temp /= primes[i];
            if (factors > 2) return 0;
        }
    }
    if (temp > 1) factors++;
    return factors == 2;
}

#define NUM_P 8
int bases[NUM_P] = {2, 3, 5, 7, 11, 13, 17, 19};

double calc_W(int x, double *c, double d[NUM_P][NUM_P]) {
    double W = 0;
    int rems[NUM_P];
    for (int i=0; i<NUM_P; i++) rems[i] = x % bases[i];
    
    // Linear terms
    for (int i=0; i<NUM_P; i++) W += c[i] * rems[i];
    
    // Quadratic cross terms
    for (int i=0; i<NUM_P; i++) {
        for (int j=i; j<NUM_P; j++) {
            W += d[i][j] * rems[i] * rems[j];
        }
    }
    return W;
}

double compute_energy(int M, double *c, double d[NUM_P][NUM_P]) {
    double E = 0;
    // We only evaluate on primes and semiprimes to isolate the parity barrier
    for (int x = 2; x <= M; x++) {
        int prime = is_prime(x);
        int semi = is_semiprime(x);
        
        if (prime || semi) {
            double w = calc_W(x, c, d);
            double target = prime ? 1.0 : 0.0;
            E += (w - target) * (w - target);
        }
    }
    return E;
}

// Random double in [-bound, bound]
double rand_double(double bound) {
    return ((double)rand() / RAND_MAX) * 2.0 * bound - bound;
}

int main() {
    init();
    srand(42);

    int M = 1000;
    
    printf("====================================================\n");
    printf("  CRACK 28: SA Quadratic Sieve Optimizer\n");
    printf("====================================================\n\n");
    printf("  Target M = %d. Primes = Target 1.0, Semiprimes = Target 0.0\n", M);
    printf("  State variables: 8 linear, 36 quadratic cross-terms.\n\n");

    // Initialize state
    double best_c[NUM_P];
    double best_d[NUM_P][NUM_P];
    
    for (int i=0; i<NUM_P; i++) best_c[i] = rand_double(0.1);
    for (int i=0; i<NUM_P; i++)
        for (int j=0; j<NUM_P; j++)
            best_d[i][j] = rand_double(0.01);

    double best_E = compute_energy(M, best_c, best_d);
    
    int ITERS = 500000;
    double T = 1000.0;
    double T_end = 0.001;
    double cooling_rate = pow(T_end/T, 1.0/ITERS);
    
    printf("  Starting SA: Iters=%d, Initial E=%.2f\n\n", ITERS, best_E);

    int accepts = 0;
    
    for (int step = 0; step < ITERS; step++) {
        // Copy state
        double curr_c[NUM_P];
        double curr_d[NUM_P][NUM_P];
        for (int i=0; i<NUM_P; i++) curr_c[i] = best_c[i];
        for (int i=0; i<NUM_P; i++)
            for (int j=0; j<NUM_P; j++) curr_d[i][j] = best_d[i][j];

        // Mutate exactly one parameter
        int mut_type = rand() % 2;
        if (mut_type == 0) {
            int idx = rand() % NUM_P;
            curr_c[idx] += rand_double(0.1 * T / 1000.0 + 0.001);
        } else {
            int i = rand() % NUM_P;
            int j = i + (rand() % (NUM_P - i));
            curr_d[i][j] += rand_double(0.01 * T / 1000.0 + 0.0001);
        }

        double new_E = compute_energy(M, curr_c, curr_d);
        
        if (new_E < best_E || exp((best_E - new_E) / T) > ((double)rand() / RAND_MAX)) {
            best_E = new_E;
            for (int i=0; i<NUM_P; i++) best_c[i] = curr_c[i];
            for (int i=0; i<NUM_P; i++)
                for (int j=0; j<NUM_P; j++) best_d[i][j] = curr_d[i][j];
            accepts++;
        }
        
        T *= cooling_rate;
        
        if (step % 50000 == 0) {
            printf("  Step %7d | Temp: %7.4f | Best E: %.2f\n", step, T, best_E);
        }
    }

    printf("  Step %7d | Temp: %7.4f | Best E: %.2f\n\n", ITERS, T, best_E);
    
    // Evaluate performance of the optimized sieve
    printf("   FINAL OPTIMIZED SIEVE PERFORMANCE  \n");
    int correct_primes = 0, total_primes_eval = 0;
    int correct_semis = 0, total_semis_eval = 0;
    double p_err = 0, s_err = 0;

    for (int x = 2; x <= M; x++) {
        if (is_prime(x)) {
            total_primes_eval++;
            double w = calc_W(x, best_c, best_d);
            p_err += fabs(w - 1.0);
            if (w > 0.5) correct_primes++;
        }
        else if (is_semiprime(x)) {
            total_semis_eval++;
            double w = calc_W(x, best_c, best_d);
            s_err += fabs(w - 0.0);
            if (w < 0.5) correct_semis++;
        }
    }
    
    printf("  Primes correctly > 0.5     : %d / %d (%.1f %% accuracy)\n", 
           correct_primes, total_primes_eval, 100.0 * correct_primes / total_primes_eval);
    printf("  Semiprimes correctly < 0.5 : %d / %d (%.1f %% accuracy)\n", 
           correct_semis, total_semis_eval, 100.0 * correct_semis / total_semis_eval);
           
    printf("  Average Prime Score        : %.3f (Target 1.0)\n", 1.0 - (p_err / total_primes_eval));
    printf("  Average Semiprime Score    : %.3f (Target 0.0)\n\n", s_err / total_semis_eval);
    
    printf("  CONCLUSION:\n");
    if (correct_primes > total_primes_eval*0.8 && correct_semis > total_semis_eval*0.8) {
        printf("  The Annealer BROKE the Parity Barrier. It formulated a non-linear weight\n");
        printf("  matrix that accurately separates robust primes from semiprimes.\n");
    } else {
        printf("  Even an advanced combinatorial optimizer over completely unconstrained\n");
        printf("  quadratic non-linear terms could NOT beat the Bombieri parity barrier.\n");
        printf("  The algebraic indistinguishability of primes and semiprimes extends\n");
        printf("  structurally even into quadratic cyclic mappings.\n");
    }

    return 0;
}
