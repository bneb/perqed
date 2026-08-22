//! Anti-Exploit Exact Arithmetic & Sound Interval Inclusion Engine
//!
//! Terence Tao (Nov 2025 / AlphaEvolve):
//! "The Verifier Exploit Phenomenon: AI engines exploit floating-point epsilon-tolerances
//!  and boundary clipping to produce bogus mathematical solutions."
//!
//! This module completely bans IEEE 754 floating point in continuous/geometric sweeps,
//! enforcing exact BigRational arithmetic, guaranteed Arb inclusion intervals,
//! and degeneracy non-vanishing checks.

use num_bigint::BigInt;
use num_rational::BigRational;
use num_traits::{One, Zero};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ExactMathError {
    #[error("Division by zero in exact arithmetic")]
    DivisionByZero,
    #[error("Degenerate geometric configuration detected: {0}")]
    DegenerateConfiguration(String),
    #[error("Sound interval inclusion violated")]
    InclusionViolation,
}

/// Guaranteed Sound Interval Inclusion [inf, sup] over exact Rationals ℚ
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArbInterval {
    pub inf: BigRational,
    pub sup: BigRational,
}

impl ArbInterval {
    pub fn new(inf: BigRational, sup: BigRational) -> Result<Self, ExactMathError> {
        if inf > sup {
            return Err(ExactMathError::InclusionViolation);
        }
        Ok(Self { inf, sup })
    }

    pub fn point(val: BigRational) -> Self {
        Self {
            inf: val.clone(),
            sup: val,
        }
    }

    pub fn from_integers(inf: i64, sup: i64) -> Result<Self, ExactMathError> {
        Self::new(
            BigRational::from_integer(BigInt::from(inf)),
            BigRational::from_integer(BigInt::from(sup)),
        )
    }

    /// Sound interval addition: [a, b] + [c, d] = [a + c, b + d]
    pub fn add(&self, other: &Self) -> Self {
        Self {
            inf: &self.inf + &other.inf,
            sup: &self.sup + &other.sup,
        }
    }

    /// Sound interval subtraction: [a, b] - [c, d] = [a - d, b - c]
    pub fn sub(&self, other: &Self) -> Self {
        Self {
            inf: &self.inf - &other.sup,
            sup: &self.sup - &other.inf,
        }
    }

    /// Sound interval multiplication
    pub fn mul(&self, other: &Self) -> Self {
        let p1 = &self.inf * &other.inf;
        let p2 = &self.inf * &other.sup;
        let p3 = &self.sup * &other.inf;
        let p4 = &self.sup * &other.sup;

        let mut min_val = p1.clone();
        let mut max_val = p1;

        for p in [&p2, &p3, &p4] {
            if p < &min_val {
                min_val = p.clone();
            }
            if p > &max_val {
                max_val = p.clone();
            }
        }

        Self {
            inf: min_val,
            sup: max_val,
        }
    }

    /// Checks if zero is strictly excluded from interval (sound proof that value ≠ 0)
    pub fn strictly_nonzero(&self) -> bool {
        self.inf > BigRational::zero() || self.sup < BigRational::zero()
    }

    /// Checks if interval is strictly positive
    pub fn strictly_positive(&self) -> bool {
        self.inf > BigRational::zero()
    }

    /// Checks if a rational point is contained within the interval
    pub fn contains(&self, point: &BigRational) -> bool {
        &self.inf <= point && point <= &self.sup
    }
}

/// Exact Geometric & Algebraic Degeneracy Validator
pub struct DegeneracyChecker;

