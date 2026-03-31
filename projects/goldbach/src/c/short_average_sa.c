/*
 * short_average_sa.c — SA search on short average parameters.
 *
 * The Guth-Maynard short average trick:
 *   Instead of bounding |F(σ+it)| at a single point,
 *   bound the average (1/H)∫|F(σ+i(t+h))|² dh over |h| ≤ H.
 *
 * The saving comes from cancellation in the average:
 *   (1/H)∫|F|² dh ≈ Σ|aₙ|²/n^{2σ} + (oscillatory terms)/H
 *
 * The oscillatory terms decay as 1/H when H is large,
 * but the saving is ALSO affected by the KERNEL SHAPE.
 *
 * We optimize:
 *   H (interval length, as fraction of T)
 *   w(h) (kernel weights, not necessarily uniform)
 *   k (moment power)
 *
 * to maximize the saving δ in:
 *   ∫ w(h) |F(σ+i(t+h))|^{2k} dh ≤ M_k · N^{-δ}
 *
 * BUILD: cc -O3 -o short_average_sa short_average_sa.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_KERNEL 20  /* kernel coefficients */

/*
 * Model: the short average of |F|^{2k} with kernel w(h).
 *
 * F(s) = Σ_{n=N}^{2N} aₙ n^{-s}, so:
 * |F(σ+it)|² = Σ_{m,n} aₘ ā_n (m/n)^{-σ} (m/n)^{-it}
 *
 * Averaging over t with kernel w:
 * ∫ w(h) |F(σ+i(t+h))|² dh = Σ_{m,n} aₘ ā_n (m/n)^{-σ} (m/n)^{-it} · ŵ(log(m/n))
 *
 * where ŵ is the Fourier transform of w.
 *
 * The diagonal terms (m=n): contribute Σ|aₙ|²/n^{2σ} · ∫w = ||a||² (no saving).
 * The off-diagonal terms (m≠n): contribute ~ ŵ(log(m/n)) which can be SMALL.
 *
 * The KEY: choose w so that ŵ(x) is small for |x| ≥ δ₀ = 1/N.
 *
 * If w is supported on [-H, H], then ŵ has "width" ~ 1/H.
 * For ŵ(1/N) to be small, need H >> N.
 * But H can't be too large (we need F to be "large" throughout the interval).
 *
 * The OPTIMIZATION: find the kernel w of support [-H,H] that
 * minimizes the off-diagonal contribution while keeping H manageable.
 *
 * PARAMETERIZE: w(h) = Σ_{j=0}^{J} cⱼ cos(jπh/H) (cosine expansion)
 * Then: ŵ(x) = Σ cⱼ · sinc-like terms
 */

/* Compute the saving δ for a given kernel and parameters */
double compute_saving(double *kernel_c, int J, double H, int k, int N, double sigma) {
    /* The saving δ in: ∫w·|F|^{2k} ≤ M_k · N^{-δ}
     *
     * Model: the off-diagonal contribution is proportional to
     * max_{m≠n, |m-n|≤Δ} |ŵ(log(m/n))|^k
     *
     * For m,n ∈ [N, 2N]: log(m/n) ∈ [-log2, log2]
     * The "dangerous" terms have |log(m/n)| ~ 1/N (nearest neighbors).
     *
     * ŵ at x = 1/N: ŵ(1/N) = Σ cⱼ sin(jπ/(NH)) / (jπ/(NH))
     *
     * If NH >> 1: ŵ(1/N) ≈ Σ cⱼ = w(0) (no saving)
     * If NH << 1: ŵ(1/N) ≈ Σ cⱼ · NH/(jπ) = small (good saving)
     *
     * The saving: δ ≈ -log|ŵ(1/N)|/logN · k
     */

    /* Compute ŵ at x = 1/N */
    double w_hat = 0;
    double w_norm = 0;
    for (int j = 0; j < J; j++) {
        double arg = (j == 0) ? 0.0 : (double)j * M_PI / (N * H);
        double sinc = (arg < 1e-10) ? 1.0 : sin(arg) / arg;
        w_hat += kernel_c[j] * sinc;
        w_norm += fabs(kernel_c[j]);
    }
    if (w_norm < 1e-15) return 0;
    w_hat /= w_norm;

    /* The saving is proportional to how small ŵ(1/N) is */
    double ratio = fabs(w_hat);
    if (ratio >= 1.0) return 0;
    double delta = -log(ratio) / log((double)N) * k;

    /* But the saving is limited by the "cost" of using a short interval:
     * shorter H means worse large values detection.
     * Cost: the interval [-H, H] can "miss" large values if H is too small.
     * Model: cost = max(0, 1/H - 1/T) × factor */
    double cost = (H < 1.0) ? (1.0 - H) * 0.1 : 0;
    delta -= cost;

    return fmax(delta, 0);
}

