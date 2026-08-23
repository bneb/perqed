//! Autonomous discovery campaign engine.
//!
//! For each algebraic field spec, generates a candidate point set (stereographic
//! unit vectors over field elements, plus rotation orbits where the field
//! contains the entries), emits it through the dynamic-probe contract, runs the
//! certificate through [`crate::dynamic_probe::DynamicProbeVerifier`] (field /
//! point / adjacency / sanity gates), and decides the resulting graph exactly
//! via [`crate::graph_color`]. Every entry — positive or negative — is recorded,
//! and the whole run is keyed by the spec's SHA-256 for the prompt-keyed ledger.

use crate::domain_synth::{AlgebraicNumber, AlgebraicNumberField, Point2DAlgebraic};
use crate::dynamic_probe::{DynamicProbeVerifier, ProbeCertificate};
use crate::graph_color::compute_chromatic_number;
use num_rational::BigRational;
use num_traits::{One, Zero};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::sync::Arc;

/// A campaign: the set of algebraic fields to sweep.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CampaignSpec {
    pub fields: Vec<String>,
}

impl Default for CampaignSpec {
    /// The standard sweep: the four campaign target fields.
    fn default() -> Self {
        Self {
            fields: vec![
                "QQ[sqrt(2)]".to_string(),
                "QQ[sqrt(3)]".to_string(),
                "QQ[cbrt(2)]".to_string(),
                "QQ[zeta_5]".to_string(),
            ],
        }
    }
}

impl CampaignSpec {
    /// Parse a comma-separated field list, e.g. `"QQ[sqrt(2)], QQ[sqrt(3)]"`.
    pub fn parse_csv(csv: &str) -> Self {
        let fields: Vec<String> = csv
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        Self { fields }
    }

    /// SHA-256 of the canonicalized spec — the prompt key for the run ledger.
    pub fn hash(&self) -> String {
        let canonical = serde_json::to_string(self).expect("spec serializes");
        let digest = Sha256::digest(canonical.as_bytes());
        hex::encode(digest)
    }
}

/// One field's outcome. Negative results are recorded as such — a verified
/// absence of odd cycles is a data point, not a failure.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CampaignEntry {
    pub field_spec: String,
    pub point_count: usize,
    pub edge_count: usize,
    /// Exact chromatic number of the verified graph; None if the certificate
    /// did not pass the harness gates.
    pub chromatic_number: Option<usize>,
    pub bipartite: Option<bool>,
    pub odd_cycle: Option<bool>,
    pub verified: bool,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CampaignReport {
    pub spec_hash: String,
    pub entries: Vec<CampaignEntry>,
    pub max_chromatic: usize,
    pub fields_with_odd_cycle: Vec<String>,
}

/// Run the full campaign: generate → probe contract → harness gates → decide.
pub fn run_campaign(spec: &CampaignSpec) -> CampaignReport {
    let mut entries = Vec::with_capacity(spec.fields.len());
    let mut max_chromatic = 0;
    let mut odd_fields = Vec::new();

    for field_spec in &spec.fields {
        let entry = run_field(field_spec);
        if let Some(chi) = entry.chromatic_number {
            max_chromatic = max_chromatic.max(chi);
        }
        if entry.odd_cycle == Some(true) {
            odd_fields.push(field_spec.clone());
        }
        entries.push(entry);
    }

    CampaignReport {
        spec_hash: spec.hash(),
        entries,
        max_chromatic,
        fields_with_odd_cycle: odd_fields,
    }
}

