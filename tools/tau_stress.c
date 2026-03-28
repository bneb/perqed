/*
 * tau_stress.c — Second-order analysis of the β = -0.322 result.
 *
 * Failure modes we test:
 *
 * 1. PRECISION AUDIT: Is τ(p)/p^{11/2} becoming less accurate at large p?
 *    Check: Hecke multiplicativity error as a function of n.
 *    If errors grow → our τ values are wrong at large p → decrease is artificial.
 *
 * 2. L² vs L∞: Does the TOTAL minor arc energy (L²) also decrease?
 *    If L² is flat but L∞ decreases → the energy is spreading, not cancelling.
 *    For genuine cancellation, L² should also decrease.
 *
 * 3. LOG-CORRECTED FIT: Try E ∝ N^α · (logN)^γ
 *    If the true model is E ∝ (logN)^{-c} (very slow decrease),
 *    a pure power law would falsely show β < 0 over a finite range.
 *
 * 4. τ AMPLITUDE DISTRIBUTION: Does |τ(p)/p^{11/2}| have a systematic
 *    trend with p? If it decreases with p, the twist weights are shrinking,
 *    trivially reducing the sum.
 *
 * Uses verified fft_lib.h and tau_lib.h.
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void progress(int n, int max_n) {
    if (n % 100000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    int TAU_MAX = 500001;
    fprintf(stderr, "Init...\n");
    char *isc = fft_sieve_primes(TAU_MAX);
    TauTable tau = tau_compute(TAU_MAX, progress);
    fprintf(stderr, "Done.\n\n");

    /* ═══ TEST 1: Precision Audit ═══ */
    printf("═══ Test 1: Precision Audit ═══\n");
    printf("  Checking Hecke multiplicativity error by scale:\n\n");
    printf("  %10s | %10s | %10s | %s\n", "Range", "n_tested", "max_rel_err", "Status");

    int ranges[][2] = {{2,100},{100,1000},{1000,10000},{10000,50000},{50000,100000}};
    int n_ranges = 5;
    int precision_ok = 1;

    for (int r = 0; r < n_ranges; r++) {
        int lo = ranges[r][0], hi = ranges[r][1];
        double max_rel_err = 0;
        int tested = 0;

        for (int m = lo; m <= hi && m <= 400; m++) {
            for (int n = lo; n <= hi && n <= 400; n++) {
                if (fft_gcd(m, n) != 1) continue;
                if ((long long)m * n > TAU_MAX) continue;
                tested++;
                double lhs = tau.values[m * n];
                double rhs = tau.values[m] * tau.values[n];
                double rel = fabs(lhs - rhs) / (fabs(lhs) + fabs(rhs) + 1);
                if (rel > max_rel_err) max_rel_err = rel;
            }
        }

        const char *status = (max_rel_err < 1e-6) ? "✓ GOOD" :
                             (max_rel_err < 1e-3) ? "⚠ WARNING" : "✗ BAD";
        if (max_rel_err >= 1e-3) precision_ok = 0;
        printf("  %5d-%5d | %10d | %10.2e | %s\n", lo, hi, tested, max_rel_err, status);
    }

    /* Also check: at the largest primes, does p² recurrence still hold? */
    printf("\n  p² recurrence at large primes:\n");
    int p2_tested = 0, p2_fails = 0;
    double max_p2_err = 0;
    for (int p = 400; p <= 700 && (long long)p*p <= TAU_MAX; p++) {
        if (isc[p]) continue;
        double lhs = tau.values[p*p];
        double rhs = tau.values[p]*tau.values[p] - pow((double)p, 11);
        double rel = fabs(lhs - rhs) / (fabs(lhs) + fabs(rhs) + 1);
        if (rel > max_p2_err) max_p2_err = rel;
        p2_tested++;
        if (rel > 1e-3) p2_fails++;
    }
    printf("  p∈[400,700]: %d tested, %d failures, max_rel_err=%.2e %s\n\n",
           p2_tested, p2_fails, max_p2_err, p2_fails == 0 ? "✓" : "✗");

    /* ═══ TEST 2: L² vs L∞ ═══ */
    printf("═══ Test 2: L² vs L∞ Energy ═══\n");
    printf("  %10s | %10s | %10s | %10s | %10s\n",
           "N", "L∞_plain", "L∞_tau", "L²_plain", "L²_tau");

    int test_Ns[] = {10000, 50000, 100000, 200000, 500000, 0};
    double logN_a[10], logLinf_p[10], logLinf_t[10], logL2_p[10], logL2_t[10];
    int npts = 0;

    for (int idx = 0; test_Ns[idx]; idx++) {
        int N = test_Ns[idx];
        if (N > TAU_MAX - 1) break;
        double norm = (double)N / log((double)N);
        double norm2 = norm * norm;

        int M = fft_next_pow2(4*N);
        double *pre = calloc(M,8), *pim = calloc(M,8);
        double *tre = calloc(M,8), *tim = calloc(M,8);

        for (int n = 2; n <= N; n++) {
            if (isc[n]) continue;
            pre[n] = log((double)n);
            tre[n] = log((double)n) * tau_normalized(&tau, n);
        }
        fft_transform(pre, pim, M, 1);
        fft_transform(tre, tim, M, 1);

        double sup_p=0, sup_t=0, l2_p=0, l2_t=0;
        int minor_count = 0;
        for (int k = 0; k < M; k++) {
            if (fft_is_major_arc(k, M, FIXED_Q, N)) continue;
            minor_count++;
            double mp = pre[k]*pre[k] + pim[k]*pim[k];
            double mt = tre[k]*tre[k] + tim[k]*tim[k];
            if (sqrt(mp) > sup_p) sup_p = sqrt(mp);
            if (sqrt(mt) > sup_t) sup_t = sqrt(mt);
            l2_p += mp;
            l2_t += mt;
        }
        /* Normalize L² by number of minor arc points */
        l2_p = sqrt(l2_p / minor_count);
        l2_t = sqrt(l2_t / minor_count);

        logN_a[npts] = log((double)N);
        logLinf_p[npts] = log(sup_p / norm);
        logLinf_t[npts] = log(sup_t / norm);
        logL2_p[npts] = log(l2_p / norm);
        logL2_t[npts] = log(l2_t / norm);

        printf("  %10d | %10.4f | %10.4f | %10.4f | %10.4f\n",
               N, sup_p/norm, sup_t/norm, l2_p/norm, l2_t/norm);

        free(pre);free(pim);free(tre);free(tim);
        npts++;
    }

    /* Fit slopes */
    printf("\n  Power-law fits:\n");
    const char *names[] = {"L∞ plain", "L∞ τ", "L² plain", "L² τ"};
    double *arrs[] = {logLinf_p, logLinf_t, logL2_p, logL2_t};
    double betas[4];
    for (int m = 0; m < 4; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=arrs[m][i];
            sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*arrs[m][i];}
        betas[m]=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        printf("  %-12s | β = %8.4f\n", names[m], betas[m]);
    }

    printf("\n  If L² τ decreases → genuine energy cancellation.\n");
    printf("  If L² τ flat but L∞ τ decreases → just spreading, not cancelling.\n");
    printf("  Result: L² τ β = %.4f → %s\n\n", betas[3],
           betas[3] < -0.05 ? "GENUINE CANCELLATION" :
           betas[3] < 0.05  ? "SPREADING (not cancellation)" : "GROWING");

    /* ═══ TEST 3: τ Amplitude Distribution ═══ */
    printf("═══ Test 3: τ(p)/p^{11/2} Distribution by Scale ═══\n");
    printf("  If |τ(p)/p^{11/2}| systematically decreases with p,\n");
    printf("  the twist is just SHRINKING, not CANCELLING.\n\n");

    int bins[][2] = {{2,1000},{1000,10000},{10000,50000},{50000,100000},
                     {100000,200000},{200000,500000}};
    int nbins = 6;

    printf("  %15s | %8s | %8s | %8s | %8s\n",
           "Range", "mean|τ̃|", "rms|τ̃|", "max|τ̃|", "n_primes");

    for (int b = 0; b < nbins; b++) {
        int lo = bins[b][0], hi = bins[b][1];
        if (hi > TAU_MAX) hi = TAU_MAX;
        double sum = 0, sum2 = 0, mx = 0;
        int cnt = 0;
        for (int p = lo; p <= hi; p++) {
            if (isc[p]) continue;
            double t = fabs(tau_normalized(&tau, p));
            sum += t;
            sum2 += t * t;
            if (t > mx) mx = t;
            cnt++;
        }
        if (cnt == 0) continue;
        double mean = sum / cnt;
        double rms = sqrt(sum2 / cnt);
        printf("  %7d-%7d | %8.4f | %8.4f | %8.4f | %8d\n",
               lo, hi, mean, rms, mx, cnt);
    }

    printf("\n  Sato-Tate prediction: mean should → 2/π ≈ 0.6366, rms → 1/√2 ≈ 0.7071\n");

    /* ═══ TEST 4: Log-Corrected Fit ═══ */
    printf("\n═══ Test 4: Log-Corrected Fit ═══\n");
    printf("  Model: log(E_τ) = a + b·log(N) + c·log(log(N))\n");

    /* 3-parameter fit using least squares (Ax=b where x=[a,b,c]) */
    if (npts >= 3) {
        /* Build normal equations */
        double A[3][3] = {{0}}, B[3] = {0};
        for (int i = 0; i < npts; i++) {
            double x1 = 1.0, x2 = logN_a[i], x3 = log(logN_a[i]);
            double y = logLinf_t[i];
            A[0][0] += x1*x1; A[0][1] += x1*x2; A[0][2] += x1*x3;
            A[1][0] += x2*x1; A[1][1] += x2*x2; A[1][2] += x2*x3;
            A[2][0] += x3*x1; A[2][1] += x3*x2; A[2][2] += x3*x3;
            B[0] += x1*y; B[1] += x2*y; B[2] += x3*y;
        }

        /* Solve 3x3 via Cramer's rule */
        double det = A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
                    -A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
                    +A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);

        if (fabs(det) > 1e-20) {
            double a = (B[0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
                       -A[0][1]*(B[1]*A[2][2]-A[1][2]*B[2])
                       +A[0][2]*(B[1]*A[2][1]-A[1][1]*B[2])) / det;
            double b = (A[0][0]*(B[1]*A[2][2]-A[1][2]*B[2])
                       -B[0]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
                       +A[0][2]*(A[1][0]*B[2]-B[1]*A[2][0])) / det;
            double c = (A[0][0]*(A[1][1]*B[2]-B[1]*A[2][1])
                       -A[0][1]*(A[1][0]*B[2]-B[1]*A[2][0])
                       +B[0]*(A[1][0]*A[2][1]-A[1][1]*A[2][0])) / det;

            printf("  Pure power law:    E_τ ∝ N^{%.4f}\n", betas[1]);
            printf("  Log-corrected:     E_τ ∝ N^{%.4f} · (logN)^{%.4f}\n", b, c);
            printf("\n  If b ≈ 0 and c < 0: decrease is logarithmic, NOT power-law.\n");
            printf("  If b < 0 and c ≈ 0: decrease is genuine power-law.\n");

            if (b < -0.05)
                printf("  → Power term β=%.4f remains strongly negative. ✓\n", b);
            else if (fabs(b) < 0.05 && c < -0.5)
                printf("  → ⚠ Decrease is logarithmic, not power-law! β≈0, γ=%.2f\n", c);
            else
                printf("  → Power β=%.4f, log γ=%.4f\n", b, c);

            /* Residuals */
            double max_resid = 0;
            for (int i = 0; i < npts; i++) {
                double pred = a + b*logN_a[i] + c*log(logN_a[i]);
                double resid = fabs(logLinf_t[i] - pred);
                if (resid > max_resid) max_resid = resid;
            }
            printf("  Max residual: %.4f (pure power law: ", max_resid);

            double max_resid_pure = 0;
            double sx=0,sy=0,sxx=0,sxy=0;
            for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=logLinf_t[i];
                sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logLinf_t[i];}
            double beta_pure=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
            double alpha_pure=(sy-beta_pure*sx)/npts;
            for(int i=0;i<npts;i++){
                double p=alpha_pure+beta_pure*logN_a[i];
                double r=fabs(logLinf_t[i]-p);if(r>max_resid_pure)max_resid_pure=r;
            }
            printf("%.4f)\n", max_resid_pure);
        }
    }

    /* ═══ SUMMARY ═══ */
    printf("\n═══════════════════════════════════════\n");
    printf("  SECOND-ORDER VERDICT\n");
    printf("═══════════════════════════════════════\n");

    printf("  Precision: %s\n", precision_ok ? "✓ Hecke errors < 10⁻⁶" : "✗ Degraded");
    printf("  L² τ β:    %.4f (%s)\n", betas[3],
           betas[3]<-0.05 ? "genuine cancellation" : "spreading only");
    printf("  τ̃ trend:  check table above\n");
    printf("  Log model: check fit above\n");

    tau_free(&tau);
    free(isc);
    return 0;
}
