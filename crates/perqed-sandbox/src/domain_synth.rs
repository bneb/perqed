//! Generic Algebraic Number Field Engine: ℚ[x] / ⟨p(x)⟩
//!
//! Provides exact arithmetic over arbitrary algebraic number fields K = ℚ(α)
//! defined by a minimal irreducible polynomial p(x) ∈ ℚ[x].
//!
//! Elements are represented in the canonical power basis {1, α, α², ..., α^{d-1}}.
//! Inversion uses the polynomial Extended Euclidean Algorithm:
//! gcd(A(x), p(x)) = 1 ⟹ A(x)·U(x) + p(x)·V(x) = 1 ⟹ A(x)⁻¹ ≡ U(x) (mod p(x)).
//!
//! Governance guarantees (v2.3):
//! - Every field is constructed through [`AlgebraicNumberField::try_new`], which
//!   **certifies irreducibility over ℚ** before the field exists. Reducible
//!   polynomials (e.g. x² − 1) are rejected outright; a field built on a
//!   reducible modulus would make inversion ill-defined.
//! - Certification (see [`certify_irreducible`]) tries four sound certificates
//!   in order: reduction mod a prime p (Gauss; exhaustive over the first 54
//!   primes — note x⁴+1 and Φ₁₂ factor mod every prime, so this alone is
//!   insufficient), Eisenstein's criterion on shifted polynomials, a complete
//!   quartic split test via the resolvent cubic, and the rational root test
//!   (complete for degrees 2 and 3). Exhaustion fails safe as Unverified —
//!   never a false accept.
//! - Deserialization re-runs certification, so a reducible "field" cannot be
//!   smuggled into a hash-locked certificate JSON.
//! - Field identity is the minimal polynomial, not the display name.
//!
//! [`AlgebraicNumberField::from_spec`] instantiates fields from discovery JSON
//! specs: `"QQ"`, `"QQ[sqrt(2)]"`, `"QQ[cbrt(2)]"`, `"QQ[zeta_5]"`.

use num_bigint::BigInt;
use num_rational::BigRational;
use num_traits::{One, Signed, ToPrimitive, Zero};
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt;
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
    #[error("Invalid field specification: {0}")]
    InvalidFieldSpec(String),
    #[error("Polynomial is reducible over ℚ: {0}")]
    ReduciblePolynomial(String),
    #[error("Irreducibility over ℚ could not be certified for: {0}")]
    UnverifiedIrreducibility(String),
}

/// Parsed discovery-JSON field specification, e.g. `"QQ[cbrt(2)]"`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FieldSpec {
    Qq,
    Sqrt(i64),
    Cbrt(i64),
    Cyclotomic(u32),
}

impl FieldSpec {
    pub fn parse(spec: &str) -> Result<Self, AlgebraicFieldError> {
        let s = spec.trim();
        if s == "QQ" {
            return Ok(FieldSpec::Qq);
        }
        let err = || AlgebraicFieldError::InvalidFieldSpec(s.to_string());
        let inner = s
            .strip_prefix("QQ[")
            .ok_or_else(err)?
            .strip_suffix(']')
            .ok_or_else(err)?;
        if let Some(rad) = inner.strip_prefix("sqrt(") {
            let n: i64 = rad.strip_suffix(')').ok_or_else(err)?.trim().parse().map_err(|_| err())?;
            Ok(FieldSpec::Sqrt(n))
        } else if let Some(rad) = inner.strip_prefix("cbrt(") {
            let n: i64 = rad.strip_suffix(')').ok_or_else(err)?.trim().parse().map_err(|_| err())?;
            Ok(FieldSpec::Cbrt(n))
        } else if let Some(z) = inner.strip_prefix("zeta_") {
            let n: u32 = z.trim().parse().map_err(|_| err())?;
            if n == 0 {
                return Err(err());
            }
            Ok(FieldSpec::Cyclotomic(n))
        } else {
            Err(err())
        }
    }

    pub fn to_field(&self) -> Result<Arc<AlgebraicNumberField>, AlgebraicFieldError> {
        match self {
            FieldSpec::Qq => Ok(AlgebraicNumberField::qq()),
            FieldSpec::Sqrt(n) => AlgebraicNumberField::try_new(
                format!("QQ[sqrt({n})]"),
                vec![
                    BigRational::from_integer(BigInt::from(-*n)),
                    BigRational::zero(),
                    BigRational::one(),
                ],
            ),
            FieldSpec::Cbrt(n) => AlgebraicNumberField::try_new(
                format!("QQ[cbrt({n})]"),
                vec![
                    BigRational::from_integer(BigInt::from(-*n)),
                    BigRational::zero(),
                    BigRational::zero(),
                    BigRational::one(),
                ],
            ),
            FieldSpec::Cyclotomic(n) => AlgebraicNumberField::cyclotomic(*n),
        }
    }
}

