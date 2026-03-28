/*
 * unit_tests.c — Sanity checks on ALL key computations.
 *
 * Tests:
 *  1. Dirichlet polynomial |F|² basic identities
 *  2. Additive energy formula
 *  3. Euler product factorization claim
 *  4. |ab|² = |a|²|b|² (basic complex arithmetic)
 *  5. Ramanujan tau values
 *  6. GM bound formula: N²/V⁶ check
 *  7. Halász formula A = 2(1-κ)/(2σ-1-2κ)
 *  8. Key numerical claims from red team outputs
 *
 * BUILD: cc -O3 -o unit_tests unit_tests.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <complex.h>

int tests_passed = 0, tests_failed = 0;

void check(const char *name, int condition) {
    if (condition) {
        tests_passed++;
    } else {
        tests_failed++;
        printf("  ✗ FAIL: %s\n", name);
    }
}

void check_approx(const char *name, double actual, double expected, double tol) {
    if (fabs(actual - expected) <= tol * (fabs(expected) + 1e-10)) {
        tests_passed++;
    } else {
        tests_failed++;
        printf("  ✗ FAIL: %s: got %.10f, expected %.10f (tol=%.2e)\n",
               name, actual, expected, tol);
    }
}

/* ═══════ Dirichlet polynomial ═══════ */
double complex dirichlet_poly(int *S, int M, double sigma, double t) {
    double complex sum = 0;
    for (int i = 0; i < M; i++) {
        double n = (double)S[i];
        sum += cpow(n, -(sigma + t * I));
    }
    return sum;
}

void test_dirichlet_basics() {
    printf("\n## Test 1: Dirichlet Polynomial Basics\n");

    /* At t=0: F(σ) = Σ n^{-σ} (real, positive) */
    int S[] = {1, 2, 3, 4, 5};
    double complex F0 = dirichlet_poly(S, 5, 0.75, 0.0);
    check("F(σ,0) is real", fabs(cimag(F0)) < 1e-10);
    check("F(σ,0) > 0", creal(F0) > 0);

    double expected = 1.0 + pow(2,-0.75) + pow(3,-0.75) + pow(4,-0.75) + pow(5,-0.75);
    check_approx("F(0.75, 0) value", creal(F0), expected, 1e-10);

    /* At σ=0, t=0: F = Σ 1 = M */
    double complex F_s0 = dirichlet_poly(S, 5, 0.0, 0.0);
    check_approx("F(0,0) = M", creal(F_s0), 5.0, 1e-10);

    /* |F|² = F · F̄ */
    double t = 3.7;
    double complex Ft = dirichlet_poly(S, 5, 0.5, t);
    double abs2_v1 = creal(Ft)*creal(Ft) + cimag(Ft)*cimag(Ft);
    double abs2_v2 = cabs(Ft) * cabs(Ft);
    check_approx("|F|² two methods agree", abs2_v1, abs2_v2, 1e-10);

    /* Parseval: (1/T)∫₀ᵀ |F|² dt ≈ Σ n^{-2σ} for large T */
    double sigma = 0.75;
    int T_int = 10000;
    double sum_abs2 = 0;
    for (int k = 0; k < T_int; k++) {
        double tt = (k + 0.5);
        double complex Ftt = dirichlet_poly(S, 5, sigma, tt);
        sum_abs2 += cabs(Ftt) * cabs(Ftt);
    }
    double parseval = sum_abs2 / T_int;
    double parseval_expected = 0;
    for (int i = 0; i < 5; i++)
        parseval_expected += pow((double)S[i], -2*sigma);
    check_approx("Parseval identity", parseval, parseval_expected, 0.05);
}

/* ═══════ Additive energy ═══════ */
long long additive_energy(int *S, int M) {
    int maxsum = S[M-1] + S[M-1] + 1;
    int *cnt = calloc(maxsum, sizeof(int));
    for (int i = 0; i < M; i++)
        for (int j = 0; j < M; j++)
            cnt[S[i] + S[j]]++;
    long long E = 0;
    for (int s = 0; s < maxsum; s++)
        E += (long long)cnt[s] * cnt[s];
    free(cnt);
    return E;
}

