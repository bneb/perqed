//! Polymorphic domain layer ("Rule of Two"): decouples the domain payload from
//! the verification pipeline.
//!
//! The trust boundary is [`MathematicalDomain::verify`]: every derived claim in
//! a [`DomainPayload`] is re-derived independently from the payload's raw
//! witness in exact arithmetic, and the domain gates run on the TRUSTED object
//! — never on the proposal's own numbers. Domain A: unit-distance graphs over
//! algebraic fields (adapter over the dynamic probe harness). Domain B:
//! bounded continued fractions (Zaremba over powers of two), verified by exact
//! Euclidean reconstruction.
//!
//! Domain B's precise statement: for target m and bound B, the witness is a
//! numerator a with 0 < a < m, gcd(a, m) = 1, whose continued fraction
//! [q₀; q₁, …, qₙ] of a/m has every partial quotient ≤ B. The verifier
//! re-derives the quotients by the Euclidean algorithm and independently
//! reconstructs a/m from them — the proposed bound is checked, never trusted.

use crate::dynamic_probe::{DynamicProbeVerifier, ProbeCertificate};
use crate::graph_sanity::SanityCertificate;
use num_rational::BigRational;
use num_traits::{One, ToPrimitive, Zero};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DomainError {
    #[error("unknown domain: {0}")]
    UnknownDomain(String),
    #[error("invalid spec: {0}")]
    InvalidSpec(String),
    #[error("no witness found: {0}")]
    NoWitness(String),
    #[error("field error: {0}")]
    Field(#[from] crate::domain_synth::AlgebraicFieldError),
    #[error("probe error: {0}")]
    Probe(#[from] crate::dynamic_probe::ProbeError),
    #[error("Lean emission not supported: {0}")]
    LeanEmissionUnsupported(String),
}

/// Raw, untrusted proposal. Carries WITNESS data only — derived claims are
/// re-derived by the domain's verifier, never taken at face value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum DomainPayload {
    /// Domain A: witness = points; adjacency + chromatic claim are proposals.
    UnitDistanceGraph {
        field_spec: String,
        /// (x, y) coefficient vectors per witness point in the field basis.
        witness_points: Vec<[Vec<BigRational>; 2]>,
        /// Proposed unit-distance edges — re-derived from the points.
        adjacency: Vec<(usize, usize)>,
        /// Proposed lower bound χ ≥ chromatic_claim — gated.
        chromatic_claim: usize,
    },
    /// Domain B: witness = numerator a for the rational a/m; the quotient
    /// list and the bound are re-derived / checked, never trusted.
    BoundedContinuedFraction {
        target: i64,
        numerator: i64,
        quotient_bound: i64,
    },
}

impl DomainPayload {
    pub fn domain_id(&self) -> &'static str {
        match self {
            DomainPayload::UnitDistanceGraph { .. } => "geometry.unit_distance",
            DomainPayload::BoundedContinuedFraction { .. } => "number_theory.zaremba",
        }
    }

    /// SHA-256 of the canonical payload — the prompt key for the run ledger.
    pub fn hash(&self) -> String {
        let canonical = serde_json::to_string(self).expect("payload serializes");
        hex::encode(Sha256::digest(canonical.as_bytes()))
    }
}

/// Trusted verdict: the domain's re-derived facts, with the shared
/// `verified` / `reason` contract.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "domain", content = "data")]
pub enum DomainVerdict {
    UnitDistanceGraph {
        verified: bool,
        reason: String,
        vertex_count: usize,
        edge_count: usize,
        /// Exact chromatic number of the re-derived graph.
        chromatic_number: usize,
        bipartite: bool,
        odd_cycle: bool,
        sanity: Option<SanityCertificate>,
    },
    BoundedContinuedFraction {
        verified: bool,
        reason: String,
        target: i64,
        numerator: i64,
        /// a/m reconstructed exactly from the re-derived quotients.
        reconstruction: Option<BigRational>,
        quotient_count: usize,
        max_quotient: i64,
        quotient_bound: i64,
    },
}

impl DomainVerdict {
    pub fn verified(&self) -> bool {
        match self {
            DomainVerdict::UnitDistanceGraph { verified, .. }
            | DomainVerdict::BoundedContinuedFraction { verified, .. } => *verified,
        }
    }

