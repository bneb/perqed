/*
 * crack59_fractal_dimension.c — Fractal Geometry & Cantor Dust Bounds
 *
 * THE FRACTAL DIMENSION OF GOLDBACH:
 * Classical Euclidean shapes have integer dimensions (Line = 1, Area = 2).
 * However, complex iterative geometries (like the Cantor Set) hold 
 * fractional dimensions D_f < 1 over macroscopic scales.
 *
 * The Minkowski-Bouligand (Box-Counting) dimension formally evaluates 
 * the spatial density of a bounded point-cloud. 
 * We slice the 1D number line [0, 2N] into N(ε) distinct mathematical "boxes" 
 * of length ε. 
 * We count exactly how many boxes contain at least ONE Goldbach coordinate.
 *
 * D_f = lim_ {ε->0}  [ log(N_filled(ε)) / log(1/ε) ]
 *
 * Since discrete integers trivially have dimension 0 at absolute microscopic 
 * limits (ε=1), we evaluate the *Macroscopic Correlation Dimension* by computing 
 * the least-squares linear regression slope of the log-log plot across strict 
 * spatial increments (ε = 10 -> 10,000).
 *
 * THE HYPOTHESIS:
 * True Prime Numbers are asymptotically dense (~x/log x), meaning at macro 
 * scales, they reliably "fill" almost every large integer box, producing a 
 * macroscopic Fractal Dimension functionally approaching D_f = 1.0 (a solid line).
 * 
 * If the Hardy-Littlewood Double-Sieve (p and 2N-p bypassing moduli) systematically 
 * compresses the valid coordinate zones, the Goldbach point-cloud will fail 
 * to fill boxes linearly compared to equivalent true primes.
 *
 * If D_f strictly drops < 1.0 vs identical noise baseline, the permutations 
 * structurally construct a Topological Cantor Dust.
 *
 * BUILD: cc -O3 -o crack59 crack59_fractal_dimension.c -lm
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

// Computes the number of length-epsilon boxes that contain >0 points
int count_boxes(int *pts, int count, int limit, int epsilon) {
    int total_boxes = (limit / epsilon) + 1;
    int *has_point = calloc(total_boxes, sizeof(int));
    
    for (int i=0; i<count; i++) {
        int box_idx = pts[i] / epsilon;
        if (box_idx < total_boxes) {
            has_point[box_idx] = 1;
        }
    }
    
    int filled = 0;
    for (int i=0; i<total_boxes; i++) {
        if (has_point[i]) filled++;
    }
    
    free(has_point);
    return filled;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 59: Fractal Geometry (Box-Counting Dimension)\n");
    printf("====================================================\n\n");

    int target = 1000000;
    
    int *gb_points = malloc(nprimes * sizeof(int));
    int gb_count = 0;
    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) gb_points[gb_count++] = p;
    }
    
    printf("  Target 2N = %d\n", target);
    printf("  Goldbach Point-Cloud Size: V = %d\n", gb_count);

    // Baseline True Prime Random Selection (Identical Density)
    int *rand_points = malloc(gb_count * sizeof(int));
    int num_valid_primes = 0;
    for (int i=0; i<nprimes; i++) {
        if (primes[i] <= target/2) num_valid_primes++;
        else break;
    }
    
    srand(12345);
    int *prime_pool = malloc(num_valid_primes * sizeof(int));
    for(int i=0; i<num_valid_primes; i++) prime_pool[i] = primes[i];
    for (int i = num_valid_primes - 1; i > 0; i--) {
        int j = rand() % (i + 1);
        int temp = prime_pool[i];
        prime_pool[i] = prime_pool[j];
        prime_pool[j] = temp;
    }
    for(int i=0; i<gb_count; i++) rand_points[i] = prime_pool[i];
    
    // Sort Random Primes
    for (int i=0; i<gb_count-1; i++) {
        for (int j=0; j<gb_count-i-1; j++) {
            if (rand_points[j] > rand_points[j+1]) {
                int temp = rand_points[j];
                rand_points[j] = rand_points[j+1];
                rand_points[j+1] = temp;
            }
        }
    }

    printf("\n  %8s | %18s | %18s | %12s\n", "Box(ε)", "GB Filled N(ε)", "Prime Filled N(ε)", "Missing");
    printf("  ----------------------------------------------------------------------\n");

    // Arrays to store regression data points
    int steps = 15;
    double *log_inv_epsilon = malloc(steps * sizeof(double));
    double *log_gb_N = malloc(steps * sizeof(double));
    double *log_rand_N = malloc(steps * sizeof(double));
    
    int idx = 0;
    for (int eps = 10; eps <= 10000; eps *= 2) {
        if (idx >= steps) break;
        
        int gb_n = count_boxes(gb_points, gb_count, target/2, eps);
        int rand_n = count_boxes(rand_points, gb_count, target/2, eps);
        
        log_inv_epsilon[idx] = log(1.0 / eps);
        log_gb_N[idx] = log(gb_n);
        log_rand_N[idx] = log(rand_n);
        
        int diff = rand_n - gb_n;
        printf("  %8d | %18d | %18d | %12d\n", eps, gb_n, rand_n, diff);
        idx++;
    }

    // Least Squares Linear Regression: y = m*x + b
    // where m is the mathematical Fractal Dimension D_f
    double sum_x = 0, sum_y_gb = 0, sum_y_rand = 0;
    double sum_x2 = 0, sum_xy_gb = 0, sum_xy_rand = 0;
    int n = idx;
    
    for (int i=0; i<n; i++) {
        sum_x += log_inv_epsilon[i];
        sum_y_gb += log_gb_N[i];
        sum_y_rand += log_rand_N[i];
        sum_x2 += log_inv_epsilon[i] * log_inv_epsilon[i];
        sum_xy_gb += log_inv_epsilon[i] * log_gb_N[i];
        sum_xy_rand += log_inv_epsilon[i] * log_rand_N[i];
    }
    
    double denom = (n * sum_x2 - sum_x * sum_x);
    double df_gb = (n * sum_xy_gb - sum_x * sum_y_gb) / denom;
    double df_rand = (n * sum_xy_rand - sum_x * sum_y_rand) / denom;

    // Fractional compression variance
    double variance = fabs(df_gb - df_rand) / df_rand * 100.0;

    printf("\n   FRACTAL GEOMETRY VERDICT \n");
    printf("  Goldbach Coordinate Fractal Dimension (D_f): %.4f\n", df_gb);
    printf("  True Prime Random Fractal Dimension   (D_f): %.4f\n", df_rand);
    printf("  Fractal Dimensional Divergence Variance:   %.2f%%\n\n", variance);

    if (variance > 5.0 && df_gb < df_rand) {
        printf("  RESULT: ANOMALY DETECTED. The Space Volume visibly fractured.\n");
        printf("  Goldbach Point-Clouds rigorously enforce a mathematically degraded D_f.\n");
        printf("  The strict double-sieve constraints uniquely bound combinations into a\n");
        printf("  fractally-compressible Topological Cantor Dust. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Goldbach is geometrically strictly continuous.\n");
        printf("  The combination sequence maps across the vector space with the explicit\n");
        printf("  volume and dimension constraints as standard True Prime stochastic noise.\n");
        printf("  Fractional Space (Minkowski Compression) bounds DO NOT strictly govern 2N. ️\n");
    }

    free(gb_points); free(rand_points); free(prime_pool);
    free(log_inv_epsilon); free(log_gb_N); free(log_rand_N);
    return 0;
}
