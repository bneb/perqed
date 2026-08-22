//! Generic Algebraic Number Field Engine: ℚ[x] / ⟨p(x)⟩
//!
//! Provides exact arithmetic over arbitrary algebraic number fields K = ℚ(α)
//! defined by a minimal irreducible polynomial p(x) ∈ ℚ[x].
//!
//! Elements are represented in the canonical power basis {1, α, α², ..., α^{d-1}}.
//! Inversion uses the polynomial Extended Euclidean Algorithm:
//! gcd(A(x), p(x)) = 1 ⟹ A(x)·U(x) + p(x)·V(x) = 1 ⟹ A(x)⁻¹ ≡ U(x) (mod p(x)).

use num_bigint::BigInt;
use num_rational::BigRational;
use num_traits::{One, Zero};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum AlgebraicFieldError {
    #[error("Division by zero in algebraic number field")]
    DivisionByZero,
    #[error("Incompatible algebraic number fields: {0} vs {1}")]
    IncompatibleFields(String, String),
    #[error("Zero polynomial divisor")]
    ZeroPolynomialDivisor,
}

/// Represents an Algebraic Number Field K = ℚ[x] / ⟨p(x)⟩
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AlgebraicNumberField {
    pub name: String,
    /// Minimal polynomial coefficients in ascending power order:
    /// p(x) = c_0 + c_1 x + ... + c_d x^d
    /// Must be monic (c_d = 1) and degree d ≥ 1.
    pub min_poly: Vec<BigRational>,
    pub degree: usize,
}

impl AlgebraicNumberField {
    pub fn new(name: impl Into<String>, min_poly: Vec<BigRational>) -> Arc<Self> {
        let mut p = min_poly;
        while p.len() > 1 && p.last().map_or(false, |c| c.is_zero()) {
            p.pop();
        }
        assert!(p.len() >= 2, "Minimal polynomial must have degree at least 1");
        let degree = p.len() - 1;
        let lead = p[degree].clone();
        assert!(!lead.is_zero(), "Leading coefficient must be non-zero");

        // Make monic
        let monic_poly: Vec<BigRational> = p.iter().map(|c| c / &lead).collect();

        Arc::new(Self {
            name: name.into(),
            min_poly: monic_poly,
            degree,
        })
    }

    /// ℚ: Rational field (degree 1, p(x) = x)
    pub fn qq() -> Arc<Self> {
        Self::new("QQ", vec![BigRational::zero(), BigRational::one()])
    }

    /// ℚ(√n): Quadratic field extension (p(x) = x² - n)
    pub fn sqrt(n: i64) -> Arc<Self> {
        Self::new(
            format!("QQ[sqrt({n})]"),
            vec![
                BigRational::from_integer(BigInt::from(-n)),
                BigRational::zero(),
                BigRational::one(),
            ],
        )
    }

    /// ℚ(∛n): Cubic field extension (p(x) = x³ - n)
    pub fn cbrt(n: i64) -> Arc<Self> {
        Self::new(
            format!("QQ[cbrt({n})]"),
            vec![
                BigRational::from_integer(BigInt::from(-n)),
                BigRational::zero(),
                BigRational::zero(),
                BigRational::one(),
            ],
        )
    }

    /// ℚ(ζ₅): 5th Cyclotomic field (p(x) = x⁴ + x³ + x² + x + 1)
    pub fn cyclotomic_5() -> Arc<Self> {
        Self::new(
            "QQ[zeta_5]",
            vec![
                BigRational::one(),
                BigRational::one(),
                BigRational::one(),
                BigRational::one(),
                BigRational::one(),
            ],
        )
    }
}

/// Element of an Algebraic Number Field K = ℚ(α)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlgebraicNumber {
    /// Coefficients in basis [1, α, α², ..., α^{d-1}]
    pub coeffs: Vec<BigRational>,
    pub field: Arc<AlgebraicNumberField>,
}

impl PartialEq for AlgebraicNumber {
    fn eq(&self, other: &Self) -> bool {
        self.field.name == other.field.name && self.coeffs == other.coeffs
    }
}

