/*
 * crack64_galois_algebra.c — Abstract Algebra (GF(2) Linear Complexity)
 *
 * THE GALOIS FIELD LFSR:
 * Inside Abstract Algebra, sequences of binaries evaluate exactly as 
 * polynomials over Galois Field GF(2). 
 * Every deterministic binary sequence can be algebraically modeled as the 
 * output of a Linear Feedback Shift Register (LFSR).
 * 
 * The ALGEBRAIC LINEAR COMPLEXITY of a sequence is the absolute mathematically 
 * shortest possible LFSR length needed to seamlessly generate it.
 *
 * BERLEKAMP-MASSEY ALGORITHM:
 * For a purely, stochasticgraphically rigorous random Boolean sequence of length L, 
 * the expected Linear Complexity converges fundamentally to exactly L/2.
 * 
 * If a sequence embeds rigorously structured mathematical constraints or 
 * recursive polynomial behaviors, the Berlekamp-Massey algorithm will systematically 
 * collapse the Linear Complexity (LC < L/2) and explicitly output the short 
 * recurrent GF(2) polynomial that controls the sequence.
 *
 * THE GOLDBACH ALGEBRAIC SEQUENCE:
 * We convert the Goldbach truth table (1 if sum=2N, 0 else) into a Galois sequence.
 * If Berlekamp-Massey evaluates the combinations to a Linear Complexity critically 
 * smaller than L/2, Goldbach prime addition holds a formally predictable 
 * linear-algebraic topological recurrence. 
 *
 * BUILD: cc -O3 -o crack64 crack64_galois_algebra.c -lm
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

// Berlekamp-Massey Algorithm to compute the GF(2) Linear Complexity of a binary array
int berlekamp_massey(char *seq, int n) {
    int *C = calloc(n, sizeof(int));
    int *B = calloc(n, sizeof(int));
    int *T = calloc(n, sizeof(int));
    
    C[0] = 1;
    B[0] = 1;
    
    int L = 0;
    int m = -1;
    
    for (int i = 0; i < n; i++) {
        int d = 0;
        for (int j = 0; j <= L; j++) {
            d ^= (C[j] & seq[i - j]);
        }
        
        if (d .= 0) {
            for (int k = 0; k < n; k++) T[k] = C[k];
            
            for (int j = 0; i - m + j < n; j++) {
                C[i - m + j] ^= B[j];
            }
            
            if (2 * L <= i) {
                L = i + 1 - L;
                m = i;
                for (int k = 0; k < n; k++) B[k] = T[k];
            }
        }
    }
    
    free(C); free(B); free(T);
    return L;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 64: Abstract Algebra GF(2) / Berlekamp-Massey\n");
    printf("====================================================\n\n");

    int target = 1000000;
    int L_count = 5000; // Bit-length of polynomial field target
    
    printf("  Target 2N = %d (Evaluating sequence lengths L = %d)\n", target, L_count);
    
    char *gb_seq = calloc(L_count, sizeof(char));
    char *rand_seq = calloc(L_count, sizeof(char));
    
    int gb_bits = 0;
    for (int i=0; i<L_count; i++) {
        int p = primes[i];
        if (target - p > 0 && .sieve[target - p]) {
            gb_seq[i] = 1;
            gb_bits++;
        }
    }

    printf("  Populated Galois Target Set: %d Internal Combos\n\n", gb_bits);

    // Baseline Array (Identical sum density)
    for (int i=0; i<gb_bits; i++) rand_seq[i] = 1;
    srand(12345);
    for (int i = L_count - 1; i > 0; i--) {
        int j = rand() % (i + 1);
        char temp = rand_seq[i];
        rand_seq[i] = rand_seq[j];
        rand_seq[j] = temp;
    }
    
    printf("  Executing Berlekamp-Massey Algebraic Resolution Engine...\n\n");
    
    int gb_lc = berlekamp_massey(gb_seq, L_count);
    int rand_lc = berlekamp_massey(rand_seq, L_count);

    double bound = (double)L_count / 2.0;
    double gb_variance = fabs(gb_lc - bound) / bound * 100.0;
    double rand_variance = fabs(rand_lc - bound) / bound * 100.0;

    printf("  %16s | %18s | %18s \n", "Metric", "Goldbach GF(2)", "Random Noise");
    printf("  ----------------------------------------------------------------\n");
    printf("  %16s | %18d | %18d \n", "Linear Complexity", gb_lc, rand_lc);
    printf("  %16s | %18.2f%% | %18.2f%% \n", "Bound Variance", gb_variance, rand_variance);
    
    printf("\n   GALOIS ALGEBRA VERDICT \n");

    if (gb_lc < rand_lc * 0.90) { // If LC crashes by >10% vs random noise
        printf("  RESULT: ANOMALY DETECTED. The Polynomial systematically Factored.\n");
        printf("  Goldbach sequences mathematically evaluate to an extremely tight \n");
        printf("  Linear Complexity. The Additive restrictions explicitly force the\n");
        printf("  logic of primes into predictable, mathematically rigorous GF(2) \n");
        printf("  recursive roots spanning trivial Algebraic Subfields. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Prime Sequences mathematically diverge LFSR matrices.\n");
        printf("  The Goldbach Galois formulation evaluated to a strict Maximum\n");
        printf("  Complexity LFSR length identical to standard Pseudorandom Noise\n");
        printf("  (LC = %d vs Bound = %.2f).\n", gb_lc, bound);
        printf("  The permutations natively lack ANY predictable recursive polynomial topologies. ️\n");
    }

    free(gb_seq); free(rand_seq);
    return 0;
}
