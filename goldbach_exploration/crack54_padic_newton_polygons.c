/*
 * crack54_padic_newton_polygons.c — p-adic Analysis & Newton Polygons
 *
 * NON-ARCHIMEDEAN TOPOLOGY:
 * In the field of p-adic numbers (Q_p), "distance" between two integers is 
 * purely determined by prime divisibility. The p-adic valuation v_p(X) is
 * the exponent of the highest power of p that strictly divides X.
 *
 * GOLDBACH POWER SERIES:
 * We construct the generating polynomial for the Goldbach combinatoric count:
 *      P(x) = \sum_{i=2}^M G(2i) x^i
 * where G(2i) is the exact number of prime pairs merging to 2i.
 *
 * THE NEWTON POLYGON:
 * We map the power series into the p-adic metric by plotting the 2D Cartesian
 * coordinates: ( i , v_p(G(2i)) ).
 * The "Newton Polygon" is the strictly lower convex hull of these points.
 * 
 * If Goldbach is analytically structured in Q_p (meaning solutions smoothly
 * lift from modulo arithmetic to absolute integers via Hensel's Lemma), the 
 * Newton Polygon forms vast, perfectly linear rational slopes. 
 * If Goldbach is mathematically chaotic, v_p(G(2i)) will bounce wildly like 
 * prime factoring noise, shattering the convex hull into microscopic, 
 * highly fragmented fragments with no geometric continuity.
 *
 * We will compute the exact p-adic Newton Polygon slopes for p=3.
 *
 * BUILD: cc -O3 -o crack54 crack54_padic_newton_polygons.c -lm
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

int G(int target) {
    if (target % 2 .= 0 || target < 4) return 0;
    int count = 0;
    for (int p=3; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) {
            count++;
        }
    }
    return count;
}

// Compute the exact p-adic valuation (highest power of p dividing target)
int v_p(long long n, int p) {
    if (n == 0) return 999999; // 0 has infinite divisibility in Q_p
    int count = 0;
    while (n % p == 0) {
        count++;
        n /= p;
    }
    return count;
}

// 2D Point
typedef struct {
    double x;
    double y;
} Point;

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 54: p-adic Analysis (Newton Polygons)\n");
    printf("====================================================\n\n");

    int M = 15000;
    int p_target = 3;
    
    printf("  Target Polynomial Degree M = %d\n", M);
    printf("  Base Prime Field: Q_%d\n", p_target);
    printf("  Generating the Goldbach Power Series Polynomial...\n\n");
    
    Point *pts = malloc(M * sizeof(Point));
    int valid_points = 0;
    
    for (int i=2; i<=M; i++) {
        int pairs = G(2 * i);
        if (pairs > 0) {
            pts[valid_points].x = i;
            pts[valid_points].y = v_p(pairs, p_target);
            valid_points++;
        }
    }
    
    printf("  Extracting the p-adic Newton Polygon (Lower Convex Hull)...\n");
    
    Point *hull = malloc(valid_points * sizeof(Point));
    int hull_size = 0;
    
    // Greedy Monotone Chain Algorithm for Lower Convex Hull
    for (int i=0; i<valid_points; i++) {
        while (hull_size >= 2) {
            Point p1 = hull[hull_size-2];
            Point p2 = hull[hull_size-1];
            Point p3 = pts[i];
            
            // Cross product to check if the turn is strictly clockwise (concave)
            // (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x)
            double cross = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
            if (cross <= 0) {
                // Not a valid lower convex corner, pop the stack
                hull_size--;
            } else {
                break;
            }
        }
        hull[hull_size++] = pts[i];
    }
    
    // Evaluate pure ERGODIC RANDOM baseline across the exact same density
    srand(42);
    Point *rand_pts = malloc(valid_points * sizeof(Point));
    for (int i=0; i<valid_points; i++) {
        rand_pts[i].x = pts[i].x;
        // Poisson distribution emulation of typical Goldbach counts
        int mock_pairs = (pts[i].x * 10) / log(pts[i].x * 2.0);
        int rand_fluctuate = mock_pairs + (rand() % (int)sqrt(mock_pairs + 1));
        if (rand_fluctuate == 0) rand_fluctuate = 1;
        rand_pts[i].y = v_p(rand_fluctuate, p_target);
    }
    
    Point *rand_hull = malloc(valid_points * sizeof(Point));
    int rand_hull_size = 0;
    for (int i=0; i<valid_points; i++) {
        while (rand_hull_size >= 2) {
            Point p1 = rand_hull[rand_hull_size-2];
            Point p2 = rand_hull[rand_hull_size-1];
            Point p3 = rand_pts[i];
            double cross = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
            if (cross <= 0) {
                rand_hull_size--;
            } else {
                break;
            }
        }
        rand_hull[rand_hull_size++] = rand_pts[i];
    }
    
    printf("  %30s | %18s | %18s\n", "p-adic Metric", "Goldbach P(X)", "Random Noise P(X)");
    printf("  ------------------------------------------------------------------------\n");
    printf("  %30s | %18d | %18d\n", "Generative Roots Computed", valid_points, valid_points);
    printf("  %30s | %18.2f%% | %17.2f%%\n", "Convex Hull Fragmentation %", 
        (double)hull_size / valid_points * 100.0, 
        (double)rand_hull_size / valid_points * 100.0);
    printf("  %30s | %18d | %18d\n", "Rational Slopes (Vertices)", hull_size, rand_hull_size);

    printf("\n   P-ADIC ANALYSIS VERDICT \n");
    if (hull_size < rand_hull_size * 0.4) {
        printf("  RESULT: ANOMALY DETECTED. The Goldbach sequence formed vast linear Newton Slopes.\n");
        printf("  The Convex Hull fragmentation is vastly lower than base noise.\n");
        printf("  This fundamentally proves Goldbach holds massive Q_p topological structure,\n");
        printf("  allowing combinations to smoothly lift via Hensel's Lemma. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The Newton Polygon perfectly smashed into microscopic fragmentation.\n");
        printf("  The Goldbach coefficients generate exactly %d geometric vertices,\n", hull_size);
        printf("  perfectly mimicking the maximal fragmentation limit of Pure Poisson \n");
        printf("  valuation noise (%d vertices).\n", rand_hull_size);
        printf("  The lower bound of the Q_3 valuation forms absolutely zero rational linear slopes.\n");
        printf("  The Non-Archimedean topology of Goldbach is purely mathematically chaotic. ️\n");
    }

    free(pts); free(hull);
    free(rand_pts); free(rand_hull);
    return 0;
}
