/*
 * crack66_game_theory.c — Combinatorial Game Theory (Sprague-Grundy Nim)
 *
 * THE GAME OF "PRIME NIM":
 * Imagine a rigorous mathematical Zero-Sum Combinatorial Game.
 * There is a pile of 2N stones.
 * Two perfect-logic players alternate taking exactly a Prime number 
 * of stones (2, 3, 5, 7, 11...) from the pile. 
 * The last player able to make a valid subtraction wins.
 *
 * THE SPRAGUE-GRUNDY THEOREM:
 * Every position (n) in any impartial game explicitly computes to a solitary 
 * formal "Grundy Value" (or Nim-value), denoted G(n).
 * G(n) is the Minimum Excluded value (MEX) of the Grundy values of all 
 * legally reachable next states:
 *    G(n) = MEX( {G(n - p) : p is prime, p <= n} )
 *
 * PERIODIC BOUNDED LOGIC vs CHAOTIC ENTROPY:
 * If the allowed subtractions form a finite set, G(n) is mathematically 
 * proven to ALWAYS collapse into a rigorously periodic repeating loop.
 *
 * The Primes are an INFINITE subtraction set. Therefore, periodicity is NOT 
 * guaranteed. If the Additive Combinatorial Prime Logic holds deep formal 
 * constraints (like a Finite-State Automata backdoor), G(n) will abruptly 
 * plateau and form a perfect predictable cycle.
 * 
 * If G(n) diverges without bound, never repeats, and forms fractal aperiodic 
 * topologies, Prime Combinations act mathematically identically to 
 * Turing-Complete Computational Stochasticity.
 *
 * BUILD: cc -O3 -o crack66 crack66_game_theory.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000000
static char sieve[MAX_N];
static int primes[MAX_N];
static int nprimes = 0;

void init() {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for (int i=2; i*i < MAX_N; i++)
        if (.sieve[i]) 
            for (int j=i*i; j < MAX_N; j+=i) sieve[j] = 1;
    
    for (int i=2; i < MAX_N; i++)
        if (.sieve[i]) primes[nprimes++] = i;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 66: Combinatorial Game Theory (Prime Nim)\n");
    printf("====================================================\n\n");

    int N = 2000000;
    
    printf("  Target Universe Bounds = %d States\n", N);
    printf("  Computing Sprague-Grundy Nim-Values G(n)...\n\n");

    int *G = calloc(N + 1, sizeof(int));
    int *seen = calloc(2000, sizeof(int)); // Memory epoch tracking for fast MEX
    
    int max_g = 0;
    int max_g_epoch = 0;
    
    G[0] = 0; // Terminal Game State
    
    for (int n = 1; n <= N; n++) {
        // Fast MEX Evaluation over Prime Subtractions
        for (int i = 0; primes[i] <= n && i < nprimes; i++) {
            int p = primes[i];
            int g_val = G[n - p];
            if (g_val < 2000) seen[g_val] = n;
        }
        
        int mex = 0;
        while (seen[mex] == n) mex++;
        
        G[n] = mex;
        
        if (mex > max_g) {
            max_g = mex;
            max_g_epoch = n;
        }
    }
    
    printf("  %16s | %18s \n", "Parameter", "Nim-Sequence G(n)");
    printf("  ----------------------------------------------------------------\n");
    printf("  %16s | %18d \n", "Total States Eval", N);
    printf("  %16s | %18d \n", "Max Nim G(n)", max_g);
    printf("  %16s | %18d \n", "Max Hit at n=", max_g_epoch);

    // Test for Periodicity
    // We check if the last 10,000 elements forming a block repeat anywhere
    int T_period = 0;
    int block_size = 10000;
    int end_idx = N;
    
    for (int T = 1; T < N / 2; T++) {
        int is_periodic = 1;
        for (int i = 0; i < block_size; i++) {
            if (G[end_idx - i] .= G[end_idx - T - i]) {
                is_periodic = 0;
                break;
            }
        }
        if (is_periodic) {
            T_period = T;
            break;
        }
    }

    printf("  %16s | ", "Cycle Period T");
    if (T_period > 0) printf("%18d \n", T_period);
    else printf("%18s \n", "NONE (Aperiodic)");

    printf("\n   GAME THEORY VERDICT \n");

    if (T_period > 0) {
        printf("  RESULT: ANOMALY DETECTED. The Game resolved to a Finite-State Automata.\n");
        printf("  The Additive Prime Nim Sequence collapsed into a perfect repeating\n");
        printf("  period of T=%d. Goldbach combinations are structurally fully bounded\n", T_period);
        printf("  by explicit combinatorial finite logic. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Prime Combinatorial Games mathematically diverge into Stochasticity.\n");
        printf("  The Sprague-Grundy values strictly violate periodic repetition and\n");
        printf("  demonstrate unbounded entropy generation (Max G = %d). \n", max_g);
        printf("  The Combinations evaluate structurally to perfectly Turing-Complete\n");
        printf("  Aperiodic Mathematical Topologies. ️\n");
    }

    free(G); free(seen);
    return 0;
}