void test_additive_energy() {
    printf("\n## Test 2: Additive Energy\n");

    /* E({1,2,3}) should count (a+b=c+d) quadruples. */
    /* Sums: 1+1=2, 1+2=3, 1+3=4, 2+1=3, 2+2=4, 2+3=5, 3+1=4, 3+2=5, 3+3=6 */
    /* cnt[2]=1, cnt[3]=2, cnt[4]=3, cnt[5]=2, cnt[6]=1 */
    /* E = 1+4+9+4+1 = 19 */
    int S1[] = {1, 2, 3};
    check_approx("E({1,2,3})", (double)additive_energy(S1, 3), 19.0, 1e-10);

    /* E({1}) = 1 (only 1+1=1+1) */
    int S2[] = {1};
    check_approx("E({1})", (double)additive_energy(S2, 1), 1.0, 1e-10);

    /* E({1,2}) sums: 2,3,3,4. cnt[2]=1,cnt[3]=2,cnt[4]=1. E=1+4+1=6 */
    int S3[] = {1, 2};
    check_approx("E({1,2})", (double)additive_energy(S3, 2), 6.0, 1e-10);

    /* For arithmetic progression {1,2,...,n}: E is known to be O(n³) */
    /* E({1,...,n}) = Σ_s r²(s) where r(s) = #{(a,b): a+b=s, 1≤a,b≤n} */
    /* r(s) = s-1 for 2≤s≤n+1, r(s) = 2n+1-s for n+1<s≤2n */
    /* E = Σ_{s=2}^{n+1} (s-1)² + Σ_{s=n+2}^{2n} (2n+1-s)² = 2Σ_{k=1}^{n-1} k² + n² */
    /* = 2·(n-1)n(2n-1)/6 + n² = n(n-1)(2n-1)/3 + n² */
    int n = 10;
    int S4[10]; for (int i = 0; i < n; i++) S4[i] = i + 1;
    long long E_expected = (long long)n*(n-1)*(2*n-1)/3 + n*n;
    check_approx("E({1..10}) formula", (double)additive_energy(S4, n),
                 (double)E_expected, 1e-10);

    /* From our output: E/M³ for integers ≈ 0.667. Check: */
    /* E = M(M-1)(2M-1)/3 + M² ≈ 2M³/3 for large M. So E/M³ ≈ 2/3 ✓ */
    int M = 200;
    int S5[200]; for (int i = 0; i < M; i++) S5[i] = i + 1;
    double ratio = (double)additive_energy(S5, M) / ((double)M*M*M);
    check_approx("E/M³ for [1,200] ≈ 2/3", ratio, 2.0/3, 0.01);
}

