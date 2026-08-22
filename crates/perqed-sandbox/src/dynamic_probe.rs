//! Dynamic Code-Probing Sandbox Loop (v2.3, upgrade #2) — verification harness.
//!
//! Contract + independent verification for probe certificates. A probe is a
//! runtime-supplied program (compiled against this crate as the prelude) that
//! reads a discovery spec JSON on stdin and emits a [`ProbeCertificate`] JSON
//! on stdout: witness points over an algebraic field, a unit-distance
//! adjacency, and a claimed chromatic lower bound.
//!
//! The harness NEVER trusts the certificate's numbers. It re-derives every
//! claim in exact arithmetic before anything downstream may consume it:
//!
//! 1. Field gate — [`AlgebraicNumberField::from_spec`] re-certifies
//!    irreducibility of the field spec (a reducible "field" is rejected).
//! 2. Point gate — every coordinate's coefficient vector must have exactly
//!    `degree` entries; witness points must be pairwise distinct (vertex
//!    merging would change the graph).
//! 3. Adjacency gate — the claimed edge set is re-derived by exact
//!    unit-distance checks and must match the probe's claim *exactly* in both
//!    directions. An invented edge or an omitted one changes the graph the
//!    chromatic claim refers to, and both are rejected.
//! 4. Sanity gate — the re-derived graph is run through
//!    [`GraphSanityChecker::verify_chromatic_bound`] (bipartiteness,
//!    degeneracy, sharp Brooks, Turán).
//!
//! Structural corruption (malformed JSON, out-of-range edges, duplicate
//! points) is a hard [`ProbeError`]. A well-formed certificate whose content
//! is mathematically unsound yields [`ProbeVerdict::verified`] = false with
//! the offending [`SanityError`] attached — the probe proposes, the exact
//! math layer disposes.
//!
//! [`run_probe_binary`] executes a probe as a hardened subprocess: cleared
//! environment, piped stdin/stdout, hard timeout (kill-on-drop), and a 64 KiB
//! output cap. This is process-level isolation, not a container — probes are
//! only as trusted as the author (the model tier), which is exactly why every
//! output must pass the gates above.

use crate::domain_synth::{AlgebraicNumber, AlgebraicNumberField, Point2DAlgebraic};
use crate::graph_sanity::{GraphSanityChecker, SanityCertificate, SanityError};
use num_rational::BigRational;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;
use thiserror::Error;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;

/// Hard cap on probe stdout; larger output is treated as a failed probe.
pub const MAX_PROBE_OUTPUT_BYTES: usize = 64 * 1024;

/// Structured certificate emitted by a probe and consumed by the verifier.
///
/// Coordinates are coefficient vectors in the field's canonical power basis
/// {1, α, α², …} — exactly the representation of [`AlgebraicNumber`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProbeCertificate {
    pub probe_id: String,
    /// Discovery-JSON field spec, e.g. `"QQ[sqrt(3)]"`.
    pub field_spec: String,
    /// One entry per witness point: `[x_coeffs, y_coeffs]`.
    pub witness_points: Vec<[Vec<BigRational>; 2]>,
    /// Claimed unit-distance edge list (unordered pairs).
    #[serde(default)]
    pub adjacency: Vec<(usize, usize)>,
    /// Claimed chromatic lower bound: χ ≥ `chromatic_claim`.
    pub chromatic_claim: usize,
}

/// Outcome of verifying one probe certificate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProbeVerdict {
    pub probe_id: String,
    pub verified: bool,
    pub reason: String,
    pub field_name: String,
    pub vertex_count: usize,
    pub edge_count: usize,
    /// Present iff verified: the Stage-0 sanity certificate for the
    /// re-derived graph (Turán confirmation, sharp Brooks bound, k-cores…).
    pub sanity: Option<SanityCertificate>,
    /// Present iff the sanity gate rejected the claim.
    pub sanity_error: Option<SanityError>,
}

