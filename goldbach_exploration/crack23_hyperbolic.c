/*
 * crack23_hyperbolic.c — The Hyperbolic Cusp Cancellation
 *
 * HYPOTHESIS: Map the Circle Method onto the boundary of the hyperbolic plane.
 * The major arcs α = a/q are the rational cusps of the modular group acting on ℍ.
 * If M is a Goldbach counterexample, then R(M) = 0.
 *
 * R(M) = ∫_cusps S_N(α)² e(-Mα) + ∫_bulk S_N(α)² e(-Mα) = 0
 *
 * Thus: ∫_bulk = - ∫_cusps.
 *
 * The cusps (major arcs) give an overwhelmingly positive signal:
 *   S(M) * ∫_2^{M/2} dt / (log t * log(M-t))  ≈  S(M) * M / log² M.
 *
 * For the bulk (minor arcs) to exactly cancel this, the negative fluctuations
 * of the minor arcs must be massive enough.
 * But we know the TOTAL energy of the minor arcs is constrained by Parseval's identity:
 *   ∫_0^1 |S_N(α)|² dα = π(N) ≈ N / log N.
 *
 * The maximum possible negative contribution an integral can make is bounded by
 * its total absolute energy, which is bounded by Parseval.
 * Actually, the minor arc integral is ∫_bulk S_N(α)² e(-Mα) dα.
 * The absolute value of this integral is ≤ ∫_bulk |S_N|² dα ≤ ∫_0^1 |S_N|² dα = π(N).
 *
 * Wait. The Parseval identity bounds the ERROR by N / log N.
 * But the MAIN TERM is M / log² M (which is 2N / log² 2N).
 * Since N / log N > N / log² N, the minor arcs theoretically DO have the "capacity"
 * to cancel the main term. This is the fundamental "log gap" wall.
 *
 * But wait, we can compute the empirical capacity more tightly.
 * What if we compute the ACTUAL minor arc maximum negative capacity for small M?
 * If we assume M is a counterexample, we can force a contradiction if we can show
 * that the minor arc integral physically CANNOT reach -S(M) * M / log² M even under
 * worst-case phase alignment.
 *
 * Let's calculate the empirical "Cancellation Ratio" = (Major Arc Signal) / (Parseval Energy)
 * If this ratio > 1, Goldbach is proved because the minor arcs mathematically cannot
 * cancel the major arcs.
 *
 * BUILD: cc -O3 -o crack23 crack23_hyperbolic.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 5000000
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

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

double twin_prime_const() {
    double C2 = 1.0;
    for(int p = 3; p < 10000; p++){
        if(.is_prime(p)) continue;
        C2 *= 1.0 - 1.0 / ((double)(p-1)*(p-1));
    }
    return C2;
}

double singular_series(int N, double C2) {
    double S = 2 * C2;
    int t = N; 
    while (t % 2 == 0) t /= 2;
    for (int p = 3; p <= t; p++) {
        if (t % p) continue;
        while (t % p == 0) t /= p;
        S *= (double)(p - 1) / (p - 2);
    }
    return S;
}

double exact_integral(int N, int steps) {
    double sum = 0;
    double lo = 2.5, hi = N / 2.0 - 0.5;
    double dt = (hi - lo) / steps;
    for (int i = 0; i < steps; i++) {
        double t = lo + (i + 0.5) * dt;
        sum += dt / (log(t) * log(N - t));
    }
    return sum;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 23: Hyperbolic Cusp Cancellation Bounds\n");
    printf("====================================================\n\n");

    printf("  Assume M is a Goldbach Counterexample.\n");
    printf("  Then R(M) = 0.\n");
    printf("  R(M) = ∫_cusps S(α)²e(-Mα) + ∫_bulk S(α)²e(-Mα) = 0.\n");
    printf("  ∫_bulk = - ∫_cusps (The minor arcs must EXACTLY cancel the major arcs).\n\n");

    printf("  Major Arc Signal ≈ S(M) * ∫ dt / (log t * log(M-t))\n");
    printf("  Max Minor Arc Capacity ≤ ∫_0^1 |S(α)|² dα = π(M/2) (via Parseval)\n");
    printf("  To prove Goldbach, we need Major Arc Signal > Max Minor Arc Capacity.\n\n");

    printf("  Let's compute the Cancellation Ratio = Signal / Max Capacity.\n");
    printf("  If Ratio > 1, the counterexample yields a contradiction.\n\n");

    printf("  %8s | %13s | %13s | %8s\n", "M", "Signal", "Parseval Max", "Ratio");

    int M_vals[] = {1000, 10000, 50000, 100000, 500000, 1000000, 2000000, 4000000, 0};

    for (int i = 0; M_vals[i]; i++) {
        int M = M_vals[i];
        
        double S = singular_series(M, C2);
        double signal = S * exact_integral(M, 10000);
        
        // Parseval upper bound is EXACTLY the number of primes ≤ M/2
        // because we sum unordered pairs.
        int parseval_max = 0;
        for (int j = 0; j < nprimes && primes[j] <= M/2; j++) {
            parseval_max++;
        }

        double ratio = signal / parseval_max;
        
        printf("  %8d | %13.2f | %13d | %8.4f\n", M, signal, parseval_max, ratio);
    }

    printf("\n   THE LOGARITHMIC TRENCH \n");
    printf("  The Ratio is strictly < 1 and DECREASES as M approaches infinity.\n");
    printf("  Signal grows as M / log² M.\n");
    printf("  Parseval capacity grows as M / log M.\n");
    printf("  Therefore, Ratio grows as 1 / log M → 0.\n\n");

    printf("  CONCLUSION:\n");
    printf("  The minor arcs always have infinitely more 'capacity' to\n");
    printf("  cancel the major arcs than the major arcs have signal.\n");
    printf("  A counterexample M perfectly forcing ∫_bulk = -∫_cusps\n");
    printf("  is mathematically allowed by the $L_2$ energy bounds of the space.\n");

    return 0;
}
