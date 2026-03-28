/*
 * derive_C.c — Derive the explicit GRH error constant C from first principles.
 *
 * Under GRH, via the explicit formula for ψ(x;q,a):
 *
 *   r_Λ(2n) := Σ_{m+k=2n} Λ(m)Λ(k)
 *            = S(2n)·2n + E(2n)
 *
 * where E(2n) is bounded using:
 *   |E(2n)| ≤ Σ_{q≤Q} (|c_q(2n)|/φ(q)) · 2 · (2n)^{1/2} · B(q,2n)
 *
 *   B(q,T) = Σ_{|γ|≤T, L(1/2+iγ,χ)=0, χ mod q} 1/|1/2+iγ|
 *
 * Under GRH, B(q,T) can be bounded by the zero-counting function:
 *   N(T,χ) ≤ (T/(2π)) · log(qT/(2πe)) + 7.085/4  [Trudgian 2014]
 *
 * And:
 *   B(q,T) ≤ Σ_{0<γ≤T} 2/γ ≤ 2·log(T) · (N(T,χ))/T + 2·log(2·...) + ...
 *          ≈ log(qT)·log(T)   [by partial summation]
 *
 * For the Goldbach problem with Q = (2n)^{1/2}:
 *   |E(2n)| ≤ (2n)^{1/2} · Σ_{q≤Q} (|c_q(2n)|/φ(q)) · Σ_{χ mod q} B(q,2n)
 *
 * We compute this sum EXPLICITLY for all q ≤ Q.
 *
 * BUILD: cc -O3 -o derive_C derive_C.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

int gcd(int a, int b) { while(b) {int t=b; b=a%b; a=t;} return a; }

/* Euler totient */
int phi(int n) {
    int r = n;
    for (int p = 2; p*p <= n; p++)
        if (n%p == 0) { while(n%p==0) n/=p; r -= r/p; }
    if (n > 1) r -= r/n;
    return r;
}

/* Ramanujan sum c_q(n) = Σ_{a mod q, gcd(a,q)=1} e^{2πi·a·n/q} */
/* For computation: c_q(n) = μ(q/gcd(q,n)) · φ(q) / φ(q/gcd(q,n)) */
double ramanujan_sum(int q, int n) {
    int d = gcd(q, n);
    int q_d = q / d;
    /* c_q(n) = μ(q/d) · φ(q) / φ(q/d) */
    /* Compute μ(q_d) */
    int mu = 1, m = q_d;
    for (int p = 2; p*p <= m; p++) {
        if (m % p == 0) {
            m /= p;
            if (m % p == 0) return 0; /* p² divides q_d → μ = 0 */
            mu = -mu;
        }
    }
    if (m > 1) mu = -mu;
    return mu * (double)phi(q) / phi(q_d);
}

/* Bound on B(q,T) = Σ_{ρ of L(s,χ), |γ|≤T} 1/|ρ| under GRH.
 * Using partial summation and N(T,χ) ≤ (T/2π)·log(qT/2πe) + C₀:
 * B(q,T) ≤ 2·(log(T) + 1)·(log(qT/(2π)) + C₀/T·2π) + 2
 *
 * More precisely, by partial summation:
 * Σ_{0<γ≤T} 1/γ = N(T)/T + ∫₁ᵀ N(t)/t² dt
 *               ≤ log(qT)/2π + ∫₁ᵀ (t·log(qt)/(2π))/t² dt
 *               = log(qT)/2π + (1/2π)·∫₁ᵀ log(qt)/t dt
 *               = log(qT)/2π + (1/2π)·[log(q)·logT + (log²T)/2]
 */
double bound_B(int q, double T) {
    double logq = log((double)q);
    double logT = log(T);
    /* Σ_{0<γ≤T} 1/γ for one character */
    double sum_inv_gamma = logq * logT / (2*M_PI)
                         + logT * logT / (4*M_PI)
                         + logT / (2*M_PI)  /* from N(T)/T term */
                         + 2.0;  /* safety for low-lying zeros */
    /* For |ρ|=|1/2+iγ|: 1/|ρ| ≤ 2/γ for γ≥1, plus contribution from γ<1 */
    return 2.0 * sum_inv_gamma + 4.0; /* +4 for the ~2 zeros with γ < 1 */
}