impl Eq for AlgebraicNumber {}

impl AlgebraicNumber {
    pub fn new(mut coeffs: Vec<BigRational>, field: Arc<AlgebraicNumberField>) -> Self {
        // Pad or truncate to field degree
        coeffs.resize(field.degree, BigRational::zero());
        Self { coeffs, field }
    }

    pub fn zero(field: Arc<AlgebraicNumberField>) -> Self {
        Self::new(vec![BigRational::zero(); field.degree], field)
    }

    pub fn one(field: Arc<AlgebraicNumberField>) -> Self {
        let mut coeffs = vec![BigRational::zero(); field.degree];
        coeffs[0] = BigRational::one();
        Self::new(coeffs, field)
    }

    pub fn generator(field: Arc<AlgebraicNumberField>) -> Self {
        assert!(field.degree >= 2, "Generator requires degree >= 2");
        let mut coeffs = vec![BigRational::zero(); field.degree];
        coeffs[1] = BigRational::one();
        Self::new(coeffs, field)
    }

    pub fn from_rational(r: BigRational, field: Arc<AlgebraicNumberField>) -> Self {
        let mut coeffs = vec![BigRational::zero(); field.degree];
        coeffs[0] = r;
        Self::new(coeffs, field)
    }

    pub fn from_integers(ints: &[i64], field: Arc<AlgebraicNumberField>) -> Self {
        let coeffs: Vec<BigRational> = ints
            .iter()
            .map(|&i| BigRational::from_integer(BigInt::from(i)))
            .collect();
        Self::new(coeffs, field)
    }

    pub fn is_zero(&self) -> bool {
        self.coeffs.iter().all(|c| c.is_zero())
    }

    pub fn is_one(&self) -> bool {
        if self.coeffs.is_empty() || !self.coeffs[0].is_one() {
            return false;
        }
        self.coeffs[1..].iter().all(|c| c.is_zero())
    }

    pub fn add(&self, other: &Self) -> Self {
        assert_eq!(self.field.name, other.field.name);
        let mut res = vec![BigRational::zero(); self.field.degree];
        for i in 0..self.field.degree {
            res[i] = &self.coeffs[i] + &other.coeffs[i];
        }
        Self::new(res, self.field.clone())
    }

    pub fn sub(&self, other: &Self) -> Self {
        assert_eq!(self.field.name, other.field.name);
        let mut res = vec![BigRational::zero(); self.field.degree];
        for i in 0..self.field.degree {
            res[i] = &self.coeffs[i] - &other.coeffs[i];
        }
        Self::new(res, self.field.clone())
    }

    /// Exact polynomial multiplication followed by reduction modulo min_poly
    pub fn mul(&self, other: &Self) -> Self {
        assert_eq!(self.field.name, other.field.name);
        let d = self.field.degree;
        let mut raw_prod = vec![BigRational::zero(); 2 * d - 1];

        for i in 0..d {
            for j in 0..d {
                raw_prod[i + j] += &self.coeffs[i] * &other.coeffs[j];
            }
        }

        let reduced = poly_rem(&raw_prod, &self.field.min_poly);
        Self::new(reduced, self.field.clone())
    }

    pub fn sqr(&self) -> Self {
        self.mul(self)
    }

    /// Multiplicative inverse via Polynomial Extended Euclidean Algorithm
    pub fn inv(&self) -> Result<Self, AlgebraicFieldError> {
        if self.is_zero() {
            return Err(AlgebraicFieldError::DivisionByZero);
        }

        let u = poly_ext_gcd_inv(&self.coeffs, &self.field.min_poly)?;
        Ok(Self::new(u, self.field.clone()))
    }

    pub fn div(&self, other: &Self) -> Result<Self, AlgebraicFieldError> {
        let other_inv = other.inv()?;
        Ok(self.mul(&other_inv))
    }
}

/// Exact 2D point with coordinates in an Algebraic Number Field K
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Point2DAlgebraic {
    pub x: AlgebraicNumber,
    pub y: AlgebraicNumber,
}

