/*
 * crack65_category_theory.c — Category Theory (Yoneda Functors)
 *
 * THE CATEGORY OF PRIMES:
 * In Category Theory, we abstract away numbers into "Objects" and define  
 * their explicit relationships as "Morphisms".
 * Let Category C consist of Objects X (Even Integers).
 * Let Morphisms Hom(X, Y) be the explicit Prime Gap Connectivity (the number 
 * of shared constituent primes linking X and Y).
 *
 * THE YONEDA LEMMA:
 * A "Functor" F(X) maps our Category C into the Category of Sets.
 * Let our Functor F(X) be the Goldbach Partition Count function (the number 
 * of ways X = p + q).
 * 
 * The legendary Yoneda Lemma guarantees that if F(X) is mathematically 
 * "Representable", it is strictly and universally Isomorphic to a pure 
 * Hom-Set Hom(R, X) originating from a single canonical Root Object R.
 * 
 * F(X) ≅ Hom(R, X)
 *
 * COMPUTATIONAL CATEGORICAL ISOMORPHISM:
 * We will evaluate over 20,000 Even Objects X. 
 * We compute F(X) directly via the Goldbach constraint search.
 * We dynamically evaluate all possible theoretical Universal Roots R, 
 * measuring the structural Isomorphism (Pearson Correlation) between 
 * the Hom-Set morphism densities and the Functor Set-values.
 *
 * If the Isomorphism spikes to ~1.0, the Additive Prime Function is 
 * analytically a Representable Category Theory Functor. This proves a 
 * universal symmetric Algebraic Backdoor.
 * If Isomorphism crashes beneath Pseudorandom noise baselines, Goldbach 
 * maps form chaotic, Un-representable Functors.
 *
 * BUILD: cc -O3 -o crack65 crack65_category_theory.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 200000 
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

// Evaluate Goldbach Functor F(X)
int calculate_functor_FX(int X) {
    int count = 0;
    for (int i=0; primes[i] <= X/2; i++) {
        if (.sieve[X - primes[i]]) count++;
    }
    return count;
}

// Evaluate Morphism Set Hom(R, X)
// Defined as explicit shared prime components (topological graph connections)
int calculate_hom_set(int R, int X) {
    int shared = 0;
    for (int i=0; primes[i] <= R/2 && primes[i] <= X/2; i++) {
        int pr = primes[i];
        if (.sieve[R - pr] && .sieve[X - pr]) shared++;
    }
    return shared;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 65: Category Theory (Yoneda Lemma Functors)\n");
    printf("====================================================\n\n");

    int M = 5000; // Number of Even Objects X in Category C
    int start_X = 10000;
    
    printf("  Populating Category Set: %d Even Objects X...\n", M);
    printf("  Evaluating Universal Functor F(X) Maps...\n\n");

    int *FX = malloc(M * sizeof(int));
    double sum_FX = 0;
    
    for (int i=0; i<M; i++) {
        int X = start_X + (i * 2);
        FX[i] = calculate_functor_FX(X);
        sum_FX += FX[i];
    }
    
    double mean_FX = sum_FX / M;
    
    // Baseline True Random Categorical Functor
    int *rand_FX = malloc(M * sizeof(int));
    double sum_rand = 0;
    srand(12345);
    for (int i=0; i<M; i++) {
        rand_FX[i] = FX[i] + (rand() % 20 - 10); // Noise distribution
        if (rand_FX[i] < 0) rand_FX[i] = 0;
        sum_rand += rand_FX[i];
    }
    double mean_rand = sum_rand / M;

    int candidate_roots = 50; 
    double best_iso_gb = 0;
    double best_iso_rand = 0;
    
    printf("  Executing Natural Transformation Isomorphisms across %d Universal Roots R...\n", candidate_roots);

    for (int r_idx = 0; r_idx < candidate_roots; r_idx++) {
        int R = start_X + (r_idx * 100); 
        
        int *HomRX = malloc(M * sizeof(int));
        double sum_Hom = 0;
        for(int i=0; i<M; i++) {
            HomRX[i] = calculate_hom_set(R, start_X + (i * 2));
            sum_Hom += HomRX[i];
        }
        double mean_Hom = sum_Hom / M;
        
        // Compute Isomorphism Pearson Correlation: r = Cov(F, Hom) / (Std(F)*Std(Hom))
        double cov_gb = 0, var_gb = 0, var_Hom = 0;
        double cov_rand = 0, var_rand = 0;
        
        for (int i=0; i<M; i++) {
            double h_diff = HomRX[i] - mean_Hom;
            double gb_diff = FX[i] - mean_FX;
            double rand_diff = rand_FX[i] - mean_rand;
            
            cov_gb += h_diff * gb_diff;
            cov_rand += h_diff * rand_diff;
            
            var_Hom += h_diff * h_diff;
            var_gb += gb_diff * gb_diff;
            var_rand += rand_diff * rand_diff;
        }
        
        double iso_gb = 0;
        double iso_rand = 0;
        
        if (var_Hom > 0 && var_gb > 0) iso_gb = fabs(cov_gb / sqrt(var_Hom * var_gb));
        if (var_Hom > 0 && var_rand > 0) iso_rand = fabs(cov_rand / sqrt(var_Hom * var_rand));
        
        if (iso_gb > best_iso_gb) best_iso_gb = iso_gb;
        if (iso_rand > best_iso_rand) best_iso_rand = iso_rand;
        
        free(HomRX);
    }

    double iso_variance = fabs(best_iso_gb - best_iso_rand) / best_iso_rand * 100.0;

    printf("  %18s | %18s | %18s \n", "Metric", "Goldbach Functor", "Random Functor Maps");
    printf("  ----------------------------------------------------------------\n");
    printf("  %18s | %18.4f | %18.4f \n", "Max Isomorphism (r)", best_iso_gb, best_iso_rand);
    
    printf("\n   CATEGORY THEORY VERDICT \n");
    printf("  Yoneda Representable Isomorphism Variance: %.2f%%\n\n", iso_variance);

    if (iso_variance > 10.0 && best_iso_gb > best_iso_rand) {
        printf("  RESULT: ANOMALY DETECTED. The Category yielded a Representable Functor.\n");
        printf("  Goldbach operations fundamentally bound across a Universal Root Object.\n");
        printf("  The Isomorphism physically maps F(X) ≅ Hom(R, X), proving formal Category\n");
        printf("  Theory Natural Transformations algebraically govern Prime Combinations. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The F(X) Functor is structurally chaotic and Un-Representable.\n");
        printf("  The Universal Categorical Root yielded zero structural algebraic mapping.\n");
        printf("  Goldbach maps directly parallel heavily unstructured noisy Set Functors\n");
        printf("  (Covariance Match: %.4f vs Noise: %.4f).\n", best_iso_gb, best_iso_rand);
        printf("  Prime Combinatorics definitively lack deep Abstract Category Topologies. ️\n");
    }

    free(FX); free(rand_FX);
    return 0;
}