    pub fn reason(&self) -> &str {
        match self {
            DomainVerdict::UnitDistanceGraph { reason, .. }
            | DomainVerdict::BoundedContinuedFraction { reason, .. } => reason,
        }
    }
}

/// Envelope: identity + domain tag + payload + provenance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UniversalProbeCertificate {
    pub probe_id: String,
    pub domain: String,
    pub payload: DomainPayload,
    /// SHA-256 of the canonical payload.
    pub spec_hash: String,
    /// Recorded, informational — not part of the trust boundary.
    pub compute_cost_usd: f64,
    pub timestamp_utc: String,
}

impl UniversalProbeCertificate {
    pub fn new(probe_id: impl Into<String>, payload: DomainPayload) -> Self {
        let spec_hash = payload.hash();
        let domain = payload.domain_id().to_string();
        let timestamp_utc = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|_| "unknown".to_string());
        Self {
            probe_id: probe_id.into(),
            domain,
            payload,
            spec_hash,
            compute_cost_usd: 0.0,
            timestamp_utc,
        }
    }
}

/// A mathematical domain plugging into the universal governance pipeline.
pub trait MathematicalDomain: Send + Sync {
    fn domain_id(&self) -> &'static str;

    /// Propose a candidate payload from a discovery spec (in-engine generator;
    /// external LLM probes emit the same payload contract).
    fn propose(&self, spec: &Value) -> Result<DomainPayload, DomainError>;

    /// Trust boundary: independently re-derive the payload's claims from its
    /// raw witness in exact arithmetic, run the domain gates on the trusted
    /// object, and return the verdict.
    fn verify(&self, payload: &DomainPayload) -> Result<DomainVerdict, DomainError>;

    /// Emit the Lean 4 Spec.lean declaration for a verified verdict.
    fn generate_lean_spec(
        &self,
        payload: &DomainPayload,
        verdict: &DomainVerdict,
    ) -> Result<String, DomainError>;

    /// Emit the deterministic Lean 4 proof (kernel `decide` reflection).
    fn generate_lean_proof(
        &self,
        payload: &DomainPayload,
        verdict: &DomainVerdict,
    ) -> Result<String, DomainError>;
}

pub struct DomainRegistry {
    domains: HashMap<&'static str, Box<dyn MathematicalDomain>>,
}

impl DomainRegistry {
    pub fn standard() -> Self {
        let mut domains: HashMap<&'static str, Box<dyn MathematicalDomain>> = HashMap::new();
        domains.insert(UnitDistanceDomain.domain_id(), Box::new(UnitDistanceDomain));
        domains.insert(BoundedCfDomain.domain_id(), Box::new(BoundedCfDomain));
        Self { domains }
    }

    pub fn get(&self, id: &str) -> Result<&dyn MathematicalDomain, DomainError> {
        self.domains
            .get(id)
            .map(|d| d.as_ref())
            .ok_or_else(|| DomainError::UnknownDomain(id.to_string()))
    }
}

// ---------------------------------------------------------------------------
// Domain A: unit-distance graphs over algebraic fields
// ---------------------------------------------------------------------------

pub struct UnitDistanceDomain;

impl UnitDistanceDomain {
    fn payload_to_certificate(payload: &DomainPayload) -> Result<ProbeCertificate, DomainError> {
        match payload {
            DomainPayload::UnitDistanceGraph {
                field_spec,
                witness_points,
                adjacency,
                chromatic_claim,
            } => Ok(ProbeCertificate {
                probe_id: "domain::geometry".to_string(),
                field_spec: field_spec.clone(),
                witness_points: witness_points.clone(),
                adjacency: adjacency.clone(),
                chromatic_claim: *chromatic_claim,
            }),
            _ => Err(DomainError::InvalidSpec(
                "UnitDistanceDomain received a non-geometry payload".to_string(),
            )),
        }
    }
}

