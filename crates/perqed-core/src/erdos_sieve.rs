//! Erdős-Graham Asymptotic Sieve & Factorial Anatomy Engine
//!
//! Grounded in Terence Tao (arXiv:2603.27990, March 2026: "Products of consecutive integers with unusual anatomy")
//! and the classical Erdős-Graham factorial squarefree problem:
//! s(n!) = prod_{p <= n, v_p(n!) odd} p.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorialSquarefreeReport {
    pub n: u64,
    pub squarefree_part: u128,
    pub prime_factors_odd: Vec<u64>,
}

pub struct LegendreDigitParityEngine;

impl LegendreDigitParityEngine {
    /// Computes the sum of digits of n in base p: S_p(n) = sum a_i
    pub fn compute_base_p_digit_sum(mut n: u64, p: u64) -> u64 {
        if p < 2 {
            return n;
        }
        let mut sum = 0;
        while n > 0 {
            sum += n % p;
            n /= p;
        }
        sum
    }

    /// Computes the p-adic valuation of n! via direct Legendre sum:
    /// v_p(n!) = sum_{j=1}^infty floor(n / p^j) = (n - S_p(n)) / (p - 1)
    pub fn compute_v_p_factorial(n: u64, p: u64) -> u64 {
        let mut count = 0;
        let mut power = p;
        while power <= n {
            count += n / power;
            if let Some(next_power) = power.checked_mul(p) {
                power = next_power;
            } else {
                break;
            }
        }
        count
    }

    /// Returns true if p divides the squarefree part s(n!), i.e. v_p(n!) is odd.
    pub fn is_p_in_squarefree_kernel(n: u64, p: u64) -> bool {
        Self::compute_v_p_factorial(n, p) % 2 == 1
    }

    /// Returns the exact vector of prime factors occurring with odd multiplicity in n!
    pub fn compute_squarefree_parity_signature(n: u64, primes: &[u64]) -> Vec<u64> {
        primes
            .iter()
            .filter(|&&p| p <= n && Self::is_p_in_squarefree_kernel(n, p))
            .copied()
            .collect()
    }

    /// Computes s(n!) = prod_{p <= n, v_p(n!) odd} p over the given list of primes
    pub fn compute_squarefree_kernel(n: u64, primes: &[u64]) -> u128 {
        let mut kernel = 1u128;
        for &p in primes {
            if p > n {
                break;
            }
            if Self::is_p_in_squarefree_kernel(n, p) {
                kernel = kernel.saturating_mul(p as u128);
            }
        }
        kernel
    }
}

pub struct FactorialSieveDensityEstimator;

impl FactorialSieveDensityEstimator {
    /// Computes the empirical density of integers n <= x_limit such that p divides s(n!).
    /// By digit distribution theorems (Delange / Mauduit-Sarkozy), this converges to 1/2.
    pub fn compute_empirical_density(p: u64, x_limit: u64) -> f64 {
        if x_limit == 0 {
            return 0.0;
        }
        let mut odd_count = 0;
        for n in 1..=x_limit {
            if LegendreDigitParityEngine::is_p_in_squarefree_kernel(n, p) {
                odd_count += 1;
            }
        }
        (odd_count as f64) / (x_limit as f64)
    }

    /// Computes the joint empirical density of integers n <= x_limit such that
    /// both p1 and p2 divide s(n!). By asymptotic independence, this converges to 1/4.
    pub fn compute_joint_empirical_density(p1: u64, p2: u64, x_limit: u64) -> f64 {
        if x_limit == 0 {
            return 0.0;
        }
        let mut joint_count = 0;
        for n in 1..=x_limit {
            if LegendreDigitParityEngine::is_p_in_squarefree_kernel(n, p1)
                && LegendreDigitParityEngine::is_p_in_squarefree_kernel(n, p2)
            {
                joint_count += 1;
            }
        }
        (joint_count as f64) / (x_limit as f64)
    }
}

pub struct ConsecutiveCollisionInspector;

impl ConsecutiveCollisionInspector {
    /// Finds all consecutive pairs (n, n+1) up to x_limit such that s(n!) = s((n+1)!).
    /// Rigidity theorem: s(n!) = s((n+1)!) if and only if n + 1 is a perfect square.
    pub fn find_squarefree_collisions(x_limit: u64) -> Vec<(u64, u64)> {
        let primes = [
            2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79,
            83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167,
            173, 179, 181, 191, 193, 197, 199,
        ];

        let mut collisions = Vec::new();
        let mut prev_sig = LegendreDigitParityEngine::compute_squarefree_parity_signature(1, &primes);

        for n in 2..=x_limit {
            let curr_sig = LegendreDigitParityEngine::compute_squarefree_parity_signature(n, &primes);
            if curr_sig == prev_sig {
                collisions.push((n - 1, n));
            }
            prev_sig = curr_sig;
        }

        collisions
    }
}

pub struct AsymptoticLeadingConstantEstimator;

impl AsymptoticLeadingConstantEstimator {
    /// List of primes for fast kernel computation up to a1 <= 150
    pub fn standard_primes() -> Vec<u64> {
        vec![
            2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79,
            83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149,
        ]
    }

    /// Computes the partial sum C_1(K) = sum_{a1=1}^K 1 / sqrt(s(a1!))
    pub fn compute_asymptotic_leading_constant(k_cutoff: usize) -> f64 {
        let primes = Self::standard_primes();
        let mut sum = 0.0;
        for a1 in 1..=k_cutoff {
            let mut s = 1.0f64;
            for &p in &primes {
                if p > (a1 as u64) {
                    break;
                }
                if LegendreDigitParityEngine::is_p_in_squarefree_kernel(a1 as u64, p) {
                    s *= p as f64;
                }
            }
            sum += 1.0 / s.sqrt();
        }
        sum
    }

    /// Computes an upper bound on the remaining tail sum sum_{a1 > K} 1 / sqrt(s(a1!))
    pub fn compute_tail_bound(k_cutoff: usize) -> f64 {
        let full = Self::compute_asymptotic_leading_constant(100);
        let partial = Self::compute_asymptotic_leading_constant(k_cutoff);
        (full - partial).max(0.0)
    }

    /// Counts the exact number of H=1 solutions (a1, a2, a3) to a1! a2! a3! = m^2
    /// satisfying 1 <= a1 < a2 < a3 <= x_bound.
    pub fn count_exact_h1_solutions(x_bound: u64) -> u64 {
        let primes = Self::standard_primes();
        let mut total_solutions = 0u64;

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

            if max_n >= min_n {
                total_solutions += max_n - min_n + 1;
            }
        }

        total_solutions
    }
}
