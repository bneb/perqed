/*
 * explicit_formula.c — Spectral decomposition of S(α) via ζ zeros.
 *
 * The explicit formula gives:
 *   S(α) = Σ Λ(n)·e(nα) ≈ T(α) - Σ_ρ S_ρ(α)
 *
 * where:
 *   T(α)   = Σ_{n=1}^{N} e(nα)              (geometric sum — small on minor arcs)
 *   S_ρ(α) = Σ_{n=1}^{N} n^{ρ-1}·e(nα)/ρ   (zero contribution)
 *   ρ = ½ + iγ  are non-trivial zeros of ζ
 *
 * We measure:
 *   R_K(α) = S(α) - T(α) + Σ_{k=1}^{K} [S_{ρ_k}(α) + S_{ρ̄_k}(α)]
 *
 * As K increases, R_K should approach the "smooth" part (log terms, trivial zeros)
 * which has small minor arcs. If sup_{minor} |R_K| → 0, the proof path is open.
 *
 * Uses verified fft_lib.h. First 50 ζ zeros hardcoded from LMFDB.
 */
#include "fft_lib.h"
#include <complex.h>

#define FIXED_Q 10

/* ═══ First 50 non-trivial zeros of ζ(s): ρ_k = 1/2 + i·gamma_k ═══ */
/* All on the critical line (verified computationally to >1000 digits) */
static const double zeta_zeros[] = {
    14.134725141734693, 21.022039638771555, 25.010857580145689,
    30.424876125859513, 32.935061587739189, 37.586178158825671,
    40.918719012147495, 43.327073280914999, 48.005150881167159,
    49.773832477672302, 52.970321477714460, 56.446247697063394,
    59.347044002602353, 60.831778524609809, 65.112544048081607,
    67.079810529494174, 69.546401711173979, 72.067157674481907,
    75.704690699083933, 77.144840068874805, 79.337375020249367,
    82.910380854086030, 84.735492980517050, 87.425274613125229,
    88.809111207634465, 92.491899270558484, 94.651344040519838,
    95.870634228245309, 98.831194218193692, 101.317851005731220,
    103.725538040466258, 105.446623052771273, 107.168611184276408,
    111.029535543088076, 111.874659176999500, 114.320220915452713,
    116.226680320857573, 118.790782865976209, 121.370125002018390,
    122.946829293884745, 124.256818554346540, 127.516683879616960,
    129.578704199956350, 131.087688530932885, 133.497737202646949,
    134.756509753473823, 138.116042054533571, 139.736208952121902,
    141.123707404021807, 143.111845807862452
};
#define N_ZEROS 50