impl Point2DAlgebraic {
    pub fn new(x: AlgebraicNumber, y: AlgebraicNumber) -> Self {
        assert_eq!(x.field.name, y.field.name);
        Self { x, y }
    }

    pub fn origin(field: Arc<AlgebraicNumberField>) -> Self {
        Self {
            x: AlgebraicNumber::zero(field.clone()),
            y: AlgebraicNumber::zero(field),
        }
    }

    pub fn dist_sq(&self, other: &Self) -> AlgebraicNumber {
        let dx = self.x.sub(&other.x);
        let dy = self.y.sub(&other.y);
        dx.sqr().add(&dy.sqr())
    }

    pub fn is_unit_distance(&self, other: &Self) -> bool {
        self.dist_sq(other).is_one()
    }
}

// ---------------------------------------------------------------------------
// Exact Polynomial Arithmetic Helpers
// ---------------------------------------------------------------------------

fn trim_poly(p: &[BigRational]) -> &[BigRational] {
    let mut end = p.len();
    while end > 0 && p[end - 1].is_zero() {
        end -= 1;
    }
    &p[..end]
}

/// Polynomial remainder A(x) mod B(x) over ℚ
fn poly_rem(a: &[BigRational], b: &[BigRational]) -> Vec<BigRational> {
    let b_trimmed = trim_poly(b);
    if b_trimmed.is_empty() {
        panic!("Division by zero polynomial");
    }

    let mut rem = a.to_vec();
    let b_deg = b_trimmed.len() - 1;
    let b_lead = &b_trimmed[b_deg];

    while rem.len() > b_deg {
        let cur_deg = rem.len() - 1;
        let lead_coeff = rem.pop().unwrap();
        if lead_coeff.is_zero() {
            continue;
        }

        let factor = &lead_coeff / b_lead;
        let deg_diff = cur_deg - b_deg;

        for i in 0..b_deg {
            rem[i + deg_diff] -= &factor * &b_trimmed[i];
        }
    }

    rem
}

/// Polynomial Division A(x) = Q(x)·B(x) + R(x)
fn poly_div_rem(a: &[BigRational], b: &[BigRational]) -> (Vec<BigRational>, Vec<BigRational>) {
    let b_trimmed = trim_poly(b);
    if b_trimmed.is_empty() {
        panic!("Division by zero polynomial");
    }

    let a_trimmed = trim_poly(a);
    if a_trimmed.len() < b_trimmed.len() {
        return (vec![BigRational::zero()], a_trimmed.to_vec());
    }

    let b_deg = b_trimmed.len() - 1;
    let b_lead = &b_trimmed[b_deg];

    let mut rem = a_trimmed.to_vec();
    let q_deg = a_trimmed.len() - b_trimmed.len();
    let mut quot = vec![BigRational::zero(); q_deg + 1];

    while rem.len() >= b_trimmed.len() {
        let cur_deg = rem.len() - 1;
        let lead_coeff = rem[cur_deg].clone();
        if lead_coeff.is_zero() {
            rem.pop();
            continue;
        }

        let factor = &lead_coeff / b_lead;
        let deg_diff = cur_deg - b_deg;
        quot[deg_diff] = factor.clone();

        for i in 0..=b_deg {
            rem[i + deg_diff] -= &factor * &b_trimmed[i];
        }
        while rem.last().map_or(false, |c| c.is_zero()) {
            rem.pop();
        }
    }

    (quot, rem)
}

fn poly_sub(a: &[BigRational], b: &[BigRational]) -> Vec<BigRational> {
    let max_len = a.len().max(b.len());
    let mut res = vec![BigRational::zero(); max_len];
    for i in 0..a.len() {
        res[i] += &a[i];
    }
    for i in 0..b.len() {
        res[i] -= &b[i];
    }
    while res.len() > 1 && res.last().map_or(false, |c| c.is_zero()) {
        res.pop();
    }
    res
}