#[derive(Error, Debug)]
pub enum ProbeError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("certificate JSON parse error: {0}")]
    Parse(String),
    #[error("field error: {0}")]
    Field(#[from] crate::domain_synth::AlgebraicFieldError),
    #[error("witness point {point} has {actual} coefficients but the field degree is {expected}")]
    PointDimension {
        point: usize,
        actual: usize,
        expected: usize,
    },
    #[error("duplicate witness points at indices {0} and {1}")]
    DuplicatePoints(usize, usize),
    #[error("invalid edge ({u}, {v}): {reason}")]
    InvalidEdge { u: usize, v: usize, reason: String },
    #[error("probe timeout after {0:?}")]
    Timeout(Duration),
    #[error("probe process failed: {0}")]
    ProcessFailed(String),
}

/// Stateless verification harness. See the module docs for the gates.
pub struct DynamicProbeVerifier;

impl DynamicProbeVerifier {
    pub fn verify(certificate_json: &str) -> Result<ProbeVerdict, ProbeError> {
        let cert: ProbeCertificate = serde_json::from_str(certificate_json)
            .map_err(|e| ProbeError::Parse(e.to_string()))?;
        Self::verify_certificate(&cert)
    }

    pub fn verify_certificate(cert: &ProbeCertificate) -> Result<ProbeVerdict, ProbeError> {
        let field = AlgebraicNumberField::from_spec(&cert.field_spec)?;

        // ---- Point gate: dimension and distinctness ----
        let n = cert.witness_points.len();
        let mut points: Vec<Point2DAlgebraic> = Vec::with_capacity(n);
        for (i, [x_coeffs, y_coeffs]) in cert.witness_points.iter().enumerate() {
            for coeffs in [x_coeffs, y_coeffs] {
                if coeffs.len() != field.degree {
                    return Err(ProbeError::PointDimension {
                        point: i,
                        actual: coeffs.len(),
                        expected: field.degree,
                    });
                }
            }
            points.push(Point2DAlgebraic::new(
                AlgebraicNumber::new(x_coeffs.clone(), field.clone()),
                AlgebraicNumber::new(y_coeffs.clone(), field.clone()),
            ));
        }
        for i in 0..n {
            for j in (i + 1)..n {
                if points[i] == points[j] {
                    return Err(ProbeError::DuplicatePoints(i, j));
                }
            }
        }

        // ---- Adjacency gate: structural validity, then exact re-derivation ----
        let mut claimed: HashSet<(usize, usize)> = HashSet::new();
        for &(u, v) in &cert.adjacency {
            if u == v {
                return Err(ProbeError::InvalidEdge {
                    u,
                    v,
                    reason: "self-loop".into(),
                });
            }
            if u >= n || v >= n {
                return Err(ProbeError::InvalidEdge {
                    u,
                    v,
                    reason: "vertex index out of range".into(),
                });
            }
            let (a, b) = (u.min(v), u.max(v));
            if !claimed.insert((a, b)) {
                return Err(ProbeError::InvalidEdge {
                    u,
                    v,
                    reason: "duplicate edge listing".into(),
                });
            }
        }

        let mut rederived: HashSet<(usize, usize)> = HashSet::new();
        for i in 0..n {
            for j in (i + 1)..n {
                if points[i].is_unit_distance(&points[j]) {
                    rederived.insert((i, j));
                }
            }
        }

        if claimed != rederived {
            return Ok(ProbeVerdict {
                probe_id: cert.probe_id.clone(),
                verified: false,
                reason: format!(
                    "adjacency mismatch: probe claims {} edges but exact re-derivation finds {}",
                    claimed.len(),
                    rederived.len()
                ),
                field_name: field.name.clone(),
                vertex_count: n,
                edge_count: rederived.len(),
                sanity: None,
                sanity_error: None,
            });
        }

        // ---- Sanity gate: Stage-0 invariants on the re-derived graph ----
        let mut adj: Vec<HashSet<usize>> = vec![HashSet::new(); n];
        for &(u, v) in &claimed {
            adj[u].insert(v);
            adj[v].insert(u);
        }

        match GraphSanityChecker::verify_chromatic_bound(&adj, cert.chromatic_claim) {
            Ok(sanity) => Ok(ProbeVerdict {
                probe_id: cert.probe_id.clone(),
                verified: true,
                reason: "all gates passed".into(),
                field_name: field.name.clone(),
                vertex_count: n,
                edge_count: claimed.len(),
                sanity: Some(sanity),
                sanity_error: None,
            }),
            Err(e) => Ok(ProbeVerdict {
                probe_id: cert.probe_id.clone(),
                verified: false,
                reason: format!("sanity gate rejected χ ≥ {}: {e}", cert.chromatic_claim),
                field_name: field.name.clone(),
                vertex_count: n,
                edge_count: claimed.len(),
                sanity: None,
                sanity_error: Some(e),
            }),
        }
    }
}

