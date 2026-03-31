/*
 * arithmetic_lve.c — Arithmetic Decomposition for Large Values Estimates
 *
 * THE NOVEL IDEA:
 * BD decoupling splits F(s) = Σaₙn^{-s} by GEOMETRIC intervals:
 *   F = Σ_j F_j where F_j = Σ_{n∈[N+jQ, N+(j+1)Q]} aₙn^{-s}
 *
 * We instead split by ARITHMETIC progressions:
 *   F = Σ_{a=0}^{q-1} F_a where F_a = Σ_{n≡a(q)} aₙn^{-s}
 *
 * The arithmetic pieces have MULTIPLICATIVE STRUCTURE:
 *   F_a(s) = Σ_{m: qm+a ∈ [N,2N]} a_{qm+a} · (qm+a)^{-s}
 *          = q^{-s} Σ_m a_{qm+a} · (m + a/q)^{-s}
 *
 * For the ℓ² combination:
 *   |F|² ≤ q · Σ_a |F_a|²   (Cauchy-Schwarz)
 *   |F|⁶ ≤ q² · (Σ_a |F_a|²)³   (Hölder)
 *
 * COMPARISON:
 *   GEOMETRIC: R = N/Q pieces, ℓ²: |F|² ≤ R·Σ|F_j|²
 *   ARITHMETIC: q pieces, ℓ²: |F|² ≤ q·Σ|F_a|²
 *
 * The KEY DIFFERENCE: the PIECE BOUNDS differ because
 *   F_j = interval sum (ADDITIVE structure)
 *   F_a = arithmetic sum (MULTIPLICATIVE structure)
 *
 * For F_j: ||F_j||_∞ ≤ Q^{1/2+ε}   (trivially, or better with exp pair)
 * For F_a: ||F_a||_∞ ≤ ???           (this exploits multiplicative structure)
 *
 * BUILD: cc -O3 -o arithmetic_lve arithmetic_lve.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

int gcd(int a, int b) { while(b){int t=b;b=a%b;a=t;} return a; }

/*
 * Compute |F(1/2+it)|² for Dirichlet polynomial F = Σn^{-s}
 * with support on n ∈ S.
 */
double dirichlet_abs2(int *S, int M, double t) {
    double re = 0, im = 0;
    for (int i = 0; i < M; i++) {
        double logn = log((double)S[i]);
        double phase = -t * logn;
        double amp = 1.0 / sqrt((double)S[i]);
        re += amp * cos(phase);
        im += amp * sin(phase);
    }
    return re*re + im*im;
}

/*
 * Large values count: #{t ∈ grid : |F(σ+it)| > V}
 */
int large_values_count(int *S, int M, double V2, double T, int ngrid) {
    int count = 0;
    for (int j = 0; j < ngrid; j++) {
        double t = (j + 0.5) * T / ngrid;
        double abs2 = dirichlet_abs2(S, M, t);
        if (abs2 > V2) count++;
    }
    return count;
}