fn poly_mul(a: &[BigRational], b: &[BigRational]) -> Vec<BigRational> {
    let a_trim = trim_poly(a);
    let b_trim = trim_poly(b);
    if a_trim.is_empty() || b_trim.is_empty() {
        return vec![BigRational::zero()];
    }
    let mut res = vec![BigRational::zero(); a_trim.len() + b_trim.len() - 1];
    for i in 0..a_trim.len() {
        for j in 0..b_trim.len() {
            res[i + j] += &a_trim[i] * &b_trim[j];
        }
    }
    res
}

/// Compute modular inverse U(x) such that A(x)·U(x) ≡ 1 (mod P(x))
fn poly_ext_gcd_inv(a: &[BigRational], p: &[BigRational]) -> Result<Vec<BigRational>, AlgebraicFieldError> {
    let mut r0 = p.to_vec();
    let mut r1 = a.to_vec();
    let mut s0 = vec![BigRational::zero()];
    let mut s1 = vec![BigRational::one()];

    while !trim_poly(&r1).is_empty() {
        let (q, r2) = poly_div_rem(&r0, &r1);
        let s2 = poly_sub(&s0, &poly_mul(&q, &s1));

        r0 = r1;
        r1 = r2;
        s0 = s1;
        s1 = s2;
    }

    let r_trim = trim_poly(&r0);
    if r_trim.len() != 1 || r_trim[0].is_zero() {
        return Err(AlgebraicFieldError::DivisionByZero);
    }

    let gcd_const = &r_trim[0];
    let inv_poly: Vec<BigRational> = s0.iter().map(|c| c / gcd_const).collect();
    let reduced = poly_rem(&inv_poly, p);
    Ok(reduced)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quadratic_field_sqrt2_arithmetic() {
        let q_sqrt2 = AlgebraicNumberField::sqrt(2);
        // alpha = sqrt(2)
        let alpha = AlgebraicNumber::generator(q_sqrt2.clone());

        // alpha^2 should equal 2
        let alpha_sq = alpha.sqr();
        assert_eq!(alpha_sq.coeffs[0], BigRational::from_integer(2.into()));
        assert_eq!(alpha_sq.coeffs[1], BigRational::zero());

        // Invert (1 + sqrt(2)): (1 + sqrt(2)) * (-1 + sqrt(2)) = -1 + 2 = 1
        // So (1 + sqrt(2))^-1 = -1 + sqrt(2)
        let val = AlgebraicNumber::from_integers(&[1, 1], q_sqrt2.clone());
        let val_inv = val.inv().unwrap();
        assert_eq!(val_inv.coeffs[0], BigRational::from_integer((-1).into()));
        assert_eq!(val_inv.coeffs[1], BigRational::from_integer(1.into()));

        let prod = val.mul(&val_inv);
        assert!(prod.is_one());
    }

    #[test]
    fn test_cubic_field_cbrt2_arithmetic() {
        let q_cbrt2 = AlgebraicNumberField::cbrt(2);
        let alpha = AlgebraicNumber::generator(q_cbrt2.clone());

        // alpha^3 should equal 2
        let alpha_cb = alpha.sqr().mul(&alpha);
        assert_eq!(alpha_cb.coeffs[0], BigRational::from_integer(2.into()));
        assert_eq!(alpha_cb.coeffs[1], BigRational::zero());
        assert_eq!(alpha_cb.coeffs[2], BigRational::zero());

        // Invert (1 + alpha)
        let val = AlgebraicNumber::from_integers(&[1, 1, 0], q_cbrt2.clone());
        let val_inv = val.inv().unwrap();
        let prod = val.mul(&val_inv);
        assert!(prod.is_one(), "Product of element and its inverse must be exactly 1");
    }

    #[test]
    fn test_point2d_algebraic_unit_distance() {
        let q_sqrt2 = AlgebraicNumberField::sqrt(2);
        // Point (sqrt(2)/2, sqrt(2)/2)
        let half = BigRational::new(1.into(), 2.into());
        let half_sqrt2 = AlgebraicNumber::new(vec![BigRational::zero(), half], q_sqrt2.clone());

        let p1 = Point2DAlgebraic::new(half_sqrt2.clone(), half_sqrt2);
        let origin = Point2DAlgebraic::origin(q_sqrt2);

        assert!(origin.is_unit_distance(&p1));
    }
}