pub fn default_probe_timeout() -> Duration {
    Duration::from_secs(10)
}

/// Runs a probe binary as a hardened subprocess: cleared environment, the
/// discovery spec on stdin, a hard timeout (kills the child on expiry), and a
/// 64 KiB stdout cap. Returns the raw stdout for [`DynamicProbeVerifier::verify`].
pub async fn run_probe_binary(
    binary: &Path,
    domain_spec_json: &str,
    timeout_duration: Duration,
) -> Result<String, ProbeError> {
    let mut cmd = Command::new(binary);
    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .env_clear()
        .kill_on_drop(true);
    let mut child = cmd.spawn()?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(domain_spec_json.as_bytes()).await?;
        drop(stdin);
    }

    let wait_result = timeout(timeout_duration, child.wait_with_output()).await;
    match wait_result {
        Ok(Ok(output)) => {
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            if stdout_str.len() > MAX_PROBE_OUTPUT_BYTES {
                return Err(ProbeError::ProcessFailed(format!(
                    "probe output exceeds {} bytes",
                    MAX_PROBE_OUTPUT_BYTES
                )));
            }
            if !output.status.success() && stdout_str.trim().is_empty() {
                return Err(ProbeError::ProcessFailed(
                    String::from_utf8_lossy(&output.stderr).to_string(),
                ));
            }
            Ok(stdout_str.to_string())
        }
        Ok(Err(e)) => Err(ProbeError::Io(e)),
        // kill_on_drop(true) reaps the child on drop
        Err(_) => Err(ProbeError::Timeout(timeout_duration)),
    }
}

