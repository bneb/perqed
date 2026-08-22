//! End-to-end dynamic probe loop: compiled probe binaries (linked against the
//! perqed-sandbox prelude) run as hardened subprocesses; their certificates are
//! independently verified by the harness.
//!
//! Cargo sets CARGO_BIN_EXE_<name> for each [[bin]] target of this package
//! (the probes live in src/bin/), which forces them to be built before these
//! tests run.

use perqed_sandbox::dynamic_probe::{run_probe_binary, DynamicProbeVerifier, ProbeError, ProbeVerdict};
use std::path::PathBuf;
use std::time::Duration;

fn example_bin(name: &str) -> PathBuf {
    let var = format!("CARGO_BIN_EXE_{name}");
    PathBuf::from(std::env::var(&var).unwrap_or_else(|_| panic!("cargo must set {var}")))
}

const STAR_SPEC: &str = r#"{"domain": "QQ[sqrt(2)]"}"#;

async fn run_star_probe(claim: u64) -> ProbeVerdict {
    let spec = format!(r#"{{"domain": "QQ[sqrt(2)]", "chromatic_claim": {claim}}}"#);
    let output = run_probe_binary(&example_bin("probe_qsqrt2"), &spec, Duration::from_secs(10))
        .await
        .expect("probe binary runs");
    DynamicProbeVerifier::verify(&output).expect("certificate parses and is structurally sound")
}

#[tokio::test]
async fn test_probe_binary_end_to_end_genuine() {
    let verdict = run_star_probe(2).await;
    assert!(verdict.verified, "genuine probe certificate must verify: {}", verdict.reason);
    assert_eq!(verdict.vertex_count, 9, "origin + 8 orbit points");
    assert_eq!(verdict.edge_count, 8, "only the star spokes are unit-distance");
    let sanity = verdict.sanity.expect("sanity certificate present");
    assert!(sanity.is_bipartite);
}

#[tokio::test]
async fn test_probe_binary_end_to_end_flawed_claim_rejected() {
    // The probe computes the geometry honestly but claims χ ≥ 4 on a bipartite
    // star (χ = 2) — the Stage-0 gate must reject it (the audit scenario).
    let verdict = run_star_probe(4).await;
    assert!(!verdict.verified, "flawed chromatic claim must be rejected");
    assert!(
        matches!(verdict.sanity_error, Some(perqed_sandbox::SanityError::BipartiteViolation { .. })),
        "expected bipartite rejection, got: {:?}",
        verdict.sanity_error
    );
}

#[tokio::test]
async fn test_probe_binary_end_to_end_wrong_field_spec_rejected() {
    // The probe honors the spec, but the spec names a reducible field.
    let spec = r#"{"domain": "QQ[sqrt(4)]"}"#;
    let output = run_probe_binary(&example_bin("probe_qsqrt2"), spec, Duration::from_secs(10))
        .await
        .expect("probe binary runs");
    let res = DynamicProbeVerifier::verify(&output);
    assert!(matches!(res, Err(ProbeError::Field(_))), "got: {res:?}");
}

#[tokio::test]
async fn test_garbage_probe_rejected() {
    let output = run_probe_binary(&example_bin("probe_garbage"), STAR_SPEC, Duration::from_secs(10))
        .await
        .expect("garbage probe runs");
    assert!(matches!(
        DynamicProbeVerifier::verify(&output),
        Err(ProbeError::Parse(_))
    ));
}

#[tokio::test]
async fn test_slow_probe_times_out() {
    let res = run_probe_binary(&example_bin("probe_sleep"), STAR_SPEC, Duration::from_millis(300)).await;
    assert!(matches!(res, Err(ProbeError::Timeout(_))), "got: {res:?}");
}

#[tokio::test]
async fn test_missing_probe_binary_is_io_error() {
    let res = run_probe_binary(
        &PathBuf::from("/nonexistent/probe_binary"),
        STAR_SPEC,
        Duration::from_secs(1),
    )
    .await;
    assert!(matches!(res, Err(ProbeError::Io(_))), "got: {res:?}");
}
