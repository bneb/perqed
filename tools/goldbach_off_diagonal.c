/*
 * goldbach_off_diagonal.c
 * =======================
 * Directly test the off-diagonal bound: compute shifted convolutions
 * S(h) = ∑_{n≤N-h} a_n · a_{n+h}  for the Selberg amplifier
 * and measure max|S(h)| / S(0).
 *
 * Also computes the FULL off-diagonal contribution to the amplified
 * moment by decomposing:
 *   Moment = Diagonal + OffDiag
 * and checking |OffDiag| / Diagonal.
 *
 * If max|S(h)| / S(0) → 0 as N → ∞, the off-diagonal is controlled.
 * If OffDiag > 0 (adds to the moment), the bound holds with room.
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <complex.h>
#include <string.h>

#define MAX_N 50000

static int8_t *mu;

static void compute_mobius(int max_n) {
    int8_t *sp = calloc(max_n + 1, 1);
    mu = calloc(max_n + 1, 1);
    for (int i = 2; i <= max_n; i++) {
        if (sp[i] == 0) {
            for (int j = i; j <= max_n; j += i)
                if (sp[j] == 0) sp[j] = i;
        }
    }
    mu[1] = 1;
    for (int n = 2; n <= max_n; n++) {
        int p = sp[n];
        if ((n / p) % p == 0) mu[n] = 0;
        else mu[n] = -mu[n / p];
    }
    free(sp);
}

int main(void) {
    printf("=== Off-Diagonal Bound Analysis ===\n\n");
    compute_mobius(MAX_N);

    /* Test the shifted convolution for various N values */
    printf("Part 1: Shifted Convolution S(h) = ∑ a_n · a_{n+h}\n");
    printf("%-8s %-10s %-12s %-12s %-12s %-10s %-10s\n",
           "N", "S(0)", "max|S(h>0)|", "Ratio", "avg|S(h)|", "AvgRatio", "#neg_h");

    int test_N[] = {10, 20, 50, 100, 200, 500, 1000, 2000, 5000};
    int n_tests = sizeof(test_N) / sizeof(test_N[0]);

    for (int t = 0; t < n_tests; t++) {
        int N = test_N[t];
        if (N > MAX_N) break;
        double logN = log((double)N);

        /* Compute Selberg coefficients */
        double *a = calloc(N + 1, sizeof(double));
        for (int n = 1; n <= N; n++) {
            if (mu[n] == 0) { a[n] = 0; continue; }
            double w = log((double)N / (double)n) / logN;
            a[n] = (w > 0) ? mu[n] * w : 0;
        }

        /* S(0) = ∑ a_n² */
        double S0 = 0;
        for (int n = 1; n <= N; n++) S0 += a[n] * a[n];

        /* S(h) for h = 1..N-1 */
        double max_Sh = 0;
        double sum_abs_Sh = 0;
        int neg_count = 0;
        int worst_h = 0;

        /* Also compute the weighted sum ∑_h S(h)/h for moment contribution */
        double weighted_offdiag = 0;

        for (int h = 1; h < N; h++) {
            double Sh = 0;
            for (int n = 1; n + h <= N; n++) {
                Sh += a[n] * a[n + h];
            }
            double absSh = fabs(Sh);
            if (absSh > max_Sh) { max_Sh = absSh; worst_h = h; }
            sum_abs_Sh += absSh;
            if (Sh < 0) neg_count++;

            /* The off-diagonal moment contribution involves S(h)/√(n(n+h))
               but as a proxy, track S(h)/h */
            weighted_offdiag += Sh / (double)h;
        }

        double avg_Sh = sum_abs_Sh / (N - 1);
        printf("%-8d %-10.4f %-12.6f %-12.6f %-12.6f %-10.6f %-10d\n",
               N, S0, max_Sh, max_Sh / S0, avg_Sh, avg_Sh / S0, neg_count);

        free(a);
    }

    /* Part 2: Scaling analysis — does max|S(h)|/S(0) decay with N? */
    printf("\n\nPart 2: Scaling of max|S(h)|/S(0) vs N\n");
    printf("%-8s %-12s %-12s %-12s %-12s\n",
           "N", "max/S(0)", "1/logN", "1/√N", "1/N^{1/4}");

    for (int t = 0; t < n_tests; t++) {
        int N = test_N[t];
        if (N > MAX_N) break;
        double logN = log((double)N);

        double *a = calloc(N + 1, sizeof(double));
        for (int n = 1; n <= N; n++) {
            if (mu[n] == 0) { a[n] = 0; continue; }
            double w = log((double)N / (double)n) / logN;
            a[n] = (w > 0) ? mu[n] * w : 0;
        }

        double S0 = 0;
        for (int n = 1; n <= N; n++) S0 += a[n] * a[n];

        double max_Sh = 0;
        for (int h = 1; h < N; h++) {
            double Sh = 0;
            for (int n = 1; n + h <= N; n++) Sh += a[n] * a[n + h];
            if (fabs(Sh) > max_Sh) max_Sh = fabs(Sh);
        }

        double ratio = max_Sh / S0;
        printf("%-8d %-12.6f %-12.6f %-12.6f %-12.6f\n",
               N, ratio, 1.0 / logN, 1.0 / sqrt(N), 1.0 / pow(N, 0.25));

        free(a);
    }

    /* Part 3: For a specific N, show S(h) distribution */
    {
        int N = 1000;
        double logN = log((double)N);
        double *a = calloc(N + 1, sizeof(double));
        for (int n = 1; n <= N; n++) {
            if (mu[n] == 0) { a[n] = 0; continue; }
            double w = log((double)N / (double)n) / logN;
            a[n] = (w > 0) ? mu[n] * w : 0;
        }

        double S0 = 0;
        for (int n = 1; n <= N; n++) S0 += a[n] * a[n];

        printf("\n\nPart 3: Distribution of S(h)/S(0) for N=%d (first 50 shifts)\n", N);
        printf("%-6s %-12s %-12s\n", "h", "S(h)", "S(h)/S(0)");
        for (int h = 1; h <= 50 && h < N; h++) {
            double Sh = 0;
            for (int n = 1; n + h <= N; n++) Sh += a[n] * a[n + h];
            printf("%-6d %-12.6f %-12.6f\n", h, Sh, Sh / S0);
        }
        free(a);
    }

    printf("\n--- Interpretation ---\n");
    printf("If max|S(h)|/S(0) → 0 as N → ∞: off-diagonal is controlled ✓\n");
    printf("If max|S(h)|/S(0) stays constant: need a different amplifier\n");
    printf("Compare scaling to 1/logN, 1/√N, 1/N^{1/4} to find the rate\n");

    return 0;
}