/* ═══════ Euler product ═══════ */
void test_euler_product() {
    printf("\n## Test 3: Euler Product Factorization\n");

    /* KEY CLAIM from red_team_euler: |Πf_p|² = Π|f_p|² always. */
    /* This is basic complex arithmetic: |ab|² = |a|²|b|² */
    double complex a = 3.0 + 4.0*I;
    double complex b = 1.0 - 2.0*I;
    check_approx("|ab|² = |a|²|b|²",
                 cabs(a*b)*cabs(a*b),
                 cabs(a)*cabs(a) * cabs(b)*cabs(b), 1e-10);

    /* So if F = Π f_p (exact Euler product), then |F|² = Π|f_p|². */
    /* The ISSUE is that Σ_{smooth n≤N} n^{-s} ≠ Π_{p≤P} Σ_{k} p^{-ks} */
    /* because the product includes products like p₁^a₁·p₂^a₂ > N. */

    /* Verify: for N=6, P=3: */
    /* Smooth numbers ≤ 6: {1,2,3,4,6} (not 5) */
    /* Euler product Π: (1+2^{-s}+4^{-s})(1+3^{-s}+9^{-s}) */
    /* = 1 + 2^{-s} + 3^{-s} + 4^{-s} + 6^{-s} + 9^{-s} + 12^{-s} + 18^{-s} + 36^{-s} */
    /* The sum Σ_{smooth ≤6} = 1 + 2^{-s} + 3^{-s} + 4^{-s} + 6^{-s} */
    /* Euler product has EXTRA terms: 9^{-s} + 12^{-s} + 18^{-s} + 36^{-s} */

    double s_re = 0.5, s_im = 1.0;
    /* Direct sum: 1 + 2 + 3 + 4 + 6 */
    int smooth6[] = {1, 2, 3, 4, 6};
    double complex F_direct = dirichlet_poly(smooth6, 5, s_re, s_im);

    /* Euler product: (1 + 2^{-s} + 4^{-s})(1 + 3^{-s} + 9^{-s}) */
    /* but truncated Euler factors: only include p^k ≤ N=6 */
    /* For p=2: 2^0=1, 2^1=2, 2^2=4 (all ≤ 6) → 1 + 2^{-s} + 4^{-s} */
    /* For p=3: 3^0=1, 3^1=3 (≤6), 3^2=9 (>6) → 1 + 3^{-s} */
    double complex f2 = 1.0 + cpow(2, -(s_re + s_im*I)) + cpow(4, -(s_re + s_im*I));
    double complex f3 = 1.0 + cpow(3, -(s_re + s_im*I));
    /* Even with truncated factors: product = (1+2^{-s}+4^{-s})(1+3^{-s}) */
    /* = 1 + 2^{-s} + 3^{-s} + 4^{-s} + 6^{-s} + 12^{-s} */
    /* Has 12^{-s} term but NOT 9^{-s}. Still differs from direct sum. */

    double complex F_euler = f2 * f3;
    double direct_abs2 = cabs(F_direct)*cabs(F_direct);
    double euler_abs2 = cabs(F_euler)*cabs(F_euler);

    printf("  N=6, P=3 at s=0.5+i:\n");
    printf("    |F_direct|² = %.6f\n", direct_abs2);
    printf("    |F_euler|²  = %.6f\n", euler_abs2);
    printf("    Ratio        = %.6f (should NOT be 1.0)\n", euler_abs2/direct_abs2);

    check("Euler ≠ direct (truncation difference)", fabs(euler_abs2 - direct_abs2) > 0.01);

    /* But Π|f_p|² DOES equal |Πf_p|² — verify */
    double prod_abs2 = cabs(f2)*cabs(f2) * cabs(f3)*cabs(f3);
    check_approx("Π|fp|² = |Πfp|²", prod_abs2, euler_abs2, 1e-10);
}

/* ═══════ Ramanujan tau ═══════ */
void test_tau() {
    printf("\n## Test 4: Ramanujan Tau Function\n");

    /* Known values: τ(1)=1, τ(2)=-24, τ(3)=252, τ(4)=-1472,
     * τ(5)=4830, τ(6)=-6048, τ(7)=-16744, τ(11)=534612, τ(13)=-577738 */
    /* Also: τ(p) satisfies |τ(p)| ≤ 2p^{11/2} (Deligne) */

    /* Check Deligne bound for small primes */
    int primes[] = {2, 3, 5, 7, 11, 13};
    long long tau_vals[] = {-24, 252, 4830, -16744, 534612, -577738};
    int np = 6;

    for (int i = 0; i < np; i++) {
        double bound = 2.0 * pow((double)primes[i], 5.5);
        char buf[80];
        snprintf(buf, sizeof(buf), "|τ(%d)| ≤ 2p^{11/2}", primes[i]);
        check(buf, (double)llabs(tau_vals[i]) <= bound * 1.001);
    }

    /* Multiplicativity: τ(mn) = τ(m)τ(n) for gcd(m,n)=1 */
    /* τ(6) = τ(2)τ(3) since gcd(2,3)=1 */
    long long tau6_from_mult = (-24LL) * 252LL;
    check_approx("τ(6) = τ(2)τ(3)", (double)tau6_from_mult, -6048.0, 1e-10);

    /* τ(15) = τ(3)τ(5) since gcd(3,5)=1 */
    long long tau15_from_mult = 252LL * 4830LL;
    /* τ(15) = 1217160 (known) */
    check_approx("τ(15) = τ(3)τ(5)", (double)tau15_from_mult, 1217160.0, 1e-10);
}

