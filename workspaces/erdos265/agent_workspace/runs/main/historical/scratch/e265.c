// Erdős 265: Fast integer-only simulation
// Uses R1/Rs recurrences directly, no fraction arithmetic needed.
// Compile: gcc -O2 -I/opt/homebrew/include -L/opt/homebrew/lib -o e265 e265.c -lgmp -lm

#include <stdio.h>
#include <math.h>
#include <gmp.h>

#define MAX_STEPS 30

// log(mpz) via mpz_get_d_2exp
static double mpz_log(const mpz_t x) {
    if (mpz_sgn(x) <= 0) return -1e30;
    long exp2;
    double m = mpz_get_d_2exp(&exp2, x);
    return log(m) + exp2 * log(2.0);
}

static void mpz_print_short(const mpz_t x, char *buf, size_t sz) {
    size_t d = mpz_sizeinbase(x, 10);
    if (d > 10) snprintf(buf, sz, "~10^%zu", d - 1);
    else gmp_snprintf(buf, sz, "%Zd", x);
}

int main(void) {
    // For S1 = 1 (q1=1):
    //   R1(0) = 1, greedy a_k = ceil(P1/R1)
    //   R1(k+1) = a_k * R1(k) - P1(k)
    //   P1(k+1) = P1(k) * a_k
    //
    // For S2 = p2/q2:
    //   Rs(0) = p2, where p2/q2 is the reduced fraction
    //   Rs(k+1) = (a_k - 1) * Rs(k) - q2 * P2(k)
    //   P2(k+1) = P2(k) * (a_k - 1)
    //
    // Constraint: Rs > 0 always. If greedy a would make Rs <= 0,
    // must choose larger a (deviation).

    int targets[][2] = {
        {169, 100},
        {17, 10},
        {5, 3},
        {1691, 1000},
    };

    for (int t = 0; t < 4; t++) {
        int p2v = targets[t][0], q2v = targets[t][1];
        printf("\n=== S1=1, S2=%d/%d = %.6f ===\n", p2v, q2v, (double)p2v/q2v);

        mpz_t R1, Rs, P1, P2, a, tmp, tmp2, q2, prev_a, Rs_test;
        mpz_init_set_ui(R1, 1);
        mpz_init_set_ui(Rs, p2v);
        mpz_init_set_ui(P1, 1);
        mpz_init_set_ui(P2, 1);
        mpz_init(a); mpz_init(tmp); mpz_init(tmp2);
        mpz_init_set_ui(q2, q2v);
        mpz_init_set_ui(prev_a, 1);
        mpz_init(Rs_test);

        double log_P1 = 0;
        int devs = 0;

        printf("%3s %15s %12s %12s %8s %8s %s\n",
               "k", "a_k", "R1", "Rs", "L", "log/2^k", "type");

        for (int k = 0; k < MAX_STEPS; k++) {
            if (mpz_sgn(R1) <= 0) { printf("R1 <= 0, stopping\n"); break; }
            if (mpz_sgn(Rs) <= 0) { printf("Rs <= 0, stopping\n"); break; }

            // Greedy: a = ceil(P1 / R1)
            mpz_cdiv_q(a, P1, R1);
            // Must be > prev_a
            mpz_add_ui(tmp, prev_a, 1);
            if (mpz_cmp(a, tmp) < 0) mpz_set(a, tmp);
            // Must be >= 2
            if (mpz_cmp_ui(a, 2) < 0) mpz_set_ui(a, 2);

            // Also need: 1/(a-1) <= T2, i.e., a-1 >= P2*q2/Rs
            // a >= ceil(P2*q2/Rs) + 1
            mpz_mul(tmp, P2, q2);
            mpz_cdiv_q(tmp, tmp, Rs);
            mpz_add_ui(tmp, tmp, 1);
            if (mpz_cmp(a, tmp) < 0) mpz_set(a, tmp);

            // Check Rs constraint: Rs_next = (a-1)*Rs - q2*P2 > 0
            const char* stype = "greedy";
            mpz_sub_ui(tmp, a, 1);
            mpz_mul(Rs_test, tmp, Rs);
            mpz_mul(tmp2, q2, P2);
            mpz_sub(Rs_test, Rs_test, tmp2);

            if (mpz_sgn(Rs_test) <= 0) {
                // Deviate: choose a = ceil(q2*P2/Rs) + 2
                mpz_mul(tmp, q2, P2);
                mpz_cdiv_q(tmp, tmp, Rs);
                mpz_add_ui(tmp, tmp, 2);
                if (mpz_cmp(a, tmp) < 0) mpz_set(a, tmp);

                // Recheck prev_a constraint
                mpz_add_ui(tmp, prev_a, 1);
                if (mpz_cmp(a, tmp) < 0) mpz_set(a, tmp);

                // Recompute Rs_test
                mpz_sub_ui(tmp, a, 1);
                mpz_mul(Rs_test, tmp, Rs);
                mpz_mul(tmp2, q2, P2);
                mpz_sub(Rs_test, Rs_test, tmp2);

                stype = "DEVIATE";
                devs++;
            }

            double log_a = mpz_log(a);
            log_P1 += log_a;
            double L = log_P1 / pow(2.0, k + 1);
            double lr = log_a / pow(2.0, k);

            char as[20], r1s[20], rss[20];
            mpz_print_short(a, as, 20);
            mpz_print_short(R1, r1s, 20);
            mpz_print_short(Rs, rss, 20);
            printf("%3d %15s %12s %12s %8.4f %8.4f %s\n", k, as, r1s, rss, L, lr, stype);

            // Update R1 = a*R1 - P1
            mpz_mul(tmp, a, R1);
            mpz_sub(R1, tmp, P1);
            // Update Rs
            mpz_set(Rs, Rs_test);
            // Update P1, P2
            mpz_mul(P1, P1, a);
            mpz_sub_ui(tmp, a, 1);
            mpz_mul(P2, P2, tmp);
            mpz_set(prev_a, a);
        }

        printf("Deviations: %d, L_final ~ %.6f, limsup ~ %.4f\n",
               devs, log_P1/pow(2.0, MAX_STEPS), exp(log_P1/pow(2.0, MAX_STEPS)));

        mpz_clear(R1); mpz_clear(Rs); mpz_clear(P1); mpz_clear(P2);
        mpz_clear(a); mpz_clear(tmp); mpz_clear(tmp2); mpz_clear(q2);
        mpz_clear(prev_a); mpz_clear(Rs_test);
    }
    return 0;
}