/* SA search for optimal kernel */
void sa_search(int N, double sigma) {
    int J = 8;  /* kernel coefficients */
    double best_c[MAX_KERNEL], c[MAX_KERNEL];
    double best_H, H;
    int best_k, kk;
    double best_delta = 0;

    /* Initialize */
    for (int j = 0; j < J; j++) c[j] = (j == 0) ? 1.0 : 0.0;
    H = 0.5;
    kk = 3;

    unsigned rng = 12345;
    double temp = 0.5;

    for (int step = 0; step < 1000000; step++) {
        double new_c[MAX_KERNEL];
        memcpy(new_c, c, J * sizeof(double));
        double new_H = H;
        int new_k = kk;

        rng = rng * 1103515245 + 12345;
        int which = rng % (J + 2);
        rng = rng * 1103515245 + 12345;
        double delta_val = (((double)(rng%10000)/10000) - 0.5) * temp;

        if (which < J) {
            new_c[which] += delta_val;
        } else if (which == J) {
            new_H += delta_val * 0.2;
            new_H = fmax(0.001, fmin(2.0, new_H));
        } else {
            new_k = kk + (delta_val > 0 ? 1 : -1);
            new_k = (new_k < 1) ? 1 : (new_k > 6) ? 6 : new_k;
        }

        double saving = compute_saving(new_c, J, new_H, new_k, N, sigma);

        if (saving > best_delta ||
            ((double)(rng%10000)/10000) < exp(-(best_delta-saving)/temp)) {
            memcpy(c, new_c, J*sizeof(double));
            H = new_H; kk = new_k;
            if (saving > best_delta) {
                best_delta = saving;
                memcpy(best_c, c, J*sizeof(double));
                best_H = H; best_k = kk;
            }
        }
        temp *= 0.999995;
    }

    printf("  N=%d, σ=%.2f: best δ=%.6f, H=%.4f, k=%d\n",
           N, sigma, best_delta, best_H, best_k);
    printf("    kernel:");
    for (int j=0;j<J;j++) if (fabs(best_c[j])>0.01)
        printf(" c%d=%.3f", j, best_c[j]);
    printf("\n");
}

int main() {
    printf("# SA Search: Optimal Short Average Parameters\n\n");
    printf("  Searching for kernel w(h) = Σcⱼcos(jπh/H) that maximizes\n");
    printf("  the saving δ in ∫w·|F|^{2k} ≤ M_k · N^{-δ}\n\n");

    /* Sweep N and σ */
    printf("## Results by N and σ:\n\n");
    for (int N = 100; N <= 10000; N *= 10) {
        for (double sigma = 0.65; sigma <= 0.80; sigma += 0.05) {
            sa_search(N, sigma);
        }
        printf("\n");
    }

    /* Also search for the optimal moment k at fixed N, σ */
    printf("## Sensitivity to Moment k:\n\n");
    int N = 1000;
    double sigma = 0.75;
    for (int k = 1; k <= 6; k++) {
        /* Fixed k, optimize kernel only */
        int J = 8;
        double c[MAX_KERNEL]; for(int j=0;j<J;j++) c[j]=(j==0)?1:0;
        double best_delta = 0, best_H = 0;

        unsigned rng = 42 + k;
        double temp = 0.3;
        double H = 0.5;

        for (int step = 0; step < 200000; step++) {
            double new_c[MAX_KERNEL]; memcpy(new_c, c, J*sizeof(double));
            double new_H = H;
            rng=rng*1103515245+12345; int which=rng%(J+1);
            rng=rng*1103515245+12345; double dv=(((double)(rng%10000)/10000)-0.5)*temp;
            if(which<J) new_c[which]+=dv; else {new_H+=dv*0.2;new_H=fmax(0.001,fmin(2,new_H));}
            double sav = compute_saving(new_c, J, new_H, k, N, sigma);
            if(sav>best_delta) { memcpy(c,new_c,J*sizeof(double)); H=new_H; best_delta=sav; best_H=H; }
            temp *= 0.99999;
        }
        printf("  k=%d: δ=%.6f, H=%.4f\n", k, best_delta, best_H);
    }

    printf("\n## Connection to Zero Density\n\n");
    printf("  If δ > 0, the improved large values estimate gives:\n");
    printf("    A_improved = A_GM - f(δ)\n");
    printf("  where f(δ) depends on how δ translates through the Halász method.\n\n");
    printf("  For the Guth-Maynard analysis:\n");
    printf("    A = 30/13 uses δ = 0.054 (approximately)\n");
    printf("    Improving δ by any amount improves 30/13.\n");

    return 0;
}