fn run_field(field_spec: &str) -> CampaignEntry {
    let field = match AlgebraicNumberField::from_spec(field_spec) {
        Ok(f) => f,
        Err(e) => {
            return CampaignEntry {
                field_spec: field_spec.to_string(),
                point_count: 0,
                edge_count: 0,
                chromatic_number: None,
                bipartite: None,
                odd_cycle: None,
                verified: false,
                note: format!("field gate: {e}"),
            };
        }
    };

    let points = generate_points(&field);
    let mut adjacency = Vec::new();
    for i in 0..points.len() {
        for j in (i + 1)..points.len() {
            if points[i].is_unit_distance(&points[j]) {
                adjacency.push((i, j));
            }
        }
    }

    let cert = ProbeCertificate {
        probe_id: format!("campaign::{field_spec}"),
        field_spec: field_spec.to_string(),
        witness_points: points
            .iter()
            .map(|p| [p.x.coeffs.clone(), p.y.coeffs.clone()])
            .collect(),
        adjacency,
        // The campaign reports χ exactly; the vacuous lower bound is claimed.
        chromatic_claim: 1,
    };

    let point_count = points.len();
    match DynamicProbeVerifier::verify_certificate(&cert) {
        Err(e) => CampaignEntry {
            field_spec: field_spec.to_string(),
            point_count,
            edge_count: 0,
            chromatic_number: None,
            bipartite: None,
            odd_cycle: None,
            verified: false,
            note: format!("harness error: {e}"),
        },
        Ok(verdict) if !verdict.verified => CampaignEntry {
            field_spec: field_spec.to_string(),
            point_count,
            edge_count: verdict.edge_count,
            chromatic_number: None,
            bipartite: None,
            odd_cycle: None,
            verified: false,
            note: verdict.reason,
        },
        Ok(verdict) => {
            let mut adj: Vec<HashSet<usize>> = vec![HashSet::new(); point_count];
            for &(u, v) in &verdict.rederived_adjacency {
                adj[u].insert(v);
                adj[v].insert(u);
            }
            let chi = compute_chromatic_number(&adj);
            let bipartite = verdict.sanity.as_ref().map(|s| s.is_bipartite);
            CampaignEntry {
                field_spec: field_spec.to_string(),
                point_count,
                edge_count: verdict.edge_count,
                chromatic_number: Some(chi),
                bipartite,
                odd_cycle: bipartite.map(|b| !b),
                verified: true,
                note: "all gates passed".to_string(),
            }
        }
    }
}

/// Candidate unit-distance point sets: rotation orbits where the field
/// contains the rotation entries, plus stereographic unit vectors.
pub(crate) fn generate_points(field: &Arc<AlgebraicNumberField>) -> Vec<Point2DAlgebraic> {
    let mut points = vec![Point2DAlgebraic::origin(field.clone())];

    // Rotation orbits: π/4 in ℚ(√2) (√2/2 ∈ K), π/3 in ℚ(√3) (1/2, √3/2 ∈ K).
    let x2_minus_2: Vec<BigRational> = vec![
        BigRational::from_integer((-2).into()),
        BigRational::zero(),
        BigRational::one(),
    ];
    let x2_minus_3: Vec<BigRational> = vec![
        BigRational::from_integer((-3).into()),
        BigRational::zero(),
        BigRational::one(),
    ];
    if field.min_poly == x2_minus_2 {
        let half_sqrt2 = AlgebraicNumber::new(
            vec![BigRational::zero(), BigRational::new(1.into(), 2.into())],
            field.clone(),
        );
        points.extend(rotation_orbit(field, &half_sqrt2, &half_sqrt2, 8));
    } else if field.min_poly == x2_minus_3 {
        let half = AlgebraicNumber::from_rational(BigRational::new(1.into(), 2.into()), field.clone());
        let half_sqrt3 = AlgebraicNumber::new(
            vec![BigRational::zero(), BigRational::new(1.into(), 2.into())],
            field.clone(),
        );
        points.extend(rotation_orbit(field, &half, &half_sqrt3, 6));
    }

    for t in t_values(field) {
        if let Some(p) = stereographic_point(field, &t) {
            points.push(p);
        }
    }

    // Dedupe by exact equality, preserving order
    let mut seen: Vec<Point2DAlgebraic> = Vec::with_capacity(points.len());
    for p in points {
        if !seen.contains(&p) {
            seen.push(p);
        }
    }
    seen
}

