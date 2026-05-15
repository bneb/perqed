// Erdős 265: Full cycle simulation with arbitrary precision
// Tracks (R1, Rs) through greedy/deviation cycles
// Compile: gcc -O2 -o erdos265_sim erdos265_sim.c -lgmp -lm

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <gmp.h>

#define MAX_STEPS 30

// Compute log(mpz) accurately using sizeinbase
static double mpz_log(const mpz_t x) {
    if (mpz_sgn(x) <= 0) return -1e30;
    size_t digits = mpz_sizeinbase(x, 10);
    if (digits <= 15) return log(mpz_get_d(x));
    // log(x) ≈ digits * log(10) + log(leading digits)
    // Get top ~15 digits by dividing
    mpz_t shifted;
    mpz_init(shifted);
    mpz_tdiv_q_2exp(shifted, x, (digits - 15) * 3);  // rough shift
    double lead = mpz_get_d(shifted);
    double log_lead = log(lead);
    double log_shift = (digits - 15) * 3 * log(2.0);
    mpz_clear(shifted);
    // Better: use mpz_get_d_2exp
    long exp2;
    double mantissa = mpz_get_d_2exp(&exp2, x);
    return log(mantissa) + exp2 * log(2.0);
}

int main(void) {
    // Targets: S1 = 1/1, S2 = p2/q2
    // We try several S2 values
    int targets[][2] = {
        {169, 100},   // 1.69
        {7, 4},       // 1.75
        {17, 10},     // 1.70
        {1691, 1000}, // 1.691
        {845, 500},   // 1.69
        {5, 3},       // 1.667
    };
    int ntargets = sizeof(targets) / sizeof(targets[0]);

    for (int t = 0; t < ntargets; t++) {
        int p2_init = targets[t][0];
        int q2_val = targets[t][1];

        printf("========================================\n");
        printf("S1=1, S2=%d/%d = %.6f\n", p2_init, q2_val, (double)p2_init/q2_val);
        printf("========================================\n");

        // Initialize GMP variables
        mpz_t R1, Rs, P1, P2, T1_num, T1_den, T2_num, T2_den;
        mpz_t a, a_greedy, tmp, tmp2, Rs_next, q2;
        mpz_t prev_a;

        mpz_init_set_ui(R1, 1);        // R1(0) = q1 * S1 = 1
        mpz_init_set_ui(Rs, p2_init);   // Rs(0) = q2 * S2 = p2
        mpz_init_set_ui(P1, 1);
        mpz_init_set_ui(P2, 1);
        mpz_init_set_ui(T1_num, 1);     // T1 = 1/1
        mpz_init_set_ui(T1_den, 1);
        mpz_init_set_ui(T2_num, p2_init); // T2 = p2/q2
        mpz_init_set_ui(T2_den, q2_val);
        mpz_init(a);
        mpz_init(a_greedy);
        mpz_init(tmp);
        mpz_init(tmp2);
        mpz_init(Rs_next);
        mpz_init_set_ui(q2, q2_val);
        mpz_init_set_ui(prev_a, 1);

        double log_P1 = 0.0;

        printf("%3s %15s %8s %12s %10s %8s %8s %s\n",
               "k", "a_k", "R1", "Rs", "waste", "L", "log/2^k", "type");
        printf("-------------------------------------------------------------------\n");

        int deviations = 0;
        int steps = 0;

        for (int k = 0; k < MAX_STEPS; k++) {
            // Check T1, T2 > 0
            if (mpz_sgn(T1_num) <= 0 || mpz_sgn(T2_num) <= 0) break;

            // Greedy: a = ceil(T1_den / T1_num)
            mpz_cdiv_q(a_greedy, T1_den, T1_num);

            // Must be > prev_a
            mpz_add_ui(tmp, prev_a, 1);
            if (mpz_cmp(a_greedy, tmp) < 0)
                mpz_set(a_greedy, tmp);

            // Check 1/(a-1) <= T2: a-1 >= ceil(T2_den/T2_num)
            // i.e., a >= ceil(T2_den/T2_num) + 1
            mpz_cdiv_q(tmp, T2_den, T2_num);
            mpz_add_ui(tmp, tmp, 1);
            if (mpz_cmp(a_greedy, tmp) < 0)
                mpz_set(a_greedy, tmp);

            mpz_set(a, a_greedy);

            // Check Rs constraint: Rs_next = (a-1)*Rs - q2*P2
            mpz_sub_ui(tmp, a, 1);
            mpz_mul(Rs_next, tmp, Rs);
            mpz_mul(tmp2, q2, P2);
            mpz_sub(Rs_next, Rs_next, tmp2);

            const char* step_type = "greedy";
            if (mpz_sgn(Rs_next) <= 0 && mpz_sgn(Rs) > 0) {
                // Must deviate: need (a-1)*Rs > q2*P2
                // a > q2*P2/Rs + 1
                mpz_mul(tmp, q2, P2);
                mpz_cdiv_q(tmp, tmp, Rs);
                mpz_add_ui(tmp, tmp, 2);
                if (mpz_cmp(a, tmp) < 0)
                    mpz_set(a, tmp);

                // Recompute Rs_next
                mpz_sub_ui(tmp, a, 1);
                mpz_mul(Rs_next, tmp, Rs);
                mpz_mul(tmp2, q2, P2);
                mpz_sub(Rs_next, Rs_next, tmp2);

                step_type = "DEVIATE";
                deviations++;
            }

            // Compute waste = a * T1_num / T1_den (as double)
            mpz_mul(tmp, a, T1_num);
            double waste = mpz_get_d(tmp) / mpz_get_d(T1_den);

            double log_a = mpz_log(a);
            log_P1 += log_a;
            double L = log_P1 / pow(2.0, k + 1);
            double log_ratio = log_a / pow(2.0, k);

            // Print (truncate large numbers)
            char a_str[20];
            if (mpz_sizeinbase(a, 10) > 12)
                snprintf(a_str, sizeof(a_str), "~10^%zu", mpz_sizeinbase(a, 10) - 1);
            else
                gmp_snprintf(a_str, sizeof(a_str), "%Zd", a);

            // Print Rs as digit count if huge
            char rs_str[20];
            size_t rs_digits = mpz_sizeinbase(Rs, 10);
            if (rs_digits > 10)
                snprintf(rs_str, sizeof(rs_str), "~10^%zu", rs_digits - 1);
            else
                gmp_snprintf(rs_str, sizeof(rs_str), "%Zd", Rs);

            char r1_str[20];
            size_t r1_digits = mpz_sizeinbase(R1, 10);
            if (r1_digits > 10)
                snprintf(r1_str, sizeof(r1_str), "~10^%zu", r1_digits - 1);
            else
                gmp_snprintf(r1_str, sizeof(r1_str), "%Zd", R1);

            printf("%3d %15s %12s %12s %10.4f %8.4f %8.4f %s\n",
                   k, a_str, r1_str, rs_str,
                   waste > 1e12 ? -1.0 : waste, L, log_ratio, step_type);

            // Update T1 = T1 - 1/a = (T1_num*a - T1_den) / (T1_den * a)
            mpz_mul(tmp, T1_num, a);
            mpz_sub(tmp, tmp, T1_den);
            mpz_mul(T1_den, T1_den, a);
            mpz_set(T1_num, tmp);
            // Reduce
            mpz_gcd(tmp2, T1_num, T1_den);
            mpz_divexact(T1_num, T1_num, tmp2);
            mpz_divexact(T1_den, T1_den, tmp2);

            // Update T2 = T2 - 1/(a-1) = (T2_num*(a-1) - T2_den) / (T2_den*(a-1))
            mpz_sub_ui(tmp, a, 1);
            mpz_mul(tmp2, T2_num, tmp);
            mpz_sub(tmp2, tmp2, T2_den);
            mpz_mul(T2_den, T2_den, tmp);
            mpz_set(T2_num, tmp2);
            // Reduce
            mpz_gcd(tmp, T2_num, T2_den);
            if (mpz_sgn(tmp) > 0) {
                mpz_divexact(T2_num, T2_num, tmp);
                mpz_divexact(T2_den, T2_den, tmp);
            }

            // Update R1 = a*R1 - P1
            mpz_mul(tmp, a, R1);
            mpz_sub(R1, tmp, P1);

            // Update Rs
            mpz_set(Rs, Rs_next);

            // Update P1, P2
            mpz_mul(P1, P1, a);
            mpz_sub_ui(tmp, a, 1);
            mpz_mul(P2, P2, tmp);

            mpz_set(prev_a, a);
            steps++;
        }

        printf("\nFinal L = %.6f, limsup ~ %.4f, deviations: %d/%d\n\n",
               log_P1 / pow(2.0, steps), exp(log_P1 / pow(2.0, steps)),
               deviations, steps);

        // Cleanup
        mpz_clear(R1); mpz_clear(Rs); mpz_clear(P1); mpz_clear(P2);
        mpz_clear(T1_num); mpz_clear(T1_den); mpz_clear(T2_num); mpz_clear(T2_den);
        mpz_clear(a); mpz_clear(a_greedy); mpz_clear(tmp); mpz_clear(tmp2);
        mpz_clear(Rs_next); mpz_clear(q2); mpz_clear(prev_a);
    }

    return 0;
}
