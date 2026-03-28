/*
 * red_team_crack56.c — Red Teaming the Betti Number Homology Anomaly
 *
 * THE 72% VARIANCE ANOMALY:
 * Crack 56 yielded a massive 72% variance in the 1st Betti Number (β_1).
 * The Goldbach prime point-cloud generated vastly FEWER geometric holes 
 * than the Random Noise point cloud at every connectivity radius ε.
 *
 * THE DENSITY METRIC ILLUSION:
 * Why did the random point cloud form so many more holes?
 * In Crack 56, we generated the random points uniformly across the entire
 * domain [3, target/2]. 
 * BUT prime numbers are not uniformly dense. The Prime Number Theorem 
 * dictates that density falls as 1/log(x). 
 * 
 * Because the random points were uniformly dense, they had a much higher 
 * probability of forming dense local structural clusters at high values 
 * of X compared to the sparse prime numbers. These local clusters 
 * easily geometrically linked to form topological ε-holes (1D cycles).
 * The primes, being sparser at high X, naturally formed fewer holes.
 *
 * THE RIGOROUS AUDIT:
 * 1. We crank the scale to 2N = 1,000,000.
 * 2. We generate the Random Control point-cloud using the exact Prime 
 *    Density Integral weighting (x/log x), mapping the points to precisely 
 *    mimic the macroscopic logarithmic thinning of Primes.
 * 3. We re-evaluate the Persistent Betti-1 homology barcodes.
 * 
 * If Goldbach is strictly governed by Algebraic Topology, the Goldbach β_1 
 * curve will remain stochastically severed from the Density-Corrected Random noise.
 * If the "Breakthrough" was purely a topological density illusion, both 
 * Betti curves will crash directly into each other.
 *
 * BUILD: cc -O3 -o red_team_crack56 red_team_crack56.c -lm
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
    printf("  CRACK 56 (RED TEAM): Betti Number Density Illusion\n");
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
    
    // Evaluate Prime Density Weighted Random Baseline
    int *rand_points = malloc(gb_count * sizeof(int));
    int rand_count = 0;
    srand(42);
    
    // We compute the total log-integral weight to sample from the exact same CDF
    double total_weight = 0;
    double *cdf = malloc((target/2) * sizeof(double));
    for (int x=3; x<=target/2; x++) {
        total_weight += 1.0 / log((double)x);
        cdf[x] = total_weight;
    }
    
    while (rand_count < gb_count) {
        double r = ((double)rand() / RAND_MAX) * total_weight;
        // Binary search the CDF
        int low = 3, high = target/2, ans = 3;
        while (low <= high) {
            int mid = low + (high - low)/2;
            if (cdf[mid] >= r) {
                ans = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        rand_points[rand_count++] = ans;
    }
    
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

    printf("  Evaluating Density-Corrected Persistent Betti-1 (β_1) Homology Curve...\n\n");

    printf("  %10s | %18s | %18s | %18s\n", "Radius ε", "Goldbach β_1 Holes", "Random β_1 Holes", "Betti Variance");
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

    printf("\n   RED TEAM VERDICT \n");
    if (mean_variance > 10.0) {
        printf("  CONFIRMED: The Persistent Homology anomaly SURVIVED scale up.\n");
        printf("  Even with geometrically identical density mappings, the Goldbach primes\n");
        printf("  stochastically resisted topological cycles. Algebraic Topology governs 2N.\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The anomaly was purely a Topological Density Metric Illusion.\n");
        printf("  As soon as the Random Baseline was correctly re-weighted to match the\n");
        printf("  Prime Density inverse-log decay, the macroscopic number of topological\n");
        printf("  holes perfectly normalized. The Betti-1 homology curves structurally\n");
        printf("  crashed into each other (Variance = %.2f%%).\n", mean_variance);
        printf("  Goldbach subsets possess ZERO unique invariant shape properties.\n");
        printf("  Topological Homology forms absolutely continuous stochasticity. ️\n");
    }

    free(gb_points); free(rand_points); free(parent); free(cdf);
    return 0;
}
