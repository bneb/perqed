//! Red-to-Green Test Suite: Canonical Goal Normalization & Transposition Table

use perqed_core::mcts::transposition::{CanonicalGoalHasher, TranspositionEntry, TranspositionTable};
use perqed_core::types::ProofState;

#[test]
fn test_canonical_goal_normalization_alpha_equivalence() {
    let state_a = ProofState {
        open_goals: vec!["a + b > 0".to_string()],
        hypotheses: vec!["(h1 : a > 0)".to_string(), "(h2 : b > 0)".to_string()],
        is_solved: false,
        cumulative_tactics: vec![],
        search_depth: 1,
        raw_lean_state: "h1 : a > 0\nh2 : b > 0\n⊢ a + b > 0".to_string(),
    };

    // State B has permuted hypothesis order and extra whitespace
    let state_b = ProofState {
        open_goals: vec!["  a + b   > 0  ".to_string()],
        hypotheses: vec!["(h2 : b > 0)".to_string(), "(h1 : a > 0)".to_string()],
        is_solved: false,
        cumulative_tactics: vec![],
        search_depth: 3,
        raw_lean_state: "h2 : b > 0\nh1 : a > 0\n⊢   a + b > 0".to_string(),
    };

    let hash_a = CanonicalGoalHasher::hash_proof_state(&state_a);
    let hash_b = CanonicalGoalHasher::hash_proof_state(&state_b);

    assert_eq!(
        hash_a, hash_b,
        "Permuted hypothesis contexts and whitespace should produce identical canonical goal hashes"
    );
}

#[test]
fn test_transposition_table_instant_closes_recurring_subgoals() {
    let mut table = TranspositionTable::new();

    let state = ProofState {
        open_goals: vec!["x + 0 = x".to_string()],
        hypotheses: vec!["(x : Nat)".to_string()],
        is_solved: true,
        cumulative_tactics: vec!["rw [Nat.add_zero]".to_string()],
        search_depth: 2,
        raw_lean_state: "x : Nat\n⊢ x + 0 = x".to_string(),
    };

    let hash = CanonicalGoalHasher::hash_proof_state(&state);

    // Record solved state in transposition table
    table.insert(
        hash.clone(),
        TranspositionEntry {
            canonical_hash: hash.clone(),
            is_solved: true,
            proof_script: Some("rw [Nat.add_zero]".to_string()),
            value_estimate: 1.0,
            visit_count: 5,
        },
    );

    // Query in a completely distinct branch with identical canonical goal
    let query_state = ProofState {
        open_goals: vec!["x + 0 = x".to_string()],
        hypotheses: vec!["(x : Nat)".to_string()],
        is_solved: false,
        cumulative_tactics: vec!["intros".to_string()],
        search_depth: 8,
        raw_lean_state: "x : Nat\n⊢ x + 0 = x".to_string(),
    };

    let query_hash = CanonicalGoalHasher::hash_proof_state(&query_state);
    let hit = table.lookup(&query_hash);

    assert!(hit.is_some(), "Expected transposition table hit for recurring subgoal");
    let entry = hit.unwrap();
    assert!(entry.is_solved);
    assert_eq!(entry.proof_script.as_deref(), Some("rw [Nat.add_zero]"));
}
