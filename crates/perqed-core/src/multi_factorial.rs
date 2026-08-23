//! Erdős–Graham Multi-Factorial Asymptotic Hierarchy Engine ($k \ge 2$)
//!
//! Grounded in Terence Tao (arXiv:2603.27990, March 2026: "Products of consecutive integers with unusual anatomy")
//! and generalizes the asymptotic structure to all k-factorial equations:
//! prod_{i=1}^k a_i! = m^2.

use crate::erdos_sieve::LegendreDigitParityEngine;

pub struct MultiFactorialHierarchyEngine;

impl MultiFactorialHierarchyEngine {
    /// Standard prime list up to 150
    pub fn standard_primes() -> Vec<u64> {
        vec![
            2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79,
            83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149,
        ]
    }

    /// Computes the generalized Tao Dirichlet constant:
    /// C_k = sum_{a1=1}^K 1 / s(a1!)^{(k-1)/4}
    pub fn compute_generalized_constant(k: usize, cutoff: usize) -> f64 {
        if k % 2 == 0 {
            return 1.0;
        }
        let power = (k as f64 - 1.0) / 4.0;
        let primes = Self::standard_primes();
        let mut sum = 0.0;

        for a1 in 1..=cutoff {
            let mut s = 1.0f64;
            for &p in &primes {
                if p > (a1 as u64) {
                    break;
                }
                if LegendreDigitParityEngine::is_p_in_squarefree_kernel(a1 as u64, p) {
                    s *= p as f64;
                }
            }
            sum += 1.0 / s.powf(power);
        }
        sum
    }

    /// Computes the leading coefficient for the asymptotic counting function N_k(x) ~ c_k * x^{floor(k/2)/2}
    pub fn compute_asymptotic_leading_coefficient(k: usize) -> f64 {
        let r = k / 2;
        let mut factorial_r = 1.0f64;
        for i in 2..=r {
            factorial_r *= i as f64;
        }

        if k % 2 == 0 {
            1.0 / factorial_r
        } else {
            let c_k = Self::compute_generalized_constant(k, 100);
            c_k / factorial_r
        }
    }

    /// Counts the exact number of multi-factorial solutions in the dominant family with a_k <= x_bound
    pub fn count_exact_multi_factorial_solutions(k: usize, x_bound: u64) -> u64 {
        let r = k / 2;
        if r == 0 {
            return 0;
        }

        if k % 2 == 0 {
            // Even k = 2r: pairwise orthogonal consecutive square pairs (m_i^2 - 1, m_i^2)
            // 2 <= m_1 < m_2 < ... < m_r <= sqrt(x_bound)
            let sqrt_x = (x_bound as f64).sqrt().floor() as u64;
            if sqrt_x < 2 + (r as u64) - 1 {
                return 0;
            }
            let pool = sqrt_x - 1; // number of integers m >= 2 with m <= sqrt_x
            Self::combinations(pool, r as u64)
        } else {
            // Odd k = 2r + 1: a1 free, r pairs (s_1 n_i^2 - 1, s_1 n_i^2)
            let primes = Self::standard_primes();
            let mut total = 0u64;

            for a1 in 1..100u64 {
                let mut s = 1.0f64;
                for &p in &primes {
                    if p > a1 {
                        break;
                    }
                    if LegendreDigitParityEngine::is_p_in_squarefree_kernel(a1, p) {
                        s *= p as f64;
                    }
                }

                let s_val = s as u64;
                if s_val == 0 {
                    continue;
                }

                let max_n = ((x_bound / s_val) as f64).sqrt().floor() as u64;
                let mut min_n = (((a1 + 1) / s_val) as f64).sqrt().floor() as u64;
                while min_n * min_n * s_val <= a1 + 1 {
                    min_n += 1;
                }

                if max_n >= min_n + (r as u64) - 1 {
                    let pool = max_n - min_n + 1;
                    total += Self::combinations(pool, r as u64);
                }
            }

            total
        }
    }

    /// Computes binomial coefficient C(n, k)
    fn combinations(n: u64, k: u64) -> u64 {
        if k > n {
            return 0;
        }
        if k == 0 || k == n {
            return 1;
        }
        let k = k.min(n - k);
        let mut res = 1u128;
        for i in 0..k {
            res = res * (n - i) as u128 / (i + 1) as u128;
        }
        res as u64
    }
}
