/*
 * lemma4_test.c — Computational verification of Lemma 4 ingredients.
 *
 * Lemma 4 says: ∫_{minor} |S|²|S_τ|² ≤ C · N^{4-2δ_mix}/(logN)^4
 *
 * The proof route uses the large sieve inequality:
 *   ∫|S|²|S_τ|² = Σ_E |Σ_{p+q=E} Λ(p)·Λ(q)·τ̃(q)|²
 *
 * By the large sieve, this is bounded by terms involving:
 *   Σ_{q≤Q} Σ_a |Σ_{n≡a(q)} Λ(n)·τ̃(n) - expected|²
 *
 * This is exactly the BV error for the τ-TWISTED prime sum.
 * Key advantage: L(Δ⊗χ, s) has NO Siegel zeros (Deligne).
 *
 * Tests:
 *   1. BV error for Σ Λ(n)·τ̃(n) restricted to each residue class
 *   2. Large sieve sum: Σ_{q≤Q} max_a |error|²
 *   3. Compare to plain BV error to quantify the improvement
 *
 * IMPORTANT: The BV error for the PRODUCT Λ·τ̃ is different from
 * the BV error for τ̃ alone (which we showed is 10⁵× worse).
 * Here we're asking: how well does Λ·τ̃ distribute in APs?
 */
#include "fft_lib.h"
#include "tau_lib.h"

