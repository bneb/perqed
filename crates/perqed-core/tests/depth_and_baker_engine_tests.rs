use perqed_core::{
    Conjecture, DepthClassification, LinearFormsLogarithmEngine, MathlibDag, MathematicalDepthEvaluator,
    RoiEvaluator,
};
use std::collections::HashMap;

#[test]
fn test_mathematical_depth_evaluator_classifications() {
    // 1. Trivial Presburger conjecture
    let trivial_report = MathematicalDepthEvaluator::evaluate_depth(
        "x + 0 = x",
        "intro x; omega",
        false,
        false,
    );
    assert_eq!(trivial_report.classification, DepthClassification::TrivialPresburgerOrIdentity);
    assert!(trivial_report.depth_multiplier < 0.20);
    assert!(!trivial_report.is_publication_grade);

    // 2. Intermediate modular non-residue + divisor variety
    let intermediate_report = MathematicalDepthEvaluator::evaluate_depth(
        "p^2 + (2^k * p + 1) = z^2 -> False (k >= 2, p % 2 = 1)",
        "modular_obstruction mod 8; divisor_param d1 * d2",
        false,
        false,
    );
    assert_eq!(intermediate_report.classification, DepthClassification::IntermediateParametricVariety);
    assert_eq!(intermediate_report.depth_multiplier, 1.0);
    assert!(intermediate_report.is_publication_grade);

    // 3. Advanced Baker's method + continued fraction reduction
    let advanced_report = MathematicalDepthEvaluator::evaluate_depth(
        "3^x + 13^y = z^2 has only solutions (3, 2, 14) and (5, 1, 16)",
        "baker linear forms in logarithms; baker_davenport continued_fraction convergent",
        true,
        true,
    );
    assert_eq!(advanced_report.classification, DepthClassification::AdvancedAnalyticalExhaustiveness);
    assert!(advanced_report.depth_multiplier >= 3.0);
    assert!(advanced_report.is_publication_grade);
}

#[test]
fn test_linear_forms_logarithm_engine_baker_davenport_reduction() {
    // Equation: 3^x - 13^y = ...
    // theta = ln(3) / ln(13)
    let theta = 3.0f64.ln() / 13.0f64.ln();
    let convergents = LinearFormsLogarithmEngine::compute_continued_fractions(theta, 20);
    assert!(!convergents.is_empty());
    assert_eq!(convergents[0].partial_quotient, 0); // ln(3) < ln(13) => floor = 0

    // Compute Laurent initial bound B_max (~10^14)
    let b_max = LinearFormsLogarithmEngine::compute_laurent_initial_bound(3, 13, 2.0);
    assert!(b_max >= 1_000_000);

    // Execute Baker-Davenport reduction
    let report = LinearFormsLogarithmEngine::execute_baker_davenport_reduction(3, 13, b_max, 2.0);
    assert!(report.reduced_bound < 50, "Baker-Davenport must reduce astronomical bound down to small constant: got {}", report.reduced_bound);
    assert!(report.exhaustiveness_certified);
}

#[test]
fn test_roi_evaluator_prioritizes_depth_over_cheap_trivialities() {
    let dag = MathlibDag::new();
    let evaluator = RoiEvaluator::new(dag);

    let trivial_conjecture = Conjecture {
        conjecture_id: "trivial_1".to_string(),
        domain: "nat.arithmetic".to_string(),
        informal_claim: "Adding zero to n equals n".to_string(),
        hypotheses: vec![],
        target: "n + 0 = n".to_string(),
        variables: HashMap::new(),
        custom_predicates: vec![],
        provenance_source: Some("autonomous_synthesis".to_string()),
    };

    let analytical_conjecture = Conjecture {
        conjecture_id: "baker_1".to_string(),
        domain: "diophantine.baker.analytical.exhaustiveness".to_string(),
        informal_claim: "Complete resolution of 3^x + 13^y = z^2 via Baker's method".to_string(),
        hypotheses: vec![],
        target: "3^x + 13^y = z^2 global exhaustiveness via linear forms in logarithms".to_string(),
        variables: HashMap::new(),
        custom_predicates: vec![],
        provenance_source: Some("autonomous_synthesis".to_string()),
    };

    let trivial_score = evaluator.evaluate_conjecture(&trivial_conjecture, 100);
    let analytical_score = evaluator.evaluate_conjecture(&analytical_conjecture, 100);

    assert!(
        analytical_score.total_roi > trivial_score.total_roi,
        "Analytical theorem (ROI: {:.2}) must beat trivial Presburger theorem (ROI: {:.2})",
        analytical_score.total_roi, trivial_score.total_roi
    );
}
