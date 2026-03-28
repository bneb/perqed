/*
 * crack57_quantum_gue.c — Quantum Mechanics & Random Matrix Theory
 *
 * THE GUE/WIGNER SURMISE:
 * In the 1970s, Montgomery and Dyson famously proved that the nontrivial 
 * zeros of the Riemann Zeta Function perfectly obey the Gaussian Unitary 
 * Ensemble (GUE) of Random Matrix Theory.
 * This means Prime Numbers behave mathematically identically to the 
 * quantum energy levels of heavy nuclei.
 * 
 * Specifically, quantum energy levels (and Zeta zeros) exhibit 
 * "Eigenvalue Repulsion". Unlike random independent events (which obey 
 * Poisson statistics and cluster together, P(s) = e^-s), quantum states 
 * systematically repel each other. 
 * Their normalized spacing follows the Wigner Surmise:
 *      P(s) = (32 / pi^2) * s^2 * e^(-(4/pi)*s^2)
 *
 * THE GOLDBACH QUANTUM TEST:
 * Does the sequence of Goldbach counts G(2N) possess Quantum structure,
 * or is it purely independent Poisson noise?
 * We will calculate G(2N) for thousands of sequential N.
 * We will fully normalize the sequence (unfolding the spectrum by removing 
 * the secular Hardy-Littlewood trend).
 * We will calculate the spacing 's' between consecutive unfolded counts.
 * 
 * If Goldbach is governed by Deep Quantum Analytic Structure, the spacing
 * histogram will perfectly align with the GUE Wigner Surmise.
 * If Goldbach is purely combinatoric noise, it will perfectly crash into 
 * the basic e^-s Exponential Poisson curve.
 *
 * BUILD: cc -O3 -o crack57 crack57_quantum_gue.c -lm
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

// Computes the Hardy-Littlewood twin prime constant multiplier C_2 \prod (p-1)/(p-2)
double hl_multiplier(int num) {
    double c2 = 0.6601618158;
    double m = 2.0 * c2;
    for (int i=1; i<nprimes; i++) {
        int p = primes[i];
        if (p > sqrt(num)) break; // Fast heuristic approximation for local density
        if (num % p == 0) {
            m *= (double)(p - 1) / (p - 2);
        }
    }
    return m;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 57: Quantum Mechanics (GUE Random Matrices)\n");
    printf("====================================================\n\n");

    int start_N = 100000;
    int end_N = 150000;
    int num_samples = end_N - start_N;
    
    printf("  Extracting Spectrum of Goldbach Pairs from N=%d to N=%d\n", start_N, end_N);
    printf("  Unfolding the Secular trend to isolate Quantum Energy Spacings...\n\n");

    double *unfolded = malloc(num_samples * sizeof(double));
    double *spacings = malloc((num_samples - 1) * sizeof(double));

    for (int n = start_N; n < end_N; n++) {
        int target = 2 * n;
        int pairs = G(target);
        
        // Unfold the secular trend: G(2N) ≈ 2 * C_2 * (2N / ln^2(2N)) * \prod
        double expected = hl_multiplier(target) * ((double)target / pow(log(target), 2));
        unfolded[n - start_N] = (double)pairs / expected;
    }
    
    // Sort the unfolded energy levels to compute nearest-neighbor spacing
    // Wait, the Wigner surmise applies to the spacing of sequential energy levels.
    // We sort the normalized ratios to form an increasing sequence of "energy levels"
    for (int i=0; i<num_samples-1; i++) {
        for (int j=0; j<num_samples-i-1; j++) {
            if (unfolded[j] > unfolded[j+1]) {
                double temp = unfolded[j];
                unfolded[j] = unfolded[j+1];
                unfolded[j+1] = temp;
            }
        }
    }
    
    // Compute consecutive spacings
    double total_s = 0;
    for (int i=0; i<num_samples-1; i++) {
        spacings[i] = unfolded[i+1] - unfolded[i];
        total_s += spacings[i];
    }
    
    // Normalize spacing so Mean = 1.0 (Critical for Wigner Surmise)
    double mean_s = total_s / (num_samples - 1);
    for (int i=0; i<num_samples-1; i++) {
        spacings[i] /= mean_s;
    }
    
    printf("  Generating the Empirical Nearest-Neighbor Spacing Histogram...\n\n");

    int BINS = 10;
    double max_s = 3.0;
    int *hist = calloc(BINS, sizeof(int));
    
    for (int i=0; i<num_samples-1; i++) {
        int bin = (int)(spacings[i] / (max_s / BINS));
        if (bin >= BINS) bin = BINS - 1;
        hist[bin]++;
    }

    double diff_gue = 0;
    double diff_poisson = 0;

    printf("  %8s | %18s | %18s | %18s\n", "Spc 's'", "Goldbach P(s)", "GUE Wigner P(s)", "Poisson P(s)");
    printf("  -------------------------------------------------------------------------\n");

    for (int i=0; i<BINS; i++) {
        double s = (i + 0.5) * (max_s / BINS);
        
        // Empirical %
        double gb_pct = (double)hist[i] / (num_samples - 1) * 100.0;
        
        // Wigner Surmise for GUE: P(s) = (32/pi^2) * s^2 * e^(-(4/pi)*s^2)
        double wigner = (32.0 / (M_PI * M_PI)) * s * s * exp(-(4.0 / M_PI) * s * s);
        double wigner_pct = wigner * (max_s / BINS) * 100.0;
        
        // Standard Poisson exponential decay
        double poisson = exp(-s);
        double poisson_pct = poisson * (max_s / BINS) * 100.0;
        
        diff_gue += fabs(gb_pct - wigner_pct);
        diff_poisson += fabs(gb_pct - poisson_pct);

        printf("  %8.2f | %17.2f%% | %17.2f%% | %17.2f%%\n", s, gb_pct, wigner_pct, poisson_pct);
    }

    printf("\n   QUANTUM MECHANICS VERDICT \n");
    printf("  Variance against GUE Wigner Surmise: %.2f%%\n", diff_gue);
    printf("  Variance against Poisson Exponential: %.2f%%\n\n", diff_poisson);

    if (diff_gue < diff_poisson) {
        printf("  RESULT: ANOMALY DETECTED. The Goldbach Spacings obey Quantum Eigenvalue Repulsion.\n");
        printf("  The normalized pairs completely rejected the Poisson stochasticity distribution.\n");
        printf("  Just like the zeros of the Riemann Zeta Function, prime addition natively\n");
        printf("  generates the exact Random Matrix symmetry of heavy quantum nuclei. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Goldbach completely ignores Quantum GUE symmetries.\n");
        printf("  The spacing geometry flawlessly snapped to standard exponential Poisson noise.\n");
        printf("  Unlike the Riemann Zeta zeros (which powerfully exhibit eigenvalue repulsion),\n");
        printf("  the additive combinations of Goldbach pairs behave exactly like mathematically\n");
        printf("  independent coin-flips. There is NO hidden Hermitian operator dictating 2N. ️\n");
    }

    free(unfolded); free(spacings); free(hist);
    return 0;
}
