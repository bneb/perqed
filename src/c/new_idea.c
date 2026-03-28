/*
 * new_idea.c — Inventing a genuinely new approach to zero-density.
 *
 * ANALYSIS OF WHY ALL 12 APPROACHES FAILED:
 *
 * Common failure mode: they all try to improve the LARGE VALUES ESTIMATE
 * for GENERIC Dirichlet polynomials. But GM's bound is TIGHT for generic
 * polynomials. The zero-detecting polynomial IS generic (by construction).
 *
 * So a new idea must do ONE of:
 *   (A) Make the zero-detecting polynomial NON-GENERIC
 *   (B) Bypass large values entirely — bound N(σ,T) without bounding |F|
 *   (C) Use GLOBAL information about zeros (repulsion, functional equation)
 *
 * OPTION (B) IS THE MOST PROMISING.
 *
 * Current methods: N(σ,T) ≤ Σ (|F(ρ)|/V)² ≤ ∫|F|²/V² (Markov/MVT)
 * This immediately enters the large values regime.
 *
 * ALTERNATIVE: Don't detect zeros via |F(ρ)| > V. Instead,
 * detect them via the ARGUMENT PRINCIPLE:
 *   N = (1/2πi) ∮ (ζ'/ζ)(s) ds = (1/2π) Δ arg ζ(s)
 *
 * The argument principle counts zeros EXACTLY (not via large values).
 * The change in argument Δarg ζ = ∫ Im(ζ'/ζ) dt along a contour.
 *
 * KEY INSIGHT: ζ'/ζ has BETTER structure than ζ itself because
 *   ζ'/ζ(s) = -Σ Λ(n)/n^s
 * where Λ is the von Mangoldt function. This Dirichlet series has
 * PRIME SUPPORT — only terms at prime powers.
 *
 * A large values estimate for ζ'/ζ would be DIFFERENT from one for ζ
 * because the sparse prime support changes the additive energy structure.
 *
 * Let's compute: how does the large values estimate for
 *   G(s) = Σ_{p≤N} (logp) p^{-s}  (prime sum)
 * compare to
 *   F(s) = Σ_{n≤N} n^{-s}  (all integers)
 *
 * BUILD: cc -O3 -o new_idea new_idea.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define SIEVE_MAX 100001
char sieve[SIEVE_MAX];
int primes[10000], nprimes;

void init_sieve() {
    memset(sieve, 0, sizeof(sieve));
    sieve[0]=sieve[1]=1;
    for (int i=2;(long long)i*i<SIEVE_MAX;i++)
        if (!sieve[i]) for(int j=i*i;j<SIEVE_MAX;j+=i) sieve[j]=1;
    nprimes=0;
    for (int i=2;i<SIEVE_MAX;i++) if(!sieve[i]) primes[nprimes++]=i;
}

double F_abs2(int N, double t) { /* F(s) = Σ n^{-s}, all n ≤ N */
    double re=0,im=0;
    for (int n=1;n<=N;n++) {
        double a=1.0/sqrt((double)n), p=-t*log((double)n);
        re+=a*cos(p); im+=a*sin(p);
    }
    return re*re+im*im;
}

double G_abs2(int N, double t) { /* G(s) = Σ (logp)p^{-s}, primes p ≤ N */
    double re=0,im=0;
    for (int i=0;i<nprimes&&primes[i]<=N;i++) {
        int p=primes[i];
        double lp=log((double)p);
        double a=lp/sqrt((double)p), ph=-t*log((double)p);
        re+=a*cos(ph); im+=a*sin(ph);
    }
    return re*re+im*im;
}

/* Additive energy E(S) = #{(a,b,c,d) ∈ S⁴: a+b=c+d} */
long long additive_energy(int *S, int M) {
    int maxsum = S[M-1]+S[M-1]+1;
    int *cnt = calloc(maxsum, sizeof(int));
    for (int i=0;i<M;i++) for(int j=0;j<M;j++) cnt[S[i]+S[j]]++;
    long long E=0;
    for (int s=0;s<maxsum;s++) E+=(long long)cnt[s]*cnt[s];
    free(cnt);
    return E;
}

