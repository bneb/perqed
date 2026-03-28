/*
 * crack62_dynamical_systems.c — Stochasticity Theory & Strange Attractors
 *
 * THE GOLDBACH DYNAMICAL SYSTEM:
 * In Stochasticity Theory, a Dynamical System tracks how a state evolves over time.
 * We define the Goldbach Iterative Map as:
 *      x_{n+1} = NearestPrime( |2N - x_n| )
 *
 * Because the search space [0, 2N] is absolutely finite, every single orbit 
 * MUST mathematically terminate into a repeating loop (a Limit Cycle / Attractor).
 *
 * THE PERIOD-2 GRAVITY WELL:
 * Note that if x_n is a TRUE Goldbach prime, 2N - x_n is ALSO perfectly prime.
 * Thus: x_{n+1} = 2N - x_n
 *       x_{n+2} = 2N - (2N - x_n) = x_n
 * Every Goldbach pair is intrinsically a Period-2 Limit Cycle Attractor.
 *
 * RANDOM TOPOLOGICAL MAPPINGS limit:
 * In a purely chaotic, unstructured random mapping over V elements, the 
 * mathematical expected transient orbit length before hitting a cycle is 
 * roughly sqrt(pi * V / 8).
 *
 * THE VERDICT:
 * Do generic, non-Goldbach primes wander randomly through the search space 
 * (matching the random mapping attractor limit), or does the Goldbach equation 
 * structurally behave as a "Strange Attractor"—a massive gravity well that 
 * systematically forces all primes to instantly collapse into a Goldbach Period-2 loop?
 *
 * We will calculate the Transient Stochasticity Length of every prime up to 2N, 
 * compute the Mean Orbit Length, and benchmark it against True Random mappings.
 *
 * BUILD: cc -O3 -o crack62 crack62_dynamical_systems.c -lm
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

// Binary search to find nearest prime
int nearest_prime(int n) {
    if (n <= 2) return 2;
    if (.sieve[n]) return n;
    
    int low = 0;
    int high = nprimes - 1;
    int closest = primes[0];
    
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (primes[mid] == n) return primes[mid];
        
        if (abs(primes[mid] - n) < abs(closest - n)) {
            closest = primes[mid];
        }
        
        if (primes[mid] < n) low = mid + 1;
        else high = mid - 1;
    }
    return closest;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 62: Stochasticity Theory & Strange Attractors\n");
    printf("====================================================\n\n");

    int target = 1000000;
    
    int num_valid_primes = 0;
    for (int i=0; i<nprimes; i++) {
        if (primes[i] <= target) num_valid_primes++;
        else break;
    }

    printf("  Target 2N = %d\n", target);
    printf("  Executing Dynamical System over %d initial prime states...\n", num_valid_primes);
    
    long long total_transit_steps = 0;
    int *visited = malloc((target + 1) * sizeof(int));

    // Phase 1: Evaluate Goldbach Dynamical Mappings
    for (int i = 0; i < num_valid_primes; i++) {
        memset(visited, 0, (target + 1) * sizeof(int));
        
        int current = primes[i];
        int steps = 0;
        
        while (1) {
            visited[current] = 1;
            
            int next_val = abs(target - current);
            int next_p = nearest_prime(next_val);
            
            if (visited[next_p]) {
                // Limit Cycle hit
                total_transit_steps += steps;
                break;
            }
            
            current = next_p;
            steps++;
        }
    }
    
    double mean_gb_transit = (double)total_transit_steps / num_valid_primes;
    
    // Phase 2: True Random Topological Mapping Limit
    // Evaluates expected attractor cycles using identical array sizes
    long long total_rand_transit = 0;
    int V = num_valid_primes;
    int *rand_map = malloc(V * sizeof(int));
    srand(42);
    
    for (int i=0; i<V; i++) rand_map[i] = rand() % V;

    int *rand_visited = malloc(V * sizeof(int));
    for (int i = 0; i < V; i++) {
        memset(rand_visited, 0, V * sizeof(int));
        
        int current = i;
        int steps = 0;
        
        while (1) {
            rand_visited[current] = 1;
            int next_p = rand_map[current];
            
            if (rand_visited[next_p]) {
                total_rand_transit += steps;
                break;
            }
            current = next_p;
            steps++;
        }
    }

    double mean_rand_transit = (double)total_rand_transit / V;
    double stochasticity_variance = fabs(mean_gb_transit - mean_rand_transit) / mean_rand_transit * 100.0;

    printf("\n  %18s | %18s | %18s \n", "Metric", "Goldbach Orbit", "Random Mapping");
    printf("  ----------------------------------------------------------------\n");
    printf("  %18s | %18.2f | %18.2f \n", "Mean Attractor Hit", mean_gb_transit, mean_rand_transit);
    
    printf("\n   DYNAMICAL SYSTEMS VERDICT \n");
    printf("  Mean Stochasticity Orbit Length Variance: %.2f%%\n\n", stochasticity_variance);

    if (stochasticity_variance > 10.0 && mean_gb_transit < mean_rand_transit) {
        printf("  RESULT: ANOMALY DETECTED. The Stochasticity Map instantly collapsed.\n");
        printf("  Goldbach coordinates behave as aggressive Strange Attractors.\n");
        printf("  Rather than wandering chaotically across the finite subset boundary,\n");
        printf("  the entire prime universe physically gravitates and systematically collapses\n");
        printf("  into localized Period-2 gravity wells exponentially faster than chance. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. Goldbach is purely mathematically chaotic.\n");
        printf("  The Iterative mapping evaluated transient limits practically identical\n");
        printf("  to completely unstructured pseudo-random integer routing mappings.\n");
        printf("  (Variance: %.2f%%). The Additive logic has ZERO gravitational limit cycles. ️\n", stochasticity_variance);
    }

    free(visited); free(rand_map); free(rand_visited);
    return 0;
}
