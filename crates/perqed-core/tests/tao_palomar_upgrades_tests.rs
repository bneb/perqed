//! Terence Tao / Palomar Standard Upgrade Verification Suite
//!
//! Verifies the 5 concrete engineering upgrades:
//! 1. Palomar Registry Exporter (challenge.lean, solution.lean, formalization.yaml)
//! 2. Anti-Exploit Exact Arithmetic (BigRational + ArbInterval + DegeneracyChecker)
//! 3. Algebraic Invariant Parameterization (Resultants, SL_n Equivariance, Variety Slices)
//! 4. Conclusion Mutation Gate (H ⊢ ¬C Non-Triviality Verification)
//! 5. Lean Daemon Worker Pool & MCTS Cycle Pruning

use num_bigint::BigInt;
use num_rational::BigRational;
use num_traits::Zero;
use perqed_audit::{ConclusionMutationGate, SpecLock};
use perqed_core::invariant_search::AlgebraicInvariantSearchEngine;
use perqed_export::PalomarBundle;
use perqed_lean_client::{GoalCycleDetector, LeanWorkerPool};
use perqed_sandbox::exact_math::{ArbInterval, DegeneracyChecker};
use tempfile::tempdir;

#[test]
fn test_red_to_green_palomar_bundle_export() {
    let tmp = tempdir().unwrap();
    let out_dir = tmp.path().join("palomar_bundle");

    let lock = SpecLock {
        spec_file: "lean/Perqed/Spec/nat_add_right_id.lean".to_string(),
        sha256_hash: "94b9f3e18a24...".to_string(),
        canonical_len: 120,
        declarations: vec!["Perqed.Spec.nat_add_right_id".to_string()],
        created_at: chrono::Utc::now(),
        perqed_version: "0.2.0".to_string(),
    };

    let bundle = PalomarBundle::from_verified_theorem(
        "Perqed.Proofs.nat_add_right_id",
        "Right Identity of Natural Addition",
        "For all natural numbers n, n + 0 = n",
        "namespace Perqed.Spec\ndef nat_add_right_id (n : Nat) : Prop := n + 0 = n\nend Perqed.Spec",
        "theorem nat_add_right_id : ∀ n, Perqed.Spec.nat_add_right_id n := by intro n; rfl",
        &lock,
        0.038,
        4120.0,
    );

    let export_path = bundle.export_to_dir(&out_dir).unwrap();
    assert!(export_path.join("challenge.lean").exists());
    assert!(export_path.join("solution.lean").exists());
    assert!(export_path.join("formalization.yaml").exists());

    let yaml = std::fs::read_to_string(export_path.join("formalization.yaml")).unwrap();
    assert!(yaml.contains("schema_version: \"1.0\""));
    assert!(yaml.contains("theorem_id: \"Perqed.Proofs.nat_add_right_id\""));
    assert!(yaml.contains("sorrys_count: 0"));
    assert!(yaml.contains("total_cost_usd: 0.0380"));
}

#[test]
fn test_red_to_green_anti_exploit_exact_rational_and_intervals() {
    // 1. Exact Arb Interval inclusion
    let i1 = ArbInterval::from_integers(3, 7).unwrap();
    let i2 = ArbInterval::from_integers(-2, 4).unwrap();

    let product = i1.mul(&i2);
    // [3, 7] * [-2, 4] = [-14, 28]
    assert_eq!(product.inf, BigRational::from_integer(BigInt::from(-14)));
    assert_eq!(product.sup, BigRational::from_integer(BigInt::from(28)));

    // 2. Exact Matrix Determinant without float epsilon exploits
    let singular_mat = vec![
        vec![BigRational::from_integer(2.into()), BigRational::from_integer(4.into())],
        vec![BigRational::from_integer(1.into()), BigRational::from_integer(2.into())],
    ];
    let det = DegeneracyChecker::exact_determinant(&singular_mat).unwrap();
    assert!(det.is_zero(), "Singular matrix determinant must be strictly zero in exact arithmetic");

    // 3. Pairwise Vertex Separation (preventing corridor clipping / point collapse)
    let p1 = vec![BigRational::from_integer(1.into()), BigRational::from_integer(2.into())];
    let p2 = vec![BigRational::from_integer(1.into()), BigRational::from_integer(2.into())];
    let sep_res = DegeneracyChecker::check_pairwise_separation(&[p1, p2]);
    assert!(sep_res.is_err(), "Pairwise separation must flag coinciding points");
}

#[test]
fn test_red_to_green_algebraic_invariants_jacobian_templates() {
    let templates = AlgebraicInvariantSearchEngine::generate_invariant_templates("jacobian", 3);
    assert!(templates.len() >= 3);

    let candidate = AlgebraicInvariantSearchEngine::instantiate_candidate(&templates[0]);
    assert!(candidate.degrees_of_freedom <= 6, "Symmetry-slicing must reduce DOF from 360 to <= 6");
    assert!(candidate.symbolic_map.contains("Res(P_1, Q_2)=1"));
}

#[test]
fn test_red_to_green_conclusion_mutation_gate() {
    // Test conclusion negation
    assert_eq!(
        ConclusionMutationGate::invert_conclusion("∀ n, n + 0 = n"),
        "∀ n, n + 0 ≠ n"
    );

    // Test non-triviality check on valid theorem
    let report = ConclusionMutationGate::audit_conclusion_non_trivial(
        &["n > 0".to_string()],
        "n + 1 > 1",
    )
    .unwrap();
    assert!(report.mutation_passed);
    assert_eq!(report.inverted_target, "n + 1 ≤ 1");

    // Test rejection of trivial tautology
    let tautology_res = ConclusionMutationGate::audit_conclusion_non_trivial(&[], "x = x");
    assert!(tautology_res.is_err(), "Trivial tautology x = x must be rejected by mutation gate");
}

#[test]
fn test_red_to_green_daemon_worker_pool_and_cycle_pruning() {
    // 1. Worker Pool recycling at 500
    let pool = LeanWorkerPool::new(4, 500);
    for _ in 0..499 {
        assert!(!pool.record_evaluation());
    }
    assert!(pool.record_evaluation(), "500th evaluation must trigger daemon recycling");
    assert_eq!(pool.get_stats().recycled_count, 1);

    // 2. Goal State Cycle Detector
    let mut detector = GoalCycleDetector::new();
    let state_a = "⊢ ∀ a b : Nat, a + b = b + a";
    let state_b = "h_step : Nat ⊢ ∀ a b : Nat, a + b = b + a";
    let state_c = "h_another : Nat ⊢ ∀ a b : Nat, a + b = b + a"; // Alpha-equivalent to state_b

    assert!(!detector.check_and_record_cycle(state_a));
    assert!(!detector.check_and_record_cycle(state_b));
    assert!(detector.check_and_record_cycle(state_c), "Alpha-equivalent hypothesis state must be detected as cycle");
}
