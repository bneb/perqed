/*
 * zero_density_proper.c — Properly compute the zero-density exponent
 * from an optimized mollifier, using the correct framework.
 *
 * The zero-density bound (Gallagher + mean value):
 *   N(σ,T) ≤ C · Σ_χ ∫|M(σ+it,χ)·L(σ+it,χ) - 1|² dt
 *
 * For M(s,χ) = Σ_{n≤Y} μ(n)·P(logn/logY)·χ(n)·n⁻ˢ:
 *   I₁(P,Y,σ) = Σ_χ ∫₁ᵀ |ML - 1|² dt
 *
 * The asymptotic behavior: I₁ ≈ φ(q)·T · R(P,Y,σ) where R → 0 as Y → ∞.
 * The rate of decay R ~ Y^{-(2σ-1)} · F(P) determines the exponent.
 *
 * PROCEDURE:
 * 1. For each Y: compute I₁(P=flat) and I₁(P=optimal)
 * 2. Extract the decay rate: R(Y) = I₁(P,Y) / (φ(q)·T)
 * 3. Fit R(Y) ~ Y^{-α} to extract α
 * 4. The zero-density exponent: A = (1-α)/(1-σ) (from N ≤ T^{1-αθ})
 *
 * If α_opt > α_flat: the optimal mollifier gives a BETTER exponent.
 *
 * BUILD: cc -O3 -o zero_density_proper zero_density_proper.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <complex.h>
#include <string.h>

#define MAX_Y 600
#define MAX_DEG 4      /* keep degree low to avoid overfitting */
#define T_GRID 300

static int mu_table[MAX_Y + 1];
void compute_mu(int limit) {
    int *smallest = calloc(limit + 1, sizeof(int));
    for (int i = 1; i <= limit; i++) mu_table[i] = 1;
    for (int p = 2; p <= limit; p++) {
        if (smallest[p]) continue;
        for (int j = p; j <= limit; j += p) {
            if (!smallest[j]) smallest[j] = p;
            mu_table[j] *= -1;
        }
        for (long long j = (long long)p*p; j <= limit; j += (long long)p*p)
            mu_table[(int)j] = 0;
    }
    free(smallest);
}

int primitive_root(int q) {
    for (int g = 2; g < q; g++) {
        int x = 1, ok = 1;
        for (int i = 1; i < q-1; i++) { x = (x*g)%q; if (x==1) { ok=0; break; } }
        if (ok) return g;
    }
    return -1;
}

void solve_system(int n, double B[][MAX_DEG+1], double *l, double *c) {
    double A[MAX_DEG+1][MAX_DEG+2];
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) A[i][j] = B[i][j];
        A[i][n] = l[i];
    }
    for (int col = 0; col < n; col++) {
        int pivot = col;
        for (int row = col+1; row < n; row++)
            if (fabs(A[row][col]) > fabs(A[pivot][col])) pivot = row;
        for (int j = 0; j <= n; j++) {
            double tmp = A[col][j]; A[col][j] = A[pivot][j]; A[pivot][j] = tmp;
        }
        if (fabs(A[col][col]) < 1e-15) { c[col] = 0; continue; }
        for (int row = col+1; row < n; row++) {
            double f = A[row][col] / A[col][col];
            for (int j = col; j <= n; j++) A[row][j] -= f * A[col][j];
        }
    }
    for (int i = n-1; i >= 0; i--) {
        c[i] = A[i][n];
        for (int j = i+1; j < n; j++) c[i] -= A[i][j] * c[j];
        if (fabs(A[i][i]) > 1e-15) c[i] /= A[i][i]; else c[i] = 0;
    }
}

