/*
 * red_team_motohashi.c — Red Team the "Negative Spectral Remainder"
 *
 * SUSPICION: The negative R(σ) is a TRUNCATION ARTIFACT.
 *
 * We computed: ∫|ζ_N(σ+it)|⁴ where ζ_N = Σ_{n≤N} n^{-s}
 * We compared to: ζ(2σ)⁴/ζ(4σ) = Σ_{n=1}^∞ d(n)²/n^{2σ}
 *
 * But the CORRECT diagonal for the truncated polynomial is:
 *   C_N(σ) = Σ_{n≤N²} d_N(n)²/n^{2σ}
 * where d_N(n) = #{(a,b): ab=n, 1≤a,b≤N}
 *
 * For n > N²: d_N(n) = 0 (can't write n=ab with both ≤ N)
 * For n > N: d_N(n) < d(n) (some factorizations have a or b > N)
 *
 * So C_N(σ) < ζ(2σ)⁴/ζ(4σ), and the "negative remainder"
 * might just be: actual ≈ C_N(σ) < ζ(2σ)⁴/ζ(4σ) = wrong comparison.
 *
 * BUILD: cc -O3 -o red_team_motohashi red_team_motohashi.c -lm
 */
#include <stdio.h>
#include <math.h>

int main() {
    printf("# 🔴 RED TEAM: Is the Negative Spectral Remainder Real?\n\n");

    int N = 2000;  /* same truncation as before */

    /* ═══════════════════════════════════════════ */
    printf("## 1. The Truncation Bug\n\n");

    printf("  We used ζ_N(s) = Σ_{n≤%d} n^{-s} (truncated at N=%d)\n", N, N);
    printf("  We compared ∫|ζ_N|⁴/T to ζ(2σ)⁴/ζ(4σ) (INFINITE sum)\n\n");

    printf("  CORRECT comparison: ∫|ζ_N|⁴/T should be compared to\n");
    printf("    C_N(σ) = Σ_{n: n=ab with a,b≤N} d_N(n)²/n^{2σ}\n");
    printf("  where d_N(n) = #{(a,b): ab=n, 1≤a,b≤N}\n\n");

    printf("  Since d_N(n) ≤ d(n) and d_N(n) = 0 for n > N²:\n");
    printf("    C_N(σ) ≤ ζ(2σ)⁴/ζ(4σ)\n\n");

    printf("  Computing C_N(σ) = Σ_{n≤N²} d_N(n)² / n^{2σ}:\n\n");

    /* Compute d_N(n) for n up to N² (too large! Use different method) */
    /* Instead: C_N(σ) = Σ_{a,b,c,d ≤ N, ab=cd} (abcd)^{-σ}
     *        = (Σ_{a≤N} a^{-σ})⁴ approximately? No.
     *
     * Actually: C_N = Σ_{m,n ≤ N} Σ_{m',n' ≤ N, mn=m'n'} (mm'nn')^{-σ}
     * This is too expensive to compute directly for N=2000.
     *
     * But we can compute C_N = [Σ_{n≤N} n^{-σ}]⁴ integrated properly.
     *
     * Actually, the MVT gives:
     * ∫_T^{2T} |Σ_{n≤N} n^{-σ-it}|⁴ dt = T·Σ_{ab=cd,all≤N} (abcd)^{-σ} + O(error)
     *
     * The main term is:
     * Σ_{ab=cd} (abcd)^{-σ} = Σ_n d_N(n)² n^{-2σ}
     *
     * For a simpler approximation: for n ≤ N, d_N(n) = d(n).
     * The missing part is n ∈ (N, N²] where d_N(n) < d(n).
     * The TAIL contribution is:
     * Σ_{n>N} d(n)²/n^{2σ} ≈ ζ(2σ)⁴/ζ(4σ) - Σ_{n≤N} d(n)²/n^{2σ}
     */

    printf("  %6s | %12s | %12s | %12s | %s\n",
           "σ", "ζ⁴/ζ(inf)", "Σ_{n≤N}d²/n²σ", "diff%%", "explains R?");

    double sigmas[] = {0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.90, 0};
    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];

        /* Full ζ(2σ)⁴/ζ(4σ) */
        double z2s = 0, z4s = 0;
        for (int n = 1; n <= 100000; n++) {
            z2s += pow(n, -2*sigma);
            z4s += pow(n, -4*sigma);
        }
        double C_inf = pow(z2s, 4) / z4s;

        /* Truncated diagonal: Σ_{n≤N} d(n)²/n^{2σ} */
        /* First compute d(n) for n ≤ N */
        double C_trunc = 0;
        for (int n = 1; n <= N; n++) {
            int dn = 0;
            for (int d = 1; d*d <= n; d++) {
                if (n%d == 0) { dn += 2; if (d*d == n) dn--; }
            }
            C_trunc += (double)dn*dn * pow(n, -2*sigma);
        }

        double diff_pct = 100.0 * (C_trunc - C_inf) / C_inf;

        printf("  %6.2f | %12.2f | %12.2f | %+12.2f%% | %s\n",
               sigma, C_inf, C_trunc, diff_pct,
               fabs(diff_pct) > 10 ? "YES — explains it!" :
               fabs(diff_pct) > 2 ? "PARTIALLY" : "no");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Comparing Truncated Diagonal to Actual ∫|ζ_N|⁴\n\n");

    printf("  Now compare ∫|ζ_N|⁴/T to C_N(σ) = Σ_{n≤N} d(n)²/n^{2σ}\n");
    printf("  (still not EXACT C_N but much closer)\n\n");

    printf("  %6s | %12s | %12s | %+12s | %s\n",
           "σ", "trunc diag", "∫|ζ_N|⁴/T", "remainder%%", "spectral?");

    int T = 5000, nsamples = 3000;
    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];

        double C_trunc = 0;
        for (int n = 1; n <= N; n++) {
            int dn = 0;
            for (int d = 1; d*d <= n; d++)
                if (n%d == 0) { dn += 2; if (d*d == n) dn--; }
            C_trunc += (double)dn*dn * pow(n, -2*sigma);
        }

        /* But C_N also includes n ∈ (N, N²] with d_N < d.
         * For simplicity, add an estimate of the (N, N²] contribution:
         * Σ_{N<n≤N²} d_N(n)²/n^{2σ} ≈ integral approximation
         * d_N(n) for N < n ≤ N²: roughly d_N(n) ≈ 2(N/n) for large n
         * This is hard to compute exactly. Let's just use C_trunc as lower bound.
         */

        double int4 = 0;
        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re = 0, im = 0;
            for (int n = 1; n <= N; n++) {
                double a = -t * log(n);
                double m = pow(n, -sigma);
                re += m*cos(a); im += m*sin(a);
            }
            double mag2 = re*re + im*im;
            int4 += mag2*mag2;
        }
        int4 /= nsamples;

        double r_pct = 100.0*(int4 - C_trunc)/C_trunc;

        printf("  %6.2f | %12.2f | %12.2f | %+12.2f%% | %s\n",
               sigma, C_trunc, int4, r_pct,
               fabs(r_pct) < 5 ? "NO — just truncation!" :
               r_pct < -5 ? "maybe genuine" : "noise");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 3. 🔴 VERDICT\n\n");

    printf("  The 'negative spectral remainder' was comparing:\n");
    printf("    TRUNCATED ζ_N (N=%d terms) to INFINITE ζ(2σ)⁴/ζ(4σ)\n\n", N);

    printf("  The truncation removes Σ_{n>N} d(n)²/n^{2σ} from the\n");
    printf("  diagonal, which is a LARGE contribution at small σ.\n\n");

    printf("  At σ=0.55: the tail Σ_{n>2000} d(n)²/n^{1.1} is ~87%% of\n");
    printf("  the full sum — explaining the -87%% 'remainder'.\n\n");

    printf("  When comparing to the CORRECT truncated diagonal,\n");
    printf("  the remainder should be much smaller.\n\n");

    printf("  ★ If the remainder against the truncated diagonal is\n");
    printf("    small (< 5%%), then there is NO spectral effect —\n");
    printf("    the negative R was entirely a TRUNCATION ARTIFACT.\n\n");

    printf("  ★ If the remainder is still significantly negative\n");
    printf("    even against the truncated diagonal, THEN it's\n");
    printf("    a genuine spectral contribution.\n\n");

    printf("  Either way: the claim 'spectral remainder reduces\n");
    printf("  the fourth moment by 18%%' was PREMATURE.\n");
    printf("  We compared apples (truncated) to oranges (infinite).\n\n");

    printf("  🔴 LESSON: Always compare truncated sums to truncated\n");
    printf("  diagonal, not to the full ζ-function value.\n");
    printf("  This is the kind of 'embarrassing error' we've seen before.\n");

    return 0;
}
