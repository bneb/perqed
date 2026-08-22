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

/// Exact element in the quadratic field extension ℚ[√2] represented as a + b√2 (a, b ∈ ℚ)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuadraticFieldQ2 {
    pub a: BigRational, // Rational component
    pub b: BigRational, // √2 coefficient
}

impl QuadraticFieldQ2 {
    pub fn new(a: BigRational, b: BigRational) -> Self {
        Self { a, b }
    }

    pub fn rational(r: BigRational) -> Self {
        Self {
            a: r,
            b: BigRational::zero(),
        }
    }

    pub fn from_integers(a: i64, b: i64) -> Self {
        Self {
            a: BigRational::from_integer(BigInt::from(a)),
            b: BigRational::from_integer(BigInt::from(b)),
        }
    }

    pub fn zero() -> Self {
        Self::from_integers(0, 0)
    }

    pub fn one() -> Self {
        Self::from_integers(1, 0)
    }

    pub fn sqrt2() -> Self {
        Self::from_integers(0, 1)
    }

    pub fn is_zero(&self) -> bool {
        self.a.is_zero() && self.b.is_zero()
    }

    pub fn is_one(&self) -> bool {
        self.a.is_one() && self.b.is_zero()
    }

    pub fn add(&self, other: &Self) -> Self {
        Self {
            a: &self.a + &other.a,
            b: &self.b + &other.b,
        }
    }

    pub fn sub(&self, other: &Self) -> Self {
        Self {
            a: &self.a - &other.a,
            b: &self.b - &other.b,
        }
    }

    /// (a1 + b1√2)(a2 + b2√2) = (a1*a2 + 2*b1*b2) + (a1*b2 + a2*b1)√2
    pub fn mul(&self, other: &Self) -> Self {
        let two = BigRational::from_integer(BigInt::from(2));
        let rational_part = (&self.a * &other.a) + (&two * &self.b * &other.b);
        let sqrt2_part = (&self.a * &other.b) + (&self.b * &other.a);
        Self {
            a: rational_part,
            b: sqrt2_part,
        }
    }

    pub fn sqr(&self) -> Self {
        self.mul(self)
    }

    pub fn norm(&self) -> BigRational {
        let two = BigRational::from_integer(BigInt::from(2));
        &self.a * &self.a - &two * &self.b * &self.b
    }

    pub fn inv(&self) -> Result<Self, ExactMathError> {
        let n = self.norm();
        if n.is_zero() {
            return Err(ExactMathError::DivisionByZero);
        }
        Ok(Self {
            a: &self.a / &n,
            b: -&self.b / &n,
        })
    }
}

/// 2D Point with exact coordinates in (ℚ[√2])²
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Point2DQ2 {
    pub x: QuadraticFieldQ2,
    pub y: QuadraticFieldQ2,
}

impl Point2DQ2 {
    pub fn new(x: QuadraticFieldQ2, y: QuadraticFieldQ2) -> Self {
        Self { x, y }
    }

    pub fn origin() -> Self {
        Self {
            x: QuadraticFieldQ2::zero(),
            y: QuadraticFieldQ2::zero(),
        }
    }

    /// Exact Euclidean distance squared in ℚ[√2]: (x1 - x2)² + (y1 - y2)²
    pub fn dist_sq(&self, other: &Self) -> QuadraticFieldQ2 {
        let dx = self.x.sub(&other.x);
        let dy = self.y.sub(&other.y);
        dx.sqr().add(&dy.sqr())
    }

    /// Checks if distance between two points is exactly 1 (unit distance)
    pub fn is_unit_distance(&self, other: &Self) -> bool {
        self.dist_sq(other).is_one()
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

    #[test]
    fn test_quadratic_field_exact_arithmetic() {
        // (1 + √2)(1 - √2) = 1 - 2 = -1
        let z1 = QuadraticFieldQ2::from_integers(1, 1);
        let z2 = QuadraticFieldQ2::from_integers(1, -1);
        let prod = z1.mul(&z2);

        assert_eq!(prod.a, BigRational::from_integer(BigInt::from(-1)));
        assert!(prod.b.is_zero());
        assert_eq!(z1.norm(), BigRational::from_integer(BigInt::from(-1)));

        // (1 + √2) * (1 + √2) = 1 + 2√2 + 2 = 3 + 2√2
        let sq = z1.sqr();
        assert_eq!(sq.a, BigRational::from_integer(BigInt::from(3)));
        assert_eq!(sq.b, BigRational::from_integer(BigInt::from(2)));
    }

    #[test]
    fn test_point2d_qsqrt2_unit_distance() {
        let half = BigRational::new(1.into(), 2.into());
        // p1 = (0, 0), p2 = (√2/2, √2/2) => dist^2 = (√2/2)^2 + (√2/2)^2 = 2/4 + 2/4 = 1
        let p1 = Point2DQ2::origin();
        let p2 = Point2DQ2::new(
            QuadraticFieldQ2::new(BigRational::zero(), half.clone()),
            QuadraticFieldQ2::new(BigRational::zero(), half),
        );

        assert!(p1.is_unit_distance(&p2), "Distance between (0, 0) and (√2/2, √2/2) must be exactly 1");
    }
}
