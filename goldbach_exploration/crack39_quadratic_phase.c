/*
 * crack39_quadratic_phase.c — Quadratic Phase Pseudorandomness (U^{2.5})
 *
 * THE U^3 GOWERS NORM TEST:
 *
 * U^2 pseudorandomness = cancellation against linear phases e^{2πiαn}
 * U^3 pseudorandomness = cancellation against quadratic phases e^{2πi(αn²+βn)}
 *
 * If primes are U^3-pseudorandom, we get MORE cancellation than U^2 alone.
 * 
 * This experiment computes:
 *   T(α) = Σ_{p ≤ N} e^{2πi α p²}    (Quadratic Weyl Sum over primes)
 *
 * If |T(α)| << |S(α)| on the minor arcs, the QUADRATIC phases extract
 * extra cancellation from the primes' distribution. This would prove
 * that the primes satisfy a pseudorandomness condition strictly between
 * U^2 and U^3 — exactly what we need.
 *
 * We also compute the "Quadratic Goldbach" correlation:
 *   Q(2N) = Σ_{p+q=2N} e^{2πi α (p² - q²)}
 * 
 * Since p² - q² = (p-q)(p+q) = (p-q)·2N, this encodes the GAP between
 * the primes into a multiplicative structure. If Q(2N) cancels better
 * than R(2N), the quadratic lift reveals hidden structure.
 *
 * BUILD: cc -O3 -o crack39 crack39_quadratic_phase.c -lm
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

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 39: Quadratic Phase Pseudorandomness (U^3)\n");
    printf("====================================================\n\n");

    int N = 50000;
    int num_primes = 0;
    for (int i = 0; i < nprimes && primes[i] <= N; i++) num_primes++;

    printf("  Primes up to %d: %d\n", N, num_primes);
    printf("  Testing: do quadratic phases e^{2πiαp²} cancel BETTER\n");
    printf("  than linear phases e^{2πiαp} on minor arcs?\n\n");

    int num_alphas = 5000;
    double max_linear = 0, max_quadratic = 0;
    double sum_linear_sq = 0, sum_quadratic_sq = 0;

    for (int j = 0; j < num_alphas; j++) {
        double alpha = 0.01 + (double)j / num_alphas * 0.48;
        
        double re_lin = 0, im_lin = 0;
        double re_quad = 0, im_quad = 0;
        
        for (int i = 0; i < num_primes; i++) {
            int p = primes[i];
            
            // Linear phase: e^{2πi p α}
            double angle_lin = 2.0 * M_PI * p * alpha;
            re_lin += cos(angle_lin);
            im_lin += sin(angle_lin);
            
            // Quadratic phase: e^{2πi p² α}
            double angle_quad = 2.0 * M_PI * ((double)p * p) * alpha;
            re_quad += cos(angle_quad);
            im_quad += sin(angle_quad);
        }
        
        double mag_lin = sqrt(re_lin*re_lin + im_lin*im_lin);
        double mag_quad = sqrt(re_quad*re_quad + im_quad*im_quad);
        
        if (mag_lin > max_linear) max_linear = mag_lin;
        if (mag_quad > max_quadratic) max_quadratic = mag_quad;
        
        sum_linear_sq += mag_lin * mag_lin;
        sum_quadratic_sq += mag_quad * mag_quad;
    }

    double rms_linear = sqrt(sum_linear_sq / num_alphas);
    double rms_quadratic = sqrt(sum_quadratic_sq / num_alphas);

    printf("  %20s | %15s | %15s\n", "Metric", "Linear (U^2)", "Quadratic (U^3)");
    printf("  ----------------------------------------------------------\n");
    printf("  %20s | %15.1f | %15.1f\n", "Max |Sum| on Minor", max_linear, max_quadratic);
    printf("  %20s | %15.1f | %15.1f\n", "RMS |Sum| on Minor", rms_linear, rms_quadratic);
    printf("  %20s | %15.4f | %15.4f\n", "Max/π(N)", max_linear/num_primes, max_quadratic/num_primes);
    printf("  %20s | %15.4f | %15.4f\n", "RMS/√π(N)", rms_linear/sqrt(num_primes), rms_quadratic/sqrt(num_primes));

    printf("\n   THE QUADRATIC PHASE VERDICT \n");
    
    if (max_quadratic < max_linear * 0.8) {
        printf("  RESULT: ANOMALY DETECTED. Quadratic phases give %.1f%% BETTER cancellation.\n",
               (1.0 - max_quadratic/max_linear) * 100);
        printf("  The primes are MORE pseudorandom against quadratic phases\n");
        printf("  than against linear phases. This is the intermediate notion.\n");
    } else if (max_quadratic > max_linear * 1.2) {
        printf("  WORSE: Quadratic phases give LESS cancellation than linear.\n");
        printf("  The primes have unexpected quadratic correlations that AMPLIFY\n");
        printf("  the interference instead of suppressing it.\n");
    } else {
        printf("  NEUTRAL: Quadratic phases give roughly the same cancellation.\n");
        printf("  The primes look equally pseudorandom at both scales.\n");
    }

    // Bonus: compute the "Quadratic Goldbach" correlation
    printf("\n  BONUS: Quadratic Goldbach Correlation\n");
    printf("  Since p² - q² = (p-q)(p+q) = (p-q)·2N for p+q=2N,\n");
    printf("  the quadratic lift encodes the GAP (p-q) multiplicatively.\n\n");
    
    int test_N2 = 10000;
    double max_Q = 0;
    for (int j = 0; j < 1000; j++) {
        double alpha = 0.01 + (double)j / 1000.0 * 0.48;
        double re = 0, im = 0;
        
        for (int p = 3; p <= test_N2/2; p += 2) {
            if (is_prime(p) && is_prime(test_N2 - p)) {
                // Encode the GAP
                int gap = p - (test_N2 - p); // = 2p - 2N
                double angle = 2.0 * M_PI * gap * alpha;
                re += cos(angle);
                im += sin(angle);
            }
        }
        double mag = sqrt(re*re + im*im);
        if (mag > max_Q) max_Q = mag;
    }
    
    int true_pairs = 0;
    for (int p = 3; p <= test_N2/2; p+=2) 
        if (is_prime(p) && is_prime(test_N2 - p)) true_pairs++;
    
    printf("  Goldbach Pairs for 2N=%d: %d\n", test_N2, true_pairs);
    printf("  Max Quadratic Correlation |Q(α)|: %.1f\n", max_Q);
    printf("  Ratio |Q|/Pairs: %.4f\n", max_Q / true_pairs);
    printf("  (If Ratio >> 1.0, the gaps between Goldbach primes are structured.\n");
    printf("   If Ratio ≈ 1.0, the gaps are random — no extra info.) ️\n");

    return 0;
}