impl MathematicalDomain for UnitDistanceDomain {
    fn domain_id(&self) -> &'static str {
        "geometry.unit_distance"
    }

    fn propose(&self, spec: &Value) -> Result<DomainPayload, DomainError> {
        let field_spec = spec
            .get("field")
            .and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::InvalidSpec("missing \"field\"".to_string()))?
            .to_string();
        let chromatic_claim = spec
            .get("chromatic_claim")
            .and_then(|v| v.as_u64())
            .unwrap_or(1) as usize;

        let field = crate::domain_synth::AlgebraicNumberField::from_spec(&field_spec)?;
        let points = crate::campaign::generate_points(&field);
        let mut adjacency = Vec::new();
        for i in 0..points.len() {
            for j in (i + 1)..points.len() {
                if points[i].is_unit_distance(&points[j]) {
                    adjacency.push((i, j));
                }
            }
        }
        Ok(DomainPayload::UnitDistanceGraph {
            field_spec,
            witness_points: points
                .iter()
                .map(|p| [p.x.coeffs.clone(), p.y.coeffs.clone()])
                .collect(),
            adjacency,
            chromatic_claim,
        })
    }

    fn verify(&self, payload: &DomainPayload) -> Result<DomainVerdict, DomainError> {
        let cert = Self::payload_to_certificate(payload)?;
        // The harness re-derives the adjacency from the witness points and
        // runs the Stage-0 gates on the re-derived graph.
        let verdict = DynamicProbeVerifier::verify_certificate(&cert)?;

        let mut adj: Vec<std::collections::HashSet<usize>> =
            vec![std::collections::HashSet::new(); verdict.vertex_count];
        for &(u, v) in &verdict.rederived_adjacency {
            adj[u].insert(v);
            adj[v].insert(u);
        }
        let chromatic_number = crate::graph_color::compute_chromatic_number(&adj);

        Ok(DomainVerdict::UnitDistanceGraph {
            verified: verdict.verified,
            reason: verdict.reason,
            vertex_count: verdict.vertex_count,
            edge_count: verdict.edge_count,
            chromatic_number,
            bipartite: verdict.sanity.as_ref().is_some_and(|s| s.is_bipartite),
            odd_cycle: verdict.sanity.as_ref().is_some_and(|s| !s.is_bipartite),
            sanity: verdict.sanity,
        })
    }

    fn generate_lean_spec(
        &self,
        payload: &DomainPayload,
        _verdict: &DomainVerdict,
    ) -> Result<String, DomainError> {
        let (field_spec, witness_points, adjacency, _claim) = match payload {
            DomainPayload::UnitDistanceGraph {
                field_spec,
                witness_points,
                adjacency,
                chromatic_claim,
            } => (field_spec, witness_points, adjacency, chromatic_claim),
            _ => return Err(DomainError::InvalidSpec("not a geometry payload".into())),
        };

        // Lean emission is supported for quadratic fields x² − n, where the
        // unit-distance predicate can be expressed with Int arithmetic:
        // (dx)² + (dy)² == d² with the √n coefficient vanishing.
        let field = crate::domain_synth::AlgebraicNumberField::from_spec(field_spec)?;
        let n = match field.min_poly.as_slice() {
            [c0, c1, one] if c1.is_zero() && one.is_one() => {
                let n_val = -c0.numer();
                n_val.to_i64().ok_or_else(|| {
                    DomainError::LeanEmissionUnsupported("quadratic constant too large".into())
                })?
            }
            _ => {
                return Err(DomainError::LeanEmissionUnsupported(format!(
                    "field {field_spec} is not quadratic"
                )))
            }
        };

        // Common denominator and integer numerators per point.
        let mut lcm = num_bigint::BigInt::one();
        for [x, y] in witness_points {
            for c in x.iter().chain(y.iter()) {
                let d = c.denom();
                lcm = &lcm * d / big_gcd(&lcm, d);
            }
        }
        let d_i64 = lcm.to_i64().ok_or_else(|| {
            DomainError::LeanEmissionUnsupported("common denominator too large".into())
        })?;

        let mut point_lines = Vec::new();
        for [x, y] in witness_points {
            let to_int = |c: &BigRational| -> Result<i64, DomainError> {
                let scaled = c * &lcm;
                scaled
                    .to_integer()
                    .to_i64()
                    .ok_or_else(|| DomainError::LeanEmissionUnsupported("coordinate too large".into()))
            };
            let xa = to_int(&x[0])?;
            let xb = to_int(&x[1])?;
            let ya = to_int(&y[0])?;
            let yb = to_int(&y[1])?;
            point_lines.push(format!("  ({xa}, {xb}, {ya}, {yb})"));
        }
        let mut edge_lines = Vec::new();
        for (u, v) in adjacency {
            edge_lines.push(format!("  ({u}, {v})"));
        }

        let points_text = point_lines.join("\n");
        let edges_text = edge_lines.join("\n");
        Ok(format!(
            "/-\n  Perqed.Spec.{spec_name}\n  Domain: {field_spec} (quadratic, √{n})\n  Witness points and unit-distance adjacency, kernel-decidable.\n-/\n\nnamespace Perqed.Spec\n\n/-- Point (xa + xb√{n}, ya + yb√{n}) over common denominator {d_i64} -/\nstructure Pt where\n  xa : Int\n  xb : Int\n  ya : Int\n  yb : Int\n\n/-- Squared distance numerator: √{n} coefficient must vanish, rational part == d² -/\ndef unit (p q : Pt) (n d : Int) : Bool :=\n  let dxa := p.xa - q.xa\n  let dxb := p.xb - q.xb\n  let dya := p.ya - q.ya\n  let dyb := p.yb - q.yb\n  dxa * dxb + dya * dyb == 0 &&\n  dxa * dxa + n * dxb * dxb + dya * dya + n * dyb * dyb == d * d\n\ndef PTS : List Pt :=\n  [\n{points_text}\n  ]\n\ndef E : List (Int × Int) :=\n  [\n{edges_text}\n  ]\n\ndef isUnitDistanceGraph (pts : List Pt) (es : List (Int × Int)) (n d : Int) : Bool :=\n  es.all (fun e => unit (pts.get! e.1) (pts.get! e.2) n d)\n\ntheorem {spec_name} : isUnitDistanceGraph PTS E {n} {d_i64} = true :=\n  by\nend Perqed.Spec\n",
            spec_name = "witness_unit_distance_graph"
        ))
    }

    fn generate_lean_proof(
        &self,
        _payload: &DomainPayload,
        _verdict: &DomainVerdict,
    ) -> Result<String, DomainError> {
        Ok("theorem witness_unit_distance_graph : Perqed.Spec.witness_unit_distance_graph := by\n  decide\n".to_string())
    }
}

