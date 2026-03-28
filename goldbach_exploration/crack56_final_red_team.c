/*
 * crack56_final_red_team.c — Final Red Team of the Topological Homology Anomaly
 *
 * THE 63% PERSISTENT HOMOLOGY SURVIVAL:
 * In the RED TEAM density audit, the Goldbach point-cloud preserved a massive 63% 
 * variance in its 1st Betti Number (β_1) topological barcode compared to a density-
 * matched random point cloud. The Goldbach pairs form far fewer "holes" / cycles.
 *
 * THE "PRIME REPULSION" TOPOLOGICAL HYPOTHESIS:
 * Why would Goldbach points form fewer cycles? Because the 1st Betti Number of the 
 * 1-skeleton graph (β_1 = E - V + β_0) essentially counts the Cyclomatic Complexity 
 * (local dense clumping). 
 * Continuous random variables have absolutely zero geometric collision rules—they can 
 * randomly generate 5 points right next to each other, spawning massive clique cycles.
 * Prime numbers possess STRICT LATTICE REPULSION. Because they cannot be divisible 
 * by 2, 3, 5, etc., they geometrically repel each other. This hard-core interaction 
 * naturally suppresses local cliques and edge density.
 *
 * THE ULTIMATE CONTROL GROUP:
 * Is the 63% topological shape specifically a product of the GOLDBACH COMBINATION 
 * (p+q=2N), or is it merely the generic background physics of Prime Gap Repulsion?
 *
 * We draw the Random Control group NOT from continuous integers, but as a random 
 * subsample of the ACTUAL Prime sequence. This guarantees the Control Group inherits 
 * the exact absolute fundamental sieve lattice repulsion physics as the Goldbach set.
 *
 * If Goldbach combinations literally govern Algebraic Topology natively, their 
 * Betti-1 curve will still separate from the Subsampled Prime Control topology.
 * If the "Breakthrough" was purely generic Prime Geometry, the Betti variances 
 * will seamlessly crash to zero, brutally killing the anomaly.
 *
 * BUILD: cc -O3 -o crack56_final crack56_final_red_team.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 1200000
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

int *parent;
int find(int i) {
    if (parent[i] == i) return i;
    return parent[i] = find(parent[i]);
}

void union_set(int i, int j) {
    int root_i = find(i);
    int root_j = find(j);
    if (root_i .= root_j) {
        parent[root_i] = root_j;
    }
}

int compute_betti_1(int *points, int num_points, int epsilon) {
    for (int i=0; i<num_points; i++) parent[i] = i;
    int edges = 0;
    for (int i=0; i<num_points; i++) {
        for (int j=i+1; j<num_points; j++) {
            if (points[j] - points[i] <= epsilon) {
                edges++;
                union_set(i, j);
            } else { break; }
        }
    }
    int beta_0 = 0;
    for (int i=0; i<num_points; i++) {
        if (parent[i] == i) beta_0++;
    }
    return edges - num_points + beta_0;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 56 (FINAL RED TEAM): Prime Lattice Repulsion\n");
    printf("====================================================\n\n");

    int target = 1000000;
    printf("  Target 2N = %d (Massive Topo-Scale)\n", target);

    int *gb_points = malloc(nprimes * sizeof(int));
    int gb_count = 0;

    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) {
            gb_points[gb_count++] = p;
        }
    }
    printf("  Total Goldbach Topological Vertices (V): %d\n", gb_count);
    
    // Evaluate Prime-Subsample Random Baseline (The Ultimate Control)
    int *rand_points = malloc(gb_count * sizeof(int));
    int rand_count = 0;
    srand(42);
    
    // We want to sample exactly gb_count primes uniformly from the prime array up to target/2
    // We count how many primes are <= target/2
    int num_valid_primes = 0;
    for (int i=0; i<nprimes; i++) {
        if (primes[i] <= target/2) num_valid_primes++;
        else break;
    }
    
    // Reservoir sampling / Random Shuffle to pick gb_count distinct primes
    int *prime_pool = malloc(num_valid_primes * sizeof(int));
    for(int i=0; i<num_valid_primes; i++) prime_pool[i] = primes[i];
    
    // Fisher-Yates shuffle
    for (int i = num_valid_primes - 1; i > 0; i--) {
        int j = rand() % (i + 1);
        int temp = prime_pool[i];
        prime_pool[i] = prime_pool[j];
        prime_pool[j] = temp;
    }
    
    for(int i=0; i<gb_count; i++) rand_points[i] = prime_pool[i];
    
    // Sort the subsampled primes to map topological logic correctly
    for (int i=0; i<rand_count-1; i++) {
        for (int j=0; j<gb_count-i-1; j++) {
            if (rand_points[j] > rand_points[j+1]) {
                int temp = rand_points[j];
                rand_points[j] = rand_points[j+1];
                rand_points[j+1] = temp;
            }
        }
    }

    parent = malloc((gb_count > rand_count ? gb_count : rand_count) * sizeof(int));

    printf("  Evaluating Repulsion-Corrected Persistent Betti-1 (β_1) Homology Curve...\n\n");

    printf("  %10s | %18s | %18s | %18s\n", "Radius ε", "Goldbach β_1 Holes", "Prime Sub-set β_1", "Betti Variance");
    printf("  -------------------------------------------------------------------------\n");

    double total_variance = 0;
    int steps = 10;
    
    for (int epsilon = 5; epsilon <= 50; epsilon += 5) {
        int gb_betti = compute_betti_1(gb_points, gb_count, epsilon);
        int rand_betti = compute_betti_1(rand_points, gb_count, epsilon);
        
        double variance = 0;
        if (rand_betti > 0) {
            variance = fabs((double)(gb_betti - rand_betti) / rand_betti * 100.0);
        } else if (gb_betti > 0) {
            variance = 100.0;
        }
        total_variance += variance;
        printf("  %10d | %18d | %18d | %17.2f%%\n", epsilon, gb_betti, rand_betti, variance);
    }
    
    double mean_variance = total_variance / steps;

    printf("\n   FINAL RED TEAM VERDICT \n");
    if (mean_variance > 10.0) {
        printf("  CONFIRMED: The Topological Homology is UNIQUELY GOLDBACH.\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The ultimate topological anomaly is completely dead.\n");
        printf("  When explicitly benchmarked against the base lattice of the pure Prime Number\n");
        printf("  sequence, the Goldbach Persistence Barcode instantly falsified and snapped \n");
        printf("  flawlessly to the control group (Variance = %.2f%%).\n", mean_variance);
        printf("  The \"massive geometric structure\" was just generic Arithmetic Sieve Repulsion.\n");
        printf("  Primes inherently geometrically repel, leading to sparse cyclomatic graphs;\n");
        printf("  the actual Goldbach combinatorics add absolutely ZERO macroscopic shape. ️\n");
    }

    free(gb_points); free(rand_points); free(parent); free(prime_pool);
    return 0;
}
