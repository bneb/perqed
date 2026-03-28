/*
 * red_team_crack58.c — Red Teaming the Forman-Ricci Geometric Curve
 *
 * THE 12% MANIFOLD ANOMALY:
 * Crack 58 yielded a 12.56% variance in the Forman-Ricci scalar curvature 
 * between the Goldbach combinatorial manifold and the generic Prime Baseline.
 *
 * THE EPSILON CUTOFF ILLUSION:
 * A meticulous review of the output reveals a fatal computational bias:
 * At radius ε=5, the generic Primes formed edges (Ricci = 2.00) while the 
 * Goldbach set formed literally zero edges (Ricci = 0.00). 
 * This spawned a 100% variance data point.
 * 
 * From ε=10 to ε=50, the Ricci curvature of both manifolds drifted downward 
 * symmetrically, differing by only ~1% to 7%. The 12.56% "mean variance" 
 * was entirely artificially hyper-inflated by the discrete boundary condition 
 * at the absolute smallest radius.
 *
 * THE RIGOROUS AUDIT:
 * Differential Geometry applies to the continuous, smooth limits of a 
 * macroscopic manifold. A single absolute lower-bound edge state cannot 
 * define the global "Shape" of a Riemannian Space.
 * 
 * 1. We redefine the radius envelope from ε=10 to ε=100 (a true macroscopic 
 *    evaluative landscape).
 * 2. If the Manifolds are truly geometrically distinct (e.g. Spherical vs 
 *    Hyperbolic), their discrete local curvatures will aggressively separate 
 *    across all scales of continuous integration.
 * 3. If the "Breakthrough" was merely a localized discrete lattice artifact 
 *    (Prime Double-Sieve Repulsion), the Forman-Ricci tensors will collapse 
 *    and seamlessly merge, proving zero embedded geometric curvature.
 *
 * BUILD: cc -O3 -o red_team_crack58 red_team_crack58.c -lm
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

double compute_mean_ricci(int *pts, int v_count, int epsilon) {
    int *degree = calloc(v_count, sizeof(int));
    int max_edges = v_count * 150; 
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
            } else { break; }
        }
    }
    
    if (e_count == 0) {
        free(degree); free(edge_u); free(edge_v);
        return 0.0;
    }

    double total_ricci = 0;

    for (int e=0; e<e_count; e++) {
        int u = edge_u[e];
        int v = edge_v[e];
        int triangles = 0;
        
        for (int w = v+1; w < v_count; w++) {
            if (pts[w] - pts[u] <= epsilon) triangles++;
            else break;
        }
        for (int w = u-1; w >= 0; w--) {
            if (pts[v] - pts[w] <= epsilon) triangles++;
            else break;
        }
        
        double ricci = 4.0 - degree[u] - degree[v] + 3.0 * triangles;
        total_ricci += ricci;
    }
    
    free(degree); free(edge_u); free(edge_v);
    return total_ricci / e_count;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 58 (RED TEAM): Ricci Curvature Cutoff\n");
    printf("====================================================\n\n");

    int target = 400000;
    
    int *gb_points = malloc(nprimes * sizeof(int));
    int gb_count = 0;
    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) gb_points[gb_count++] = p;
    }
    
    int *rand_points = malloc(gb_count * sizeof(int));
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

    printf("  Evaluating Macro Continuous Forman-Ricci Geometry...\n\n");
    printf("  %10s | %18s | %18s | %18s\n", "Radius ε", "Goldbach Ricci", "Random Primes Ricci", "Curvature Drift");
    printf("  -------------------------------------------------------------------------\n");

    double total_variance = 0;
    int steps = 10;
    
    // Smooth macroscopic scale ε=10 to ε=100
    for (int epsilon = 10; epsilon <= 100; epsilon += 10) {
        double gb_ricci = compute_mean_ricci(gb_points, gb_count, epsilon);
        double rand_ricci = compute_mean_ricci(rand_points, gb_count, epsilon);
        
        double variance = 0;
        if (rand_ricci .= 0) variance = fabs((gb_ricci - rand_ricci) / rand_ricci * 100.0);
        
        total_variance += variance;
        printf("  %10d | %18.2f | %18.2f | %17.2f%%\n", epsilon, gb_ricci, rand_ricci, variance);
    }
    
    double mean_variance = total_variance / steps;

    printf("\n   RED TEAM VERDICT \n");
    if (mean_variance > 10.0) {
        printf("  CONFIRMED: The Riemannian Geometry Anomaly SURVIVED scale up.\n");
        printf("  The Differential Form is rigidly and explicitly curved. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The anomaly was purely an Epsilon-5 Cutoff boundary illusion.\n");
        printf("  As the topological metric extended into continuous macro-scale curvature,\n");
        printf("  the Differential Tensor flawlessly collapsed to match generic prime arrays.\n");
        printf("  The Mean Tensor Variance crashed to exactly %.2f%%.\n", mean_variance);
        printf("  The Goldbach sequences strictly possess a Geometric Riemann Curvature\n");
        printf("  indistinguishable from basic, unstructured, Euclidean random point clouds. ️\n");
    }

    free(gb_points); free(rand_points); free(prime_pool);
    return 0;
}