fn big_gcd(a: &num_bigint::BigInt, b: &num_bigint::BigInt) -> num_bigint::BigInt {
    let mut r0 = a.clone();
    let mut r1 = b.clone();
    while !r1.is_zero() {
        let r2 = &r0 % &r1;
        r0 = r1;
        r1 = r2;
    }
    r0
}

// ---------------------------------------------------------------------------
// Domain B: bounded continued fractions (Zaremba over powers of two)
// ---------------------------------------------------------------------------

pub struct BoundedCfDomain;

/// Exact continued fraction of p/q by the Euclidean algorithm (p, q > 0).
fn cf_quotients(mut p: i64, mut q: i64) -> Vec<i64> {
    debug_assert!(p > 0 && q > 0);
    let mut quotients = Vec::new();
    loop {
        let qi = p / q;
        quotients.push(qi);
        let r = p % q;
        if r == 0 {
            break;
        }
        p = q;
        q = r;
    }
    quotients
}

/// Exact value of [q₀; q₁, …, qₙ] as a rational, via the pair recurrence.
fn cf_value(quotients: &[i64]) -> BigRational {
    // (p_{-2}, p_{-1}) = (0, 1): step with q: (p_cur, q·p_cur + p_prev)
    let (mut p_prev, mut p_cur) = (BigRational::zero(), BigRational::one());
    for &q in quotients {
        let next = BigRational::from_integer(q.into()) * &p_cur + &p_prev;
        p_prev = p_cur;
        p_cur = next;
    }
    let (mut q_prev, mut q_cur) = (BigRational::one(), BigRational::zero());
    for &q in quotients {
        let next = BigRational::from_integer(q.into()) * &q_cur + &q_prev;
        q_prev = q_cur;
        q_cur = next;
    }
    p_cur / q_cur
}