/* ═══════ GM formula ═══════ */
void test_gm_formulas() {
    printf("\n## Test 5: Guth-Maynard Formulas\n");

    /* A = 30/13 */
    check_approx("30/13", 30.0/13.0, 2.307692307, 1e-6);

    /* At σ=3/4: A(1-σ) = (30/13)(1/4) = 30/52 = 15/26 ≈ 0.577 */
    check_approx("A(1-σ) at σ=3/4", 30.0/13 * 0.25, 15.0/26, 1e-10);

    /* Halász formula: A = 2(1-κ)/(2σ-1-2κ) at (1/6, 2/3) and σ=3/4 */
    double kappa = 1.0/6, lambda = 2.0/3, sigma = 0.75;
    double A_halasz = 2*(1-kappa) / (2*sigma - 1 - 2*kappa);
    check_approx("Halász A at (1/6,2/3), σ=3/4", A_halasz, 4.0, 1e-10);
    /* Verify: 2(5/6)/(0.5 - 1/3) = (5/3)/(1/6) = 10. Wait... */
    /* 2(1-κ) = 2(5/6) = 5/3. 2σ-1-2κ = 1.5-1-1/3 = 1/6. A = (5/3)/(1/6) = 10. */
    /* That's 10, not 4! Let me recheck... */
    printf("  Halász recalc: 2(1-1/6)/(2·0.75-1-2/6) = %.4f\n", A_halasz);

    /* Actually: 2σ-1-2κ = 2(0.75)-1-2(1/6) = 1.5-1-0.333 = 0.167 = 1/6 */
    /* 2(1-κ) = 2(5/6) = 10/6 = 5/3 */
    /* A = (5/3)/(1/6) = 10. Not 4! */
    /* So the red_team_checkpoint.c said A=4, but the actual Halász formula gives A=10?! */

    /* Let me check what formula was actually used in red_team_checkpoint.c */
    /* It used: A = 2(1-κ)/(2σ-1-2κ) */
    /* At σ=3/4, κ=1/6: A = 2(5/6)/(3/2-1-1/3) = (5/3)/(1/6) = 10 */
    /* This is DIFFERENT from A=4 that was claimed! */

    printf("\n  🔴 BUG FOUND: red_team_checkpoint claimed Halász A=4 at (1/6,2/3)\n");
    printf("     Actual computation: A = 2(5/6)/(1/6) = 10.0\n");
    printf("     The A=4 claim was based on a DIFFERENT formula!\n\n");

    /* The correct Halász-Montgomery formula for the EXPONENT in N(σ,T): */
    /* A = 2/(2σ-1) when using pure MVT (no exponent pair). That gives A=4 at σ=3/4. */
    /* With exponent pair (κ,λ): A = (1+2κ)/(2σ-1) [Jutila variant] */
    double A_jutila = (1 + 2*kappa) / (2*sigma - 1);
    printf("  Jutila variant: A = (1+2κ)/(2σ-1) = %.4f\n", A_jutila);
    /* (1+1/3)/0.5 = (4/3)/0.5 = 8/3 ≈ 2.667 */
    check_approx("Jutila A at (1/6,2/3), σ=3/4", A_jutila, 8.0/3, 1e-10);

    /* Pure MVT (no exponent pair): A = 2/(2σ-1) */
    double A_mvt = 2.0 / (2*sigma - 1);
    check_approx("MVT A at σ=3/4", A_mvt, 4.0, 1e-10);

    printf("  ★ The '4.0' comes from pure MVT, NOT Halász with (1/6,2/3).\n");
    printf("  ★ With (1/6,2/3), Jutila gives A = 8/3 ≈ 2.67.\n");
    printf("  ★ red_team_checkpoint used the WRONG formula for A.\n\n");
}