/// Represents an Algebraic Number Field K = ℚ[x] / ⟨p(x)⟩
///
/// Identity of a field is its (monic, certified-irreducible) minimal
/// polynomial — the display name is only a label.
#[derive(Debug, Clone, Serialize)]
pub struct AlgebraicNumberField {
    pub name: String,
    /// Minimal polynomial coefficients in ascending power order:
    /// p(x) = c_0 + c_1 x + ... + c_d x^d. Always monic (c_d = 1), degree d ≥ 1.
    pub min_poly: Vec<BigRational>,
    pub degree: usize,
}

impl PartialEq for AlgebraicNumberField {
    fn eq(&self, other: &Self) -> bool {
        self.min_poly == other.min_poly
    }
}

impl Eq for AlgebraicNumberField {}

impl AlgebraicNumberField {
    /// Validating constructor: monicizes and certifies irreducibility over ℚ.
    /// Returns Err for degree-0 input, reducible polynomials, or polynomials
    /// whose irreducibility cannot be certified.
    pub fn try_new(
        name: impl Into<String>,
        min_poly: Vec<BigRational>,
    ) -> Result<Arc<Self>, AlgebraicFieldError> {
        let name = name.into();
        let mut p = min_poly;
        while p.len() > 1 && p.last().is_some_and(|c| c.is_zero()) {
            p.pop();
        }
        if p.len() < 2 {
            return Err(AlgebraicFieldError::InvalidFieldSpec(format!(
                "{name}: minimal polynomial must have degree at least 1"
            )));
        }
        let lead = p.last().cloned().unwrap();
        let monic: Vec<BigRational> = p.into_iter().map(|c| c / &lead).collect();
        let degree = monic.len() - 1;

        certify_irreducible(&monic).map_err(|failure| match failure {
            CertFailure::Reducible => {
                AlgebraicFieldError::ReduciblePolynomial(format!("{monic:?}"))
            }
            CertFailure::Unverified => {
                AlgebraicFieldError::UnverifiedIrreducibility(format!("{monic:?}"))
            }
        })?;

        Ok(Arc::new(Self {
            name,
            min_poly: monic,
            degree,
        }))
    }

    /// Convenience constructor; panics on invalid input (use [`try_new`] for governance paths).
    pub fn new(name: impl Into<String>, min_poly: Vec<BigRational>) -> Arc<Self> {
        Self::try_new(name, min_poly)
            .expect("algebraic field construction failed: polynomial reducible or uncertifiable")
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

    /// ℚ(ζ_n): n-th cyclotomic field, Φ_n(x) generated by exact division of xⁿ - 1.
    pub fn cyclotomic(n: u32) -> Result<Arc<Self>, AlgebraicFieldError> {
        if n == 0 {
            return Err(AlgebraicFieldError::InvalidFieldSpec("QQ[zeta_0]".into()));
        }
        if n > 128 {
            return Err(AlgebraicFieldError::InvalidFieldSpec(format!(
                "QQ[zeta_{n}]: n > 128 exceeds certification budget"
            )));
        }
        let poly = cyclotomic_poly(n);
        Self::try_new(format!("QQ[zeta_{n}]"), poly)
    }

    /// ℚ(ζ₅): 5th Cyclotomic field (p(x) = x⁴ + x³ + x² + x + 1)
    pub fn cyclotomic_5() -> Arc<Self> {
        Self::cyclotomic(5).expect("Phi_5 is irreducible over Q")
    }

    /// Instantiate a field from a discovery-JSON spec string.
    pub fn from_spec(spec: &str) -> Result<Arc<Self>, AlgebraicFieldError> {
        FieldSpec::parse(spec)?.to_field()
    }
}

impl<'de> Deserialize<'de> for AlgebraicNumberField {
    /// Re-certifies irreducibility on deserialization: a reducible polynomial
    /// smuggled into a certificate JSON is rejected, not silently accepted.
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Raw {
            name: String,
            min_poly: Vec<BigRational>,
        }
        let raw = Raw::deserialize(d)?;
        let arc = AlgebraicNumberField::try_new(raw.name, raw.min_poly)
            .map_err(serde::de::Error::custom)?;
        Arc::try_unwrap(arc)
            .map_err(|_| serde::de::Error::custom("field arc unexpectedly shared during deserialization"))
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
        self.field == other.field && self.coeffs == other.coeffs
    }
}

impl Eq for AlgebraicNumber {}