int main() {
    printf("# Arithmetic vs Geometric Large Values Estimates\n\n");

    int N = 500;
    int M_total = 200; /* use all n in [N, N+M_total) */
    double T = 500.0;
    int ngrid = 5000;

    int *S = malloc(M_total * sizeof(int));
    for (int i = 0; i < M_total; i++) S[i] = N + i;

    /* Compute the full F */
    printf("## 1. Full Dirichlet Polynomial F(s) = Σ_{n=%d}^{%d} n^{-s}\n\n",
           N, N+M_total-1);

    /* Find the distribution of |F|² */
    double max_abs2 = 0, sum_abs2 = 0;
    for (int j = 0; j < ngrid; j++) {
        double t = (j + 0.5) * T / ngrid;
        double abs2 = dirichlet_abs2(S, M_total, t);
        sum_abs2 += abs2;
        if (abs2 > max_abs2) max_abs2 = abs2;
    }
    double mean_abs2 = sum_abs2 / ngrid;
    printf("  ||F||_∞² ≈ %.2f,  E[|F|²] ≈ %.4f,  M = %d\n\n",
           max_abs2, mean_abs2, M_total);

    /* ═══════════════════════════════════════════════════════ */
    printf("## 2. Geometric Decomposition: F = ΣF_j, |piece| = Q\n\n");

    int Q_vals[] = {10, 20, 40, 50, 100};
    int nQ = 5;

    printf("  %4s | %6s | %10s | %10s | %10s\n",
           "Q", "#pcs", "Σ||Fj||²∞", "q·max||Fj||²", "ℓ² bound");
    for (int qi = 0; qi < nQ; qi++) {
        int Q = Q_vals[qi];
        int R = M_total / Q;
        double sum_maxj = 0;
        double max_maxj = 0;

        for (int j = 0; j < R; j++) {
            int *piece = S + j * Q;
            double piece_max = 0;
            for (int k = 0; k < ngrid; k++) {
                double t = (k + 0.5) * T / ngrid;
                double abs2 = dirichlet_abs2(piece, Q, t);
                if (abs2 > piece_max) piece_max = abs2;
            }
            sum_maxj += piece_max;
            if (piece_max > max_maxj) max_maxj = piece_max;
        }

        /* ℓ² bound: |F|² ≤ R · Σ|Fj|² ≤ R · R · max|Fj|² = R² · max|Fj|² */
        double l2_bound = R * max_maxj;
        printf("  %4d | %6d | %10.2f | %10.2f | %10.2f\n",
               Q, R, sum_maxj, R * max_maxj, l2_bound);
    }

    /* ═══════════════════════════════════════════════════════ */
    printf("\n## 3. Arithmetic Decomposition: F = ΣF_a, n≡a(mod q)\n\n");

    int q_vals[] = {2, 3, 5, 7, 10, 13};
    int nq = 6;

    printf("  %4s | %6s | %10s | %10s | %10s | %s\n",
           "q", "#pcs", "Σ||Fa||²∞", "q·max||Fa||²", "ℓ² bound", "vs geom");
    for (int qi = 0; qi < nq; qi++) {
        int q = q_vals[qi];
        double sum_maxa = 0;
        double max_maxa = 0;

        /* Build pieces F_a = {n: n≡a mod q, n∈[N, N+M)} */
        for (int a = 0; a < q; a++) {
            int piece[1000]; int pc = 0;
            for (int i = 0; i < M_total; i++)
                if (S[i] % q == a) piece[pc++] = S[i];
            if (pc == 0) continue;

            double piece_max = 0;
            for (int k = 0; k < ngrid; k++) {
                double t = (k + 0.5) * T / ngrid;
                double abs2 = dirichlet_abs2(piece, pc, t);
                if (abs2 > piece_max) piece_max = abs2;
            }
            sum_maxa += piece_max;
            if (piece_max > max_maxa) max_maxa = piece_max;
        }

        /* Find comparable geometric Q */
        int Q_comp = M_total / q;
        int R_comp = q;
        /* Geometric bound with same number of pieces */
        double geom_max = 0;
        for (int j = 0; j < R_comp; j++) {
            int *piece = S + j * Q_comp;
            double pm = 0;
            for (int k = 0; k < ngrid; k++) {
                double t = (k + 0.5) * T / ngrid;
                double abs2 = dirichlet_abs2(piece, Q_comp, t);
                if (abs2 > pm) pm = abs2;
            }
            if (pm > geom_max) geom_max = pm;
        }

        double l2_arith = q * max_maxa;
        double l2_geom = R_comp * geom_max;
        printf("  %4d | %6d | %10.2f | %10.2f | %10.2f | %s\n",
               q, q, sum_maxa, q * max_maxa, l2_arith,
               l2_arith < l2_geom ? "★ arith BETTER!" :
               fabs(l2_arith - l2_geom) < 0.1*l2_geom ? "≈ same" : "geom better");
    }

    /* ═══════════════════════════════════════════════════════ */
    printf("\n## 4. Large Values Comparison: #{t: |F|>V}\n\n");

    /* For various V thresholds, compare the large values count
     * implied by geometric vs arithmetic decomposition. */
    printf("  For each V, the ℓ² bound implies:\n");
    printf("  #{|F|>V} ≤ (ℓ² bound) / V²\n\n");

    double V_thresholds[] = {0.5, 1.0, 1.5, 2.0, 2.5};
    int nV = 5;

    /* Use q=5 arithmetic and Q=40 geometric (same # pieces) */
    int q_test = 5;
    int Q_test = M_total / q_test;

    /* Compute actual piece maxima */
    double arith_pieces_max[20]; int arith_pieces_M[20];
    double geom_pieces_max[20]; int geom_pieces_M[20];
    double arith_sum_l2 = 0, geom_sum_l2 = 0;

    for (int a = 0; a < q_test; a++) {
        int piece[1000]; int pc = 0;
        for (int i = 0; i < M_total; i++)
            if (S[i] % q_test == a) piece[pc++] = S[i];
        arith_pieces_M[a] = pc;
        /* Compute ∫|Fa|² (average over t) as proxy for large values bound */
        double sum2 = 0;
        double mx = 0;
        for (int k = 0; k < ngrid; k++) {
            double t = (k + 0.5) * T / ngrid;
            double abs2 = dirichlet_abs2(piece, pc, t);
            sum2 += abs2;
            if (abs2 > mx) mx = abs2;
        }
        arith_pieces_max[a] = mx;
        arith_sum_l2 += sum2 / ngrid; /* E[|Fa|²] */
    }

    for (int j = 0; j < q_test; j++) {
        int *piece = S + j * Q_test;
        geom_pieces_M[j] = Q_test;
        double sum2 = 0;
        double mx = 0;
        for (int k = 0; k < ngrid; k++) {
            double t = (k + 0.5) * T / ngrid;
            double abs2 = dirichlet_abs2(piece, Q_test, t);
            sum2 += abs2;
            if (abs2 > mx) mx = abs2;
        }
        geom_pieces_max[j] = mx;
        geom_sum_l2 += sum2 / ngrid;
    }

    printf("  Pieces (q=%d): arithmetic vs geometric (Q=%d):\n\n", q_test, Q_test);
    printf("  %6s | %6s | %10s %10s | %10s %10s\n",
           "piece", "M", "max|Fa|²", "E[|Fa|²]", "max|Fj|²", "E[|Fj|²]");
    for (int a = 0; a < q_test; a++) {
        printf("  %6d | %3d/%3d | %10.4f            | %10.4f\n",
               a, arith_pieces_M[a], geom_pieces_M[a],
               arith_pieces_max[a], geom_pieces_max[a]);
    }

    printf("\n  DIRECT COMPARISON: actual #{|F|>V}\n");
    printf("  %8s | %8s %8s %8s\n", "V", "actual", "arith_bd", "geom_bd");
    for (int vi = 0; vi < nV; vi++) {
        double V = V_thresholds[vi];
        double V2 = V * V;
        int actual = large_values_count(S, M_total, V2, T, ngrid);
        /* Arithmetic bound: #{|F|>V} ≤ q · Σ E[|Fa|²] / V² */
        double arith_bd = q_test * arith_sum_l2 * ngrid / V2;
        double geom_bd = q_test * geom_sum_l2 * ngrid / V2;
        printf("  %8.2f | %8d %8.0f %8.0f\n", V, actual,
               arith_bd < ngrid ? arith_bd : (double)ngrid,
               geom_bd < ngrid ? geom_bd : (double)ngrid);
    }

    /* ═══════════════════════════════════════════════════════ */
    printf("\n## 5. 🔴 Red Team: Does Arithmetic Split Help?\n\n");

    printf("  The ℓ² bound |F|² ≤ q·Σ|Fa|² has the SAME structure as\n");
    printf("  the geometric |F|² ≤ R·Σ|Fj|² when #pieces is the same.\n\n");

    printf("  The ONLY difference is in the PIECE BOUNDS:\n");
    printf("  - Geometric ||Fj||∞² ≤ Q    (trivial MVT)\n");
    printf("  - Arithmetic ||Fa||∞² ≤ M/q  (same trivially!)\n\n");

    printf("  Since Q = M/R and M/q = M/q, with R = q: IDENTICAL.\n\n");

    printf("  BUT: the arithmetic pieces have EXTRA STRUCTURE:\n");
    printf("  - F_a involves n ≡ a(mod q), which factors through primes\n");
    printf("  - If q is prime: n = qm + a, so F_a(s) = Σa_{qm+a}(qm+a)^{-s}\n");
    printf("  - The phase is -t·log(qm+a) = -t·logq - t·log(m+a/q)\n");
    printf("  - This is a Dirichlet poly in m with a FIXED phase shift!\n\n");

    printf("  The SAVING would come from: if the coefficients a_{qm+a}\n");
    printf("  have MULTIPLICATIVE STRUCTURE when restricted to one residue class.\n\n");

    printf("  For a_n = 1 (our test case): no structure → no saving.\n");
    printf("  For a_n = Möbius/Mangoldt: the residue class restriction\n");
    printf("  DOES interact with the multiplicative structure!\n\n");

    printf("  ★ KEY: For Λ(n) (von Mangoldt): the coefficients in\n");
    printf("  class a(mod q) are supported on primes p ≡ a(mod q) and\n");
    printf("  powers. By Bombieri-Vinogradov:\n");
    printf("    Σ_{q≤Q} |ψ(x;q,a) - x/φ(q)|² ≤ x²/(logx)^A\n\n");
    printf("  This gives EQUIDISTRIBUTION of primes across residue classes,\n");
    printf("  which means the pieces F_a all have SIMILAR size.\n");
    printf("  No single piece dominates → the ℓ² bound is TIGHT.\n\n");

    printf("  BOTTOM LINE:\n");
    printf("  Arithmetic decomposition gives the SAME bound as geometric\n");
    printf("  for generic coefficients (a_n = 1).\n");
    printf("  For ARITHMETIC coefficients (a_n = Λ(n)), the equidistribution\n");
    printf("  from Bombieri-Vinogradov makes the ℓ² sum tight.\n\n");
    printf("  🔴 NO SAVING from arithmetic decomposition alone.\n\n");

    printf("  HOWEVER: the COMBINATION of arithmetic + geometric might help.\n");
    printf("  Split F first by arithmetic (mod q), then each F_a by intervals.\n");
    printf("  This gives a 2D decomposition with q × R pieces total.\n");
    printf("  The ℓ² bound: |F|² ≤ q·R · Σ_{a,j} |F_{a,j}|²\n");
    printf("  This is just the standard 2D decomposition — no new information.\n\n");
    printf("  ★ The fundamental obstacle: ℓ² orthogonality doesn't distinguish\n");
    printf("  additive from multiplicative structure. Both give |F|² ≤ #pieces · max.\n");
    printf("  To exploit multiplicative structure, need MULTIPLICATIVE large sieve\n");
    printf("  or the Euler product — which is a DIFFERENT tool than ℓ² decoupling.\n");

    free(S);
    return 0;
}
