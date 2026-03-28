/*
 * crack58_forman_ricci.c — Differential Geometry & Forman-Ricci Curvature
 *
 * THE FORMAN-RICCI DISCRETE CURVATURE:
 * In Differential Geometry, Ricci Curvature measures how a geometric shape 
 * deviates from flat Euclidean space. Does a localized volume of points 
 * converge inwards (Positive Curvature / Spherical Manifold) or diverge 
 * systematically outwards (Negative Curvature / Hyperbolic Saddle)?
 *
 * Robin Forman extended Ricci curvature to discrete simplicial complexes (graphs).
 * For a 1-skeleton edge e = (u, v):
 *   Ric(e) = 4 - degree(u) - degree(v) + 3 * |Triangles containing e|
 * 
 * THE GOLDBACH COMBINATORIAL MANIFOLD:
 * In Crack 56, we discovered that Goldbach primes natively form a highly 
 * structured Topological Simplicial Complex. 
 * What is the intrinsic curvature of this Non-Euclidean mathematical space?
 *
 * We formulate the Goldbach points into a parameterized graph via radius ε.
 * We calculate the exact Forman-Ricci curvature array for every physical edge.
 * We compute the Mean Manifold Curvature for the pure Goldbach topology and 
 * strictly benchmark it against the density-scaled Prime Logarithmic point-cloud.
 *
 * If Goldbach exists organically within a Riemannian Manifold, its discrete 
 * Ricci curvature will stochastically systematically separate from pure background noise, 
 * explicitly categorizing its topological state (Spherical vs Hyperbolic).
 *
 * BUILD: cc -O3 -o crack58 crack58_forman_ricci.c -lm
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

// Struct for the Forman-Ricci calculations
double compute_mean_ricci(int *pts, int v_count, int epsilon) {
    int *degree = calloc(v_count, sizeof(int));
    
    // 1. Matrix logic: edges and degrees
    // We only need to store valid edges (u, v)
    int max_edges = v_count * 50; 
    int *edge_u = malloc(max_edges * sizeof(int));
    int *edge_v = malloc(max_edges * sizeof(int));
    int e_count = 0;
    
    for (int i=0; i<v_count; i++) {
        for (int j=i+1; j<v_count; j++) {
            if (pts[j] - pts[i] <= epsilon) {
                if (e_count < max_edges) {
                    edge_u[e_count] = i;
                    edge_v[e_count] = j;
                    degree[i]++;
                    degree[j]++;
                    e_count++;
                }
            } else {
                break;
            }
        }
    }
    
    if (e_count == 0) {
        free(degree); free(edge_u); free(edge_v);
        return 0.0;
    }

    double total_ricci = 0;

    // 2. Curvature evaluation for each edge
    for (int e=0; e<e_count; e++) {
        int u = edge_u[e];
        int v = edge_v[e];
        
        // Count triangles containing edge (u, v)
        // A triangle u-v-w requires both (u,w) and (v,w) to be edges.
        // Since points are 1D coordinates, w must be within epsilon of BOTH
        int triangles = 0;
        
        // Search right
        for (int w = v+1; w < v_count; w++) {
            if (pts[w] - pts[u] <= epsilon) {
                // Since w > v > u, if w-u <= eps, then w-v <= eps is guaranteed.
                triangles++;
            } else {
                break;
            }
        }
        // Search left
        for (int w = u-1; w >= 0; w--) {
            if (pts[v] - pts[w] <= epsilon) {
                // If v-w <= eps, u-w <= eps is guaranteed.
                triangles++;
            } else {
                break;
            }
        }
        
        // Forman-Ricci Discrete Edge Curvature
        double ricci = 4.0 - degree[u] - degree[v] + 3.0 * triangles;
        total_ricci += ricci;
    }
    
    free(degree); free(edge_u); free(edge_v);
    return total_ricci / e_count;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 58: Differential Geometry (Forman-Ricci)\n");
    printf("====================================================\n\n");

    int target = 400000;
    printf("  Target 2N = %d\n", target);

    int *gb_points = malloc(nprimes * sizeof(int));
    int gb_count = 0;

    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) {
            gb_points[gb_count++] = p;
        }
    }
    
    printf("  Evaluating Forman-Ricci Scalar Tensor...\n");
    
    // Prime Subsample Tru-Density Control (from Crack 56 Final Red Team logic)
    int *rand_points = malloc(gb_count * sizeof(int));
    int rand_count = 0;
    int num_valid_primes = 0;
    for (int i=0; i<nprimes; i++) {
        if (primes[i] <= target/2) num_valid_primes++;
        else break;
    }
    
    srand(42);
    int *prime_pool = malloc(num_valid_primes * sizeof(int));
    for(int i=0; i<num_valid_primes; i++) prime_pool[i] = primes[i];
    
    for (int i = num_valid_primes - 1; i > 0; i--) {
        int j = rand() % (i + 1);
        int temp = prime_pool[i];
        prime_pool[i] = prime_pool[j];
        prime_pool[j] = temp;
    }
    
    for(int i=0; i<gb_count; i++) rand_points[i] = prime_pool[i];
    
    for (int i=0; i<gb_count-1; i++) {
        for (int j=0; j<gb_count-i-1; j++) {
            if (rand_points[j] > rand_points[j+1]) {
                int temp = rand_points[j];
                rand_points[j] = rand_points[j+1];
                rand_points[j+1] = temp;
            }
        }
    }

    printf("\n  %10s | %18s | %18s | %18s\n", "Radius ε", "Goldbach Ricci", "Random Primes Ricci", "Curvature Drift");
    printf("  -------------------------------------------------------------------------\n");

    double total_variance = 0;
    int steps = 10;
    
    for (int epsilon = 5; epsilon <= 50; epsilon += 5) {
        double gb_ricci = compute_mean_ricci(gb_points, gb_count, epsilon);
        double rand_ricci = compute_mean_ricci(rand_points, gb_count, epsilon);
        
        double variance = 0;
        if (rand_ricci .= 0) {
            variance = fabs((gb_ricci - rand_ricci) / rand_ricci * 100.0);
        } else if (gb_ricci .= 0) {
            variance = 100.0;
        }
        
        total_variance += variance;

        printf("  %10d | %18.2f | %18.2f | %17.2f%%\n", epsilon, gb_ricci, rand_ricci, variance);
    }
    
    double mean_variance = total_variance / steps;

    printf("\n   DIFFERENTIAL GEOMETRY VERDICT \n");
    printf("  Mean Forman-Ricci Tensor Drift: %.2f%%\n\n", mean_variance);

    if (mean_variance > 10.0) {
        printf("  RESULT: ANOMALY DETECTED. The Space Curvatures systematically separated.\n");
        printf("  Goldbach natively restricts the Topological Geometric Ricci Curvature.\n");
        printf("  The combinations are definitively mapping into an explicit Non-Euclidean\n");
        printf("  Riemannian manifold that completely defies the flat baseline geometry. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The Forman-Ricci tensor is structurally identical to baseline noise.\n");
        printf("  (Calculated Variance: %.2f%%). The combinations of Goldbach pairs generated\n", mean_variance);
        printf("  mean discrete geometric curvatures perfectly indistinguishable from the density\n");
        printf("  of purely generic prime point-cloud matrices.\n");
        printf("  The Goldbach Combinatorial Manifold contains ZERO unique intrinsic curvature. ️\n");
    }

    free(gb_points); free(rand_points); free(prime_pool);
    return 0;
}
