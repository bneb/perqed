/*
 * crack52_hyperbolic_geometry.c — Hyperbolic Geometry & Modular Curves
 *
 * THE POINCARE HALF-PLANE:
 * We map the positive numbers to the Complex Upper Half-Plane H:
 *      z = x + i y    (where y > 0)
 * 
 * For Goldbach, we map every pair (p, q) to a complex point:
 *      z = p + i q
 *
 * THE MODULAR GROUP PSL(2, Z):
 * Hyperbolic geometry is governed by the Modular Group PSL(2, Z), consisting
 * of Mobius transformations: f(z) = (az + b) / (cz + d) where ad - bc = 1.
 * 
 * Any point in H can be "folded" back into the standard Fundamental Domain:
 *      F = { z : |z| >= 1  AND  -0.5 <= Re(z) <= 0.5 }
 * using two simple generator transformations:
 *      T: z -> z + 1      (translation shifting Re(z) into [-0.5, 0.5])
 *      S: z -> -1_z       (inversion pushing z inside the unit circle)
 *
 * GOLDBACH GEODESIC FOLDING:
 * The target 2N defines the massive linear constraint p + q = 2N.
 * In H, this is exactly the straight line Re(z) + Im(z) = 2N.
 *
 * As we evaluate all Goldbach Prime combinations on this line and 
 * rigorously fold them down into the minuscule Fundamental Domain F,
 * they will undergo chaotic, fractal-like Mobius mixing.
 *
 * THE ERGODIC HYPOTHESIS:
 * If the primes possess geometric modular structure (like Modular Curves),
 * the folded points z' = x' + i y' will cluster densely into highly 
 * structured sub-regions of F (revealing the hidden invariant geometry).
 *
 * If Goldbach is theoretically chaotic, the Mobius transformations will
 * shred the line into "Hyperbolic Dust", spraying the points uniformly
 * across F, perfectly achieving Ergodic Equidistribution matching 
 * completely random coordinate pairs.
 *
 * Let's fold the Goldbach Pairs and compute their Spatial Hyperbolic Distribution.
 *
 * BUILD: cc -O3 -o crack52 crack52_hyperbolic_geometry.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 400000
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

// Reduce a complex point z = x + iy into the Fundamental Domain F of PSL(2,Z)
void mobius_reduce(double *x, double *y) {
    int max_iters = 10000;
    for (int i=0; i<max_iters; i++) {
        // Step 1: Translation T^k (Shift real part to [-0.5, 0.5])
        double shift = round(*x);
        *x -= shift;
        
        // Step 2: Inversion S (If inside the unit circle, invert out)
        double norm_sq = (*x)*(*x) + (*y)*(*y);
        if (norm_sq >= 0.999999) { // |z| >= 1.0
            break; // We have reached the fundamental domain.
        }
        
        // z -> -1 / z
        // -1 / (x + iy) = - (x - iy) / (x^2 + y^2) = -x/norm_sq + i y/norm_sq
        *x = -(*x) / norm_sq;
        *y = (*y) / norm_sq;
    }
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 52: Hyperbolic Geometry (Modular Curves)\n");
    printf("====================================================\n\n");

    int target = 200000;
    
    printf("  Target Line constraint: p + q = %d\n", target);
    printf("  Mapping primes to z = p + i*q in the Poincare Half-Plane.\n");
    printf("  Folding complex coordinates via Mobius S and T matrices into the\n");
    printf("  Fundamental Domain F = { |z| >= 1, and -0.5 <= x <= 0.5 }\n\n");

    // We will measure Equidistribution using a spatial grid over F.
    // The domain visually spans roughly y from 0.866 (sqrt(3)/2) up to ~infinity.
    // We'll bin the resulting folded Y-coordinates into regions to test uniformity.
    int BINS = 10;
    int *gb_bins = calloc(BINS, sizeof(int));
    int *rand_bins = calloc(BINS, sizeof(int));
    
    int gb_count = 0;
    
    // Evaluate pure GOLDBACH structure
    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) {
            int q = target - p;
            double z_x = p;
            double z_y = q;
            
            mobius_reduce(&z_x, &z_y);
            
            // Bin the hyperbolic altitude Y
            // Y typically clusters extremely tightly at the base of F (0.866 -> 1.5)
            // due to the hyperbolic measure dxdy/y^2
            double y_cap = z_y;
            if (y_cap > 2.0) y_cap = 2.0; 
            int bin = (int)((y_cap - 0.866) / (2.0 - 0.866) * BINS);
            if (bin < 0) bin = 0;
            if (bin >= BINS) bin = BINS - 1;
            
            gb_bins[bin]++;
            gb_count++;
        }
    }
    
    // Evaluate pure ERGODIC RANDOM baseline across the exact same line constraint.
    int rand_count = 0;
    srand(42);
    // We shoot continuous random integers along the exact same line x+y = 2N
    while (rand_count < gb_count) {
        double z_x = 1.0 + (rand() % (target / 2 - 1));
        double z_y = target - z_x;
        
        mobius_reduce(&z_x, &z_y);
        
        double y_cap = z_y;
        if (y_cap > 2.0) y_cap = 2.0; 
        int bin = (int)((y_cap - 0.866) / (2.0 - 0.866) * BINS);
        if (bin < 0) bin = 0;
        if (bin >= BINS) bin = BINS - 1;
        
        rand_bins[bin]++;
        rand_count++;
    }

    printf("  Spatial Hyperbolic Altitude Distribution inside Fundamental Domain F\n");
    printf("  %15s | %18s | %18s\n", "Y-Zone Altitude", "Goldbach Cluster %", "Ergodic Random %");
    printf("  ------------------------------------------------------------------\n");
    
    double variance = 0;

    for (int i=0; i<BINS; i++) {
        double altitude_start = 0.866 + i * (2.0 - 0.866) / BINS;
        double gb_pct = (double)gb_bins[i] / gb_count * 100.0;
        double rand_pct = (double)rand_bins[i] / rand_count * 100.0;
        
        variance += fabs(gb_pct - rand_pct);
        
        printf("  %12.2f -> | %17.2f%% | %17.2f%%\n", altitude_start, gb_pct, rand_pct);
    }
    
    printf("\n   HYPERBOLIC GEOMETRY VERDICT \n");
    printf("  Total L1 Ergodic Variance Delta: %.2f%%\n\n", variance);
    
    if (variance > 15.0) {
        printf("  RESULT: ANOMALY DETECTED. The Goldbach geodesic drastically clustered.\n");
        printf("  The primes resisted Ergodic equidistribution under Mobius folding.\n");
        printf("  This fundamentally links Goldbach pairs to structured Modular Curves\n");
        printf("  embedded in the Poincare space. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The Hyperbolic footprints perfectly matched (Variance = %.2f%%).\n", variance);
        printf("  The Goldbach prime pairs completely dissolved into Hyperbolic Dust under PSL(2,Z).\n");
        printf("  They perfectly achieved the exact same Ergodic random distributions as\n");
        printf("  unconstrained random integer combinations along the geodesic.\n");
        printf("  The Modular Space is topologically blind to prime combinations. ️\n");
    }

    free(gb_bins); free(rand_bins);
    return 0;
}