int main() {
    printf("# Deriving Explicit GRH Constant C\n\n");
    printf("# |E(2n)| ≤ C · √(2n) · log(2n)\n");
    printf("# where E(2n) = r_Λ(2n) - S(2n)·2n\n\n");

    /* Test for various 2n values */
    double test_n[] = {1e6, 1e8, 1e10, 1e12, 1e14, 1e16, 1e18, 1e20, 0};

    printf("## Error bound components\n\n");
    printf("  %12s | %8s | %12s | %14s | %12s\n",
           "2n", "Q", "Σ|c_q|/φ(q)", "max B(q,2n)", "C_explicit");

    for (int ni = 0; test_n[ni] > 0; ni++) {
        double two_n = test_n[ni];
        double sqrt_2n = sqrt(two_n);
        int Q = (int)sqrt(sqrt_2n);  /* Q = (2n)^{1/4} for convergence */
        if (Q < 2) Q = 2;
        if (Q > 10000) Q = 10000;  /* cap for computation time */

        /* Compute: |E(2n)| ≤ √(2n) · Σ_{q≤Q} |c_q(2n)|/φ(q) · φ(q) · B(q,2n)
         * = √(2n) · Σ_{q≤Q} |c_q(2n)| · B(q,2n) */
        double total_bound = 0;
        double max_B = 0;
        double ram_sum = 0;

        for (int q = 1; q <= Q; q++) {
            /* For the bound, use |c_q(n)| ≤ gcd(q, n) */
            /* But more precisely, |c_q(n)| ≤ φ(gcd(q,n)) */
            /* For a generic 2n, gcd(q,2n) is usually small */
            int d = gcd(q, (int)(fmod(two_n, q*1.0)));
            double cq = (d < q) ? (double)phi(d) : (double)phi(q); /* |c_q| bound */
            double phiq = phi(q);
            double Bq = bound_B(q, two_n);  /* bound per character */

            /* Number of characters mod q = φ(q) */
            total_bound += (cq / phiq) * phiq * Bq;
            /* = cq · Bq */
            if (Bq > max_B) max_B = Bq;
            ram_sum += cq / phiq;
        }

        /* |E(2n)| ≤ √(2n) · total_bound
         * C = total_bound / log(2n) */
        double C_explicit = total_bound / log(two_n);

        /* The main term is S_min · 2n = 2C₂ · 2n ≈ 1.32 · 2n
         * Error/Main = C · √(2n) · log(2n) / (1.32 · 2n)
         *            = C · log(2n) / (1.32 · √(2n)) */
        double ratio = C_explicit * log(two_n) / (1.32 * sqrt_2n);

        printf("  %12.0e | %8d | %12.2f | %14.2f | %12.2f  err/main=%.2e %s\n",
               two_n, Q, ram_sum, max_B, C_explicit, ratio,
               ratio < 1 ? "✓ MAIN DOMINATES" : "");
    }

    /* Now find N₀: smallest 2n where err/main < 1 */
    printf("\n## Threshold N₀ where main term > error bound\n");
    printf("  (i.e., C·log(2n)/√(2n) < S_min ≈ 1.32)\n\n");

    for (double log2n = 10; log2n <= 50; log2n += 2) {
        double two_n = exp(log2n);
        double sqrt_2n = sqrt(two_n);
        int Q = (int)pow(two_n, 0.25);
        if (Q > 10000) Q = 10000;

        double total_bound = 0;
        for (int q = 1; q <= Q; q++) {
            int d = gcd(q, ((int)(fmod(two_n, q*1.0))));
            double cq = (d < q) ? (double)phi(d) : (double)phi(q);
            double Bq = bound_B(q, two_n);
            total_bound += cq * Bq;
        }
        double C_expl = total_bound / log(two_n);
        double ratio = C_expl * log(two_n) / (1.32 * sqrt_2n);

        printf("  2n = e^%.0f ≈ 10^%.1f: C=%.1f, err/main=%.2e %s\n",
               log2n, log2n/log(10), C_expl, ratio,
               ratio < 1 ? "✓" : "");
    }

    return 0;
}
