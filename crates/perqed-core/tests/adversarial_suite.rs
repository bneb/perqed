//! Red-to-Green Adversarial & Soundness Test Suite
//!
//! Enforces that all anti-cheating, falsification, and kernel reflection invariants
//! reliably catch adversarial intrusions and pass on sound mathematical artifacts.

use perqed_audit::{AxiomAuditor, LockManager};
use perqed_core::falsification::{FalsificationGate, PredicateSpec};
use perqed_core::types::Conjecture;
use perqed_lean_client::LeanClient;
use perqed_sandbox::SandboxRunner;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

fn find_workspace_root() -> PathBuf {
    let mut curr = std::env::current_dir().unwrap();
    for _ in 0..4 {
        if curr.join("lakefile.lean").exists() {
            return curr;
        }
        if let Some(parent) = curr.parent() {
            curr = parent.to_path_buf();
        } else {
            break;
        }
    }
    PathBuf::from(".")
}

#[test]
fn test_red_to_green_tampered_hash_lock() {
    let dir = tempdir().unwrap();
    let spec_path = dir.path().join("Spec.lean");

    // 1. Original valid specification
    let original_spec = r#"
namespace Perqed.Spec
def nat_add_right_id (n : Nat) : Prop :=
  n + 0 = n
end Perqed.Spec
"#;
    fs::write(&spec_path, original_spec).unwrap();

    // Create immutable SHA-256 lock
    let lock = LockManager::create_lock(&spec_path).unwrap();
    assert_eq!(lock.sha256_hash.len(), 64);

    // Initial check: GREEN
    assert!(LockManager::verify_lock(&spec_path).unwrap());

    // 2. Adversarial Tamper: modify the target theorem to cheat!
    let tampered_spec = r#"
namespace Perqed.Spec
def nat_add_right_id (n : Nat) : Prop :=
  n + 0 = 0  -- Goalpost shifted!
end Perqed.Spec
"#;
    fs::write(&spec_path, tampered_spec).unwrap();

    // Tampered check: RED (must fail with HashMismatch error)
    let verify_res = LockManager::verify_lock(&spec_path);
    assert!(verify_res.is_err(), "Lock verifier failed to catch tampered spec!");
    match verify_res.unwrap_err() {
        perqed_audit::AuditError::HashMismatch { expected, computed } => {
            assert_ne!(expected, computed);
        }
        other => panic!("Unexpected error type: {:?}", other),
    }

    // 3. Restore to original: GREEN
    fs::write(&spec_path, original_spec).unwrap();
    assert!(LockManager::verify_lock(&spec_path).unwrap());
}

#[tokio::test]
async fn test_red_to_green_falsification_counterexample() {
    let root = find_workspace_root();
    let runner = SandboxRunner::with_workspace_root(root);
    let gate = FalsificationGate::new(runner);

    // 1. False conjecture: x >= 2 => x * x >= 100
    let mut vars = HashMap::new();
    vars.insert("x".to_string(), "Int".to_string());
    let false_conj = Conjecture {
        conjecture_id: "test_false_ineq".to_string(),
        domain: "arithmetic".to_string(),
        informal_claim: "x >= 2 implies x^2 >= 100".to_string(),
        hypotheses: vec!["x >= 2".to_string()],
        target: "x * x >= 100".to_string(),
        variables: vars.clone(),
        custom_predicates: vec![],
        provenance_source: None,
    };

    // False conjecture must be rejected: RED (falsified)
    let check_false = gate.check_conjecture(&false_conj).await;
    assert!(check_false.is_err());
    match check_false.unwrap_err() {
        perqed_core::falsification::FalsificationGateError::ConjectureFalsified(cex, reason) => {
            assert!(cex.is_some());
            let cex_map = cex.unwrap();
            assert!(cex_map.contains_key("x"));
            let x_val: i64 = cex_map["x"].as_str().unwrap().parse().unwrap();
            assert!(x_val >= 2 && x_val * x_val < 100);
            assert!(reason.contains("FALSIFIED"));
        }
        other => panic!("Unexpected error: {:?}", other),
    }

    // 2. Valid conjecture: x >= 2 => x * x >= 4
    let valid_conj = Conjecture {
        conjecture_id: "test_valid_ineq".to_string(),
        domain: "arithmetic".to_string(),
        informal_claim: "x >= 2 implies x^2 >= 4".to_string(),
        hypotheses: vec!["x >= 2".to_string()],
        target: "x * x >= 4".to_string(),
        variables: vars,
        custom_predicates: vec![],
        provenance_source: None,
    };

    // Valid conjecture passes: GREEN
    let check_valid = gate.check_conjecture(&valid_conj).await;
    assert!(check_valid.is_ok());
    assert!(check_valid.unwrap().passed);
}

