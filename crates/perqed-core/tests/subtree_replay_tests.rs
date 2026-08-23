//! Red-to-Green Test Suite: Parametric Subtree Replay & Lemma Lifting Engine

use perqed_core::mcts::replay::SubtreeReplayCache;

#[test]
fn test_parametric_subtree_replay_across_divergent_branches() {
    let mut cache = SubtreeReplayCache::new();

    // Register a proven algebraic pattern: ?X + 0 = ?X proved via rw [Nat.add_zero]
    cache.register_subtree(
        "?X + 0 = ?X",
        "rw [Nat.add_zero]",
        &["X".to_string()],
    );

    // 1. Replay on concrete compound expression (a + b) + 0 = a + b
    let compound_goal = "(a + b) + 0 = a + b";
    let replay_script = cache.try_replay(compound_goal);

    assert!(
        replay_script.is_some(),
        "Expected successful subtree replay for matching compound goal: {}",
        compound_goal
    );
    assert_eq!(replay_script.unwrap(), "rw [Nat.add_zero]");

    // 2. Replay on non-matching goal should return None
    let non_matching_goal = "a * 1 = a";
    assert_eq!(cache.try_replay(non_matching_goal), None);
}

#[test]
fn test_parametric_subtree_lemma_lifting() {
    let lemma_code = SubtreeReplayCache::lift_to_lean_lemma(
        "nat_add_zero_generalized",
        "n + 0 = n",
        "rw [Nat.add_zero]",
        &[("n", "Nat")],
    );

    assert!(lemma_code.contains("theorem nat_add_zero_generalized (n : Nat) : n + 0 = n := by"));
    assert!(lemma_code.contains("rw [Nat.add_zero]"));
}
