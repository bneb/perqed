// Erdős 265: Dual-constraint simulation
// At each step, choose a_k to keep BOTH R1 > 0 and Rs > 0.
// Try different strategies: greedy-min, balanced, alternating.
// gcc -O2 -I/opt/homebrew/include -L/opt/homebrew/lib -o e265d e265d.c -lgmp -lm

#include <stdio.h>
#include <math.h>
#include <gmp.h>

#define MAX_STEPS 40

static double mpz_log(const mpz_t x) {
    if (mpz_sgn(x) <= 0) return -1e30;
    long exp2;
    double m = mpz_get_d_2exp(&exp2, x);
    return log(m) + exp2 * log(2.0);
}

static void mpz_print_short(const mpz_t x, char *buf, size_t sz) {
    size_t d = mpz_sizeinbase(x, 10);
    if (d > 8) snprintf(buf, sz, "~10^%zu", d - 1);
    else gmp_snprintf(buf, sz, "%Zd", x);
}

// Given R1, Rs, P1, P2, q2, compute the minimum valid a
// such that R1_new > 0 AND Rs_new > 0 AND a > prev_a
static void compute_a_min(mpz_t a_out, const mpz_t R1, const mpz_t Rs,
                          const mpz_t P1, const mpz_t P2, const mpz_t q2,
                          const mpz_t prev_a, mpz_t tmp) {
    // R1_new = a*R1 - P1 > 0  =>  a > P1/R1  =>  a >= ceil(P1/R1)
    mpz_cdiv_q(a_out, P1, R1);

    // Rs_new = (a-1)*Rs - q2*P2 > 0  =>  a > q2*P2/Rs + 1
    mpz_mul(tmp, q2, P2);
    mpz_cdiv_q(tmp, tmp, Rs);
    mpz_add_ui(tmp, tmp, 2);  // a >= ceil(q2*P2/Rs) + 2 to be safe
    if (mpz_cmp(a_out, tmp) < 0) mpz_set(a_out, tmp);

    // a > prev_a
    mpz_add_ui(tmp, prev_a, 1);
    if (mpz_cmp(a_out, tmp) < 0) mpz_set(a_out, tmp);

    // a >= 2
    if (mpz_cmp_ui(a_out, 2) < 0) mpz_set_ui(a_out, 2);
}

typedef struct {
    int which_binds;  // 0=R1, 1=Rs, 2=both
} StepInfo;

static StepInfo simulate_step(mpz_t R1, mpz_t Rs, mpz_t P1, mpz_t P2,
                               const mpz_t q2, mpz_t prev_a,
                               mpz_t a, mpz_t tmp, mpz_t tmp2,
                               int strategy) {
    StepInfo info;

    // Compute minimum a for each constraint independently
    mpz_t a_r1, a_rs;
    mpz_init(a_r1); mpz_init(a_rs);

    // Min a for R1 > 0: a*R1 - P1 > 0 => a > P1/R1 => a >= floor(P1/R1) + 1
    mpz_fdiv_q(a_r1, P1, R1);
    mpz_add_ui(a_r1, a_r1, 1);
    mpz_add_ui(tmp, prev_a, 1);
    if (mpz_cmp(a_r1, tmp) < 0) mpz_set(a_r1, tmp);
    if (mpz_cmp_ui(a_r1, 2) < 0) mpz_set_ui(a_r1, 2);

    // Min a for Rs > 0: (a-1)*Rs > q2*P2  =>  a > q2*P2/Rs + 1
    mpz_mul(tmp, q2, P2);
    mpz_cdiv_q(a_rs, tmp, Rs);
    mpz_add_ui(a_rs, a_rs, 1);  // a >= floor(q2*P2/Rs) + 2... no, need (a-1) > q2*P2/Rs
    // Actually: (a-1)*Rs > q2*P2  =>  a-1 > q2*P2/Rs  =>  a >= ceil(q2*P2/Rs) + 1
    // But we want strict > 0, so: a-1 >= ceil(q2*P2/Rs) + 1 if not exact, or +1 if exact
    // Simplest: a = ceil((q2*P2 + Rs) / Rs) + 1 = ceil(q2*P2/Rs) + 2? No.
    // Let's just compute: we need (a-1)*Rs - q2*P2 > 0
    // (a-1) > q2*P2/Rs => a-1 >= floor(q2*P2/Rs) + 1 => a >= floor(q2*P2/Rs) + 2
    // OR if Rs divides q2*P2 exactly: a-1 = q2*P2/Rs gives Rs_new = 0, need a-1 > that.
    mpz_mul(tmp, q2, P2);
    mpz_fdiv_q(a_rs, tmp, Rs);
    mpz_add_ui(a_rs, a_rs, 2);  // a = floor(q2*P2/Rs) + 2 guarantees (a-1)*Rs > q2*P2

    // Which constraint is binding?
    int cmp = mpz_cmp(a_r1, a_rs);
    if (cmp >= 0) info.which_binds = 0;       // R1 binds (a_r1 >= a_rs)
    else info.which_binds = 1;                  // Rs binds (a_rs > a_r1)

    // Choose a based on strategy
    if (strategy == 0) {
        // GREEDY: smallest valid a (= max(a_r1, a_rs))
        mpz_set(a, (cmp >= 0) ? a_r1 : a_rs);
    } else if (strategy == 1) {
        // BALANCED: choose a between a_r1 and a_rs to equalize R1/Rs growth
        // Use geometric mean of the two bounds
        mpz_set(a, (cmp >= 0) ? a_r1 : a_rs);
        // Add a small amount to try to balance
        // R1_new = a*R1 - P1, Rs_new = (a-1)*Rs - q2*P2
        // We want R1_new/P1_new ≈ Rs_new/(q2*P2_new)
        // Just use greedy + 1 for now
    } else {
        // GREEDY
        mpz_set(a, (cmp >= 0) ? a_r1 : a_rs);
    }

    // Apply the step
    // R1_new = a*R1 - P1
    mpz_mul(tmp, a, R1);
    mpz_sub(R1, tmp, P1);

    // Rs_new = (a-1)*Rs - q2*P2
    mpz_sub_ui(tmp, a, 1);
    mpz_mul(tmp2, tmp, Rs);
    mpz_mul(tmp, q2, P2);
    mpz_sub(Rs, tmp2, tmp);

    // P1 *= a, P2 *= (a-1)
    mpz_mul(P1, P1, a);
    mpz_sub_ui(tmp, a, 1);
    mpz_mul(P2, P2, tmp);

    mpz_set(prev_a, a);

    mpz_clear(a_r1); mpz_clear(a_rs);
    return info;
}