impl DegeneracyChecker {
    /// Exact determinant calculation via Bareiss fraction-free algorithm over BigRational
    pub fn exact_determinant(matrix: &[Vec<BigRational>]) -> Result<BigRational, ExactMathError> {
        let n = matrix.len();
        if n == 0 || matrix.iter().any(|row| row.len() != n) {
            return Err(ExactMathError::DegenerateConfiguration(
                "Matrix must be non-empty and square".to_string(),
            ));
        }

        if n == 1 {
            return Ok(matrix[0][0].clone());
        }

        if n == 2 {
            let det = (&matrix[0][0] * &matrix[1][1]) - (&matrix[0][1] * &matrix[1][0]);
            return Ok(det);
        }

        // Gaussian elimination with exact rational pivoting
        let mut a = matrix.to_vec();
        let mut det = BigRational::one();

        for i in 0..n {
            // Find pivot
            let mut pivot_row = i;
            while pivot_row < n && a[pivot_row][i].is_zero() {
                pivot_row += 1;
            }

            if pivot_row == n {
                return Ok(BigRational::zero());
            }

            if pivot_row != i {
                a.swap(i, pivot_row);
                det = -det;
            }

            let pivot = a[i][i].clone();
            det *= &pivot;

            for j in (i + 1)..n {
                let factor = &a[j][i] / &pivot;
                for k in i..n {
                    let sub = &factor * &a[i][k];
                    a[j][k] -= sub;
                }
            }
        }

        Ok(det)
    }

    /// Validates pairwise distinct geometric points in exact coordinates (prevents vertex-clipping exploits)
    pub fn check_pairwise_separation(points: &[Vec<BigRational>]) -> Result<(), ExactMathError> {
        for i in 0..points.len() {
            for j in (i + 1)..points.len() {
                let p1 = &points[i];
                let p2 = &points[j];

                if p1.len() != p2.len() {
                    return Err(ExactMathError::DegenerateConfiguration(
                        "Point dimension mismatch".to_string(),
                    ));
                }

                let mut dist_sq = BigRational::zero();
                for k in 0..p1.len() {
                    let diff = &p1[k] - &p2[k];
                    dist_sq += &diff * &diff;
                }

                if dist_sq.is_zero() {
                    return Err(ExactMathError::DegenerateConfiguration(format!(
                        "Pairwise vertex separation exploit detected: points {} and {} coincide at same coordinate",
                        i, j
                    )));
                }
            }
        }
        Ok(())
    }

    /// Verifies non-vanishing polynomial denominators on exact evaluation point
    pub fn check_denominator_non_vanishing(denom: &BigRational) -> Result<(), ExactMathError> {
        if denom.is_zero() {
            return Err(ExactMathError::DivisionByZero);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_interval_arithmetic() {
        let i1 = ArbInterval::from_integers(2, 4).unwrap();
        let i2 = ArbInterval::from_integers(3, 5).unwrap();

        let sum = i1.add(&i2);
        assert_eq!(sum.inf, BigRational::from_integer(BigInt::from(5)));
        assert_eq!(sum.sup, BigRational::from_integer(BigInt::from(9)));

        let prod = i1.mul(&i2);
        assert_eq!(prod.inf, BigRational::from_integer(BigInt::from(6)));
        assert_eq!(prod.sup, BigRational::from_integer(BigInt::from(20)));
        assert!(prod.strictly_positive());
    }

    #[test]
    fn test_exact_matrix_determinant_no_float_exploit() {
        // 3x3 Singular matrix
        let mat = vec![
            vec![BigRational::from_integer(1.into()), BigRational::from_integer(2.into()), BigRational::from_integer(3.into())],
            vec![BigRational::from_integer(4.into()), BigRational::from_integer(5.into()), BigRational::from_integer(6.into())],
            vec![BigRational::from_integer(7.into()), BigRational::from_integer(8.into()), BigRational::from_integer(9.into())],
        ];

        let det = DegeneracyChecker::exact_determinant(&mat).unwrap();
        assert!(det.is_zero(), "Collinear matrix determinant must be exactly 0, not 1e-16");
    }

    #[test]
    fn test_pairwise_vertex_separation_catches_cheating() {
        let p1 = vec![BigRational::from_integer(1.into()), BigRational::from_integer(0.into())];
        let p2 = vec![BigRational::from_integer(1.into()), BigRational::from_integer(0.into())];

        let res = DegeneracyChecker::check_pairwise_separation(&[p1, p2]);
        assert!(res.is_err());
    }
}
