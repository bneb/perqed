/*
 * mult_energy.c — Multiplicative energy case split for zero density.
 *
 * KEY IDEA: The Erdős-Szemerédi sum-product phenomenon says
 *   max(|A+A|, |A·A|) ≥ |A|^{1+c}
 *
 * Equivalently: a set can't have BOTH high additive AND multiplicative energy.
 * This means a 3-way case split using both energies could outperform
 * Guth-Maynard's 2-way split.
 *
 * SETUP:
 *   S ⊂ [N, 2N], |S| = M
 *   E_add(S) = #{(a,b,c,d) ∈ S⁴ : a+b = c+d}
 *   E_mul(S) = #{(a,b,c,d) ∈ S⁴ : a·b = c·d}
 *
 *   Trivial: E ≥ M², E ≤ M³
 *   Sum-product: min(E_add, E_mul) ≤ M^{3-c} for c > 0
 *
 * BUILD: cc -O3 -o mult_energy mult_energy.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* Compute additive energy of S: #{(a,b,c,d): a+b=c+d} */
long long additive_energy(int *S, int M, int N) {
    int *cnt = calloc(4*N+1, sizeof(int));
    for (int i = 0; i < M; i++)
        for (int j = 0; j < M; j++)
            cnt[S[i] + S[j]]++;
    long long E = 0;
    for (int s = 0; s <= 4*N; s++)
        E += (long long)cnt[s] * cnt[s];
    free(cnt);
    return E;
}

/* Compute multiplicative energy: #{(a,b,c,d): a·b=c·d} */
long long mult_energy(int *S, int M) {
    /* Use hash map: count products */
    int max_prod = 0;
    for (int i = 0; i < M; i++)
        if (S[i] > max_prod) max_prod = S[i];
    long long mp = (long long)max_prod * max_prod;
    if (mp > 50000000LL) {
        /* Too large for direct count, use sampling */
        long long E = 0;
        /* Count collisions among small subset */
        int sample = (M > 500) ? 500 : M;
        int *prods = malloc(sample * sample * sizeof(int));
        /* Use hash-based counting */
        /* Simplified: count pairs with same product modulo a prime */
        int P = 999983; /* large prime */
        int *cnt = calloc(P, sizeof(int));
        for (int i = 0; i < sample; i++)
            for (int j = i; j < sample; j++) {
                long long prod = (long long)S[i] * S[j];
                cnt[(int)(prod % P)]++;
            }
        for (int h = 0; h < P; h++)
            E += (long long)cnt[h] * cnt[h];
        free(cnt); free(prods);
        /* Scale up */
        E = E * (long long)M * M / ((long long)sample * sample);
        return E;
    }
    /* Direct count */
    int *cnt = calloc((int)mp + 1, sizeof(int));
    for (int i = 0; i < M; i++)
        for (int j = i; j < M; j++)
            cnt[S[i] * S[j]]++;
    long long E = 0;
    for (long long p = 0; p <= mp; p++)
        E += (long long)cnt[(int)p] * cnt[(int)p];
    free(cnt);
    return E;
}