/// Convenience for the outer loop: run a probe, verify its certificate.
pub async fn run_and_verify(
    binary: &Path,
    domain_spec_json: &str,
    timeout_duration: Duration,
) -> Result<ProbeVerdict, ProbeError> {
    let output = run_probe_binary(binary, domain_spec_json, timeout_duration).await?;
    DynamicProbeVerifier::verify(&output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use num_rational::BigRational;

    fn rat(n: i64, d: i64) -> BigRational {
        BigRational::new(n.into(), d.into())
    }

    /// Equilateral unit-distance triangle in ℚ(√3)²: χ = 3 exactly.
    fn triangle_cert(field_spec: &str) -> ProbeCertificate {
        ProbeCertificate {
            probe_id: "tri".into(),
            field_spec: field_spec.into(),
            witness_points: vec![
                [vec![rat(0, 1), rat(0, 1)], vec![rat(0, 1), rat(0, 1)]],
                [vec![rat(1, 1), rat(0, 1)], vec![rat(0, 1), rat(0, 1)]],
                [vec![rat(1, 2), rat(0, 1)], vec![rat(0, 1), rat(1, 2)]],
            ],
            adjacency: vec![(0, 1), (0, 2), (1, 2)],
            chromatic_claim: 3,
        }
    }

    /// Canonical 8-star in ℚ(√2)²: origin + D8 orbit of (1,0); χ = 2.
    /// Orbit point k = rotation by k·π/4 of (1, 0).
    fn star_cert(field_spec: &str) -> ProbeCertificate {
        let orbit = |k: i64| {
            // (cos kπ/4, sin kπ/4) in ℚ(√2): √2/2 = [0, 1/2]
            match k.rem_euclid(8) {
                0 => [vec![rat(1, 1), rat(0, 1)], vec![rat(0, 1), rat(0, 1)]],
                1 => [vec![rat(0, 1), rat(1, 2)], vec![rat(0, 1), rat(1, 2)]],
                2 => [vec![rat(0, 1), rat(0, 1)], vec![rat(1, 1), rat(0, 1)]],
                3 => [vec![rat(0, 1), rat(-1, 2)], vec![rat(0, 1), rat(1, 2)]],
                4 => [vec![rat(-1, 1), rat(0, 1)], vec![rat(0, 1), rat(0, 1)]],
                5 => [vec![rat(0, 1), rat(-1, 2)], vec![rat(0, 1), rat(-1, 2)]],
                6 => [vec![rat(0, 1), rat(0, 1)], vec![rat(-1, 1), rat(0, 1)]],
                _ => [vec![rat(0, 1), rat(1, 2)], vec![rat(0, 1), rat(-1, 2)]],
            }
        };
        let mut points = vec![[vec![rat(0, 1), rat(0, 1)], vec![rat(0, 1), rat(0, 1)]]];
        for k in 0..8 {
            points.push(orbit(k));
        }
        let adjacency: Vec<(usize, usize)> = (1..=8).map(|i| (0, i)).collect();
        ProbeCertificate {
            probe_id: "star".into(),
            field_spec: field_spec.into(),
            witness_points: points,
            adjacency,
            chromatic_claim: 2,
        }
    }

    fn verify_json(cert: &ProbeCertificate) -> Result<ProbeVerdict, ProbeError> {
        DynamicProbeVerifier::verify(&serde_json::to_string(cert).unwrap())
    }

    #[test]
    fn test_verify_accepts_genuine_triangle_certificate() {
        let verdict = verify_json(&triangle_cert("QQ[sqrt(3)]")).unwrap();
        assert!(verdict.verified, "genuine certificate must verify: {}", verdict.reason);
        assert_eq!(verdict.vertex_count, 3);
        assert_eq!(verdict.edge_count, 3);
        assert_eq!(verdict.field_name, "QQ[sqrt(3)]");
        let sanity = verdict.sanity.expect("sanity certificate present");
        assert_eq!(sanity.turan_forced_clique_bound, Some(3));
        assert!(verdict.sanity_error.is_none());
    }

    #[test]
    fn test_verify_rejects_fabricated_extra_edge() {
        let mut cert = star_cert("QQ[sqrt(2)]");
        cert.adjacency.push((1, 2)); // orbit points are at distance² = 2 − √2 ≠ 1
        let verdict = verify_json(&cert).unwrap();
        assert!(!verdict.verified, "fabricated edge must fail verification");
        assert!(verdict.reason.contains("adjacency"), "reason: {}", verdict.reason);
    }

    #[test]
    fn test_verify_rejects_missing_edge() {
        let mut cert = star_cert("QQ[sqrt(2)]");
        cert.adjacency.remove(0); // drop the (0,1) spoke
        let verdict = verify_json(&cert).unwrap();
        assert!(!verdict.verified, "omitted edge must fail verification");
        assert!(verdict.reason.contains("adjacency"), "reason: {}", verdict.reason);
    }

    #[test]
    fn test_verify_rejects_unsound_chromatic_claim() {
        let mut cert = triangle_cert("QQ[sqrt(3)]");
        cert.chromatic_claim = 5; // triangle is 2-degenerate ⟹ χ ≤ 3
        let verdict = verify_json(&cert).unwrap();
        assert!(!verdict.verified);
        assert!(
            matches!(verdict.sanity_error, Some(SanityError::DegeneracyViolation { .. })),
            "expected degeneracy rejection, got: {:?}",
            verdict.sanity_error
        );
    }

    #[test]
    fn test_verify_rejects_bipartite_graph_with_chi_ge_3() {
        let mut cert = star_cert("QQ[sqrt(2)]");
        cert.chromatic_claim = 3; // star is bipartite ⟹ χ = 2
        let verdict = verify_json(&cert).unwrap();
        assert!(!verdict.verified);
        assert!(
            matches!(verdict.sanity_error, Some(SanityError::BipartiteViolation { .. })),
            "expected bipartite rejection, got: {:?}",
            verdict.sanity_error
        );
    }

    #[test]
    fn test_verify_rejects_reducible_field_spec() {
        let cert = triangle_cert("QQ[sqrt(4)]"); // x² − 4 reducible
        assert!(matches!(verify_json(&cert), Err(ProbeError::Field(_))));
    }

    #[test]
    fn test_verify_rejects_malformed_field_spec() {
        let cert = triangle_cert("QQ[sqrt(2]");
        assert!(matches!(verify_json(&cert), Err(ProbeError::Field(_))));
    }

    #[test]
    fn test_verify_rejects_duplicate_points() {
        let mut cert = triangle_cert("QQ[sqrt(3)]");
        cert.witness_points[2] = cert.witness_points[0].clone();
        assert!(matches!(verify_json(&cert), Err(ProbeError::DuplicatePoints(0, 2))));
    }

    #[test]
    fn test_verify_rejects_wrong_dimension_point() {
        let mut cert = triangle_cert("QQ[sqrt(3)]");
        cert.witness_points[1][0] = vec![rat(1, 1)]; // degree-2 field needs 2 coefficients
        assert!(matches!(
            verify_json(&cert),
            Err(ProbeError::PointDimension { point: 1, actual: 1, expected: 2 })
        ));
    }

    #[test]
    fn test_verify_rejects_self_loop() {
        let mut cert = triangle_cert("QQ[sqrt(3)]");
        cert.adjacency.push((1, 1));
        assert!(matches!(verify_json(&cert), Err(ProbeError::InvalidEdge { .. })));
    }

    #[test]
    fn test_verify_rejects_out_of_range_edge() {
        let mut cert = triangle_cert("QQ[sqrt(3)]");
        cert.adjacency.push((2, 99));
        assert!(matches!(verify_json(&cert), Err(ProbeError::InvalidEdge { .. })));
    }

    #[test]
    fn test_verify_rejects_duplicate_edge_listing() {
        let mut cert = triangle_cert("QQ[sqrt(3)]");
        cert.adjacency.push((1, 0)); // same edge as (0,1), listed twice
        assert!(matches!(verify_json(&cert), Err(ProbeError::InvalidEdge { .. })));
    }

    #[test]
    fn test_verify_rejects_malformed_json() {
        assert!(matches!(
            DynamicProbeVerifier::verify("this is not a certificate"),
            Err(ProbeError::Parse(_))
        ));
    }

    #[test]
    fn test_verify_accepts_vacuous_empty_graph() {
        let cert = ProbeCertificate {
            probe_id: "empty".into(),
            field_spec: "QQ".into(),
            witness_points: vec![],
            adjacency: vec![],
            chromatic_claim: 0,
        };
        let verdict = verify_json(&cert).unwrap();
        assert!(verdict.verified);
        assert_eq!(verdict.vertex_count, 0);
    }

    #[test]
    fn test_verify_certificate_struct_direct() {
        // Same acceptance path exercised through the struct-based entry point.
        let cert = triangle_cert("QQ[sqrt(3)]");
        let verdict = DynamicProbeVerifier::verify_certificate(&cert).unwrap();
        assert!(verdict.verified);
        assert_eq!(verdict.edge_count, 3);
    }

    #[test]
    fn test_verify_rejects_claim_one_on_empty_graph() {
        let cert = ProbeCertificate {
            probe_id: "empty".into(),
            field_spec: "QQ".into(),
            witness_points: vec![],
            adjacency: vec![],
            chromatic_claim: 1,
        };
        let verdict = verify_json(&cert).unwrap();
        assert!(!verdict.verified);
        assert!(matches!(verdict.sanity_error, Some(SanityError::EmptyGraph(1))));
    }
}
