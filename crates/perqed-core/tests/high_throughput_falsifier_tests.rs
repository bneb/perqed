//! Red-to-Green Tests for High-Throughput Compiled Falsifier & Dead Ends DB

use perqed_sandbox::{CompiledFalsifier, DeadEndRecord, DeadEndsDb};
use std::collections::HashMap;
use tempfile::tempdir;

#[test]
fn test_red_to_green_deep_numerical_falsification() {
    let falsifier = CompiledFalsifier::frontier_scale(); // N = 1,000,000

    // 1. Red Phase: Conjecture that holds for small n < 750,000 but fails at n = 750,000
    // (A shallow prober checking only n in [0, 100] would falsely pass this!)
    let (passed, cex, count, _elapsed) = falsifier.sweep_numerical_assertion(|n| n != 750_000);
    assert!(!passed, "High-throughput falsifier failed to catch deep counterexample!");
    assert_eq!(cex, Some(750_000));
    assert_eq!(count, 750_001);

    // 2. Green Phase: Genuine invariant holding for all n in [0, 1,000,000]
    let (passed_true, cex_none, total_count, elapsed) =
        falsifier.sweep_numerical_assertion(|n| (n + 1) * (n + 1) == n * n + 2 * n + 1);
    assert!(passed_true);
    assert!(cex_none.is_none());
    assert_eq!(total_count, 1_000_001);
    assert!(elapsed < 0.1, "1,000,000 instances must sweep in under 100ms!");
}

#[test]
fn test_red_to_green_dead_ends_pruning() {
    let temp = tempdir().unwrap();
    let mut db = DeadEndsDb::new(temp.path());

    let target_expr = "x * x >= 1000000";

    // Initial state: target is not a known dead end
    assert!(!db.is_known_dead_end(target_expr));

    // Record dead end with counterexample on (x)
    let mut cex = HashMap::new();
    cex.insert("x".to_string(), 5);
    db.record_dead_end(DeadEndRecord {
        conjecture_id: "conj_failed_01".to_string(),
        domain: "arithmetic".to_string(),
        target: target_expr.to_string(),
        canonical_target: String::new(),
        counterexample: cex,
        timestamp: "2026-08-22T08:30:00Z".to_string(),
        test_count: 50_000,
    })
    .unwrap();

    // After recording: queries with identical or alpha-equivalent variable names (y * y >= 1000000)
    // are immediately recognized and pruned!
    assert!(db.is_known_dead_end(target_expr));
    assert!(db.is_known_dead_end("y * y >= 1000000"), "DeadEndsDb must recognize alpha-equivalent variable permutation!");
}