/* Compute I₁(P, Y, σ, q, T) = Σ_χ ∫|ML-1|² dt for given polynomial P */
double compute_I1(int q, int g, double sigma, double T, int Y,
                  int deg, double *coeffs, int N_sum) {
    int dlog[256] = {0};
    { int x = 1; for (int k = 0; k < q-1; k++) { dlog[x] = k; x = (x*g)%q; } }

    double dt = T / T_GRID;
    double I1 = 0;
    double logY = log((double)Y);

    for (int chi_idx = 0; chi_idx < q-1; chi_idx++) {
        double omega = 2.0 * M_PI * chi_idx / (q-1);
        for (int ti = 0; ti < T_GRID; ti++) {
            double t = 1.0 + ti * dt;

            /* M(σ+it,χ) = Σ_{n≤Y} μ(n)·P(logn/logY)·χ(n)·n^{-σ-it} */
            double complex M = 0;
            for (int n = 1; n <= Y; n++) {
                if (mu_table[n] == 0 || n % q == 0) continue;
                double x = log((double)n) / logY;
                double Px = 0, xk = 1.0;
                for (int k = 0; k <= deg; k++) { Px += coeffs[k] * xk; xk *= x; }
                double complex chi_n = cos(omega*dlog[n%q]) + I*sin(omega*dlog[n%q]);
                double complex ns = pow((double)n,-sigma) *
                    (cos(-t*log((double)n)) + I*sin(-t*log((double)n)));
                M += mu_table[n] * Px * chi_n * ns;
            }

            /* L(σ+it,χ) */
            double complex L = 0;
            for (int m = 1; m <= N_sum; m++) {
                if (m % q == 0) continue;
                double complex chi_m = cos(omega*dlog[m%q]) + I*sin(omega*dlog[m%q]);
                double complex ms = pow((double)m,-sigma) *
                    (cos(-t*log((double)m)) + I*sin(-t*log((double)m)));
                L += chi_m * ms;
            }

            double complex ML_minus_1 = M * L - 1.0;
            I1 += cabs(ML_minus_1) * cabs(ML_minus_1) * dt;
        }
    }
    return I1;
}

/* Optimize P for given Y, σ, q */
double optimize_P(int q, int g, double sigma, double T, int Y,
                  int deg, double *c_opt, int N_sum) {
    int dlog[256] = {0};
    { int x = 1; for (int k = 0; k < q-1; k++) { dlog[x] = k; x = (x*g)%q; } }

    double dt = T / T_GRID;
    double logY = log((double)Y);
    double B[MAX_DEG+1][MAX_DEG+1];
    double l[MAX_DEG+1];
    memset(B, 0, sizeof(B));
    memset(l, 0, sizeof(l));

    for (int chi_idx = 0; chi_idx < q-1; chi_idx++) {
        double omega = 2.0 * M_PI * chi_idx / (q-1);
        for (int ti = 0; ti < T_GRID; ti++) {
            double t = 1.0 + ti * dt;

            double complex Mk[MAX_DEG+1];
            memset(Mk, 0, (deg+1) * sizeof(double complex));
            for (int n = 1; n <= Y; n++) {
                if (mu_table[n] == 0 || n % q == 0) continue;
                double x = log((double)n) / logY;
                double complex chi_n = cos(omega*dlog[n%q]) + I*sin(omega*dlog[n%q]);
                double complex ns = pow((double)n,-sigma) *
                    (cos(-t*log((double)n)) + I*sin(-t*log((double)n)));
                double complex base = mu_table[n] * chi_n * ns;
                double xk = 1.0;
                for (int k = 0; k <= deg; k++) { Mk[k] += base * xk; xk *= x; }
            }

            double complex Lval = 0;
            for (int m = 1; m <= N_sum; m++) {
                if (m % q == 0) continue;
                double complex chi_m = cos(omega*dlog[m%q]) + I*sin(omega*dlog[m%q]);
                double complex ms = pow((double)m,-sigma) *
                    (cos(-t*log((double)m)) + I*sin(-t*log((double)m)));
                Lval += chi_m * ms;
            }

            double complex MkL[MAX_DEG+1];
            for (int k = 0; k <= deg; k++) MkL[k] = Mk[k] * Lval;
            for (int j = 0; j <= deg; j++)
                for (int k = 0; k <= deg; k++)
                    B[j][k] += creal(MkL[j] * conj(MkL[k])) * dt;
            for (int k = 0; k <= deg; k++)
                l[k] += creal(MkL[k]) * dt;
        }
    }

    solve_system(deg+1, B, l, c_opt);
    double phi_q_T = (q-1) * T;
    double I_opt = phi_q_T;
    for (int k = 0; k <= deg; k++) I_opt -= c_opt[k] * l[k];
    return I_opt;
}