/// Orbit of (1, 0) under rotation by (cos, sin) — n steps.
fn rotation_orbit(
    field: &Arc<AlgebraicNumberField>,
    cos: &AlgebraicNumber,
    sin: &AlgebraicNumber,
    n: usize,
) -> Vec<Point2DAlgebraic> {
    let mut orbit = Vec::with_capacity(n);
    let mut current = Point2DAlgebraic::new(
        AlgebraicNumber::one(field.clone()),
        AlgebraicNumber::zero(field.clone()),
    );
    for _ in 0..n {
        if !orbit.contains(&current) {
            orbit.push(current.clone());
        }
        current = Point2DAlgebraic::new(
            current.x.mul(cos).sub(&current.y.mul(sin)),
            current.x.mul(sin).add(&current.y.mul(cos)),
        );
    }
    orbit
}

/// Stereographic unit vector: t ↦ ((1 − t²)/(1 + t²), 2t/(1 + t²)).
/// None when 1 + t² = 0 in the field (denominator non-invertible).
fn stereographic_point(
    field: &Arc<AlgebraicNumberField>,
    t: &AlgebraicNumber,
) -> Option<Point2DAlgebraic> {
    let one = AlgebraicNumber::one(field.clone());
    let two = AlgebraicNumber::from_rational(BigRational::from_integer(2.into()), field.clone());
    let t_sq = t.sqr();
    let denom = one.add(&t_sq);
    let denom_inv = denom.inv().ok()?;
    let x = one.sub(&t_sq).mul(&denom_inv);
    let y = two.mul(t).mul(&denom_inv);
    Some(Point2DAlgebraic::new(x, y))
}