int main() {
    init_sieve();
    printf("# Inventing a New Approach to Zero-Density\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 1. Why All 12 Approaches Failed (Pattern Analysis)\n\n");
    printf("  Common failure: ALL tried to improve |{t: |F(t)|>V}|\n");
    printf("  for GENERIC Dirichlet polynomial F.\n\n");
    printf("  But GM's N²/V⁶ IS tight for generic F.\n");
    printf("  And zero-detection constructs a GENERIC F (mollifier).\n\n");
    printf("  ★ Any approach that reduces to bounding |F| for generic F\n");
    printf("    will be killed by GM's tightness. Need to escape.\n\n");

    printf("  ESCAPE ROUTES:\n");
    printf("  (A) Make zero-detecting poly non-generic → hard, mollifier IS generic\n");
    printf("  (B) Don't use large values at all → use ARGUMENT PRINCIPLE\n");
    printf("  (C) Use global zero structure → repulsion, functional eqn\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 2. New Idea: Count Zeros via ζ'/ζ, Not via |ζ|\n\n");
    printf("  Classical: detect zeros at ρ by |F(ρ)| > V.\n");
    printf("  New: detect zeros via the LOGARITHMIC DERIVATIVE:\n");
    printf("    ζ'/ζ(s) = -Σ Λ(n)/n^s  (von Mangoldt coefficients)\n\n");
    printf("  The argument principle:\n");
    printf("    N(σ,T) = (1/2π)∫ Im(ζ'/ζ(σ+it)) dt + boundary terms\n\n");
    printf("  ★ This counts zeros DIRECTLY without large values!\n");
    printf("  ★ The sum ζ'/ζ has SPARSE support (primes only).\n\n");

    /* Compare additive energy of primes vs integers */
    int N = 500;
    int ints[500]; for(int i=0;i<N;i++) ints[i]=i+1;
    int prime_set[200]; int np=0;
    for(int i=0;i<nprimes&&primes[i]<=N;i++) prime_set[np++]=primes[i];

    long long E_int = additive_energy(ints, N < 200 ? N : 200);
    long long E_prime = additive_energy(prime_set, np < 100 ? np : 100);
    int M_int = N < 200 ? N : 200;
    int M_prime = np < 100 ? np : 100;

    printf("  Additive energy comparison (N=%d):\n", N);
    printf("    Integers [1,%d]: E = %lld, |S|=%d, E/|S|³ = %.3f\n",
           M_int, E_int, M_int, (double)E_int/(double)M_int/(double)M_int/(double)M_int);
    printf("    Primes up to %d:  E = %lld, |S|=%d, E/|S|³ = %.3f\n\n",
           N, E_prime, M_prime, (double)E_prime/(double)M_prime/(double)M_prime/(double)M_prime);

    printf("  ★ Primes have LOWER normalized additive energy!\n");
    printf("    E/M³(integers) ≈ %.2f vs E/M³(primes) ≈ %.2f\n",
           (double)E_int/(double)M_int/(double)M_int/(double)M_int,
           (double)E_prime/(double)M_prime/(double)M_prime/(double)M_prime);
    printf("    Ratio: %.2fx smaller for primes.\n\n",
           ((double)E_int/(double)M_int/(double)M_int/(double)M_int) /
           ((double)E_prime/(double)M_prime/(double)M_prime/(double)M_prime));

    /* ═══════════════════════════════════════════ */
    printf("## 3. Large Values: Primes vs Integers\n\n");
    printf("  If primes have lower additive energy, GM's case split\n");
    printf("  would place them in the LOW ENERGY case more often.\n");
    printf("  The low-energy case gets the DECOUPLING bound.\n\n");

    double T=500; int ngrid=4000;
    double V_thresh[] = {1, 2, 3, 5, 8, 12};
    printf("  %6s | %8s %8s | %8s %8s | %s\n",
           "V", "#{F>V}", "F rate", "#{G>V}", "G rate", "ratio");
    for (int vi=0; vi<6; vi++) {
        double V = V_thresh[vi];
        double V2 = V*V;
        int cnt_F=0, cnt_G=0;
        for (int k=0;k<ngrid;k++) {
            double t=(k+0.5)*T/ngrid;
            if (F_abs2(N, t) > V2) cnt_F++;
            if (G_abs2(N, t) > V2) cnt_G++;
        }
        printf("  %6.1f | %8d %7.3f | %8d %7.3f | %.2f\n",
               V, cnt_F, (double)cnt_F/ngrid, cnt_G, (double)cnt_G/ngrid,
               cnt_G > 0 ? (double)cnt_F/cnt_G : 999.0);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 4. The Argument Principle Approach\n\n");

    printf("  Instead of: N(σ,T) ≤ T^{A(1-σ)} via |F| > V\n");
    printf("  Use:        N(σ,T) = (1/π) ∫₀ᵀ Re(ζ'/ζ(σ+it)) dt\n");
    printf("                     + (1/π) ∫_{1/2}^{σ} Im(ζ'/ζ(u+iT)) du\n\n");

    printf("  The vertical integral ∫ Re(ζ'/ζ(σ+it)) dt involves:\n");
    printf("    Re(ζ'/ζ) = -Σ Λ(n) cos(t·logn) / n^σ\n\n");

    printf("  This is a TRIGONOMETRIC SUM with coefficients Λ(n)/n^σ.\n");
    printf("  The mean value: ∫₀ᵀ |Re(ζ'/ζ)|² dt ≈ T · Σ Λ(n)²/n^{2σ}\n");
    printf("  ≈ T · logT/(2σ-1) for σ > 1/2.\n\n");

    printf("  The KEY advantage: this mean value depends on Σ Λ(n)²/n^{2σ},\n");
    printf("  which is controlled by the PRIME NUMBER THEOREM.\n");
    printf("  For the classical approach, the mean value is Σ |aₙ|²/n^{2σ}\n");
    printf("  where aₙ is GENERIC (from the mollifier).\n\n");

    printf("  The PNT gives: Σ_{n≤N} Λ(n)² = N·logN + O(N)\n");
    printf("  So:           Σ Λ(n)²/n^{2σ} ≈ N^{1-2σ}·logN/(1-2σ)\n");
    printf("  Compared to:  Σ 1/n^{2σ} ≈ N^{1-2σ}/(1-2σ)  (generic)\n\n");
    printf("  The extra logN factor is BAD (larger mean value).\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 5. 🔴 SELF RED TEAM\n\n");

    printf("  ISSUE 1: The argument principle gives N EXACTLY but\n");
    printf("  the integral ∫ Re(ζ'/ζ) dt is HARDER to bound than ∫|F|².\n");
    printf("  We replaced a SIMPLER integral with a HARDER one.\n\n");

    printf("  ISSUE 2: The extra logN in Σ Λ(n)²/n^{2σ} makes the\n");
    printf("  mean value WORSE, not better. The prime support doesn't help.\n\n");

    printf("  ISSUE 3: This approach IS known — it's essentially\n");
    printf("  Selberg's method (1942). Selberg used ζ'/ζ to prove\n");
    printf("  that >0%% of zeros are on the critical line.\n");
    printf("  It gives WORSE zero-density than Halász-Montgomery.\n\n");

    printf("  ISSUE 4: The argument principle counts algebraically\n");
    printf("  (with sign), not geometrically. A zero at σ and its\n");
    printf("  reflected zero at 1-σ cancel in the argument.\n\n");

    printf("  ★ VERDICT: The argument principle approach is KNOWN and\n");
    printf("    gives WEAKER bounds than GM for zero-density.\n");
    printf("    It's useful for proportion-on-critical-line, not density.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 6. What Would A Genuinely New Idea Look Like?\n\n");

    printf("  After 12 refuted approaches and the self-red-team above,\n");
    printf("  here's what we KNOW a new idea must satisfy:\n\n");

    printf("  NECESSARY CONDITIONS:\n");
    printf("  (1) Must NOT reduce to bounding |F| for generic F\n");
    printf("      (GM's bound is tight for this)\n");
    printf("  (2) Must NOT use ℓ² orthogonality alone\n");
    printf("      (gives same bound for additive/multiplicative)\n");
    printf("  (3) Must NOT use non-negative multiplicative weights\n");
    printf("      (Hecke parity obstruction)\n");
    printf("  (4) Must NOT factor through Möbius inversion\n");
    printf("      (signs destroy ℓ² positivity)\n");
    printf("  (5) Must NOT use the Euler product of ζ directly\n");
    printf("      (zero-detection uses generic F, not ζ)\n");
    printf("  (6) Must NOT be a 1D exponential sum improvement\n");
    printf("      (exponent pair problem is 35 years open)\n\n");

    printf("  SUFFICIENT CONDITIONS (any ONE would suffice):\n");
    printf("  (i)   A NEW orthogonality beyond ℓ² (e.g., ℓ^p decoupling\n");
    printf("        for p ≠ 6, or a non-commutative version)\n");
    printf("  (ii)  A way to make the MOLLIFIER have structure\n");
    printf("        (currently its structure is dictated by the zeros)\n");
    printf("  (iii) A GLOBAL constraint on zero configurations\n");
    printf("        (using repulsion or functional equation symmetry)\n");
    printf("  (iv)  An approach from ALGEBRAIC GEOMETRY\n");
    printf("        (function field analogs where DH is proved)\n\n");

    printf("  MOST PROMISING: (iv) — the function field analog.\n");
    printf("  Over F_q[t], the Density Hypothesis IS proved (Bombieri 1974).\n");
    printf("  The proof uses the Riemann Hypothesis for curves (Weil 1948).\n");
    printf("  The question: can any part of the function field proof\n");
    printf("  be TRANSFERRED to the number field case, even partially?\n\n");

    printf("  This is the LANGLANDS PROGRAM approach:\n");
    printf("  use the geometric structure of the function field\n");
    printf("  to guide constructions in the number field case.\n");
    printf("  It's the approach that led to the Selberg eigenvalue\n");
    printf("  conjecture, functoriality, and ultimately to\n");
    printf("  automorphic forms — THE central tool in modern ANT.\n");

    return 0;
}
