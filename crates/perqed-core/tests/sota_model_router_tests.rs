//! Red-to-Green Tests for SOTA Model Router, Reasoning Token Sanitization & Budget Enforcement

use perqed_core::router::{BudgetTracker, TaskType, TierConfig, TieredModelRouter};

#[tokio::test]
async fn test_red_to_green_strip_thinking_and_reasoning_tags() {
    let raw_gemini_37_output = r#"<think>
We need to generate candidate tactics for natural addition identity.
Let's analyze the goal: ⊢ ∀ n : Nat, n + 0 = n.
First, we introduce n with `intro n`.
Then, definition of addition with zero is an identity, so `rfl` or `omega` solves it.
</think>
[
  {"tactic": "intro n; rfl", "score": 0.99},
  {"tactic": "omega", "score": 0.95}
]"#;

    let sanitized = TieredModelRouter::strip_thinking_tags(raw_gemini_37_output);
    assert!(!sanitized.contains("<think>"));
    assert!(!sanitized.contains("Let's analyze the goal"));
    assert!(sanitized.contains(r#"{"tactic": "intro n; rfl", "score": 0.99}"#));

    // Verify raw JSON parses cleanly
    let parsed: serde_json::Value = serde_json::from_str(sanitized.trim()).expect("Sanitized payload must parse as valid JSON");
    assert!(parsed.is_array());
    assert_eq!(parsed.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_red_to_green_budget_tracker_enforcement() {
    // $1.50 budget
    let mut tracker = BudgetTracker::new(1.50);

    // Record Tier 1 usage ($0.05 / M tokens)
    tracker.record_usage(10_000, 2_000, 0.05);
    assert!(tracker.remaining_budget() > 1.49);
    assert!(!tracker.is_budget_exhausted());

    // Record heavy Tier 3 usage ($2.00 / M tokens)
    tracker.record_usage(500_000, 300_000, 2.00); // $1.60 spend -> budget exceeded
    assert!(tracker.is_budget_exhausted());
    assert_eq!(tracker.remaining_budget(), 0.0);
}

#[tokio::test]
async fn test_red_to_green_sota_models_configuration() {
    let mut config = TierConfig::default();
    config.tier1_model = "qwen/Qwen3.8-27B".to_string();
    config.tier1_reasoning_effort = "low".to_string();
    config.tier2_model = "gemini-3.7-flash".to_string();
    config.tier2_fallback_model = "gpt-5.6-luna".to_string();
    config.tier3_model = "gpt-5.6-sol".to_string();
    config.tier3_reasoning_effort = "high".to_string();
    config.tier3_deepseek_model = "deepseek-v4-pro".to_string();

    let router = TieredModelRouter::new(config);

    // Test dispatch with offline fallback for CI
    let t1_res = router.dispatch(TaskType::TacticBeamExpansion, "Goal: ⊢ n + 0 = n", "").await.unwrap();
    assert!(!t1_res.is_empty());

    let t2_res = router.dispatch(TaskType::LiteratureIngestAndPropose, "Literature claim", "").await.unwrap();
    assert!(!t2_res.is_empty());

    let t3_res = router.dispatch(TaskType::AdversarialStatementAudit, "Adversarial referee check", "").await.unwrap();
    assert!(!t3_res.is_empty());
}

#[test]
fn test_red_to_green_power_and_cost_roi_leverage() {
    let model = perqed_core::roi::PowerCostModel::default();

    // 10,000 candidates, 95% (9,500) falsified early in <50ms by native compiled sweeps, 500 surviving
    let (funnel_cost, cost_lev, energy_lev) = model.compute_funnel_leverage(10_000, 500, 100);

    // Verify asymmetric cost efficiency is > 3,000x over naive unconstrained prompting ($1.50 vs $4,687.50)
    assert!(funnel_cost < 2.00, "Funnel cost for 10,000 candidate funnel must be under $2.00 (actual: ${:.2})", funnel_cost);
    assert!(cost_lev > 1000.0, "Cost leverage must exceed 1000x (actual: {:.1}x)", cost_lev);
    assert!(energy_lev > 100.0, "Energy leverage must exceed 100x (actual: {:.1}x)", energy_lev);
}

#[test]
fn test_red_to_green_optimal_triad_intelligence_per_dollar() {
    let model = perqed_core::roi::PowerCostModel::default();

    // Golden Triad: DeepSeek-V4-Pro (T1) + Gemini 3.7 Flash High (T2) + GPT-5.6 Sol (T3)
    // 78% solve rate, 500 tokens per tactic, 4,000 tokens for literature ingestion
    let metrics = model.compute_triad_intelligence_per_dollar(78.0, 500, 4_000);

    assert!(metrics.cost_per_verified_proof_usd < 0.10, "Cost per verified proof must be < $0.10 (actual: ${:.4})", metrics.cost_per_verified_proof_usd);
    assert!(metrics.proofs_per_dollar > 10.0, "Proofs per dollar must exceed 10 (actual: {:.2})", metrics.proofs_per_dollar);
    assert!(metrics.intelligence_multiplier_vs_naive > 500.0, "Intelligence multiplier must exceed 500x (actual: {:.1}x)", metrics.intelligence_multiplier_vs_naive);
}

#[tokio::test]
async fn test_red_to_green_gpt5_6_luna_sublemma_routing() {
    let mut config = TierConfig::default();
    config.tier2_fallback_model = "gpt-5.6-luna".to_string();
    config.tier2_fallback_reasoning = "medium".to_string();

    let router = TieredModelRouter::new(config);

    // Test Sublemma decomposition task routing to GPT-5.6 Luna
    let sublemma_res = router.dispatch(
        TaskType::SublemmaDecomposition,
        "Goal state: ⊢ ∀ a b : Nat, a + b = b + a. Decompose into sub-lemmas.",
        "You are an expert formal theorem prover.",
    ).await.unwrap();

    assert!(!sublemma_res.is_empty());
    assert!(
        sublemma_res.contains("Lemma")
            || sublemma_res.contains("sublemma")
            || sublemma_res.contains("zero_add")
            || sublemma_res.contains("succ_add")
            || sublemma_res.contains("statement")
    );
}