/* ═══════ Overcounting ═══════ */
void test_overcounting() {
    printf("\n## Test 6: Hyperbolic Overcounting\n");

    /* For n=6, D=10: divisors of 6 that are ≤ 10 = {1,2,3,6} → τ_D(6) = 4 */
    int n = 6, D = 10;
    int tau = 0;
    for (int d = 1; d <= D; d++)
        if (n % d == 0) tau++;
    check_approx("τ_10(6) = 4", (double)tau, 4.0, 1e-10);

    /* For prime p, τ_D(p) = 1 if p > D, 2 if p ≤ D */
    check_approx("τ_10(7) = 2", (double)({int t=0;for(int d=1;d<=10;d++)if(7%d==0)t++;t;}), 2.0, 1e-10);
    check_approx("τ_10(11) = 1", (double)({int t=0;for(int d=1;d<=10;d++)if(11%d==0)t++;t;}), 1.0, 1e-10);

    /* Average τ_D for [500,700) with D=10: claimed ≈ 2.93 */
    double avg = 0; int cnt = 0;
    for (int nn = 500; nn < 1000; nn++) {
        int t = 0;
        for (int d = 1; d <= 10; d++) if (nn % d == 0) t++;
        avg += t; cnt++;
    }
    avg /= cnt;
    printf("  Average τ_10 for [500,1000): %.3f\n", avg);
    /* Should be close to Σ_{d=1}^{10} 1/d ≈ 2.93 (harmonic number H_10) */
    double H10 = 0;
    for (int d = 1; d <= 10; d++) H10 += 1.0/d;
    check_approx("avg τ_D ≈ H_D", avg, H10, 0.05);
}

/* ═══════ Huxley formula ═══════ */
void test_huxley() {
    printf("\n## Test 7: Huxley's Formula\n");

    /* red_team_checkpoint claimed: Huxley gives A=2.4 at σ=3/4 */
    /* Huxley (1972): A = 12/5 = 2.4, uniform in σ ≥ 1/2 */
    check_approx("12/5 = 2.4", 12.0/5, 2.4, 1e-10);

    /* But wait — is Huxley's A=12/5 at σ=3/4 specifically? */
    /* Huxley proved N(σ,T) ≤ T^{12(1-σ)/5+ε} for all σ ≥ 1/2 */
    /* At σ=3/4: exponent = 12(1/4)/5 = 12/20 = 3/5 = 0.6 */
    /* GM at σ=3/4: exponent = 30(1/4)/13 = 30/52 = 15/26 ≈ 0.577 */
    check("GM better than Huxley at σ=3/4", 30.0/52 < 12.0/20);
}

/* ═══════ Exceptional set ═══════ */
void test_exceptional() {
    printf("\n## Test 8: Exceptional Set Formula\n");

    /* E(N) ≤ N^{1-1/(A+1)+ε} */
    /* GM: A=30/13 → 1-1/(30/13+1) = 1-1/(43/13) = 1-13/43 = 30/43 ≈ 0.698 */
    double exc_GM = 1.0 - 13.0/43;
    check_approx("GM exceptional exponent", exc_GM, 30.0/43, 1e-10);

    /* Huxley: A=12/5 → 1-1/(12/5+1) = 1-1/(17/5) = 1-5/17 = 12/17 ≈ 0.706 */
    double exc_Hux = 1.0 - 5.0/17;
    check_approx("Huxley exceptional exponent", exc_Hux, 12.0/17, 1e-10);

    /* GM better than Huxley: 30/43 < 12/17 */
    check("GM exc < Huxley exc", 30.0/43 < 12.0/17);
}

int main() {
    printf("# Unit Tests for Zero-Density Computations\n");

    test_dirichlet_basics();
    test_additive_energy();
    test_euler_product();
    test_tau();
    test_gm_formulas();
    test_overcounting();
    test_huxley();
    test_exceptional();

    printf("\n══════════════════════════════════════════════════════════\n");
    printf("  RESULTS: %d passed, %d failed\n",
           tests_passed, tests_failed);
    if (tests_failed > 0)
        printf("  🔴 %d TESTS FAILED — review above\n", tests_failed);
    else
        printf("  ✅ ALL TESTS PASSED\n");
    printf("══════════════════════════════════════════════════════════\n");

    return tests_failed > 0 ? 1 : 0;
}