#[tokio::test]
async fn test_red_to_green_vacuous_hypotheses_contradiction() {
    let root = find_workspace_root();
    let runner = SandboxRunner::with_workspace_root(root);
    let gate = FalsificationGate::new(runner);

    // Contradictory hypotheses: m >= 10 and m <= 5 (H ⊢ ⊥)
    let mut vars = HashMap::new();
    vars.insert("m".to_string(), "Int".to_string());

    let vacuous_conj = Conjecture {
        conjecture_id: "test_vacuous_h".to_string(),
        domain: "arithmetic".to_string(),
        informal_claim: "m >= 10 and m <= 5 implies m == 42".to_string(),
        hypotheses: vec!["m >= 10".to_string(), "m <= 5".to_string()],
        target: "m == 42".to_string(),
        variables: vars,
        custom_predicates: vec![],
        provenance_source: None,
    };

    // Must be rejected as vacuous: RED
    let res = gate.check_conjecture(&vacuous_conj).await;
    assert!(res.is_err());
    match res.unwrap_err() {
        perqed_core::falsification::FalsificationGateError::VacuousHypotheses(msg) => {
            assert!(msg.contains("H ⊢ ⊥") || msg.contains("contradictory"));
        }
        other => panic!("Unexpected error: {:?}", other),
    }
}

#[tokio::test]
async fn test_red_to_green_custom_predicate_separation() {
    let root = find_workspace_root();
    let runner = SandboxRunner::with_workspace_root(root);
    let gate = FalsificationGate::new(runner);

    let mut vars = HashMap::new();
    vars.insert("x".to_string(), "Int".to_string());

    // 1. Trivial / Tautological Predicate: P(x) = True (always true, fails ∃ y, ¬P(y))
    let tautology_conj = Conjecture {
        conjecture_id: "test_tautology_pred".to_string(),
        domain: "logic".to_string(),
        informal_claim: "x >= 0 implies AlwaysTrue(x)".to_string(),
        hypotheses: vec!["x >= 0".to_string()],
        target: "x >= 0".to_string(),
        variables: vars.clone(),
        custom_predicates: vec![PredicateSpec {
            name: "AlwaysTrue".to_string(),
            expr: "x == x".to_string(),
            variables: vars.clone(),
        }],
        provenance_source: None,
    };

    let res_tautology = gate.check_conjecture(&tautology_conj).await;
    assert!(res_tautology.is_err(), "Failed to reject tautological predicate!");

    // 2. Non-vacuous & separated predicate: IsEven(x) = x % 2 == 0
    let proper_conj = Conjecture {
        conjecture_id: "test_proper_pred".to_string(),
        domain: "number_theory".to_string(),
        informal_claim: "x is positive and even".to_string(),
        hypotheses: vec!["x > 0".to_string()],
        target: "x > 0".to_string(),
        variables: vars.clone(),
        custom_predicates: vec![PredicateSpec {
            name: "IsEven".to_string(),
            expr: "x % 2 == 0".to_string(),
            variables: vars,
        }],
        provenance_source: None,
    };

    let res_proper = gate.check_conjecture(&proper_conj).await;
    assert!(res_proper.is_ok(), "Proper separated predicate should pass!");
}

#[tokio::test]
async fn test_red_to_green_kernel_reflection_and_axiom_auditor() {
    let root = find_workspace_root();
    let client = LeanClient::with_root(&root);

    // 1. Valid constructive proof with verified hash: Perqed.Proofs.nat_add_right_id -> GREEN
    let audit_ok = client
        .run_audit_spec(
            "Perqed.Proofs.nat_add_right_id",
            "Perqed.Spec.nat_add_right_id",
            Some("lean/Perqed/Spec/Theorems.lean"),
            Some("b9508e8fa6d6b332a96d67d7dac813c3d04782ea9a8d73fa5762fd06f953e266"),
        )
        .await;
    assert!(audit_ok.is_ok(), "Legitimate proof failed audit: {:?}", audit_ok.err());

    // 2. Adversarial Tamper: Mismatched / forged expected hash -> RED (rejection)
    let audit_tamper = client
        .run_audit_spec(
            "Perqed.Proofs.nat_add_right_id",
            "Perqed.Spec.nat_add_right_id",
            Some("lean/Perqed/Spec/Theorems.lean"),
            Some("0000000000000000000000000000000000000000000000000000000000000000"),
        )
        .await;
    assert!(audit_tamper.is_err(), "Audit gate failed to reject mismatched hash!");

    // 2. Axiom whitelist enforcement: test AxiomAuditor with sorryAx / custom axiom
    let cheat_axioms = vec!["sorryAx".to_string()];
    assert!(AxiomAuditor::audit_axioms(&cheat_axioms).is_err());

    let native_decide_axioms = vec!["Lean.ofReduceBool".to_string()];
    assert!(AxiomAuditor::audit_axioms(&native_decide_axioms).is_err());

    let custom_axioms = vec!["RiemannHypothesisAxiom".to_string()];
    assert!(AxiomAuditor::audit_axioms(&custom_axioms).is_err());

    let standard_axioms = vec![
        "Classical.choice".to_string(),
        "Quot.sound".to_string(),
        "propext".to_string(),
    ];
    assert!(AxiomAuditor::audit_axioms(&standard_axioms).is_ok());
}
