//! Red-to-Green Tests for Dual-Engine Proof Search Interleaving

use perqed_core::dual_engine::DualEngineProver;
use perqed_core::model_client::ModelRouter;
use perqed_core::tactic_generator::TacticGenerator;
use perqed_core::types::ProofState;

#[tokio::test]
async fn test_red_to_green_symbolic_decision_procedure_interleaving() {
    let router = ModelRouter::auto_discover();
    let tactic_gen = TacticGenerator::new(router, None);
    let dual_prover = DualEngineProver::new(tactic_gen);

    // Goal requiring linear integer arithmetic: ⊢ a + b <= b + a
    let state_arith = ProofState {
        open_goals: vec!["a + b <= b + a".to_string()],
        hypotheses: vec!["a >= 0".to_string(), "b >= 0".to_string()],
        is_solved: false,
        cumulative_tactics: vec![],
        search_depth: 0,
        raw_lean_state: "⊢ a + b <= b + a".to_string(),
    };

    let tactics = dual_prover
        .generate_interleaved_tactics(&state_arith, &[], 5)
        .await;
    assert!(!tactics.is_empty());

    // Top priority tactic must be the fast symbolic decision procedure `omega`
    assert_eq!(tactics[0].tactic_code, "omega");
    assert_eq!(tactics[0].generator_model, "symbolic_proc:omega");
    assert!(tactics[0].is_terminal);
}
