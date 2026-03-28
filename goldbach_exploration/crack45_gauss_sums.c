/*
 * crack45_gauss_sums.c — Bilinear Gauss Sums & SVD
 *
 * THE ADDITIVE-MULTIPLICATIVE BRIDGE
 * Goldbach (p+q=2N) is an Additive constraint in Z.
 * The Parity Limit requires a Multiplicative feature χ(p) to differentiate 1 or 2 prime factors.
 * In CRACK 42, we proved slapping χ directly onto an Additive algorithm generates pure noise.
 * 
 * To bridge them flawlessly, we need the GAUSS SUM, which is the exact
 * topological Fourier Transform linking Z_q (Additive) to Z_q^* (Multiplicative).
 *
 * We construct the BILINEAR GAUSS MATRIX M of size (q-1) x (q-1).
 * For a fixed 2N and a modulus q, let:
 *      M_{a, b} = Σ_{p, q < 2N : p+q=2N} [ e^(2πi(ap+bq)/q) * χ_q(p) * χ_q(q) ]
 *
 * This is an immense, incredibly dense 2D interference pattern.
 *
 * If M is pure noise, its geometric energy will be evenly scattered
 * across all dimensions, functioning as a Unitary matrix (all Singular Values are uniform).
 * 
 * If the Gauss Sum successfully isolates the Parity-Breaking Multiplicative signal
 * from the Additive noise, the Singlular Value Decomposition (SVD) of M will exhibit
 * a massive RANK-1 SPIKE (the principal singular value σ_1 ≫ all others).
 *
 * Let's calculate M for various moduli, run a Power Iteration SVD,
 * and test if the Goldbach Gauss Sum is structured or unitary.
 *
 * BUILD: cc -O3 -o crack45 crack45_gauss_sums.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 200000
static char sieve[MAX_N];

// Complex numbers setup for C
typedef struct { double r; double i; } Cpx;
Cpx c_add(Cpx a, Cpx b) { return (Cpx){a.r+b.r, a.i+b.i}; }
Cpx c_mul(Cpx a, Cpx b) { return (Cpx){a.r*b.r - a.i*b.i, a.r*b.i + a.i*b.r}; }
Cpx c_conj(Cpx a) { return (Cpx){a.r, -a.i}; }
Cpx c_exp(double theta) { return (Cpx){cos(theta), sin(theta)}; }

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

void init() {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for (int i=2; i*i < MAX_N; i++)
        if (.sieve[i]) 
            for (int j=i*i; j < MAX_N; j+=i) sieve[j] = 1;
}

// Power Iteration to find principal singular value sigma_1
double power_iteration_svd(Cpx **M, int size) {
    // We compute the principal eigenvalue of M * M^dagger
    Cpx *v = calloc(size, sizeof(Cpx));
    Cpx *next_v = calloc(size, sizeof(Cpx));
    
    // Init random vector
    for (int i=0; i<size; i++) {
        v[i] = (Cpx){ ((double)rand()/RAND_MAX), ((double)rand()/RAND_MAX) };
    }
    
    // Normalize
    double norm = 0;
    for (int i=0; i<size; i++) norm += v[i].r*v[i].r + v[i].i*v[i].i;
    norm = sqrt(norm);
    for (int i=0; i<size; i++) { v[i].r /= norm; v[i].i /= norm; }
    
    int iters = 100;
    double lambda = 0;
    
    for (int k=0; k<iters; k++) {
        // next_v = (M * M*) * v
        memset(next_v, 0, size * sizeof(Cpx));
        for (int i=0; i<size; i++) {
            for (int j=0; j<size; j++) {
                // Compute (M M*)_{i, j} = sum_k M_{i,k} * conj^{M_{j,k}}
                Cpx mm_ij = {0,0};
                for (int c=0; c<size; c++) {
                    Cpx mk = M[i][c];
                    Cpx mjk = c_conj(M[j][c]);
                    mm_ij = c_add(mm_ij, c_mul(mk, mjk));
                }
                next_v[i] = c_add(next_v[i], c_mul(mm_ij, v[j]));
            }
        }
        
        // Rayleight quotient lambda = <next_v, v>
        double rq = 0;
        for (int i=0; i<size; i++) rq += next_v[i].r*v[i].r + next_v[i].i*v[i].i;
        lambda = rq;
        
        // Normalize next_v
        norm = 0;
        for (int i=0; i<size; i++) norm += next_v[i].r*next_v[i].r + next_v[i].i*next_v[i].i;
        norm = sqrt(norm);
        if (norm > 1e-9) {
            for (int i=0; i<size; i++) { v[i].r = next_v[i].r/norm; v[i].i = next_v[i].i/norm; }
        }
    }
    
    free(v); free(next_v);
    // sigma_1 is sqrt(lambda_1 of M M*)
    return sqrt(fabs(lambda));
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 45: Bilinear Gauss Sum SVD Matrix\n");
    printf("====================================================\n\n");

    int target = 20000;
    printf("  Target 2N = %d\n\n", target);

    // Test a few prime moduli for the Gauss bridge
    int q_list[] = {11, 19, 31, 47, 97};
    int num_qs = sizeof(q_list) / sizeof(q_list[0]);
    
    printf("  %6s | %10s | %18s | %15s\n", "Mod q", "Matrix Dim", "Principal S-Val σ1", "Uniform Baseline");
    printf("  ----------------------------------------------------------------\n");
    
    for (int qi = 0; qi < num_qs; qi++) {
        int q = q_list[qi];
        int size = q - 1; // a, b in [1, q-1]
        
        // Allocate matrix M
        Cpx **M = malloc(size * sizeof(Cpx*));
        for (int i=0; i<size; i++) {
            M[i] = calloc(size, sizeof(Cpx));
        }
        
        // Compute Total Frobenius Norm exactly to find the uniform baseline
        double frobenius_sq = 0;

        for (int p = 3; p <= target/2; p+=2) {
            if (.sieve[p] && .sieve[target-p]) {
                int q_prime = target - p;
                
                int chi_p = legendre(p, q);
                int chi_q = legendre(q_prime, q);
                if (chi_p == 0 || chi_q == 0) continue;
                
                double sign = chi_p * chi_q;
                
                for (int a = 1; a < q; a++) {
                    for (int b = 1; b < q; b++) {
                        double phase = 2.0 * M_PI * ((a * p + b * q_prime) % q) / q;
                        Cpx val = c_exp(phase);
                        val.r *= sign;
                        val.i *= sign;
                        M[a-1][b-1] = c_add(M[a-1][b-1], val);
                    }
                }
            }
        }
        
        // Compute exact frobenius norm sqrt(sum |M_ij|^2)
        for (int i=0; i<size; i++) {
            for (int j=0; j<size; j++) {
                frobenius_sq += M[i][j].r*M[i][j].r + M[i][j].i*M[i][j].i;
            }
        }
        double frobenius = sqrt(frobenius_sq);
        // If the energy is purely uniformly scattered across all q-1 orthogonal dimensions (pure noise),
        // then all singular values are equal.
        // sum(σ_i^2) = frobenius^2 -> σ_i = frobenius / sqrt(q-1)
        double uniform_baseline = frobenius / sqrt(size);
        
        double sigma_1 = power_iteration_svd(M, size);
        
        printf("  %6d | %8dx%d | %18.2f | %15.2f\n", q, size, size, sigma_1, uniform_baseline);
        
        for (int i=0; i<size; i++) free(M[i]);
        free(M);
    }
    
    printf("\n   BILINEAR GAUSS SUM VERDICT \n");
    printf("  Compare the Principal Singular Value σ1 to the Uniform Baseline.\n");
    printf("  If σ1 >> Baseline, the Gauss matrix exhibits a rank-1 spectral spike,\n");
    printf("  meaning the additive & multiplicative dimensions aligned constructively.\n\n");
    
    printf("  If σ1 ≈ Baseline, the Parity Barrier perfectly shredded the signals,\n");
    printf("  proving that Additive (minor arc) arithmetic cannot fundamentally\n");
    printf("  correlate with Multiplicative parity. ️\n");

    return 0;
}
