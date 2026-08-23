//! Red-to-Green Integration Tests for Benchmark & Discovery Campaign Runner

use perqed_core::benchmark::BenchmarkRunner;
use perqed_core::types::Conjecture;
use std::collections::HashMap;
use tempfile::tempdir;

#[tokio::test]
async fn test_red_to_green_benchmark_campaign_execution() {
    let root = env!("CARGO_MANIFEST_DIR");
    let workspace_root = std::path::Path::new(root).parent().unwrap().parent().unwrap();
    let temp = tempdir().unwrap();

    let runner = BenchmarkRunner::new(workspace_root, temp.path());

    let mut vars = HashMap::new();
    vars.insert("n".to_string(), "Nat".to_string());

    // Dataset containing 1 genuine theorem and 1 false conjecture
    let dataset = vec![
        Conjecture {
            conjecture_id: "bm_valid_add_id".to_string(),
            domain: "algebra.nat".to_string(),
            informal_claim: "For any natural number n, n + 0 = n".to_string(),
            hypotheses: vec!["n >= 0".to_string()],
            target: "n + 0 == n".to_string(),
            variables: vars.clone(),
            custom_predicates: vec![],
            provenance_source: Some("BenchmarkSuite".to_string()),
        },
        Conjecture {
            conjecture_id: "bm_false_square".to_string(),
            domain: "algebra.nat".to_string(),
            informal_claim: "n * n >= 100".to_string(),
            hypotheses: vec!["n >= 2".to_string()],
            target: "n * n >= 100".to_string(),
            variables: vars,
            custom_predicates: vec![],
            provenance_source: Some("BenchmarkSuite".to_string()),
        },
    ];

    let summary = runner.run_benchmark(&dataset).await;

    for item in &summary.items {
        println!("Item: {} (Passed: {}, Error: {:?})", item.conjecture_id, item.passed_falsification, item.error);
    }

    // Verify campaign metrics
    assert_eq!(summary.total_candidates, 2);
    assert_eq!(summary.falsified_count, 1, "False conjecture must be falsified and rejected early!");
    assert_eq!(summary.proofs_solved_count, 1, "Genuine theorem must be solved!");
    assert_eq!(summary.kernel_audited_count, 1, "Genuine theorem must pass cold kernel audit!");
    assert_eq!(summary.solve_rate_percent, 50.0);

    // Verify benchmark report file was written
    let report_file = temp.path().join("benchmark_report.json");
    assert!(report_file.exists());
}
