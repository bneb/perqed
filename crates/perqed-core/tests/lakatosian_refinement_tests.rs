//! Red-to-Green Test Suite: Lakatosian Refinement & Counterexample Repair Engine

use perqed_core::types::Conjecture;
use perqed_sandbox::lakatos::{LakatosianRefiner, LakatosianVault};
use serde_json::json;
use std::collections::HashMap;

#[test]
fn test_lakatosian_vault_records_counterexample_and_deduplicates() {
    let temp_dir = tempfile::tempdir().expect("create temp dir");
    let mut vault = LakatosianVault::new(temp_dir.path());

    let hypothesis = "For all natural numbers n >= 5, n >= 10";
    let counterexample = json!({"n": 7});

    // 1. Record first failure
    let recorded = vault
        .record_failure(hypothesis, &counterexample, "COUNTEREXAMPLE_FOUND")
        .expect("should record");
    assert!(recorded, "First recording should succeed");

    // Verify retrieval
    assert!(vault.is_falsified(hypothesis));
    assert_eq!(vault.all_graveyard_entries().len(), 1);

    // 2. Duplicate recording should be ignored without bloating graveyard
    let duplicate_recorded = vault
        .record_failure(hypothesis, &counterexample, "COUNTEREXAMPLE_FOUND")
        .expect("should handle duplicate");
    assert!(!duplicate_recorded, "Duplicate recording should return false");
    assert_eq!(vault.all_graveyard_entries().len(), 1);
}

#[test]
fn test_lakatosian_boundary_refinement_repairs_conjecture() {
    let mut vars = HashMap::new();
    vars.insert("x".to_string(), "Int".to_string());

    let flawed_conjecture = Conjecture {
        conjecture_id: "test_flawed_conj".to_string(),
        domain: "algebra.real".to_string(),
        informal_claim: "If x^2 >= 4, then x >= 2".to_string(),
        hypotheses: vec!["x^2 >= 4".to_string()],
        target: "x >= 2".to_string(),
        variables: vars,
        custom_predicates: vec![],
        provenance_source: None,
    };

    let counterexample = json!({"x": -3}); // (-3)^2 = 9 >= 4, but -3 is not >= 2

    let refined_claim = LakatosianRefiner::refine_hypothesis(
        &flawed_conjecture.conjecture_id,
        &flawed_conjecture.domain,
        &flawed_conjecture.informal_claim,
        &flawed_conjecture.hypotheses,
        &flawed_conjecture.target,
        &flawed_conjecture.variables,
        &counterexample,
    ).expect("Should synthesize refined boundary conjecture");

    assert_eq!(refined_claim.conjecture_id, "test_flawed_conj_refined");
    // Refined conjecture should include positive sign or non-negativity constraint
    assert!(
        refined_claim.hypotheses.iter().any(|h| h.contains("x >= 0") || h.contains("x > 0")),
        "Refined hypotheses should isolate negative branch obstruction. Got: {:?}",
        refined_claim.hypotheses
    );
    assert_eq!(refined_claim.target, "x >= 2");
}