impl BoundedCfDomain {
    fn verify_witness(target: i64, numerator: i64, bound: i64) -> DomainVerdict {
        if numerator <= 0 || numerator >= target {
            return DomainVerdict::BoundedContinuedFraction {
                verified: false,
                reason: format!("numerator {numerator} outside (0, {target})"),
                target,
                numerator,
                reconstruction: None,
                quotient_count: 0,
                max_quotient: 0,
                quotient_bound: bound,
            };
        }
        if !coprime(numerator, target) {
            return DomainVerdict::BoundedContinuedFraction {
                verified: false,
                reason: format!("gcd({numerator}, {target}) != 1: not a reduced fraction"),
                target,
                numerator,
                reconstruction: None,
                quotient_count: 0,
                max_quotient: 0,
                quotient_bound: bound,
            };
        }
        // Trust boundary: quotients are re-derived, never read from the payload.
        let quotients = cf_quotients(numerator, target);
        let max_quotient = quotients.iter().copied().max().unwrap_or(0);
        let reconstruction = cf_value(&quotients);
        let verified = max_quotient <= bound;
        DomainVerdict::BoundedContinuedFraction {
            verified,
            reason: if verified {
                format!(
                    "a/m = {numerator}/{target} = {quotients:?}, all quotients ≤ {bound}"
                )
            } else {
                format!(
                    "max quotient {max_quotient} exceeds bound {bound} for {numerator}/{target}"
                )
            },
            target,
            numerator,
            reconstruction: Some(reconstruction),
            quotient_count: quotients.len(),
            max_quotient,
            quotient_bound: bound,
        }
    }
}

fn coprime(a: i64, b: i64) -> bool {
    let mut x = a.abs();
    let mut y = b.abs();
    while y != 0 {
        let t = x % y;
        x = y;
        y = t;
    }
    x == 1
}

