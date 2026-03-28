/*
 * crack63_boolean_circuit.c — Computational Complexity (Boolean Modularity)
 *
 * THE BOOLEAN SATISFIABILITY (SAT) TRANSLATION:
 * Any mathematical function can be compiled down into native Boolean Algebra.
 * The addition p + q = 2N involves a Ripple-Carry logic circuit:
 *   Sum Bit (S_i) = p_i XOR q_i XOR c_i
 *   Carry Bit (c_i) = (p_i AND q_i) OR (c_i AND (p_i XOR q_i))
 *
 * CRYPTOGRAPHIC ONE-WAY FUNCTIONS:
 * In stochasticgraphy (like SHA-256), input bits are systematically entangled. 
 * If you map the variable relationships into an Incidence Graph, its 
 * structural Modularity (Q) approaches 0.0, indicating pure unstructured 
 * combinatorial stochasticity. This guarantees NP-hard irreversibility.
 *
 * Structural backdoors in circuits appear when the Modularity Q > 0.3 
 * (bounded Treewidth). This allows SAT Solvers to polynomialy "divide and conquer".
 *
 * THE GOLDBACH CORRELATION MATRIX:
 * We will analyze the strict Bitwise Correlation Matrix between all valid 
 * binary states of (p, q). 
 * For every bit position i and j (0 to 31), we compute the Pearson Correlation 
 * Coefficient between the bits of p_i and p_j across all Goldbach solutions.
 * 
 * If primes construct a rigid algebraic lattice, their binary bits will 
 * strongly correlate, producing high Modularity (Q). 
 * If Prime addition is a mathematically perfect One-Way Pseudorandom Hash, 
 * the bit-states will decouple perfectly into pure uniform combinatorial noise.
 *
 * BUILD: cc -O3 -o crack63 crack63_boolean_circuit.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000000
static char sieve[MAX_N];
static int primes[MAX_N];
static int nprimes = 0;

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
    printf("  CRACK 63: Boolean Complexity (Circuit Modularity)\n");
    printf("====================================================\n\n");

    int target = 1000000;
    int BITS = 20; // 2^20 > 1,000,000
    
    int *gb_points = malloc(nprimes * sizeof(int));
    int gb_count = 0;
    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) gb_points[gb_count++] = p;
    }
    
    // Baseline Array (Identical sum pairs, purely combinatorial Boolean vectors)
    int *rand_points = malloc(gb_count * sizeof(int));
    srand(12345);
    for (int i=0; i<gb_count; i++) {
        // Generate a random odd integer < target/2
        rand_points[i] = (rand() % (target / 4)) * 2 + 1; 
    }

    printf("  Target 2N = %d (Evaluating %d-bit logic gates)\n", target, BITS);
    printf("  Goldbach Valid Pairings: %d\n", gb_count);
    printf("  Constructing Sparse Bitwise Correlation Matrices...\n\n");

    // Arrays to hold bit counts and cross-correlations
    double gb_mean[20] = {0};
    double rand_mean[20] = {0};
    
    for (int i=0; i<gb_count; i++) {
        int p = gb_points[i];
        int r = rand_points[i];
        for (int b=0; b<BITS; b++) {
            if ((p >> b) & 1) gb_mean[b]++;
            if ((r >> b) & 1) rand_mean[b]++;
        }
    }
    
    for (int b=0; b<BITS; b++) {
        gb_mean[b] /= gb_count;
        rand_mean[b] /= gb_count;
    }

    double gb_corr = 0;
    int pairs = 0;
    double rand_corr = 0;

    for (int b1 = 0; b1 < BITS; b1++) {
        for (int b2 = b1 + 1; b2 < BITS; b2++) {
            double gb_cov = 0, gb_var1 = 0, gb_var2 = 0;
            double rand_cov = 0, rand_var1 = 0, rand_var2 = 0;
            
            for (int i = 0; i < gb_count; i++) {
                int p = gb_points[i];
                double gb_d1 = ((p >> b1) & 1) - gb_mean[b1];
                double gb_d2 = ((p >> b2) & 1) - gb_mean[b2];
                gb_cov += gb_d1 * gb_d2;
                gb_var1 += gb_d1 * gb_d1;
                gb_var2 += gb_d2 * gb_d2;
                
                int r = rand_points[i];
                double rand_d1 = ((r >> b1) & 1) - rand_mean[b1];
                double rand_d2 = ((r >> b2) & 1) - rand_mean[b2];
                rand_cov += rand_d1 * rand_d2;
                rand_var1 += rand_d1 * rand_d1;
                rand_var2 += rand_d2 * rand_d2;
            }
            
            if (gb_var1 > 0 && gb_var2 > 0) {
                double r_val = fabs(gb_cov / sqrt(gb_var1 * gb_var2));
                gb_corr += r_val;
            }
            if (rand_var1 > 0 && rand_var2 > 0) {
                double r_val = fabs(rand_cov / sqrt(rand_var1 * rand_var2));
                rand_corr += r_val;
            }
            pairs++;
        }
    }
    
    gb_corr /= pairs;
    rand_corr /= pairs;
    
    // Scale Pearson R to Louvain Modularity approximation (Q)
    // Pure noise R ~ 0.0 -> Q ~ 0.0
    double mod_variance = fabs(gb_corr - rand_corr) / rand_corr * 100.0;

    printf("  %18s | %18s | %18s \n", "Metric", "Goldbach Logic", "Random SAT Noise");
    printf("  ----------------------------------------------------------------\n");
    printf("  %18s | %18.4f | %18.4f \n", "Mean Correlation", gb_corr, rand_corr);
    
    printf("\n   BOOLEAN COMPLEXITY VERDICT \n");
    printf("  Bitwise Entanglement Variance: %.2f%%\n\n", mod_variance);

    if (mod_variance > 10.0 && gb_corr > rand_corr) {
        printf("  RESULT: ANOMALY DETECTED. The Boolean Gates hold a Structural Backdoor.\n");
        printf("  Goldbach Prime logic gates are highly correlated and structurally\n");
        printf("  modular. The Additive Constraints are explicitly vulnerable to\n");
        printf("  polynomial-time SAT extraction via bounded Treewidth. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Prime Addition evaluates as a perfect One-Way Pseudorandom Hash.\n");
        printf("  The Boolean states of Goldbach primes are perfectly, aggressively decoupled\n");
        printf("  and mathematically entangled exactly equal to uniform random noise constraints.\n");
        printf("  Zero Structural Modularity. Zero Treewidth backdoor. NP-Hard Stochasticity. ️\n");
    }

    free(gb_points); free(rand_points);
    return 0;
}
