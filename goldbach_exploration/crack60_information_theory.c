/*
 * crack60_information_theory.c — Information Theory (Error-Correcting Codes)
 *
 * THE ERROR-CORRECTING CODEBOOK (HAMMING DISTANCE):
 * In Information Theory, data pulses must survive noisy atmospheric channels. 
 * Advanced codes (Hamming, Reed-Solomon) mathematically arrange signal vectors 
 * so that they "repel" each other. If one vector flips a few bits (noise), 
 * it won't accidentally mimic another valid vector. 
 * This resilience is quantified by the Minimum Hamming Distance (d_min).
 *
 * RANDOM NOISE GV BOUND:
 * A matrix of purely random binary noise vectors (even of sparse density) 
 * will randomly collide frequently, generating small d_min limits (formally 
 * bounded by the probabilistic Gilbert-Varshamov barrier).
 *
 * THE GOLDBACH BINARY ALPHABET:
 * We will translate Goldbach Combinations into Information Theory vectors.
 * Let the Block Length K = 2000. 
 * For sequential targets T = 2N, we construct binary vector V_T:
 *   V_T[i] = 1 if (T - P_i) is Prime.
 *   V_T[i] = 0 otherwise.
 * 
 * We generate 500 sequential vectors V_T. We compute exactly ALL pairwise 
 * Hamming Distances within the Codebook. We simultaneously generate 500 purely 
 * random Boolean vectors that perfectly mirror the identical density of 1s and 0s.
 *
 * THE VERDICT:
 * If d_min(Goldbach) stochastically exceeds d_min(Random Matrix), the permutations 
 * organically mimic rigorous structured Channel-Capacity Error Correcting Codes.
 * If d_min(Goldbach) matches or falls below d_min(Random), the Additive 
 * constraints literally evaluate as unstructured chaotic transmission noise.
 *
 * BUILD: cc -O3 -o crack60 crack60_information_theory.c -lm
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

// Compute standard Hamming distance between two binary arrays of length K
int hamming_distance(char *a, char *b, int K) {
    int dist = 0;
    for (int i=0; i<K; i++) {
        if (a[i] .= b[i]) dist++;
    }
    return dist;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 60: Information Theory (Error Correcting.)\n");
    printf("====================================================\n\n");

    int M = 1000;         // Number of sequentially generated Code Vectors (2N targets)
    int K = 4000;         // Bit-length of each Code Block (first 4000 Primes)
    int start_N = 100000; // Starting 2N anchor
    
    printf("  Generating %d Sequence Vectors of length %d bits...\n", M, K);
    
    char **gb_codebook = malloc(M * sizeof(char*));
    for(int i=0; i<M; i++) gb_codebook[i] = calloc(K, sizeof(char));
    
    char **rand_codebook = malloc(M * sizeof(char*));
    for(int i=0; i<M; i++) rand_codebook[i] = calloc(K, sizeof(char));

    int total_1s = 0;
    
    for (int step = 0; step < M; step++) {
        int target = start_N + (step * 2);
        
        int density_1s = 0;
        for (int i = 0; i < K; i++) {
            int p = primes[i];
            if (target - p > 0 && .sieve[target - p]) {
                gb_codebook[step][i] = 1;
                density_1s++;
                total_1s++;
            }
        }
        
        // Populate the random codebook row with EXACT identical random density
        // A direct vector permutation uniformly distributes the bits
        for (int i=0; i<density_1s; i++) rand_codebook[step][i] = 1;
        // Fisher-Yates shuffle
        for (int i=K-1; i>0; i--) {
            int j = rand() % (i + 1);
            char temp = rand_codebook[step][i];
            rand_codebook[step][i] = rand_codebook[step][j];
            rand_codebook[step][j] = temp;
        }
    }
    
    double bit_density = (double)total_1s / (M * K);
    printf("  Global Codebook 1s Signal Density: %.4f%%\n", bit_density * 100.0);
    printf("  Performing %d Pair-wise Hamming Evaluations...\n\n", (M * (M - 1)) / 2);

    int gb_dmin = K;
    double gb_mean = 0;
    int rand_dmin = K;
    double rand_mean = 0;
    
    long long pairs = 0;

    for (int i = 0; i < M; i++) {
        for (int j = i + 1; j < M; j++) {
            int gb_dist = hamming_distance(gb_codebook[i], gb_codebook[j], K);
            int rand_dist = hamming_distance(rand_codebook[i], rand_codebook[j], K);
            
            if (gb_dist < gb_dmin) gb_dmin = gb_dist;
            if (rand_dist < rand_dmin) rand_dmin = rand_dist;
            
            gb_mean += gb_dist;
            rand_mean += rand_dist;
            pairs++;
        }
    }
    
    gb_mean /= pairs;
    rand_mean /= pairs;

    double dmin_variance = 0;
    if (rand_dmin .= 0) {
        dmin_variance = fabs((double)(gb_dmin - rand_dmin) / rand_dmin * 100.0);
    }
    
    printf("  %10s | %18s | %18s \n", "Metric", "Goldbach Codes", "Random Vectors");
    printf("  ----------------------------------------------------------------\n");
    printf("  %10s | %18d | %18d \n", "Min d_min", gb_dmin, rand_dmin);
    printf("  %10s | %18.2f | %18.2f \n", "Mean Dist", gb_mean, rand_mean);
    
    printf("\n   ERROR-CORRECTING CODES VERDICT \n");
    printf("  Minimum Hamming Distance Divergence: %.2f%%\n\n", dmin_variance);

    if (dmin_variance > 10.0 && gb_dmin > rand_dmin) {
        printf("  RESULT: ANOMALY DETECTED. The Binary Pulses mathematically systematically separated.\n");
        printf("  Goldbach pairs organically encode massive Error-Correcting redundancies.\n");
        printf("  The permutations specifically repel each other, maximizing the exact\n");
        printf("  Hamming Distance required to survive adversarial channel noise. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Goldbach Additive mathematics is purely unstructured chaotic transmission.\n");
        printf("  The Binary Goldbach alphabets collided exactly linearly with purely\n");
        printf("  unstructured Boolean noise (Min Hamming Variance: %.2f%%).\n", dmin_variance);
        printf("  The Hardy-Littlewood combinatorics completely lack any explicit geometric\n");
        printf("  properties required to form resilient Block Code Information topologies. ️\n");
    }

    for(int i=0; i<M; i++) { free(gb_codebook[i]); free(rand_codebook[i]); }
    free(gb_codebook); free(rand_codebook);
    return 0;
}