int main(void) {
    int targets[][2] = {
        {169, 100},
        {5, 3},
        {1691, 1000},
        {17, 10},
        {3, 2},
    };

    for (int t = 0; t < 5; t++) {
        int p2v = targets[t][0], q2v = targets[t][1];
        printf("\n=== S1=1, S2=%d/%d = %.6f ===\n", p2v, q2v, (double)p2v/q2v);

        mpz_t R1, Rs, P1, P2, a, tmp, tmp2, q2, prev_a;
        mpz_init_set_ui(R1, 1);
        mpz_init_set_ui(Rs, p2v);
        mpz_init_set_ui(P1, 1);
        mpz_init_set_ui(P2, 1);
        mpz_init(a); mpz_init(tmp); mpz_init(tmp2);
        mpz_init_set_ui(q2, q2v);
        mpz_init_set_ui(prev_a, 1);

        double log_P1 = 0;
        int r1_binds = 0, rs_binds = 0;

        printf("%3s %12s %10s %10s %8s %8s %s\n",
               "k", "a_k", "R1", "Rs", "L", "log/2k", "binds");

        for (int k = 0; k < MAX_STEPS; k++) {
            if (mpz_sgn(R1) <= 0) { printf("R1 died\n"); break; }
            if (mpz_sgn(Rs) <= 0) { printf("Rs died\n"); break; }

            char r1s[15], rss[15];
            mpz_print_short(R1, r1s, 15);
            mpz_print_short(Rs, rss, 15);

            StepInfo info = simulate_step(R1, Rs, P1, P2, q2, prev_a,
                                          a, tmp, tmp2, 0);

            double log_a = mpz_log(a);
            log_P1 += log_a;
            double L = log_P1 / pow(2.0, k + 1);
            double lr = log_a / pow(2.0, k);

            char as[15];
            mpz_print_short(a, as, 15);
            const char *bind_str = info.which_binds == 0 ? "R1" : "Rs";
            if (info.which_binds == 0) r1_binds++; else rs_binds++;

            printf("%3d %12s %10s %10s %8.4f %8.4f %s\n",
                   k, as, r1s, rss, L, lr, bind_str);
        }

        printf("R1 bound %d times, Rs bound %d times\n", r1_binds, rs_binds);
        printf("L_final ~ %.6f, limsup ~ %.4f\n",
               log_P1/pow(2.0, MAX_STEPS), exp(log_P1/pow(2.0, MAX_STEPS)));

        mpz_clear(R1); mpz_clear(Rs); mpz_clear(P1); mpz_clear(P2);
        mpz_clear(a); mpz_clear(tmp); mpz_clear(tmp2); mpz_clear(q2);
        mpz_clear(prev_a);
    }
    return 0;
}