static void prog(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

static int euler_phi(int n) {
    int result = n;
    for (int p = 2; p * p <= n; p++) {
        if (n % p == 0) { while (n % p == 0) n /= p; result -= result / p; }
    }
    if (n > 1) result -= result / n;
    return result;
}

int main(void) {
    int N = 200000;
    fprintf(stderr, "Init (N=%d)...\n", N);
    char *isc = fft_sieve_primes(N);
    TauTable tau = tau_compute(N, prog);
    fprintf(stderr, "Done.\n\n");
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    /* Precompute totals */
    double total_Lam = 0, total_LamTau = 0;
    for (int p = 2; p <= N; p++) {
        if (isc[p]) continue;
        double lp = log((double)p);
        total_Lam += lp;
        total_LamTau += lp * tau_normalized(&tau, p);
    }

    printf("═══════════════════════════════════════════════════════\n");
    printf("  Lemma 4 Ingredients: BV for Λ·τ̃ in APs\n");
    printf("  N = %d, θ_plain = %.2f, θ_τ_prod = %.2f\n",
           N, total_Lam, total_LamTau);
    printf("═══════════════════════════════════════════════════════\n\n");

    /* Compute BV error for both Λ and Λ·τ̃ */
    int test_Qs[] = {10, 20, 50, 100, 200, 300, 400, 0};
    int sqrtN = (int)sqrt((double)N);

    printf("  %6s | %8s | %12s | %12s | %10s\n",
           "Q", "Q/√N", "BV(Λ)", "BV(Λ·τ̃)", "ratio");

    double logQ[10], logBV_L[10], logBV_LT[10];
    int npts = 0;

    for (int qi = 0; test_Qs[qi]; qi++) {
        int Q = test_Qs[qi];
        double bv_L = 0, bv_LT = 0;

        for (int q = 1; q <= Q; q++) {
            int phi_q = euler_phi(q);
            double exp_L = total_Lam / phi_q;
            double exp_LT = total_LamTau / phi_q;

            for (int a = 1; a <= q; a++) {
                if (fft_gcd(a, q) != 1) continue;

                double sum_L = 0, sum_LT = 0;
                for (int p = 2; p <= N; p++) {
                    if (isc[p] || p % q != a) continue;
                    double lp = log((double)p);
                    sum_L += lp;
                    sum_LT += lp * tau_normalized(&tau, p);
                }

                double eL = sum_L - exp_L;
                double eLT = sum_LT - exp_LT;
                bv_L += eL * eL / (exp_L + 1);
                bv_LT += eLT * eLT / (fabs(exp_LT) + 1);
            }
        }
        bv_L /= total_Lam;
        bv_LT /= (fabs(total_LamTau) + 1);

        if (Q >= 20) {
            logQ[npts] = log((double)Q);
            logBV_L[npts] = log(bv_L);
            logBV_LT[npts] = log(bv_LT);
            npts++;
        }

        printf("  %6d | %8.3f | %12.6f | %12.6f | %10.4f\n",
               Q, (double)Q/sqrtN, bv_L, bv_LT, bv_LT/bv_L);
        fflush(stdout);
    }

    /* Power-law fits */
    printf("\n  ═══ BV Error Scaling: BV ~ Q^α ═══\n");
    for (int m = 0; m < 2; m++) {
        double *arr = (m==0) ? logBV_L : logBV_LT;
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logQ[i];sy+=arr[i];
            sxx+=logQ[i]*logQ[i];sxy+=logQ[i]*arr[i];}
        double alpha=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        printf("  %s: BV ~ Q^{%.4f}\n", m==0 ? "Λ  (plain)" : "Λ·τ̃ (prod)", alpha);
    }

    /* ═══ Key: what does the large sieve give for the mixed moment? ═══ */
    printf("\n═══════════════════════════════════════════════════════\n");
    printf("  Large Sieve Connection\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    /* The large sieve inequality says:
     * Σ_{|r/s|≤Q, gcd(r,s)=1} |Σ a_n e(nr/s)|² ≤ (N + Q²) Σ |a_n|²
     *
     * For a_n = Λ(n)·τ̃(n):
     * Σ |a_n|² = Σ_p log²(p)·τ̃(p)² ≈ N·logN  (by Sato-Tate)
     *
     * So: Σ |S_τ(r/s)|² ≤ (N + Q²)·N·logN
     *
     * This bounds the sum of |S_τ|² at Farey fractions.
     * The mixed moment ∫|S|²|S_τ|² can be bounded by splitting:
     *   minor arcs ≈ union of intervals around r/s with s > Q
     */

    /* Compute Σ_p log²(p)·τ̃(p)² */
    double sum_Lam2_tau2 = 0;
    for (int p = 2; p <= N; p++) {
        if (isc[p]) continue;
        double lp = log((double)p);
        double t = tau_normalized(&tau, p);
        sum_Lam2_tau2 += lp*lp*t*t;
    }
    double sum_Lam2 = 0;
    for (int p = 2; p <= N; p++) {
        if (isc[p]) continue;
        double lp = log((double)p);
        sum_Lam2 += lp*lp;
    }

    printf("  Σ log²(p)·τ̃²(p) = %.1f (predicted ≈ N·logN = %.1f)\n",
           sum_Lam2_tau2, (double)N*log((double)N));
    printf("  Σ log²(p)        = %.1f\n", sum_Lam2);
    printf("  Ratio τ̃²/plain  = %.4f (should → 1 by Sato-Tate)\n",
           sum_Lam2_tau2 / sum_Lam2);

    printf("\n  Large sieve bound at Q=√N:\n");
    printf("  Σ |S_τ(r/s)|² ≤ (N+N)·N·logN = 2·N²·logN = %.0f\n",
           2.0*N*(double)N*log((double)N));
    printf("  Σ |S(r/s)|²   ≤ (N+N)·N·logN = 2·N²·logN = %.0f\n",
           2.0*N*(double)N*log((double)N));
    printf("\n  The large sieve gives SAME bound for both.\n");
    printf("  The improvement comes from BV, not the large sieve.\n");

    /* ═══ The critical test: BV for Λ·τ̃ at Q beyond √N ═══ */
    printf("\n═══════════════════════════════════════════════════════\n");
    printf("  Critical: Does BV(Λ·τ̃) stay controlled past √N?\n");
    printf("  Unlike our earlier Linnik test (where we tested τ̃ alone),\n");
    printf("  here we test Λ(n)·τ̃(n) = log(p)·τ̃(p) for primes p.\n");
    printf("═══════════════════════════════════════════════════════\n");
    printf("  The answer is above — check BV scaling exponents.\n");

    tau_free(&tau); free(isc);
    return 0;
}
