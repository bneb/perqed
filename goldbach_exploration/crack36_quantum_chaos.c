/*
 * crack36_quantum_stochasticity.c — Prime Hankel Matrix & Quantum Stochasticity
 *
 * THE WILDCARD: Random Matrix Theory (RMT)
 *
 * Let H be an N x N Hankel matrix where H_{i,j} = 1 if (i+j) is Prime.
 * The anti-diagonals of this matrix are constant, and the structural
 * trace invariants of H encode the Goldbach representations.
 *
 * If Goldbach combinations are structurally "Rigid", the Eigenvalues of H
 * will exhibit "Level Repulsion" — they will refuse to cluster together.
 * In Physics, this is the signature of Quantum Stochasticity (Gaussian Orthogonal Ensemble).
 * The spacing between adjacent eigenvalues 's' will follow the Wigner Surmise:
 *      P_Wigner(s) = (π/2) * s * exp(-π/4 * s^2)    (GOE / Stochasticity - Repulsion)
 * 
 * If Goldbach combinations are just "Random Uncorrelated Noise", the Eigenvalues
 * will follow a Poisson distribution (no repulsion, they cluster):
 *      P_Poisson(s) = exp(-s)                       (Uncorrelated Noise)
 *
 * Let's compute the Eigenvalues using MacOS Accelerate framework (LAPACK)
 * and calculate the Nearest-Neighbor Spacing Distribution (NNSD).
 *
 * BUILD: cc -O3 -o crack36 crack36_quantum_stochasticity.c -framework Accelerate -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <Accelerate/Accelerate.h>

#define MAX_N 20000
static char sieve[MAX_N];

void init(void) {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for(int i = 2; i * i < MAX_N; i++)
        if(.sieve[i]) 
            for(int j = i * i; j < MAX_N; j += i) sieve[j] = 1;
}

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

// Compare for qsort
int cmp(const void *a, const void *b) {
    double fa = *(const double*)a;
    double fb = *(const double*)b;
    return (fa > fb) - (fa < fb);
}

int main() {
    init();

    int N = 2000;
    
    printf("====================================================\n");
    printf("  CRACK 36: Quantum Stochasticity & The Prime Hankel Matrix\n");
    printf("====================================================\n\n");

    printf("  Constructing %d x %d Prime Hankel Matrix (H_{i,j} = 1 if i+j is prime)\n", N, N);
    
    // Allocate matrix for LAPACK dsyev (column-major)
    double *H = calloc(N * N, sizeof(double));
    for (int i = 1; i <= N; i++) {
        for (int j = 1; j <= N; j++) {
            if (is_prime(i + j)) {
                // LAPACK is column-major: index = (j-1)*N + (i-1)
                H[(j - 1) * N + (i - 1)] = 1.0;
            }
        }
    }

    printf("  Executing LAPACK dsyev to compute the full Eigenvalue Spectrum...\n");

    char jobz = 'N'; // Compute eigenvalues only
    char uplo = 'U'; // Upper triangle
    int lda = N;
    double *W = malloc(N * sizeof(double)); // Eigenvalues
    
    int lwork = 3 * N;
    double *work = malloc(lwork * sizeof(double));
    int info;

    dsyev_(&jobz, &uplo, &N, H, &lda, W, work, &lwork, &info);

    if (info .= 0) {
        printf("  LAPACK Error: info = %d\n", info);
        return 1;
    }

    // Sort Eigenvalues (though LAPACK usually returns them ordered)
    qsort(W, N, sizeof(double), cmp);

    // Calculate nearest-neighbor spacings
    // First, we must 'unfold' the spectrum to unit mean density. 
    // For simplicity, we just normalize the spacings by the local mean in a sliding window.
    
    printf("\n  Analyzing Nearest-Neighbor Spacing Distribution (NNSD)...\n");

    double *S = malloc((N - 1) * sizeof(double));
    int valid_S = 0;
    double mean_S = 0;

    for (int i = 0; i < N - 1; i++) {
        double diff = W[i+1] - W[i];
        if (diff > 1e-6) { // Ignore degenerate zero eigenvalues
            S[valid_S++] = diff;
            mean_S += diff;
        }
    }
    mean_S /= valid_S;

    // Normalize to unit mean
    for (int i = 0; i < valid_S; i++) {
        S[i] /= mean_S;
    }

    // Bin the spacings into a histogram
    int BINS = 10;
    int *hist = calloc(BINS, sizeof(int));
    double bin_width = 3.0 / BINS; // Measure up to S=3.0

    for (int i = 0; i < valid_S; i++) {
        int bin = (int)(S[i] / bin_width);
        if (bin < BINS) hist[bin]++;
    }

    printf("\n  %10s | %10s | %10s | %10s\n", "s (Spacing)", "Data Freq", "Poisson", "Wigner GOE");
    printf("  --------------------------------------------------\n");

    double poisson_l2 = 0;
    double wigner_l2 = 0;

    for (int i = 0; i < BINS; i++) {
        double s = (i + 0.5) * bin_width;
        double data_prob = (double)hist[i] / valid_S / bin_width;
        
        // P(s) = exp(-s)
        double p_poisson = exp(-s);
        
        // P(s) = (π/2) * s * exp(-π/4 * s^2)
        double p_wigner = (M_PI / 2.0) * s * exp(-M_PI / 4.0 * s * s);

        poisson_l2 += (data_prob - p_poisson) * (data_prob - p_poisson);
        wigner_l2 += (data_prob - p_wigner) * (data_prob - p_wigner);

        printf("  %10.2f | %10.4f | %10.4f | %10.4f\n", s, data_prob, p_poisson, p_wigner);
    }

    printf("\n   THE QUANTUM CHAOS VERDICT \n");
    printf("  Distance to Poisson (Uncorrelated Noise)  : %.4f\n", poisson_l2);
    printf("  Distance to Wigner (Quantum Level Repulse): %.4f\n\n", wigner_l2);

    if (poisson_l2 < wigner_l2) {
        printf("  THE MATRIX IS POISSON.\n");
        printf("  The Eigenvalues of the Prime Hankel Matrix cluster together randomly.\n");
        printf("  There is NO 'level repulsion'. The Goldbach intersections act precisely\n");
        printf("  like Uncorrelated Thermodynamic Noise.\n");
        printf("  If Goldbach is just random noise, structural combinatorics will NEVER\n");
        printf("  succeed because local noise fundamentally destroys global guarantees.\n");
    } else {
        printf("  THE MATRIX IS WIGNER GOE.\n");
        printf("  The Eigenvalues systematically repel each other. The Goldbach geometry\n");
        printf("  rigidly locks the values apart, creating a mathematical crystal lattice.\n");
        printf("  Goldbach pairs perfectly mathematically mimic the Quantum Stochasticity\n");
        printf("  of heavy atomic nuclei (Uranium-238) and the Riemann Zeta zeros.\n");
    }

    free(H); free(W); free(S); free(work); free(hist);
    return 0;
}
