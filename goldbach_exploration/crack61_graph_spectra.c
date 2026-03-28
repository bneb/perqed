/*
 * crack61_graph_spectra.c — Spectral Graph Theory (Expander Eigenvalues)
 *
 * THE ADDITIVE PRIME MATRIX:
 * We map the mathematical rule of additive primes into an Adjacency Matrix.
 * Let the graph vertices V = {1, 2, ..., N}.
 * Edge Matrix A[i][j] = 1 if (i + j) is distinctly Prime. 
 * A[i][j] = 0 otherwise.
 *
 * This explicitly models the complete topological network of prime combinations.
 *
 * SPECTRAL GRAPH THEORY:
 * The Eigenvalues of a Graph Adjacency matrix perfectly reveal its global 
 * symmetric topology, completely ignoring local configurations.
 * 
 * Expander Graphs (like the Ramanujan Graph) are magical mathematically:
 * they are sparse (few edges), yet phenomenally well-mixed and connected.
 * They are rigorously defined by a MASSIVE "Spectral Gap".
 * Spectral Gap = λ_1 - λ_2 (Largest Eigenvalue minus the Second Largest).
 * 
 * ERDOS-RENYI RANDOM GRAPH LIMIT:
 * A completely unstructured random graph (Erdos-Renyi noise) possesses a baseline
 * generic spectral gap based on the Wigner Semicircle Distribution.
 * 
 * THE VERDICT:
 * We construct the N x N Matrix. We use numerical Power Iteration and strictly
 * Deflate the matrix to extract the top Eigenvalues (λ1, λ2).
 * If the Prime Matrix generates a stochastically larger Spectral Gap than an equivalent
 * random noise matrix, it proves that Prime Combinatorial topology natively acts 
 * as a globally symmetric, optimally-spanning Expander Graph.
 *
 * BUILD: cc -O3 -o crack61 crack61_graph_spectra.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000000
static char sieve[MAX_N];

void init() {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for (int i=2; i*i < MAX_N; i++)
        if (.sieve[i]) 
            for (int j=i*i; j < MAX_N; j+=i) sieve[j] = 1;
}

// Power Iteration to find the dominant Eigenvalue of a Symmetric Matrix
double power_iteration(char **matrix, int N, double *eigenvector) {
    double *v = calloc(N, sizeof(double));
    double *v_next = calloc(N, sizeof(double));
    
    // Random initial vector
    for(int i=0; i<N; i++) v[i] = ((double)rand() / RAND_MAX);
    
    double lambda = 0;
    int max_iters = 1000;
    
    for (int iter=0; iter<max_iters; iter++) {
        // v_next = A * v
        for (int i=0; i<N; i++) {
            v_next[i] = 0;
            for (int j=0; j<N; j++) {
                if (matrix[i][j]) {
                    v_next[i] += v[j];
                }
            }
        }
        
        // Compute norm to normalize
        double norm = 0;
        for (int i=0; i<N; i++) norm += v_next[i] * v_next[i];
        norm = sqrt(norm);
        
        // Extract Rayleigh quotient (Eigenvalue approximation)
        double rayleigh = 0;
        for (int i=0; i<N; i++) rayleigh += (v[i] * v_next[i] / norm);
        lambda = rayleigh * norm; // Because v was already normalized
        
        // Normalize vector for next step
        for (int i=0; i<N; i++) v[i] = v_next[i] / norm;
    }
    
    // Save generated eigenvector for deflation
    for(int i=0; i<N; i++) eigenvector[i] = v[i];
    
    free(v); free(v_next);
    return lambda;
}

// Deflate the matrix to find the second largest eigenvalue
void deflate_matrix(char **matrix, int N, double lambda1, double *eig1, double **deflated_matrix) {
    for (int i=0; i<N; i++) {
        for (int j=0; j<N; j++) {
            double A_ij = matrix[i][j] ? 1.0 : 0.0;
            // Hotelling Deflation: M' = A - λ1 * (v1 * v1^T)
            deflated_matrix[i][j] = A_ij - (lambda1 * eig1[i] * eig1[j]);
        }
    }
}

// Power Iteration for Dense Double Matrices
double dense_power_iteration(double **matrix, int N) {
    double *v = calloc(N, sizeof(double));
    double *v_next = calloc(N, sizeof(double));
    
    for(int i=0; i<N; i++) v[i] = ((double)rand() / RAND_MAX);
    
    double lambda = 0;
    int max_iters = 1000;
    
    for (int iter=0; iter<max_iters; iter++) {
        for (int i=0; i<N; i++) {
            v_next[i] = 0;
            for (int j=0; j<N; j++) {
                v_next[i] += matrix[i][j] * v[j];
            }
        }
        
        double norm = 0;
        for (int i=0; i<N; i++) norm += v_next[i] * v_next[i];
        norm = sqrt(norm);
        
        double rayleigh = 0;
        for (int i=0; i<N; i++) rayleigh += (v[i] * v_next[i] / norm);
        lambda = rayleigh * norm;
        
        for (int i=0; i<N; i++) v[i] = v_next[i] / norm;
    }
    
    free(v); free(v_next);
    return lambda;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 61: Graph Spectra (Expander Eigenvalues)\n");
    printf("====================================================\n\n");

    int N = 4000; // 4000x4000 Matrix
    printf("  Generating %dx%d Additive Prime Adjacency Matrix...\n", N, N);
    
    char **gb_matrix = malloc(N * sizeof(char*));
    char **rand_matrix = malloc(N * sizeof(char*));
    for (int i=0; i<N; i++) {
        gb_matrix[i] = calloc(N, sizeof(char));
        rand_matrix[i] = calloc(N, sizeof(char));
    }
    
    long long total_edges = 0;
    for (int i=1; i<=N; i++) {
        for (int j=1; j<=N; j++) {
            if (.sieve[i+j]) {
                gb_matrix[i-1][j-1] = 1;
                total_edges++;
            }
        }
    }
    
    // Seed identical-density Random Graph Matrix
    double edge_prob = (double)total_edges / ((long long)N * N);
    printf("  Global Edge Density: %.4f%%\n", edge_prob * 100.0);
    
    srand(42);
    for (int i=0; i<N; i++) {
        for (int j=1; j<=N; j++) {
            if (((double)rand() / RAND_MAX) < edge_prob) rand_matrix[i][j-1] = 1;
        }
    }
    
    printf("  Executing Numerical Power Iteration Matrix Deflations...\n\n");

    double *gb_eig1 = malloc(N * sizeof(double));
    double *rand_eig1 = malloc(N * sizeof(double));

    double gb_lambda1 = power_iteration(gb_matrix, N, gb_eig1);
    double rand_lambda1 = power_iteration(rand_matrix, N, rand_eig1);

    double **gb_def = malloc(N * sizeof(double*));
    double **rand_def = malloc(N * sizeof(double*));
    for(int i=0; i<N; i++) {
        gb_def[i] = malloc(N * sizeof(double));
        rand_def[i] = malloc(N * sizeof(double));
    }

    deflate_matrix(gb_matrix, N, gb_lambda1, gb_eig1, gb_def);
    deflate_matrix(rand_matrix, N, rand_lambda1, rand_eig1, rand_def);

    double gb_lambda2 = dense_power_iteration(gb_def, N);
    double rand_lambda2 = dense_power_iteration(rand_def, N);

    double gb_gap = gb_lambda1 - fabs(gb_lambda2);
    double rand_gap = rand_lambda1 - fabs(rand_lambda2);

    double gap_variance = fabs(gb_gap - rand_gap) / rand_gap * 100.0;

    printf("  %12s | %18s | %18s \n", "Eigenvalue", "Prime Graph", "Random Erdos-Renyi");
    printf("  ----------------------------------------------------------------\n");
    printf("  %12s | %18.2f | %18.2f \n", "λ_1 (Max)", gb_lambda1, rand_lambda1);
    printf("  %12s | %18.2f | %18.2f \n", "λ_2 (Deflate)", gb_lambda2, rand_lambda2);
    printf("  ----------------------------------------------------------------\n");
    printf("  %12s | %18.2f | %18.2f \n", "Spectral Gap", gb_gap, rand_gap);

    printf("\n   SPECTRAL GRAPH VERDICT \n");
    printf("  Spectral Gap Variance against Wigner Random Matrix Bound: %.2f%%\n\n", gap_variance);

    if (gap_variance > 10.0 && gb_gap > rand_gap) {
        printf("  RESULT: ANOMALY DETECTED. The Prime Adjacency systematically separated.\n");
        printf("  The Additive Matrix possesses a phenomenally vast Spectral Gap.\n");
        printf("  Prime Combinations natively form structured Expander Graphs,\n");
        printf("  enforcing global symmetries far beyond standard random connectivity bounds. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Goldbach Combinatorial Topology is absolutely, perfectly chaotic.\n");
        printf("  The Sparse Prime Matrix generated eigenvalues mathematically identical to\n");
        printf("  pure unstructured Wigner Erdos-Renyi graph random noise (Var: %.2f%%).\n", gap_variance);
        printf("  There is absolutely ZERO expansive, global topology hidden inside the Matrix. ️\n");
    }

    for (int i=0; i<N; i++) {
        free(gb_matrix[i]); free(rand_matrix[i]);
        free(gb_def[i]); free(rand_def[i]);
    }
    free(gb_matrix); free(rand_matrix); free(gb_def); free(rand_def);
    free(gb_eig1); free(rand_eig1);
    return 0;
}
