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
    config.tier1_model = "deepseek-ai/DeepSeek-V4-Prover".to_string();
    config.tier2_model = "gemini-3.7-flash".to_string();
    config.tier3_model = "gpt-5.6-luna".to_string();

    let router = TieredModelRouter::new(config);

    // Test dispatch with offline fallback for CI
    let t1_res = router.dispatch(TaskType::TacticBeamExpansion, "Goal: ⊢ n + 0 = n", "").await.unwrap();
    assert!(!t1_res.is_empty());

    let t2_res = router.dispatch(TaskType::LiteratureIngestAndPropose, "Literature claim", "").await.unwrap();
    assert!(!t2_res.is_empty());

    let t3_res = router.dispatch(TaskType::AdversarialStatementAudit, "Adversarial referee check", "").await.unwrap();
    assert!(!t3_res.is_empty());
}