impl MathematicalDomain for BoundedCfDomain {
    fn domain_id(&self) -> &'static str {
        "number_theory.zaremba"
    }

    fn propose(&self, spec: &Value) -> Result<DomainPayload, DomainError> {
        let target = spec
            .get("target")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| DomainError::InvalidSpec("missing \"target\"".to_string()))?;
        let bound = spec
            .get("quotient_bound")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| DomainError::InvalidSpec("missing \"quotient_bound\"".to_string()))?;
        if target <= 1 {
            return Err(DomainError::InvalidSpec(format!("target {target} must be ≥ 2")));
        }

        // Search the best numerator: minimize the max quotient; first hit
        // within the bound wins.
        let mut best: Option<(i64, i64)> = None; // (numerator, max_quotient)
        for a in 1..target {
            if !coprime(a, target) {
                continue;
            }
            let max_q = cf_quotients(a, target).into_iter().max().unwrap_or(0);
            if max_q <= bound {
                return Ok(DomainPayload::BoundedContinuedFraction {
                    target,
                    numerator: a,
                    quotient_bound: bound,
                });
            }
            if best.is_none_or(|(_, bq)| max_q < bq) {
                best = Some((a, max_q));
            }
        }
        // No witness within the bound: return the best-effort proposal so the
        // verifier can record the negative result exactly.
        let (numerator, _) = best.ok_or_else(|| DomainError::NoWitness(format!("{target}")))?;
        Ok(DomainPayload::BoundedContinuedFraction {
            target,
            numerator,
            quotient_bound: bound,
        })
    }

    fn verify(&self, payload: &DomainPayload) -> Result<DomainVerdict, DomainError> {
        match payload {
            DomainPayload::BoundedContinuedFraction {
                target,
                numerator,
                quotient_bound,
            } => Ok(Self::verify_witness(*target, *numerator, *quotient_bound)),
            _ => Err(DomainError::InvalidSpec(
                "BoundedCfDomain received a non-CF payload".to_string(),
            )),
        }
    }

    fn generate_lean_spec(
        &self,
        payload: &DomainPayload,
        _verdict: &DomainVerdict,
    ) -> Result<String, DomainError> {
        let (target, numerator, bound) = match payload {
            DomainPayload::BoundedContinuedFraction {
                target,
                numerator,
                quotient_bound,
            } => (*target, *numerator, *quotient_bound),
            _ => return Err(DomainError::InvalidSpec("not a CF payload".into())),
        };
        let quotients = cf_quotients(numerator, target);
        let qs = format!(
            "[{}]",
            quotients
                .iter()
                .map(|q| q.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
        let spec_name = format!("zaremba_witness_{target}_{numerator}");
        Ok(format!(
            "/-\n  Perqed.Spec.{spec_name}\n  Domain: number_theory.zaremba\n  Witness: {numerator}/{target} = {qs}, all partial quotients ≤ {bound}\n  Kernel-decidable by exact Int arithmetic.\n-/\n\nnamespace Perqed.Spec\n\n/-- Numerator p of [q₀; q₁, …, qₙ] via the pair recurrence. -/\ndef cf_num (qs : List Int) : Int :=\n  (qs.foldl (fun acc q => (acc.2, q * acc.2 + acc.1)) (0, 1)).2\n\n/-- Denominator q of [q₀; q₁, …, qₙ] via the pair recurrence. -/\ndef cf_den (qs : List Int) : Int :=\n  (qs.foldl (fun acc q => (acc.2, q * acc.2 + acc.1)) (1, 0)).2\n\n/-- All partial quotients bounded by B. -/\ndef all_le (qs : List Int) (B : Int) : Bool :=\n  qs.all (fun q => q <= B)\n\ntheorem {spec_name} :\n    cf_num {qs} = {numerator} ∧ cf_den {qs} = {target} ∧ all_le {qs} {bound} :=\n  by\nend Perqed.Spec\n",
            spec_name = spec_name
        ))
    }

    fn generate_lean_proof(
        &self,
        _payload: &DomainPayload,
        verdict: &DomainVerdict,
    ) -> Result<String, DomainError> {
        let (target, numerator) = match verdict {
            DomainVerdict::BoundedContinuedFraction { target, numerator, .. } => {
                (*target, *numerator)
            }
            _ => return Err(DomainError::InvalidSpec("not a CF verdict".into())),
        };
        Ok(format!(
            "theorem zaremba_witness_{target}_{numerator} : Perqed.Spec.zaremba_witness_{target}_{numerator} := by\n  decide\n"
        ))
    }
}

/// One row of the Zaremba sweep over 2^k: the best bounded-CF witness found.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ZarembaRow {
    pub k: u32,
    pub m: i64,
    pub numerator: Option<i64>,
    pub max_quotient: i64,
    pub bound: i64,
}