impl fmt::Display for AlgebraicNumber {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut terms: Vec<(bool, String)> = Vec::new();
        for (i, c) in self.coeffs.iter().enumerate().rev() {
            if c.is_zero() {
                continue;
            }
            let unit = match i {
                0 => String::new(),
                1 => "α".to_string(),
                _ => format!("α^{i}"),
            };
            let negative = c.is_negative();
            let abs_c = c.abs();
            let coeff = if i == 0 {
                format!("{abs_c}")
            } else if abs_c.is_one() {
                unit.clone()
            } else {
                format!("{abs_c}{unit}")
            };
            terms.push((negative, coeff));
        }
        if terms.is_empty() {
            return write!(f, "0");
        }
        let (first_neg, first) = &terms[0];
        if *first_neg {
            write!(f, "−{first}")?;
        } else {
            write!(f, "{first}")?;
        }
        for (neg, t) in &terms[1..] {
            if *neg {
                write!(f, " − {t}")?;
            } else {
                write!(f, " + {t}")?;
            }
        }
        Ok(())
    }
}

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

    pub fn neg(&self) -> Self {
        let coeffs = self.coeffs.iter().map(|c| -c).collect();
        Self::new(coeffs, self.field.clone())
    }

    pub fn add(&self, other: &Self) -> Self {
        assert_eq!(self.field, other.field);
        let res: Vec<BigRational> = self
            .coeffs
            .iter()
            .zip(&other.coeffs)
            .map(|(a, b)| a + b)
            .collect();
        Self::new(res, self.field.clone())
    }

    pub fn sub(&self, other: &Self) -> Self {
        assert_eq!(self.field, other.field);
        let res: Vec<BigRational> = self
            .coeffs
            .iter()
            .zip(&other.coeffs)
            .map(|(a, b)| a - b)
            .collect();
        Self::new(res, self.field.clone())
    }

    /// Exact polynomial multiplication followed by reduction modulo min_poly
    pub fn mul(&self, other: &Self) -> Self {
        assert_eq!(self.field, other.field);
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

    /// Fast exponentiation by square-and-multiply (exact)
    pub fn pow(&self, mut exp: u64) -> Self {
        let mut result = Self::one(self.field.clone());
        let mut base = self.clone();
        while exp > 0 {
            if exp & 1 == 1 {
                result = result.mul(&base);
            }
            exp >>= 1;
            if exp > 0 {
                base = base.sqr();
            }
        }
        result
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
        assert_eq!(x.field, y.field);
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
// Exact Polynomial Arithmetic Helpers (over ℚ)
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
        while rem.last().is_some_and(|c| c.is_zero()) {
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
    while res.len() > 1 && res.last().is_some_and(|c| c.is_zero()) {
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

// ---------------------------------------------------------------------------
// Irreducibility Certification over ℚ
// ---------------------------------------------------------------------------

enum CertFailure {
    Reducible,
    Unverified,
}

/// First 54 primes (2..=251) for the mod-p certification search.
const PRIMES: [u64; 54] = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89,
    97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181,
    191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251,
];

/// Certify that the monic polynomial is irreducible over ℚ.
///
/// Sound certificates, tried in order:
/// 1. Reduction mod a prime p (Gauss: irreducible mod p ⟹ irreducible over ℚ).
///    A reducible-over-ℚ polynomial is reducible mod every prime, so a failed
///    search is either "no small certifying prime" or genuine reducibility.
///    Note this alone cannot certify e.g. x⁴+1 or Φ₁₂ = x⁴−x²+1, which factor
///    mod every prime while being irreducible over ℚ.
/// 2. Eisenstein's criterion on a shifted polynomial f(x + s), s ∈ [−4, 4].
///    Catches the x⁴+1 class: (x+1)⁴+1 is Eisenstein at p = 2.
/// 3. Degree-4 quadratic-factor test via the resolvent cubic — complete:
///    a monic quartic is reducible over ℚ iff it has a rational root (caught
///    by certificate 1) or splits into two quadratics over ℚ (this test).
/// 4. Rational root test — complete for degrees 2 and 3.
///
/// Exhaustion of all certificates fails safe as Unverified (never a false accept).
fn certify_irreducible(poly: &[BigRational]) -> Result<(), CertFailure> {
    let d = poly.len() - 1;
    if d == 1 {
        return Ok(());
    }

    let ints = poly_to_primitive_int(poly);
    let lead = ints.last().cloned().unwrap();

    for &prime in &PRIMES {
        let p = prime as i64;
        if (&lead % BigInt::from(p)).is_zero() {
            continue; // leading coefficient vanishes mod p: degree collapses
        }
        let mod_coeffs: Vec<i64> = ints.iter().map(|c| to_mod_i64(c, p)).collect();
        if is_irreducible_mod_prime(&mod_coeffs, p) {
            return Ok(());
        }
    }

    if is_eisenstein_shift(&ints) {
        return Ok(());
    }

    if d == 4 {
        return match quartic_splits_over_q(poly) {
            Ok(true) => Err(CertFailure::Reducible),
            Ok(false) => Ok(()),
            Err(()) => Err(CertFailure::Unverified),
        };
    }

    if d <= 3 {
        return match has_rational_root(poly) {
            Ok(true) => Err(CertFailure::Reducible),
            Ok(false) => Ok(()),
            Err(()) => Err(CertFailure::Unverified),
        };
    }
    Err(CertFailure::Unverified)
}

/// Complete test: does the monic quartic x⁴ + px³ + qx² + rx + s split into
/// two quadratics over ℚ?
///
/// f = (x² + ax + b)(x² + cx + d) forces c = p − a, b + d = q − ap + a² and
/// (a − p/2)² = z where z is a rational root of the resolvent cubic
///   4z(z + q − p²/4)² − 16sz − (2r − p(z + q − p²/4))² = 0.
/// Every rational quadratic factorization yields such a z; conversely each
/// rational root z that is a rational square is checked exactly by
/// reconstructing (a, b, c, d) and verifying all coefficient equations.
fn quartic_splits_over_q(monic: &[BigRational]) -> Result<bool, ()> {
    assert_eq!(monic.len(), 5, "quartic test requires degree exactly 4");
    let s = monic[0].clone();
    let r = monic[1].clone();
    let q = monic[2].clone();
    let p = monic[3].clone();
    let one = BigRational::one();
    let two = BigRational::from_integer(2.into());
    let four = BigRational::from_integer(4.into());

    let z1 = &q - &p * &p / &four;
    // cubic coefficients (ascending): a3 z³ + a2 z² + a1 z + a0
    let a0 = -(&p * &p * &z1 * &z1 - &four * &p * &r * &z1 + &four * &r * &r);
    let a1 = &four * &z1 * &z1 - BigRational::from_integer(16.into()) * &s - &two * &p * &p * &z1
        + &four * &p * &r;
    let a2 = BigRational::from_integer(8.into()) * &z1 - &p * &p;
    let a3 = four.clone();
    let cubic = vec![a0, a1, a2, a3];

    for z0 in find_rational_roots(&cubic)? {
        if z0 < BigRational::zero() {
            continue; // z = (a − p/2)² cannot be negative
        }
        let w = match rational_sqrt(&z0) {
            Some(w) => w,
            None => continue, // z must be a rational square
        };
        for w_sign in [&one, &(-&one)] {
            let w = &w * w_sign;
            let a = w + &p / &two;
            let c = &p - &a;
            let t = &q - &a * &p + &a * &a; // b + d
            let delta = &t * &t - &four * &s;
            let sqrt_delta = match rational_sqrt(&delta) {
                Some(x) => x,
                None => continue,
            };
            for d_sign in [&one, &(-&one)] {
                let d = (&t + &sqrt_delta * d_sign) / &two;
                let b = &t - &d;
                if &b * &d == s && &a * &d + &b * &c == r {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

fn bigint_isqrt(n: &BigInt) -> Option<BigInt> {
    if n < &BigInt::zero() {
        return None;
    }
    if n.is_zero() {
        return Some(BigInt::zero());
    }
    // Newton iteration on integer floor sqrt
    let bits = n.bits();
    let mut x = BigInt::one() << bits.div_ceil(2);
    loop {
        let y = (&x + n / &x) >> 1;
        if y >= x {
            break;
        }
        x = y;
    }
    if &x * &x == *n {
        Some(x)
    } else {
        None
    }
}

fn rational_sqrt(r: &BigRational) -> Option<BigRational> {
    let num = bigint_isqrt(r.numer())?;
    let den = bigint_isqrt(r.denom())?;
    Some(BigRational::new(num, den))
}

/// Eisenstein's criterion on f(x + s) for small integer shifts s:
/// all non-leading coefficients ≡ 0 (mod p), leading ≢ 0, constant ≡ 0 but ≢ 0 (mod p²).
fn is_eisenstein_shift(ints: &[BigInt]) -> bool {
    for s in -4i64..=4 {
        let shifted = shift_poly(ints, s);
        for &prime in &PRIMES {
            let p = BigInt::from(prime);
            let d = shifted.len() - 1;
            let lead = &shifted[d];
            if (lead % &p).is_zero() {
                continue;
            }
            let mut ok = true;
            for c in shifted.iter().take(d) {
                if !(c % &p).is_zero() {
                    ok = false;
                    break;
                }
            }
            if !ok {
                continue;
            }
            let c0 = &shifted[0];
            let p_sq = &p * &p;
            // Eisenstein requires p | c0 but p² ∤ c0
            if c0.is_zero() || !(c0 % &p).is_zero() || (c0 % &p_sq).is_zero() {
                continue;
            }
            return true;
        }
    }
    false
}

/// Coefficients of f(x + s) for integer shift s.
fn shift_poly(coeffs: &[BigInt], s: i64) -> Vec<BigInt> {
    let d = coeffs.len() - 1;
    let mut res = vec![BigInt::zero(); d + 1];
    for (i, c) in coeffs.iter().enumerate() {
        if c.is_zero() {
            continue;
        }
        // (x + s)^i = Σ_j C(i, j) s^{i-j} x^j
        let mut binom = BigInt::one();
        let mut s_pow = BigInt::one();
        for j in (0..=i).rev() {
            res[j] += c * &binom * &s_pow;
            if j > 0 {
                binom = &binom * BigInt::from(j) / BigInt::from(i - j + 1);
                s_pow *= BigInt::from(s);
            }
        }
    }
    res
}

fn big_gcd(a: &BigInt, b: &BigInt) -> BigInt {
    let mut r0 = a.clone();
    let mut r1 = b.clone();
    while !r1.is_zero() {
        let r2 = &r0 % &r1;
        r0 = r1;
        r1 = r2;
    }
    r0
}

/// Clear denominators to a primitive integer polynomial.
fn poly_to_primitive_int(poly: &[BigRational]) -> Vec<BigInt> {
    let mut lcm = BigInt::one();
    for c in poly {
        let denom = c.denom();
        lcm = &lcm * denom / big_gcd(&lcm, denom);
    }
    poly.iter().map(|c| (c * &lcm).to_integer()).collect()
}

fn to_mod_i64(c: &BigInt, p: i64) -> i64 {
    let r = (c % BigInt::from(p)).to_i64().expect("remainder fits in i64");
    r.rem_euclid(p)
}

/// All rational-root candidates ±p/q with p | a₀, q | aₙ (rational root theorem).
/// None when the coefficient magnitude exceeds the enumeration budget.
fn rational_root_candidates(poly: &[BigRational]) -> Option<Vec<BigRational>> {
    let ints = poly_to_primitive_int(poly);
    let c0 = ints[0].abs();
    let cn = ints.last().cloned().unwrap().abs();
    let budget = BigInt::from(10u64.pow(12));
    if c0 > budget || cn > budget {
        return None;
    }
    let div0 = integer_divisors(&c0)?;
    let divn = integer_divisors(&cn)?;
    if div0.len().saturating_mul(divn.len()) > 100_000 {
        return None;
    }
    let mut cands = Vec::with_capacity(2 * div0.len() * divn.len());
    for p0 in &div0 {
        for pn in &divn {
            for sign in [1i32, -1] {
                cands.push(BigRational::new(p0.clone() * sign, pn.clone()));
            }
        }
    }
    Some(cands)
}

/// Rational root test. Complete for degrees 2 and 3 (a reducible poly of
/// degree ≤ 3 has a linear factor). Returns Err(()) when the enumeration
/// budget is exceeded.
fn has_rational_root(poly: &[BigRational]) -> Result<bool, ()> {
    if poly[0].is_zero() {
        return Ok(true); // 0 is a root iff the constant term vanishes
    }
    let cands = rational_root_candidates(poly).ok_or(())?;
    Ok(cands.iter().any(|c| eval_poly(poly, c).is_zero()))
}

/// All rational roots, found by repeatedly deflating linear factors.
fn find_rational_roots(poly: &[BigRational]) -> Result<Vec<BigRational>, ()> {
    let mut roots = Vec::new();
    let mut cur = trim_poly(poly).to_vec();
    loop {
        if cur.len() <= 1 {
            break;
        }
        if cur[0].is_zero() {
            roots.push(BigRational::zero());
            cur.remove(0);
            continue;
        }
        let cands = rational_root_candidates(&cur).ok_or(())?;
        let root = match cands.into_iter().find(|c| eval_poly(&cur, c).is_zero()) {
            Some(r) => r,
            None => break,
        };
        roots.push(root.clone());
        let (quot, rem) = poly_div_rem(&cur, &[-root.clone(), BigRational::one()]);
        assert!(trim_poly(&rem).is_empty(), "root must divide the polynomial exactly");
        cur = quot;
    }
    Ok(roots)
}

/// Enumerate positive divisors of n by trial division. None when n is too large.
fn integer_divisors(n: &BigInt) -> Option<Vec<BigInt>> {
    let mut factors: Vec<BigInt> = Vec::new();
    let mut m = n.clone();
    let mut k = BigInt::from(2u64);
    let cap = BigInt::from(1_000_000u64);
    if n > &(cap.clone() * cap) {
        return None;
    }
    while (&k * &k) <= m {
        if (&m % &k).is_zero() {
            factors.push(k.clone());
            while (&m % &k).is_zero() {
                m /= &k;
            }
        }
        k += 1u64;
    }
    if m > BigInt::one() {
        factors.push(m);
    }
    let mut divs = vec![BigInt::one()];
    for f in factors {
        let mut extended: Vec<BigInt> = divs.iter().map(|d| d * &f).collect();
        divs.append(&mut extended);
    }
    Some(divs)
}

fn eval_poly(poly: &[BigRational], x: &BigRational) -> BigRational {
    poly.iter()
        .rev()
        .fold(BigRational::zero(), |acc, c| &acc * x + c)
}

// ---------------------------------------------------------------------------
// Mod-p Polynomial Machinery (coefficients in [0, p))
// ---------------------------------------------------------------------------

fn mod_poly_trim(p: &[i64]) -> &[i64] {
    let mut end = p.len();
    while end > 0 && p[end - 1] == 0 {
        end -= 1;
    }
    &p[..end]
}

fn mod_inv(a: i64, p: i64) -> i64 {
    let (mut r0, mut r1) = (p, a);
    let (mut s0, mut s1) = (0i64, 1i64);
    while r1 != 0 {
        let q = r0 / r1;
        let r2 = r0 - q * r1;
        let s2 = s0 - q * s1;
        r0 = r1;
        r1 = r2;
        s0 = s1;
        s1 = s2;
    }
    s0.rem_euclid(p)
}

fn mod_poly_mul(a: &[i64], b: &[i64], p: i64) -> Vec<i64> {
    let a = mod_poly_trim(a);
    let b = mod_poly_trim(b);
    if a.is_empty() || b.is_empty() {
        return vec![];
    }
    let mut res = vec![0i64; a.len() + b.len() - 1];
    for i in 0..a.len() {
        for j in 0..b.len() {
            res[i + j] = (res[i + j] + a[i] * b[j]).rem_euclid(p);
        }
    }
    res
}

/// Remainder mod b over F_p; b must have invertible leading coefficient mod p.
fn mod_poly_rem(a: &[i64], b: &[i64], p: i64) -> Vec<i64> {
    let b_trimmed = mod_poly_trim(b);
    assert!(!b_trimmed.is_empty(), "modulus cannot be the zero polynomial");
    let mut rem = mod_poly_trim(a).to_vec();
    let b_deg = b_trimmed.len() - 1;
    let b_lead = b_trimmed[b_deg];
    let b_lead_inv = mod_inv(b_lead, p);

    while rem.len() > b_deg {
        let cur_deg = rem.len() - 1;
        let lead = rem.pop().unwrap();
        if lead == 0 {
            continue;
        }
        let factor = (lead * b_lead_inv).rem_euclid(p);
        let deg_diff = cur_deg - b_deg;
        for i in 0..b_deg {
            rem[i + deg_diff] = (rem[i + deg_diff] - factor * b_trimmed[i]).rem_euclid(p);
        }
    }
    rem
}

fn mod_poly_gcd(a: &[i64], b: &[i64], p: i64) -> Vec<i64> {
    let mut r0 = mod_poly_trim(a).to_vec();
    let mut r1 = mod_poly_trim(b).to_vec();
    while !r1.is_empty() {
        let r2 = mod_poly_rem(&r0, &r1, p);
        r0 = r1;
        r1 = mod_poly_trim(&r2).to_vec();
    }
    if r0.is_empty() {
        r0 = vec![0];
    }
    let lead = r0.last().copied().unwrap_or(0);
    if lead != 1 && lead != 0 {
        let inv = mod_inv(lead, p);
        r0 = r0.iter().map(|c| (c * inv).rem_euclid(p)).collect();
    }
    r0
}

fn mod_poly_pow(base: &[i64], mut exp: u64, modulus: &[i64], p: i64) -> Vec<i64> {
    let mut result = vec![1i64];
    let mut b = mod_poly_rem(base, modulus, p);
    while exp > 0 {
        if exp & 1 == 1 {
            result = mod_poly_rem(&mod_poly_mul(&result, &b, p), modulus, p);
        }
        exp >>= 1;
        if exp > 0 {
            b = mod_poly_rem(&mod_poly_mul(&b, &b, p), modulus, p);
        }
    }
    result
}

/// x^{p^e} mod f via e repeated p-th powerings (no overflow, O(e · d² log p)).
fn frobenius(f: &[i64], p: i64, e: u32) -> Vec<i64> {
    let mut result = vec![0i64, 1i64]; // x
    for _ in 0..e {
        result = mod_poly_pow(&result, p as u64, f, p);
    }
    result
}

fn subtract_x(poly: Vec<i64>, p: i64) -> Vec<i64> {
    let mut v = poly;
    if v.is_empty() {
        v = vec![0, p - 1]; // 0 - x = -x
    } else if v.len() == 1 {
        v.push(p - 1); // constant c - x = c + (p-1)x
    } else {
        v[1] = (v[1] - 1).rem_euclid(p);
    }
    v
}

/// f irreducible over F_p: f | x^{p^d} − x and gcd(f, x^{p^{d/q}} − x) = 1
/// for every prime divisor q of d = deg f.
fn is_irreducible_mod_prime(f: &[i64], p: i64) -> bool {
    let f_trim = mod_poly_trim(f);
    if f_trim.is_empty() || f_trim.len() == 1 {
        return false; // zero or constant
    }
    let d = f_trim.len() - 1;
    if d == 1 {
        return true;
    }

    for &q in &PRIMES {
        if (d as u64).is_multiple_of(q) {
            let e = (d as u64 / q) as u32;
            let g = frobenius(f_trim, p, e);
            let g_minus_x = subtract_x(g, p);
            let gcd = mod_poly_gcd(f_trim, &g_minus_x, p);
            if mod_poly_trim(&gcd).len() != 1 || gcd[0] != 1 {
                return false;
            }
        }
    }

    let h = frobenius(f_trim, p, d as u32);
    let h_minus_x = subtract_x(h, p);
    mod_poly_trim(&mod_poly_rem(&h_minus_x, f_trim, p)).is_empty()
}

// ---------------------------------------------------------------------------
// Cyclotomic Polynomial Generation
// ---------------------------------------------------------------------------

/// Φ_n(x) via the exact division recurrence: xⁿ − 1 = ∏_{d | n} Φ_d(x).
fn cyclotomic_poly(n: u32) -> Vec<BigRational> {
    if n == 1 {
        return vec![BigRational::from_integer((-1).into()), BigRational::one()];
    }
    let mut phi: Vec<Vec<BigRational>> = Vec::with_capacity(n as usize + 1);
    phi.push(vec![]); // index 0 unused
    phi.push(vec![BigRational::from_integer((-1).into()), BigRational::one()]);

    for m in 2..=n {
        let mut dividend = vec![BigRational::zero(); m as usize + 1];
        dividend[0] = BigRational::from_integer((-1).into());
        dividend[m as usize] = BigRational::one();
        for d in 1..m {
            if m % d == 0 {
                let (quot, rem) = poly_div_rem(&dividend, &phi[d as usize]);
                assert!(
                    trim_poly(&rem).is_empty(),
                    "Φ_{d} must divide x^{m} − 1 exactly"
                );
                dividend = quot;
            }
        }
        phi.push(dividend);
    }
    phi[n as usize].clone()
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

    #[test]
    fn test_field_spec_parsing_constructs_fields() {
        let qq = AlgebraicNumberField::from_spec("QQ").unwrap();
        assert_eq!(qq.degree, 1);

        let s3 = AlgebraicNumberField::from_spec("QQ[sqrt(3)]").unwrap();
        assert_eq!(s3.degree, 2);
        assert_eq!(s3.min_poly[0], BigRational::from_integer((-3).into()));
        assert_eq!(s3.min_poly[2], BigRational::one());

        let c2 = AlgebraicNumberField::from_spec("QQ[cbrt(2)]").unwrap();
        assert_eq!(c2.degree, 3);

        let z5 = AlgebraicNumberField::from_spec("QQ[zeta_5]").unwrap();
        assert_eq!(z5.degree, 4);
        assert_eq!(z5.min_poly[0], BigRational::one());

        let z8 = AlgebraicNumberField::from_spec("QQ[zeta_8]").unwrap();
        assert_eq!(z8.degree, 4);

        let z12 = AlgebraicNumberField::from_spec("QQ[zeta_12]").unwrap();
        assert_eq!(z12.degree, 4);

        // Radicands that are perfect powers must be rejected as reducible
        assert!(AlgebraicNumberField::from_spec("QQ[sqrt(4)]").is_err());
        assert!(AlgebraicNumberField::from_spec("QQ[cbrt(8)]").is_err());
        assert!(AlgebraicNumberField::from_spec("QQ[sqrt(0)]").is_err());

        // Malformed specs
        for bad in ["", "QQ[", "sqrt(2)", "ZZ", "QQ[zeta]", "QQ[sqrt()]", "QQ[cbrt()]", "QQ[sqrt(2"] {
            assert!(
                AlgebraicNumberField::from_spec(bad).is_err(),
                "must reject malformed spec {bad:?}"
            );
        }
    }

    #[test]
    fn test_cyclotomic_polynomials_degrees_and_unity() {
        // Phi_n is irreducible of degree phi(n) and the generator is a primitive n-th root of unity
        for (n, deg) in [
            (2, 1), (3, 2), (4, 2), (5, 4), (6, 2),
            (7, 6), (8, 4), (9, 6), (10, 4), (12, 4),
        ] {
            let f = AlgebraicNumberField::cyclotomic(n).unwrap();
            assert_eq!(f.degree, deg, "deg Phi_{n} = phi({n}) = {deg}");
            let zeta = if deg == 1 {
                AlgebraicNumber::from_integers(&[-1], f) // zeta_2 = -1
            } else {
                AlgebraicNumber::generator(f)
            };
            assert!(zeta.pow(n as u64).is_one(), "zeta_{n}^{n} must be exactly 1");
        }
        assert!(AlgebraicNumberField::cyclotomic(0).is_err());
    }

    #[test]
    fn test_try_new_rejects_reducible_accepts_irreducible() {
        let mk = |cs: &[i64]| {
            cs.iter()
                .map(|&c| BigRational::from_integer(c.into()))
                .collect::<Vec<_>>()
        };

        // Reducible over Q: x^2-1, x^2-4, x^3-x, x^4+x^2+1 = (x^2+x+1)(x^2-x+1)
        for bad in [vec![-1, 0, 1], vec![-4, 0, 1], vec![0, -1, 0, 1], vec![1, 0, 1, 0, 1]] {
            assert!(
                AlgebraicNumberField::try_new("QQ[bad]", mk(&bad)).is_err(),
                "reducible polynomial {bad:?} must be rejected"
            );
        }

        // Irreducible over Q: x^2-3, x^3-2, x^2+x+1, x^4+1, x^3-3x+1
        for good in [vec![-3, 0, 1], vec![-2, 0, 0, 1], vec![1, 1, 1], vec![1, 0, 0, 0, 1], vec![1, -3, 0, 1]] {
            assert!(
                AlgebraicNumberField::try_new("QQ[good]", mk(&good)).is_ok(),
                "irreducible polynomial {good:?} must be accepted"
            );
        }

        // Degree zero is not a field extension
        assert!(
            AlgebraicNumberField::try_new("QQ[zero]", mk(&[1])).is_err(),
            "degree-zero polynomial must be rejected"
        );
    }

    #[test]
    fn test_field_identity_is_minimal_polynomial_not_name() {
        let f1 = AlgebraicNumberField::new("QQ[sqrt(2)]", mk_x2_minus(2));
        let f2 = AlgebraicNumberField::new("QQ[alpha]", mk_x2_minus(2));
        let f3 = AlgebraicNumberField::new("QQ[sqrt(3)]", mk_x2_minus(3));

        // Two fields with the same minimal polynomial are the same field, name aside
        assert_eq!(f1, f2);
        assert_ne!(f1, f3);

        // Arithmetic across differently-named but identically-defined fields must work
        let a = AlgebraicNumber::from_integers(&[1, 1], f1);
        let b = AlgebraicNumber::from_integers(&[1, 1], f2);
        assert_eq!(a, b);
        let sum = a.add(&b);
        assert_eq!(sum.coeffs[0], BigRational::from_integer(2.into()));
        assert_eq!(sum.coeffs[1], BigRational::from_integer(2.into()));

        let c = AlgebraicNumber::from_integers(&[1, 1], f3);
        assert_ne!(a, c);
    }

    #[test]
    fn test_neg_pow_display() {
        let f = AlgebraicNumberField::from_spec("QQ[cbrt(2)]").unwrap();
        let alpha = AlgebraicNumber::generator(f.clone());

        let neg_alpha = alpha.neg();
        assert!(alpha.add(&neg_alpha).is_zero());

        // (1 + alpha)^3 = 1 + 3a + 3a^2 + a^3 = 3 + 3a + 3a^2 since a^3 = 2
        let one_plus_a = AlgebraicNumber::from_integers(&[1, 1, 0], f);
        let cube_pow = one_plus_a.pow(3);
        let cube_mul = one_plus_a.mul(&one_plus_a).mul(&one_plus_a);
        assert_eq!(cube_pow, cube_mul, "pow must agree with iterated multiplication");
        assert_eq!(cube_pow, AlgebraicNumber::from_integers(&[3, 3, 3], one_plus_a.field.clone()));

        let disp = format!("{cube_pow}");
        assert!(disp.contains('α'), "display should render the generator, got: {disp}");
    }

    #[test]
    fn test_serialization_roundtrip_and_tamper_rejection() {
        let f = AlgebraicNumberField::from_spec("QQ[sqrt(2)]").unwrap();
        let a = AlgebraicNumber::from_integers(&[3, 7], f);

        let json = serde_json::to_string(&a).unwrap();
        let b: AlgebraicNumber = serde_json::from_str(&json).unwrap();
        assert_eq!(a, b, "round-trip must preserve the algebraic number exactly");

        // Tamper with the field's minimal polynomial inside the certificate JSON:
        // x^2 - 2 -> x^2 - 1 (reducible). The deserializer must reject the whole number.
        let mut v: serde_json::Value = serde_json::from_str(&json).unwrap();
        v["field"]["min_poly"][0] = serde_json::json!([1, 1]);
        let tampered = v.to_string();
        assert!(
            serde_json::from_str::<AlgebraicNumber>(&tampered).is_err(),
            "deserialization must reject a reducible field smuggled into the JSON"
        );
    }

    fn mk_x2_minus(n: i64) -> Vec<BigRational> {
        vec![
            BigRational::from_integer((-n).into()),
            BigRational::zero(),
            BigRational::one(),
        ]
    }
}