int main() {
    int q = 7;
    compute_mu(MAX_Y);
    int g = primitive_root(q);
    double T = 25.0;
    int N_sum = 1000;
    int deg = MAX_DEG;

    printf("# Zero-Density Exponent via Mollifier Optimization\n");
    printf("# q=%d, T=%.0f, deg≤%d\n\n", q, T, deg);

    /* For each σ: sweep Y, compute I₁ for flat and optimal P,
     * extract the decay exponent α from log(I₁) vs log(Y).  */
    double sigmas[] = {0.60, 0.65, 0.70, 0.75, 0.80, 0};
    int Ys[] = {20, 40, 80, 160, 320, 0};

    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];
        double phi_q_T = (q-1) * T;

        printf("═══ σ = %.2f ═══\n", sigma);
        printf("  %6s | %12s | %12s | %12s | %8s\n",
               "Y", "I₁(flat)", "I₁(opt)", "ratio", "R_opt");

        double log_Y[10], log_R_flat[10], log_R_opt[10];
        int npts = 0;

        for (int yi = 0; Ys[yi]; yi++) {
            int Y = Ys[yi];
            if (Y > MAX_Y) break;

            /* Flat mollifier: P(x) = 1 → coeffs = {1, 0, 0, ...} */
            double flat_coeffs[MAX_DEG+1] = {1.0};
            double I_flat = compute_I1(q, g, sigma, T, Y, 0, flat_coeffs, N_sum);

            /* Optimal mollifier */
            double c_opt[MAX_DEG+1];
            double I_opt = optimize_P(q, g, sigma, T, Y, deg, c_opt, N_sum);

            double ratio = I_opt / I_flat;
            double R_opt = I_opt / phi_q_T;

            printf("  %6d | %12.4f | %12.4f | %12.4f | %8.6f\n",
                   Y, I_flat, I_opt, ratio, R_opt);

            log_Y[npts] = log((double)Y);
            log_R_flat[npts] = log(I_flat / phi_q_T);
            log_R_opt[npts] = log(fmax(R_opt, 1e-10));
            npts++;
        }

        /* Fit log(R) = -α·log(Y) + const via least squares */
        if (npts >= 2) {
            /* For flat */
            double sx=0,sy=0,sxx=0,sxy=0;
            for (int i = 0; i < npts; i++) {
                sx += log_Y[i]; sy += log_R_flat[i];
                sxx += log_Y[i]*log_Y[i]; sxy += log_Y[i]*log_R_flat[i];
            }
            double alpha_flat = -(npts*sxy - sx*sy) / (npts*sxx - sx*sx);

            sx=sy=sxx=sxy=0;
            for (int i = 0; i < npts; i++) {
                sx += log_Y[i]; sy += log_R_opt[i];
                sxx += log_Y[i]*log_Y[i]; sxy += log_Y[i]*log_R_opt[i];
            }
            double alpha_opt = -(npts*sxy - sx*sy) / (npts*sxx - sx*sx);

            printf("  Decay exponent α (flat) = %.4f\n", alpha_flat);
            printf("  Decay exponent α (opt)  = %.4f\n", alpha_opt);
            printf("  α improvement = %.1f%%\n", (alpha_opt/alpha_flat - 1)*100);

            /* Zero-density exponent (simplified):
             * N(σ,T) ≤ T^{1-αθ} where θ is the mollifier length ratio
             * With θ_max ≈ 1/(2σ-1) (from off-diagonal control):
             * A = (1-α·θ_max)/(1-σ) */
            double theta_max = 0.5; /* conservative: Y ≤ T^{1/2} */
            double A_flat = (1.0 - alpha_flat * theta_max) / (1.0 - sigma);
            double A_opt = (1.0 - alpha_opt * theta_max) / (1.0 - sigma);

            printf("  A(flat) = %.4f, A(opt) = %.4f  %s\n\n",
                   A_flat, A_opt,
                   (A_opt < A_flat - 0.001) ? "IMPROVED ✓" : "no change");
        }
    }

    return 0;
}
