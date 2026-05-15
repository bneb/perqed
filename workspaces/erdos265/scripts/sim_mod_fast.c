#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <stdint.h>

// Modular inverse for powers of 2
uint64_t modInverse(uint64_t n, uint64_t m) {
    uint64_t inv = 1;
    for (int i = 0; i < 64; i++) {
        inv = inv * (2 - n * inv);
    }
    return inv & (m - 1);
}

void check_mod(int k) {
    uint64_t m = 1ULL << k;
    uint64_t h = m / 2;
    printf("Checking Mod %llu (2^%d)...\n", (unsigned long long)m, k);

    bool *isValidX = (bool *)calloc(m, sizeof(bool));
    for (uint64_t a = 0; a < m; a++) {
        isValidX[(a * (a - 1)) % m] = true;
    }

    // State: (X_N, C_N, C_Np1)
    // X_N is even: X_N = 2*x, 0 <= x < h
    // C_N is odd:  C_N = 2*c + 1, 0 <= c < h
    // Index: x * h * h + c1 * h + c2
    uint64_t num_states = h * h * h;
    uint8_t *active = (uint8_t *)malloc(num_states * sizeof(uint8_t));
    for (uint64_t i = 0; i < num_states; i++) active[i] = 1;

    uint64_t *inverses = (uint64_t *)malloc(h * sizeof(uint64_t));
    for (uint64_t c = 0; c < h; c++) {
        inverses[c] = modInverse(2 * c + 1, m);
    }

    uint64_t active_count = num_states;
    bool changed = true;
    int iter = 0;

    while (changed && active_count > 0) {
        changed = false;
        uint64_t next_active_count = 0;
        iter++;

        for (uint64_t x = 0; x < h; x++) {
            uint64_t XN = 2 * x;
            uint64_t XNsq = (XN * XN) % m;
            for (uint64_t c1 = 0; c1 < h; c1++) {
                uint64_t CN = 2 * c1 + 1;
                for (uint64_t c2 = 0; c2 < h; c2++) {
                    uint64_t idx = (x * h + c1) * h + c2;
                    if (!active[idx]) continue;

                    uint64_t CNp1 = 2 * c2 + 1;
                    uint64_t invCNp1 = inverses[c2];

                    bool has_successor = false;
                    // For each possible odd C_Np2
                    for (uint64_t c3 = 0; c3 < h; c3++) {
                        uint64_t CNp2 = 2 * c3 + 1;
                        
                        // C_Np1 * X_Np1 = CN * XN^2 - CNp1 * XN + CNp2 (mod m)
                        // X_Np1 = invCNp1 * (CN * XNsq + CNp2) - XN (mod m)
                        uint64_t target = (CN * XNsq + CNp2) % m;
                        uint64_t XNp1 = (invCNp1 * target);
                        // Subtraction in modular arithmetic
                        if (XNp1 < XN) XNp1 += m;
                        XNp1 = (XNp1 - XN) % m;

                        if (isValidX[XNp1]) {
                            uint64_t next_idx = ((XNp1 / 2) * h + c2) * h + c3;
                            if (active[next_idx]) {
                                has_successor = true;
                                break;
                            }
                        }
                    }

                    if (!has_successor) {
                        active[idx] = 0;
                        changed = true;
                    } else {
                        next_active_count++;
                    }
                }
            }
        }
        active_count = next_active_count;
    }

    if (active_count == 0) {
        printf("  SUCCESS: No infinite sequences of odd C_N exist mod %llu.\n", (unsigned long long)m);
    } else {
        printf("  STALL: Found %llu surviving states mod %llu.\n", (unsigned long long)active_count, (unsigned long long)m);
    }

    free(isValidX);
    free(active);
    free(inverses);
}

int main() {
    for (int k = 1; k <= 9; k++) {
        check_mod(k);
    }
    return 0;
}