/// Field-element parameters: small rationals plus low-coefficient generator
/// combinations — enough to sample the field's unit circle broadly.
fn t_values(field: &Arc<AlgebraicNumberField>) -> Vec<AlgebraicNumber> {
    let d = field.degree;
    let mut ts = Vec::new();

    let nums: [i64; 13] = [0, 1, -1, 2, -2, 3, -3, 1, -1, 2, -2, 3, -3];
    let dens: [i64; 13] = [1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 2, 2];
    for i in 0..13 {
        let mut coeffs = vec![BigRational::zero(); d];
        coeffs[0] = BigRational::new(nums[i].into(), dens[i].into());
        ts.push(AlgebraicNumber::new(coeffs, field.clone()));
    }

    // Generator combinations with coefficients in {0, 1/2, 1}
    let choices = [BigRational::zero(), BigRational::new(1.into(), 2.into()), BigRational::one()];
    let mut combos = vec![vec![BigRational::zero(); d]];
    for i in 0..d {
        let mut next = Vec::new();
        for c in &combos {
            for ch in &choices {
                let mut v = c.clone();
                v[i] = ch.clone();
                next.push(v);
            }
        }
        combos = next;
    }
    for combo in combos {
        if combo.iter().all(|c| c.is_zero()) {
            continue;
        }
        ts.push(AlgebraicNumber::new(combo, field.clone()));
    }

    ts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_campaign_sqrt3_finds_odd_cycle_graph() {
        // ℚ(√3)² contains the π/3 rotation (½, √3/2), giving the hexagon wheel
        // W₆ (center + C₆): triangles abound, χ = 3.
        let report = run_campaign(&CampaignSpec::default());
        let entry = report
            .entries
            .iter()
            .find(|e| e.field_spec == "QQ[sqrt(3)]")
            .expect("sqrt(3) entry present");
        assert!(entry.verified, "sqrt(3) certificate must verify: {}", entry.note);
        assert_eq!(entry.chromatic_number, Some(3));
        assert_eq!(entry.odd_cycle, Some(true));
        assert!(report.fields_with_odd_cycle.contains(&"QQ[sqrt(3)]".to_string()));
    }

    #[test]
    fn test_campaign_sqrt2_records_bipartite_star() {
        // ℚ(√2)²: the D₈ orbit gives the 8-star (χ = 2, bipartite). The
        // stereographic additions must not create odd cycles.
        let report = run_campaign(&CampaignSpec::default());
        let entry = report
            .entries
            .iter()
            .find(|e| e.field_spec == "QQ[sqrt(2)]")
            .expect("sqrt(2) entry present");
        assert!(entry.verified, "sqrt(2) certificate must verify: {}", entry.note);
        assert_eq!(entry.chromatic_number, Some(2));
        assert_eq!(entry.odd_cycle, Some(false));
    }

    #[test]
    fn test_campaign_covers_new_fields() {
        let report = run_campaign(&CampaignSpec::default());
        for field in ["QQ[cbrt(2)]", "QQ[zeta_5]"] {
            let entry = report
                .entries
                .iter()
                .find(|e| e.field_spec == field)
                .unwrap_or_else(|| panic!("{field} entry missing"));
            assert!(entry.verified, "{field} must verify: {}", entry.note);
            assert!(entry.chromatic_number.is_some(), "{field} decided");
        }
        assert!(report.max_chromatic >= 3, "triangle/wheel found somewhere");
    }

    #[test]
    fn test_campaign_invalid_field_recorded_not_panicked() {
        let spec = CampaignSpec {
            fields: vec!["QQ[sqrt(4)]".to_string()],
        };
        let report = run_campaign(&spec);
        assert_eq!(report.entries.len(), 1);
        assert!(!report.entries[0].verified);
        assert!(report.entries[0].note.contains("reducible"), "note: {}", report.entries[0].note);
        assert_eq!(report.max_chromatic, 0);
    }

    #[test]
    fn test_campaign_spec_hash_deterministic() {
        let a = CampaignSpec {
            fields: vec!["QQ[sqrt(2)]".to_string(), "QQ[sqrt(3)]".to_string()],
        };
        let b = CampaignSpec {
            fields: vec!["QQ[sqrt(2)]".to_string(), "QQ[sqrt(3)]".to_string()],
        };
        let c = CampaignSpec {
            fields: vec!["QQ[sqrt(2)]".to_string()],
        };
        assert_eq!(a.hash(), b.hash());
        assert_ne!(a.hash(), c.hash());
    }

    #[test]
    fn test_campaign_parse_csv() {
        let spec = CampaignSpec::parse_csv(" QQ[sqrt(2)], QQ[sqrt(3)],QQ[cbrt(2)] ");
        assert_eq!(spec.fields, vec!["QQ[sqrt(2)]", "QQ[sqrt(3)]", "QQ[cbrt(2)]"]);
        let empty = CampaignSpec::parse_csv("");
        assert!(empty.fields.is_empty());
    }

    #[test]
    fn test_campaign_empty_fields() {
        let report = run_campaign(&CampaignSpec { fields: vec![] });
        assert!(report.entries.is_empty());
        assert_eq!(report.max_chromatic, 0);
    }

    #[test]
    fn test_campaign_entry_reports_wheel_structure() {
        // ℚ(√3)² point set contains at least the hexagon wheel W₆:
        // 1 origin + 6 orbit points, 6 spokes + 6 rim edges. The stereographic
        // layer adds further unit pairs (the unit circle in ℚ(√3)² is dense),
        // so the reported graph must be at least this rich.
        let report = run_campaign(&CampaignSpec::default());
        let entry = report
            .entries
            .iter()
            .find(|e| e.field_spec == "QQ[sqrt(3)]")
            .unwrap();
        assert!(entry.point_count >= 7, "origin + hexagon orbit");
        assert!(entry.edge_count >= 12, "wheel W_6 has 12 edges, got {}", entry.edge_count);
    }
}