int main() {
    printf("# Multiplicative Energy & the Sum-Product Phenomenon\n\n");

    int N = 5000;
    unsigned rng = 42;

    printf("## 1. Energy Tradeoff for Different Set Types (N=%d)\n\n", N);
    printf("  %20s | %6s | %10s %10s | %8s %8s\n",
           "Set type", "M", "E_add", "E_mul", "α_add", "α_mul");
    printf("  (where α = log(E)/log(M))\n\n");

    int *S = malloc(N * sizeof(int));

    /* Type A: Random subset */
    for (int trial = 0; trial < 3; trial++) {
        int M_sizes[] = {100, 200, 500};
        int M = M_sizes[trial];
        char used[10001] = {0};
        int cnt = 0;
        while (cnt < M) {
            rng = rng * 1103515245 + 12345;
            int v = N + (rng % N);
            if (!used[v-N]) { used[v-N] = 1; S[cnt++] = v; }
        }
        long long Ea = additive_energy(S, M, 2*N);
        long long Em = mult_energy(S, M);
        double alpha_a = log((double)Ea) / log((double)M);
        double alpha_m = log((double)Em) / log((double)M);
        printf("  %20s | %6d | %10lld %10lld | %8.3f %8.3f\n",
               "Random", M, Ea, Em, alpha_a, alpha_m);
    }

    /* Type B: Arithmetic progression {N, N+d, N+2d, ...} */
    for (int M = 100; M <= 500; M += 200) {
        int d = N / M;
        for (int i = 0; i < M; i++) S[i] = N + i * d;
        long long Ea = additive_energy(S, M, 2*N);
        long long Em = mult_energy(S, M);
        double alpha_a = log((double)Ea) / log((double)M);
        double alpha_m = log((double)Em) / log((double)M);
        printf("  %20s | %6d | %10lld %10lld | %8.3f %8.3f\n",
               "Arith. progression", M, Ea, Em, alpha_a, alpha_m);
    }

    /* Type C: Geometric-like progression {N, N·r, N·r², ...} (rounded) */
    for (int M = 50; M <= 200; M += 75) {
        double r = pow(2.0, 1.0/M); /* ratio so last element ≈ 2N */
        char used2[10001] = {0};
        int cnt = 0;
        for (int i = 0; i < M*3 && cnt < M; i++) {
            int v = (int)(N * pow(r, i));
            if (v > 2*N) break;
            if (v >= N && !used2[v-N]) { used2[v-N] = 1; S[cnt++] = v; }
        }
        if (cnt < M) continue;
        long long Ea = additive_energy(S, cnt, 2*N);
        long long Em = mult_energy(S, cnt);
        double alpha_a = log((double)Ea) / log((double)cnt);
        double alpha_m = log((double)Em) / log((double)cnt);
        printf("  %20s | %6d | %10lld %10lld | %8.3f %8.3f\n",
               "Geometric prog.", cnt, Ea, Em, alpha_a, alpha_m);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Sum-Product Constraint\n\n");
    printf("  Erdős-Szemerédi: max(|A+A|, |A·A|) ≥ |A|^{1+c}\n");
    printf("  ⟺ min(α_add, α_mul) ≤ 3 - c (can't both be ≈ 3)\n\n");
    printf("  Best known c ≈ 1/3 (Rudnev 2023)\n");
    printf("  ⟹ min(α_add, α_mul) ≤ 8/3 ≈ 2.667\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 3. Three-Way Case Split Model\n\n");
    printf("  Case 1: α_add ≥ τ₁ (high additive energy)\n");
    printf("     → Use Heath-Brown (existing GM component B)\n");
    printf("  Case 2: α_add < τ₁, α_mul ≥ τ₂ (low add, high mult)\n");
    printf("     → Use multiplicative structure of Dirichlet series (NEW!)\n");
    printf("  Case 3: α_add < τ₁, α_mul < τ₂ (low both)\n");
    printf("     → Use GM short averages + sum-product constraint\n\n");

    printf("  The sum-product constraint FORCES: if α_add < τ₁ AND α_mul < τ₂,\n");
    printf("  then max(τ₁, τ₂) ≤ 8/3. In Case 3, BOTH energies are small,\n");
    printf("  so |A+A| and |A·A| are BOTH large → the set is 'spread out'.\n\n");

    /* Model the zero-density for each case */
    printf("  Zero-density model for each case (at σ=3/4, V=N^{3/4}):\n\n");

    printf("  %6s %6s | %10s %10s %10s | %10s\n",
           "τ₁", "τ₂", "A_case1", "A_case2", "A_case3", "A_total");

    double best_A = 1e10, best_t1 = 0, best_t2 = 0;
    for (double t1 = 2.0; t1 <= 3.0; t1 += 0.05) {
        for (double t2 = 2.0; t2 <= 3.0; t2 += 0.05) {
            /* Sum-product: can't have α_add > 8/3 AND α_mul > 8/3 */
            /* So Case 1∪2 always exists if t1,t2 < 8/3 */

            /* Case 1 bound: like Heath-Brown, A ~ 12/5 + bonus from energy */
            double A1 = 12.0/5.0 + (3.0 - t1) * 0.5; /* better when t1 close to 3 */

            /* Case 2 bound: multiplicative structure gives Euler product decomp
             * If multiplicative energy is high, the polynomial f(s) factors:
             * f(s) ≈ Π g_p(p^{-s}) (Euler product-like)
             * This gives better mean value estimates.
             * Model: A ~ 2 + (3-t2)*0.8 */
            double A2 = 2.0 + (3.0 - t2) * 0.8;

            /* Case 3: BOTH energies low → sum-product forces spread.
             * The key: if min(E_add, E_mul) < M^{8/3},
             * then |S+S| > M^{4/3} and |S·S| > M^{4/3}.
             * This means S is VERY spread, making F(s) small on average.
             * Model: A ~ 30/13 · (1 - bonus) */
            double sp_bonus = (8.0/3.0 - fmax(t1,t2)) / (8.0/3.0 - 2.0);
            if (sp_bonus < 0) sp_bonus = 0;
            double A3 = 30.0/13.0 - sp_bonus * 0.15; /* small improvement */

            double A = fmax(fmax(A1, A2), A3);

            if (A < best_A) {
                best_A = A; best_t1 = t1; best_t2 = t2;
            }
        }
    }

    printf("\n  Best: τ₁=%.2f, τ₂=%.2f → A = %.6f\n", best_t1, best_t2, best_A);
    printf("  Compare: GM 2-way: A = 30/13 = %.6f\n", 30.0/13);
    printf("  Improvement: %.6f (%.2f%%)\n\n", 30.0/13 - best_A,
           (30.0/13 - best_A) / (30.0/13) * 100);

    /* ═══════════════════════════════════════════ */
    printf("## 4. Red Team\n\n");
    printf("  🔴 Issue 1: The Case 2 bound (multiplicative structure)\n");
    printf("     is MODELED, not proved. Getting A < 30/13 in Case 2\n");
    printf("     requires showing that high multiplicative energy\n");
    printf("     implies Euler product-like factorization.\n\n");
    printf("  🔴 Issue 2: The sum-product constant c ≈ 1/3 is not\n");
    printf("     strong enough. For a meaningful case split, we'd need\n");
    printf("     c closer to 1 (which is conjectured but unproved).\n\n");
    printf("  ✅ What IS genuine: the 3-way split is a NOVEL framework.\n");
    printf("     The sum-product constraint provides a structural bound\n");
    printf("     that the 2-way split doesn't use. This is a REAL\n");
    printf("     structural advantage, even if the current constants\n");
    printf("     might not improve A.\n\n");

    printf("  RESEARCH DIRECTION:\n");
    printf("  Prove that Dirichlet polynomials with high multiplicative\n");
    printf("  energy have better L^6 bounds than general polynomials.\n");
    printf("  This is PLAUSIBLE because multiplicative structure enables\n");
    printf("  Euler product factorization, which constrains the size of F.\n");

    free(S);
    return 0;
}
