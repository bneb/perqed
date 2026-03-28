/*
 * red_team_crack38.c — Red Team: Does Twisted Cancellation Scale?
 *
 * THE RED TEAM CHALLENGE:
 * CRACK 38 showed that twisting by χ mod q for small q (3, 5, 11)
 * gave 40-63% extra cancellation on minor arcs. 
 *
 * BUT: Small q are MAJOR ARC moduli. The Circle Method already fully
 * exploits them via the Singular Series. The "extra cancellation" we saw
 * is just the Hardy-Littlewood formula in disguise.
 *
 * The REAL question: Does the cancellation persist for LARGE q >> √N?
 * Large q is where the minor arcs live. If the ratio collapses to ~1.0
 * for large q, then CRACK 38 discovered nothing new.
 *
 * BUILD: cc -O3 -o red_team_38 red_team_crack38.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 100000
static char sieve[MAX_N];
static int primes[MAX_N/10];
static int nprimes = 0;

void init(void) {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for(int i = 2; (long long)i * i < MAX_N; i++)
        if(.sieve[i]) 
            for(int j = i * i; j < MAX_N; j += i) sieve[j] = 1;
    for(int i = 2; i < MAX_N; i++)
        if(.sieve[i]) primes[nprimes++] = i;
}

// Legendre symbol (a/p)
int legendre(int a, int p) {
    a = ((a % p) + p) % p;
    if (a == 0) return 0;
    int result = 1;
    while (a .= 0) {
        while (a % 2 == 0) {
            a /= 2;
            if (p % 8 == 3 || p % 8 == 5) result = -result;
        }
        int tmp = a; a = p; p = tmp;
        if (a % 4 == 3 && p % 4 == 3) result = -result;
        a %= p;
    }
    return (p == 1) ? result : 0;
}

int main() {
    init();

    int N = 50000;
    int num_primes = 0;
    for (int i = 0; i < nprimes && primes[i] <= N; i++) num_primes++;

    printf("====================================================\n");
    printf("  RED TEAM CRACK 38: Large Moduli Scaling Test\n");
    printf("====================================================\n\n");

    printf("  N = %d, π(N) = %d, √N = %.0f\n\n", N, num_primes, sqrt(N));

    // Compute Max |S(α)| (untwisted) on minor arcs
    int num_alphas = 3000;
    double max_untwisted = 0;

    for (int j = 0; j < num_alphas; j++) {
        double alpha = 0.01 + (double)j / num_alphas * 0.48;
        double re = 0, im = 0;
        for (int i = 0; i < num_primes; i++) {
            int p = primes[i];
            double angle = 2.0 * M_PI * p * alpha;
            re += cos(angle);
            im += sin(angle);
        }
        double mag = sqrt(re*re + im*im);
        if (mag > max_untwisted) max_untwisted = mag;
    }

    printf("  %10s | %15s | %15s | %10s | %s\n", 
           "Modulus q", "Max|S(α,χ)|", "Max|S(α)|", "Ratio", "Category");
    printf("  -------------------------------------------------------------------------\n");

    // Test small q (major arcs) AND large q (minor arcs.)
    int test_q[] = {5, 11, 101, 1009, 10007, 20011, 40009, 49999, 0};

    for (int ci = 0; test_q[ci]; ci++) {
        int q = test_q[ci];
        
        // q must be prime for Legendre symbol
        if (sieve[q]) continue;
        
        double max_twisted = 0;

        for (int j = 0; j < num_alphas; j++) {
            double alpha = 0.01 + (double)j / num_alphas * 0.48;
            double re = 0, im = 0;
            for (int i = 0; i < num_primes; i++) {
                int p = primes[i];
                int chi = legendre(p, q);
                double angle = 2.0 * M_PI * p * alpha;
                re += chi * cos(angle);
                im += chi * sin(angle);
            }
            double mag = sqrt(re*re + im*im);
            if (mag > max_twisted) max_twisted = mag;
        }

        double ratio = max_twisted / max_untwisted;
        const char *cat = (q < 100) ? "MAJOR ARC" : 
                          (q < 1000) ? "TRANSITION" : "MINOR ARC";

        printf("  %10d | %15.1f | %15.1f | %10.4f | %s\n", 
               q, max_twisted, max_untwisted, ratio, cat);
    }

    printf("\n   RED TEAM SCALING VERDICT \n");
    printf("  Watch the Ratio column as q grows from Major → Minor Arc territory.\n");
    printf("  If it stays < 1.0 for large q: CRACK 38 survives (genuine extra cancellation).\n");
    printf("  If it climbs → 1.0 for large q: CRACK 38 is just the Singular Series. Dead.\n");

    return 0;
}