int main(void) {
    int MAX_N = 200001;
    fprintf(stderr, "Sieving primes to %d...\n", MAX_N);
    char *isc = fft_sieve_primes(MAX_N);
    fprintf(stderr, "Done.\n\n");

    /* Self-test: verify a few zeros give correct ψ(x) approximation */
    printf("═══ Self-Tests ═══\n");
    /* ψ(100) = Σ_{n≤100} Λ(n) should be ≈ 94.01 (known) */
    double psi100_direct = 0;
    for (int n = 2; n <= 100; n++) {
        if (!isc[n]) { psi100_direct += log((double)n); continue; }
        /* Check prime powers */
        int m = n, p = 0;
        for (int d = 2; d * d <= m; d++) {
            if (m % d == 0) { p = d; break; }
        }
        if (p > 0) {
            int pp = p, exp = 0;
            int temp = n;
            while (temp % p == 0) { temp /= p; exp++; }
            if (temp == 1) psi100_direct += log((double)p);
        }
    }

    /* Explicit formula: ψ(x) ≈ x - Σ_ρ x^ρ/ρ */
    double psi100_explicit = 100.0; /* main term */
    for (int k = 0; k < N_ZEROS; k++) {
        double gamma = zeta_zeros[k];
        /* ρ = 1/2 + iγ, ρ̄ = 1/2 - iγ */
        /* x^ρ/ρ + x^{ρ̄}/ρ̄ = 2·Re(x^ρ/ρ) */
        /* x^ρ = x^{1/2} · x^{iγ} = √x · e^{iγ·ln(x)} */
        double x = 100.0;
        double sqrtx = sqrt(x);
        double phase = gamma * log(x);
        double cos_p = cos(phase), sin_p = sin(phase);
        /* x^ρ = sqrtx · (cos_p + i·sin_p) */
        /* 1/ρ = (1/2 - iγ)/(1/4 + γ²) */
        double rho_re = 0.5, rho_im = gamma;
        double rho_mag2 = rho_re*rho_re + rho_im*rho_im;
        double inv_rho_re = rho_re / rho_mag2;
        double inv_rho_im = -rho_im / rho_mag2;
        /* x^ρ/ρ = (sqrtx·cos_p + i·sqrtx·sin_p)·(inv_rho_re + i·inv_rho_im) */
        double real_part = sqrtx * (cos_p * inv_rho_re - sin_p * inv_rho_im);
        /* 2·Re(x^ρ/ρ) */
        psi100_explicit -= 2.0 * real_part;
    }
    /* Subtract log(2π) and trivial zero contributions (small) */
    psi100_explicit -= log(2.0 * FFT_PI);

    printf("  ψ(100) direct:   %.2f\n", psi100_direct);
    printf("  ψ(100) explicit: %.2f (50 zeros)\n", psi100_explicit);
    printf("  Error: %.2f (%.1f%%)\n", fabs(psi100_direct-psi100_explicit),
           100.0 * fabs(psi100_direct-psi100_explicit) / psi100_direct);

    /* ═══ Main experiment: S(α) decomposition ═══ */
    int test_Ns[] = {10000, 20000, 50000, 100000, 200000, 0};
    int test_Ks[] = {1, 5, 10, 20, 50, 0};

    printf("\n═══════════════════════════════════════════════════════════\n");
    printf("  Explicit Formula: S(α) = T(α) - Σ_ρ S_ρ(α)\n");
    printf("  Residual R_K = S - T + Σ_{k≤K} (S_ρ + S_ρ̄)\n");
    printf("═══════════════════════════════════════════════════════════\n\n");

    printf("  %8s | %8s | %10s | %10s | %10s | %10s\n",
           "N", "K zeros", "E_S", "E_T", "E_R_K", "ratio R/S");

    for (int ni = 0; test_Ns[ni]; ni++) {
        int N = test_Ns[ni];
        if (N > MAX_N - 1) break;
        double norm = (double)N / log((double)N);
        int M = fft_next_pow2(4 * N);

        fprintf(stderr, "  N=%d (M=%d)...\n", N, M);

        /* Compute S(α) = Σ Λ(n)·e(nα) via FFT */
        double *S_re = calloc(M, 8), *S_im = calloc(M, 8);
        for (int n = 2; n <= N; n++)
            if (!isc[n]) S_re[n] = log((double)n);
        /* Add prime power contributions */
        for (int p = 2; (long long)p*p <= N; p++) {
            if (isc[p]) continue;
            long long pk = (long long)p * p;
            while (pk <= N) {
                S_re[(int)pk] += log((double)p);
                pk *= p;
            }
        }
        fft_transform(S_re, S_im, M, 1);

        /* Compute T(α) = Σ_{n=1}^{N} e(nα) via FFT */
        double *T_re = calloc(M, 8), *T_im = calloc(M, 8);
        for (int n = 1; n <= N; n++) T_re[n] = 1.0;
        fft_transform(T_re, T_im, M, 1);

        /* Compute E_S and E_T */
        double sup_S = 0, sup_T = 0;
        for (int k = 0; k < M; k++) {
            if (fft_is_major_arc(k, M, FIXED_Q, N)) continue;
            double mS = sqrt(S_re[k]*S_re[k] + S_im[k]*S_im[k]);
            double mT = sqrt(T_re[k]*T_re[k] + T_im[k]*T_im[k]);
            if (mS > sup_S) sup_S = mS;
            if (mT > sup_T) sup_T = mT;
        }

        /* For each K, compute R_K = S - T + Σ_{k≤K} (S_ρ + S_ρ̄) */
        for (int ki = 0; test_Ks[ki]; ki++) {
            int K = test_Ks[ki];
            if (K > N_ZEROS) K = N_ZEROS;

            /* Accumulate zero contributions */
            double *Z_re = calloc(M, 8), *Z_im = calloc(M, 8);

            for (int kk = 0; kk < K; kk++) {
                double gamma = zeta_zeros[kk];
                double rho_re = 0.5, rho_im = gamma;
                double rho_mag2 = rho_re*rho_re + rho_im*rho_im;
                /* 1/ρ */
                double inv_rho_re = rho_re / rho_mag2;
                double inv_rho_im = -rho_im / rho_mag2;

                /* S_ρ(α) + S_ρ̄(α) = Σ n^{ρ-1}·e(nα)/ρ + conj */
                /* = Σ 2·Re(n^{ρ-1}/ρ)·e(nα) + i·Σ 2·Im(...)·e(nα) */
                /* n^{ρ-1} = n^{-1/2 + iγ} = n^{-1/2}·(cos(γlnn)+i·sin(γlnn)) */
                double *z_re = calloc(M, 8), *z_im = calloc(M, 8);

                for (int n = 1; n <= N; n++) {
                    double inv_sqrt_n = 1.0 / sqrt((double)n);
                    double phase = gamma * log((double)n);
                    double c = cos(phase), s = sin(phase);
                    /* n^{ρ-1} = inv_sqrt_n · (c + i·s) */
                    double nrho_re = inv_sqrt_n * c;
                    double nrho_im = inv_sqrt_n * s;
                    /* n^{ρ-1}/ρ = (nrho_re + i·nrho_im)·(inv_rho_re + i·inv_rho_im) */
                    double term_re = nrho_re * inv_rho_re - nrho_im * inv_rho_im;
                    double term_im = nrho_re * inv_rho_im + nrho_im * inv_rho_re;
                    /* n^{ρ̄-1}/ρ̄ = conjugate */
                    /* Sum: 2·Re(term) as real part, 0 as imaginary */
                    z_re[n] = 2.0 * term_re;
                    /* z_im[n] = 0; (imaginary parts cancel between ρ and ρ̄) */
                }
                fft_transform(z_re, z_im, M, 1);

                for (int j = 0; j < M; j++) {
                    Z_re[j] += z_re[j];
                    Z_im[j] += z_im[j];
                }
                free(z_re); free(z_im);
            }

            /* R_K = S - T + Z  (since we subtracted -Σ S_ρ, adding Z gives the residual) */
            double sup_R = 0;
            for (int k = 0; k < M; k++) {
                if (fft_is_major_arc(k, M, FIXED_Q, N)) continue;
                double r_re = S_re[k] - T_re[k] + Z_re[k];
                double r_im = S_im[k] - T_im[k] + Z_im[k];
                double mR = sqrt(r_re*r_re + r_im*r_im);
                if (mR > sup_R) sup_R = mR;
            }

            printf("  %8d | %8d | %10.4f | %10.4f | %10.4f | %10.4f\n",
                   N, K, sup_S/norm, sup_T/norm, sup_R/norm, sup_R/sup_S);
            fflush(stdout);

            free(Z_re); free(Z_im);
        }

        free(S_re); free(S_im); free(T_re); free(T_im);
        printf("  --------+----------+------------+------------+------------+-----------\n");
    }

    /* ═══ Scaling analysis: fix K=50, vary N ═══ */
    printf("\n  ═══ Power-Law Fit: E_R vs N at K=50 ═══\n");

    double logN_a[10], logE_R[10];
    int npts = 0;

    for (int ni = 0; test_Ns[ni]; ni++) {
        int N = test_Ns[ni];
        if (N > MAX_N - 1) break;
        double norm = (double)N / log((double)N);
        int M = fft_next_pow2(4*N);

        double *s_re=calloc(M,8),*s_im=calloc(M,8);
        double *t_re=calloc(M,8),*t_im=calloc(M,8);
        for(int n=2;n<=N;n++) if(!isc[n]) s_re[n]=log((double)n);
        for(int p=2;(long long)p*p<=N;p++) if(!isc[p]){long long pk=(long long)p*p;while(pk<=N){s_re[(int)pk]+=log((double)p);pk*=p;}}
        for(int n=1;n<=N;n++) t_re[n]=1.0;
        fft_transform(s_re,s_im,M,1);
        fft_transform(t_re,t_im,M,1);

        double *z_re=calloc(M,8),*z_im=calloc(M,8);
        for(int kk=0;kk<N_ZEROS;kk++){
            double g=zeta_zeros[kk],rm2=0.25+g*g;
            double ir=0.5/rm2,ii=-g/rm2;
            double *zr=calloc(M,8),*zi=calloc(M,8);
            for(int n=1;n<=N;n++){
                double isq=1.0/sqrt((double)n),ph=g*log((double)n);
                double c=cos(ph),s=sin(ph);
                double nr=isq*c,ni2=isq*s;
                zr[n]=2.0*(nr*ir-ni2*ii);
            }
            fft_transform(zr,zi,M,1);
            for(int j=0;j<M;j++){z_re[j]+=zr[j];z_im[j]+=zi[j];}
            free(zr);free(zi);
        }

        double sup_R=0,sup_S=0;
        for(int k=0;k<M;k++){
            if(fft_is_major_arc(k,M,FIXED_Q,N))continue;
            double ms=sqrt(s_re[k]*s_re[k]+s_im[k]*s_im[k]);
            double rr=s_re[k]-t_re[k]+z_re[k],ri=s_im[k]-t_im[k]+z_im[k];
            double mr=sqrt(rr*rr+ri*ri);
            if(ms>sup_S)sup_S=ms; if(mr>sup_R)sup_R=mr;
        }

        logN_a[npts]=log((double)N);
        logE_R[npts]=log(sup_R/norm);
        printf("  N=%d: E_R(K=50) = %.5f, ratio R/S = %.4f\n", N, sup_R/norm, sup_R/sup_S);
        npts++;
        free(s_re);free(s_im);free(t_re);free(t_im);free(z_re);free(z_im);
    }

    if(npts>=3){
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=logE_R[i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logE_R[i];}
        double beta=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        printf("\n  E_R(K=50) ~ N^{%.4f}\n", beta);
        if(beta<-0.05) printf("  ★★★ RESIDUAL DECREASES — proof path is open!\n");
        else if(beta<0.05) printf("  ~ FLAT — more zeros might help\n");
        else printf("  ✗ INCREASING — explicit formula insufficient alone\n");
    }

    free(isc);
    return 0;
}
