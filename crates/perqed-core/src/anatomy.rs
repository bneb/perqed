//! Multiplicative Integer Anatomy & Anti-Sieve Analyzer
//!
//! Terence Tao (March 2026 / Products of Consecutive Integers with Unusual Anatomy):
//! "Investigating Diophantine factorial equations a1! a2! a3! = m^2 and s((N+1)...(N+H)) = s(a!)
//!  requires analyzing prime factor anatomy, powerful numbers (n = a^2 b^3), squarefree parts s(n),
//!  and anti-sieve moment bounds on small prime divisor concentrations."

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Prime factorization anatomy summary of a positive integer
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IntegerAnatomy {
    pub n: u64,
    pub prime_factors: HashMap<u64, u32>,
    pub omega_distinct: usize, // ω(n): number of distinct prime factors
    pub big_omega_total: usize, // Ω(n): total number of prime factors with multiplicity
    pub squarefree_part: u64,  // s(n): smallest factor after dividing out perfect squares
    pub is_powerful: bool,     // True if for all p | n, p^2 | n (i.e. n = a^2 b^3)
    pub is_squarefree: bool,   // True if s(n) == n
    pub largest_prime_factor: u64,
}

pub struct IntegerAnatomyInspector;

impl IntegerAnatomyInspector {
    /// Factorize a 64-bit integer into its prime components
    pub fn factorize(mut n: u64) -> HashMap<u64, u32> {
        let mut factors = HashMap::new();
        if n <= 1 {
            return factors;
        }

        // Factor out 2
        let mut count_2 = 0;
        while n % 2 == 0 {
            count_2 += 1;
            n /= 2;
        }
        if count_2 > 0 {
            factors.insert(2, count_2);
        }

        // Factor out odd numbers up to sqrt(n)
        let mut d = 3;
        while d * d <= n {
            let mut count_d = 0;
            while n % d == 0 {
                count_d += 1;
                n /= d;
            }
            if count_d > 0 {
                factors.insert(d, count_d);
            }
            d += 2;
        }

        if n > 1 {
            factors.insert(n, 1);
        }

        factors
    }

    /// Analyze prime factor anatomy of an integer n
    pub fn analyze(n: u64) -> IntegerAnatomy {
        if n <= 1 {
            return IntegerAnatomy {
                n,
                prime_factors: HashMap::new(),
                omega_distinct: 0,
                big_omega_total: 0,
                squarefree_part: n,
                is_powerful: true,
                is_squarefree: true,
                largest_prime_factor: 1,
            };
        }

        let factors = Self::factorize(n);
        let omega_distinct = factors.len();
        let big_omega_total: usize = factors.values().map(|&c| c as usize).sum();
        let mut largest_p = 1;
        let mut squarefree_part = 1;
        let mut is_powerful = true;
        let mut is_squarefree = true;

        for (&p, &exp) in &factors {
            if p > largest_p {
                largest_p = p;
            }
            if exp < 2 {
                is_powerful = false;
            }
            if exp > 1 {
                is_squarefree = false;
            }
            if exp % 2 != 0 {
                squarefree_part *= p;
            }
        }

        IntegerAnatomy {
            n,
            prime_factors: factors,
            omega_distinct,
            big_omega_total,
            squarefree_part,
            is_powerful,
            is_squarefree,
            largest_prime_factor: largest_p,
        }
    }

    /// Compute squarefree part s(n)
    pub fn squarefree_part(n: u64) -> u64 {
        Self::analyze(n).squarefree_part
    }

    /// Checks if n is a powerful number (n = a^2 b^3)
    pub fn is_powerful_number(n: u64) -> bool {
        Self::analyze(n).is_powerful
    }

    /// Decompose a powerful number n into minimal (a, b) such that n = a^2 * b^3 with b squarefree
    pub fn powerful_decomposition(n: u64) -> Option<(u64, u64)> {
        let anatomy = Self::analyze(n);
        if !anatomy.is_powerful {
            return None;
        }

        let mut a: u64 = 1;
        let mut b: u64 = 1;

        for (&p, &exp) in &anatomy.prime_factors {
            if exp % 2 == 1 {
                // If odd power >= 3, pull out one cube p^3, and the rest is an even power (p^2)^k
                b *= p;
                let rem = exp - 3;
                let a_factor = p.pow(rem / 2);
                a *= a_factor;
            } else {
                let a_factor = p.pow(exp / 2);
                a *= a_factor;
            }
        }

        Some((a, b))
    }

    /// Checks if n is B-smooth (all prime factors <= B)
    pub fn is_b_smooth(n: u64, b: u64) -> bool {
        let anatomy = Self::analyze(n);
        anatomy.largest_prime_factor <= b
    }

    /// Computes squarefree part of consecutive integer product s((N+1)...(N+H))
    pub fn squarefree_product_interval(n: u64, h: u64) -> u64 {
        let mut total_factors: HashMap<u64, u32> = HashMap::new();
        for k in 1..=h {
            let val = n + k;
            let f = Self::factorize(val);
            for (p, exp) in f {
                *total_factors.entry(p).or_insert(0) += exp;
            }
        }

        let mut sq_part = 1;
        for (p, exp) in total_factors {
            if exp % 2 != 0 {
                sq_part *= p;
            }
        }
        sq_part
    }

    /// Anti-Sieve Score: Measures excess density of small prime factors (p <= 19)
    /// Normal numbers have ~ sum_{p <= y} 1/p divisors. Abnormally high values flag bad interval candidates.
    pub fn anti_sieve_small_prime_density(n: u64) -> f64 {
        let small_primes = [2, 3, 5, 7, 11, 13, 17, 19];
        let mut score = 0.0;
        for &p in &small_primes {
            if n % p == 0 {
                let mut multiplicity = 0;
                let mut temp = n;
                while temp % p == 0 {
                    multiplicity += 1;
                    temp /= p;
                }
                score += (multiplicity as f64) / (p as f64);
            }
        }
        score
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_integer_anatomy_factorization() {
        let anatomy = IntegerAnatomyInspector::analyze(72); // 72 = 2^3 * 3^2
        assert_eq!(anatomy.omega_distinct, 2);
        assert_eq!(anatomy.big_omega_total, 5);
        assert_eq!(anatomy.largest_prime_factor, 3);
        assert_eq!(anatomy.squarefree_part, 2); // 72 / 36 = 2
        assert!(anatomy.is_powerful); // 72 = 3^2 * 2^3
    }

    #[test]
    fn test_powerful_decomposition() {
        let (a, b) = IntegerAnatomyInspector::powerful_decomposition(72).unwrap();
        assert_eq!(a * a * b * b * b, 72);
        assert_eq!(b, 2);
        assert_eq!(a, 3);
    }

    #[test]
    fn test_erdos_graham_factorial_identity() {
        // s(8 * 9 * 10) = s(720) = 5 = s(6!)
        let s_prod = IntegerAnatomyInspector::squarefree_product_interval(7, 3); // 8, 9, 10
        let s_6fact = IntegerAnatomyInspector::squarefree_part(720);
        assert_eq!(s_prod, 5);
        assert_eq!(s_6fact, 5);
    }
}