/// Sweep k = 1..=k_max: for each m = 2^k, find the smallest-max-quotient
/// coprime numerator and record whether it meets the bound.
pub fn zaremba_sweep(k_max: u32, bound: i64) -> Vec<ZarembaRow> {
    let mut rows = Vec::with_capacity(k_max as usize);
    for k in 1..=k_max {
        let m = 1i64 << k;
        let mut best: Option<(i64, i64)> = None;
        for a in 1..m {
            if !coprime(a, m) {
                continue;
            }
            let max_q = cf_quotients(a, m).into_iter().max().unwrap_or(0);
            if best.is_none_or(|(_, bq)| max_q < bq) {
                best = Some((a, max_q));
            }
        }
        let (numerator, max_quotient) = best.unwrap_or((0, 0));
        rows.push(ZarembaRow {
            k,
            m,
            numerator: (numerator != 0).then_some(numerator),
            max_quotient,
            bound,
        });
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use num_rational::BigRational;

    #[test]
    fn test_geometry_domain_propose_verify() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("geometry.unit_distance").unwrap();
        let spec = serde_json::json!({"field": "QQ[sqrt(3)]", "chromatic_claim": 3});
        let payload = domain.propose(&spec).unwrap();
        assert!(matches!(payload, DomainPayload::UnitDistanceGraph { .. }));
        let verdict = domain.verify(&payload).unwrap();
        match verdict {
            DomainVerdict::UnitDistanceGraph { verified, chromatic_number, odd_cycle, bipartite, .. } => {
                assert!(verified);
                assert_eq!(chromatic_number, 3, "hexagon wheel in Q(sqrt(3))^2 is 3-chromatic");
                assert!(odd_cycle);
                assert!(!bipartite);
            }
            other => panic!("expected geometry verdict, got: {other:?}"),
        }
    }

    #[test]
    fn test_geometry_domain_rejects_fabricated_adjacency() {
        // A probe that invents an edge must fail: the harness re-derives the
        // adjacency from the witness points and rejects the mismatch.
        let registry = DomainRegistry::standard();
        let domain = registry.get("geometry.unit_distance").unwrap();
        let spec = serde_json::json!({"field": "QQ[sqrt(2)]", "chromatic_claim": 2});
        let mut payload = domain.propose(&spec).unwrap();
        match &mut payload {
            DomainPayload::UnitDistanceGraph { adjacency, .. } => {
                adjacency.push((1, 2)); // fabricated edge between orbit points
            }
            _ => panic!("geometry payload expected"),
        }
        let verdict = domain.verify(&payload).unwrap();
        match verdict {
            DomainVerdict::UnitDistanceGraph { verified, reason, .. } => {
                assert!(!verified, "fabricated edge must fail verification");
                assert!(reason.contains("adjacency"), "reason: {reason}");
            }
            other => panic!("expected geometry verdict, got: {other:?}"),
        }
    }

    #[test]
    fn test_bounded_cf_propose_verify_8_bound_2() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("number_theory.zaremba").unwrap();
        let spec = serde_json::json!({"target": 8, "quotient_bound": 2});
        let payload = domain.propose(&spec).unwrap();
        let verdict = domain.verify(&payload).unwrap();
        match verdict {
            DomainVerdict::BoundedContinuedFraction {
                verified,
                target,
                numerator,
                reconstruction,
                max_quotient,
                quotient_bound,
                ..
            } => {
                assert!(verified, "8 has a Zaremba-2 witness: 3/8 = [0; 2, 1, 2]");
                assert_eq!(target, 8);
                assert_eq!(numerator, 3);
                assert_eq!(max_quotient, 2);
                assert_eq!(quotient_bound, 2);
                assert_eq!(
                    reconstruction.expect("exact reconstruction"),
                    BigRational::new(3.into(), 8.into())
                );
            }
            other => panic!("expected CF verdict, got: {other:?}"),
        }
    }

    #[test]
    fn test_bounded_cf_no_witness_within_bound() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("number_theory.zaremba").unwrap();
        // 1/4 = [0;4] and 3/4 = [0;1,3] — no coprime numerator with max ≤ 2.
        let spec = serde_json::json!({"target": 4, "quotient_bound": 2});
        let payload = domain.propose(&spec).unwrap();
        let verdict = domain.verify(&payload).unwrap();
        match verdict {
            DomainVerdict::BoundedContinuedFraction { verified, .. } => {
                assert!(!verified, "no Zaremba-2 witness for m = 4");
            }
            other => panic!("expected CF verdict, got: {other:?}"),
        }
    }

    #[test]
    fn test_bounded_cf_rejects_non_coprime_numerator() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("number_theory.zaremba").unwrap();
        // gcd(2, 4) = 2: the witness is not a reduced fraction of m.
        let payload = DomainPayload::BoundedContinuedFraction {
            target: 4,
            numerator: 2,
            quotient_bound: 5,
        };
        let verdict = domain.verify(&payload).unwrap();
        match verdict {
            DomainVerdict::BoundedContinuedFraction { verified, reason, .. } => {
                assert!(!verified);
                assert!(reason.contains("gcd"), "reason: {reason}");
            }
            other => panic!("expected CF verdict, got: {other:?}"),
        }
    }

    #[test]
    fn test_bounded_cf_tampered_bound_rejected() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("number_theory.zaremba").unwrap();
        // 3/8 = [0;2,1,2] has max quotient 2, so a claimed bound of 1 is false.
        let payload = DomainPayload::BoundedContinuedFraction {
            target: 8,
            numerator: 3,
            quotient_bound: 1,
        };
        let verdict = domain.verify(&payload).unwrap();
        match verdict {
            DomainVerdict::BoundedContinuedFraction { verified, max_quotient, .. } => {
                assert!(!verified);
                assert_eq!(max_quotient, 2, "max quotient is re-derived, not trusted");
            }
            other => panic!("expected CF verdict, got: {other:?}"),
        }
    }

    #[test]
    fn test_registry_standard_domains() {
        let registry = DomainRegistry::standard();
        assert!(registry.get("geometry.unit_distance").is_ok());
        assert!(registry.get("number_theory.zaremba").is_ok());
        assert!(matches!(registry.get("bogus"), Err(DomainError::UnknownDomain(_))));
    }

    #[test]
    fn test_payload_hash_deterministic_and_envelope_roundtrip() {
        let payload = DomainPayload::BoundedContinuedFraction {
            target: 8,
            numerator: 3,
            quotient_bound: 2,
        };
        assert_eq!(payload.hash(), payload.hash());
        assert_ne!(payload.hash(), DomainPayload::BoundedContinuedFraction {
            target: 8,
            numerator: 5,
            quotient_bound: 2,
        }.hash());

        let cert = UniversalProbeCertificate::new("p1", payload.clone());
        assert_eq!(cert.spec_hash, payload.hash());
        let json = serde_json::to_string(&cert).unwrap();
        let back: UniversalProbeCertificate = serde_json::from_str(&json).unwrap();
        assert_eq!(back.payload, payload);
        assert_eq!(back.domain, "number_theory.zaremba");
    }

    #[test]
    fn test_zaremba_sweep_powers_of_two() {
        // For k ≤ 10, every 2^k must admit a Zaremba witness with bound 5.
        let rows = zaremba_sweep(10, 5);
        assert_eq!(rows.len(), 10);
        for row in &rows {
            assert!(row.numerator.is_some(), "m = {} has a bounded-CF witness", row.m);
            assert!(row.max_quotient <= 5, "k = {} exceeds bound: {}", row.k, row.max_quotient);
        }
        // Hand-checked rows: 1/2 = [0;2], 3/8 = [0;2,1,2]
        assert_eq!(rows[0].m, 2);
        assert_eq!(rows[0].max_quotient, 2);
        assert_eq!(rows[2].numerator, Some(3));
        assert_eq!(rows[2].max_quotient, 2);
    }

    #[test]
    fn test_lean_emission_bounded_cf() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("number_theory.zaremba").unwrap();
        let payload = DomainPayload::BoundedContinuedFraction {
            target: 8,
            numerator: 3,
            quotient_bound: 2,
        };
        let verdict = domain.verify(&payload).unwrap();
        let spec = domain.generate_lean_spec(&payload, &verdict).unwrap();
        assert!(spec.contains("cf_num"), "spec defines the numerator reconstruction");
        assert!(spec.contains("cf_den"), "spec defines the denominator reconstruction");
        assert!(spec.contains("[0, 2, 1, 2]"), "spec inlines the verified quotients");
        assert!(!spec.contains("sorry"), "spec must not contain sorry");
        let proof = domain.generate_lean_proof(&payload, &verdict).unwrap();
        assert!(proof.contains("decide"));
    }

    #[test]
    fn test_lean_emission_geometry_quadratic_field() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("geometry.unit_distance").unwrap();
        let spec = serde_json::json!({"field": "QQ[sqrt(3)]", "chromatic_claim": 1});
        let payload = domain.propose(&spec).unwrap();
        let verdict = domain.verify(&payload).unwrap();
        let lean = domain.generate_lean_spec(&payload, &verdict).unwrap();
        assert!(lean.contains("theorem"));
        assert!(lean.contains("structure"), "point structure emitted");
        assert!(!lean.contains("sorry"), "spec must not contain sorry");
    }

    #[test]
    fn test_lean_emission_geometry_cubic_unsupported() {
        let registry = DomainRegistry::standard();
        let domain = registry.get("geometry.unit_distance").unwrap();
        let spec = serde_json::json!({"field": "QQ[cbrt(2)]", "chromatic_claim": 1});
        let payload = domain.propose(&spec).unwrap();
        let _verdict = domain.verify(&payload).unwrap();
        let res = domain.generate_lean_spec(&payload, &_verdict);
        assert!(res.is_err(), "Lean emission for non-quadratic fields is not yet generated");
    }
}
