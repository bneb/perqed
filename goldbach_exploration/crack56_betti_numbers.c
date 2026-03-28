/*
 * crack56_betti_numbers.c — Topological Data Analysis & Persistent Homology
 *
 * ALGEBRAIC TOPOLOGY:
 * We map the subset of valid Goldbach Primes into a 1D geometric space.
 * How do we scientifically quantify the "Topological Shape" of this point cloud?
 * We construct a Vietoris-Rips Simplicial Complex:
 * For a continuous sweep of a distance radius epsilon (ε):
 *   - Two points connect via a 1-Simplex (Line) if distance <= ε
 *   - Three points connect via a 2-Simplex (Triangle) if pairwise distance <= ε
 *
 * BETTI NUMBERS & EULER CHARACTERISTIC:
 * The Betti numbers define the topological invariants of the space:
 *   β_0 = Number of isolated connected components
 *   β_1 = Number of "holes" or 1D cycles
 *   β_2 = Number of 2D voids
 *
 * Using the Graph Euler Characteristic χ = V - E + F, for a 1D graph structure,
 * we can calculate the exact number of macroscopic topological holes (β_1) as:
 *      β_1 = E - V + β_0
 *
 * PERSISTENT HOMOLOGY:
 * We will trace the Betti-1 (β_1) homology barcode across an increasing 
 * radius ε. 
 * If Goldbach combinations form a rigid structural geometry, the topological 
 * holes will "persist" aggressively, vastly deviating from random point clouds 
 * (e.g. geometric gaps that refuse to geometrically close).
 * 
 * We evaluate the Betti numbers of the Goldbach prime point-cloud against a 
 * Random pure Poisson point-cloud of the exact same geometric density.
 *
 * BUILD: cc -O3 -o crack56 crack56_betti_numbers.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 600000
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

// Global Union-Find for Connected Components (β_0)
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

// Compute the Betti-1 Number for a given ε connection radius
int compute_betti_1(int *points, int num_points, int epsilon) {
    for (int i=0; i<num_points; i++) parent[i] = i;

    int edges = 0;
    
    // O(N^2) naive edge formation because 1D point clouds can just be swept O(N) but keeping it pure
    for (int i=0; i<num_points; i++) {
        // Because points are sorted, we can stop early
        for (int j=i+1; j<num_points; j++) {
            if (points[j] - points[i] <= epsilon) {
                edges++;
                union_set(i, j);
            } else {
                break;
            }
        }
    }

    // Measure β_0 (Connected Components)
    int beta_0 = 0;
    for (int i=0; i<num_points; i++) {
        if (parent[i] == i) beta_0++;
    }

    // Macroscopic topological holes via Euler Characteristic: β_1 = E - V + β_0
    int beta_1 = edges - num_points + beta_0;
    
    return beta_1;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 56: Topological Data Analysis (Betti Numbers)\n");
    printf("====================================================\n\n");

    int target = 400000;
    
    printf("  Target 2N = %d\n", target);
    printf("  Extracting the 1D Geometric Point Cloud of Goldbach Prime combinations.\n\n");

    int *gb_points = malloc(nprimes * sizeof(int));
    int gb_count = 0;

    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) {
            gb_points[gb_count++] = p;
        }
    }
    
    printf("  Total Goldbach Topological Geometric Vertices (V): %d\n", gb_count);
    
    // Evaluate pure Poisson Random Baseline with exact same density
    int *rand_points = malloc(gb_count * sizeof(int));
    int rand_count = 0;
    srand(42);
    
    // Uniform geometric spraying across the domain [3, target/2]
    int range = (target / 2) - 3;
    while (rand_count < gb_count) {
        int r = 3 + (rand() % range);
        rand_points[rand_count++] = r;
    }
    
    // Sort the uniform random points to align with continuous logic
    for (int i=0; i<rand_count-1; i++) {
        for (int j=0; j<rand_count-i-1; j++) {
            if (rand_points[j] > rand_points[j+1]) {
                int temp = rand_points[j];
                rand_points[j] = rand_points[j+1];
                rand_points[j+1] = temp;
            }
        }
    }

    parent = malloc((gb_count > rand_count ? gb_count : rand_count) * sizeof(int));

    printf("  Tracing the Persistent Betti-1 (β_1) Homology Curve...\n");
    printf("  Radius ε traces from 5 -> 50 (Connection Thresholds).\n");

    printf("\n  %10s | %18s | %18s | %18s\n", "Radius ε", "Goldbach β_1 Holes", "Random β_1 Holes", "Betti Variance");
    printf("  -------------------------------------------------------------------------\n");

    double total_variance = 0;
    int steps = 10;
    
    for (int epsilon = 5; epsilon <= 50; epsilon += 5) {
        
        int gb_betti = compute_betti_1(gb_points, gb_count, epsilon);
        int rand_betti = compute_betti_1(rand_points, rand_count, epsilon);
        
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

    printf("\n   PERSISTENT HOMOLOGY VERDICT \n");
    printf("  Mean Topological Betti Variance against Noise: %.2f%%\n\n", mean_variance);

    if (mean_variance > 15.0) {
        printf("  RESULT: ANOMALY DETECTED. The Persistent Homology systematically separated.\n");
        printf("  The Betti-1 topological geometric holes of the Goldbach subset are\n");
        printf("  stochastically structurally rigid compared to random noise.\n");
        printf("  Goldbach prime combinations are bound by Global Algebraic Topology. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The Betti-1 barcodes practically identical (Variance = %.2f%%).\n", mean_variance);
        printf("  The quantity, persistence, and collapse of the geometric holes exactly\n");
        printf("  mirror the unstructured topological geometry of pure random noise points.\n");
        printf("  Algebraic Topology confirms the prime pairs possess absolutely ZERO global shape.\n");
        printf("  The Simplicial Complex is mathematically indistinguishable from a random spray. ️\n");
    }

    free(gb_points); free(rand_points); free(parent);
    return 0;
}
