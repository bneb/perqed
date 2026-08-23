//! Red-to-Green Test Suite: Well-Founded Inductive Knots & Cyclic Proof Detection

use perqed_core::mcts::cyclic::{CyclicProofDetector, CyclicVerdict, GoalComplexityMetric};
use perqed_core::types::ProofState;

#[test]
fn test_cyclic_detector_prunes_sterile_rewrite_loops() {
    let mut detector = CyclicProofDetector::new();

    let state_root = ProofState {
        open_goals: vec!["a + b = b + a".to_string()],
        hypotheses: vec!["(a : Nat)".to_string(), "(b : Nat)".to_string()],
        is_solved: false,
        cumulative_tactics: vec![],
        search_depth: 0,
        raw_lean_state: "⊢ a + b = b + a".to_string(),
    };

    let state_step1 = ProofState {
        open_goals: vec!["b + a = a + b".to_string()],
        hypotheses: vec!["(a : Nat)".to_string(), "(b : Nat)".to_string()],
        is_solved: false,
        cumulative_tactics: vec!["rw [Nat.add_comm]".to_string()],
        search_depth: 1,
        raw_lean_state: "⊢ b + a = a + b".to_string(),
    };

    let state_step2 = ProofState {
        open_goals: vec!["a + b = b + a".to_string()],
        hypotheses: vec!["(a : Nat)".to_string(), "(b : Nat)".to_string()],
        is_solved: false,
        cumulative_tactics: vec!["rw [Nat.add_comm]".to_string(), "rw [Nat.add_comm]".to_string()],
        search_depth: 2,
        raw_lean_state: "⊢ a + b = b + a".to_string(),
    };

    detector.push_state(0, &state_root);
    assert_eq!(detector.check_cycle(&state_step1), CyclicVerdict::NoCycle);

    detector.push_state(1, &state_step1);
    
    // Step 2 is an exact repetition of Root without metric decrease
    let verdict = detector.check_cycle(&state_step2);
    assert!(
        matches!(verdict, CyclicVerdict::SterileCycle { .. }),
        "Expected SterileCycle for tautological rewrite loop, got: {:?}",
        verdict
    );
}

#[test]
fn test_cyclic_detector_identifies_inductive_descent_knot() {
    let mut detector = CyclicProofDetector::new();

    // Root goal: ∀ n : Nat, Even (2 * n)
    let state_root = ProofState {
        open_goals: vec!["∀ n : Nat, Even (2 * n)".to_string()],
        hypotheses: vec![],
        is_solved: false,
        cumulative_tactics: vec![],
        search_depth: 0,
        raw_lean_state: "⊢ ∀ n : Nat, Even (2 * n)".to_string(),
    };

    // Subgoal after inductive step: Even (2 * k) with smaller metric and local induction hypothesis
    let state_descent = ProofState {
        open_goals: vec!["Even (2 * k)".to_string()],
        hypotheses: vec!["(k : Nat)".to_string(), "(ih : Even (2 * k))".to_string()],
        is_solved: false,
        cumulative_tactics: vec!["induction n with | zero => decide | succ k ih => ...".to_string()],
        search_depth: 2,
        raw_lean_state: "k : Nat\nih : Even (2 * k)\n⊢ Even (2 * k)".to_string(),
    };

    detector.push_state(0, &state_root);

    let metric_root = GoalComplexityMetric::compute(&state_root);
    let metric_descent = GoalComplexityMetric::compute(&state_descent);

    assert!(
        metric_descent < metric_root,
        "Subgoal must exhibit strictly smaller structural complexity for inductive knot: {:?} < {:?}",
        metric_descent, metric_root
    );

    let verdict = detector.check_cycle(&state_descent);
    assert!(
        matches!(verdict, CyclicVerdict::InductiveKnot { .. }),
        "Expected InductiveKnot for well-founded structural descent, got: {:?}",
        verdict
    );
}
