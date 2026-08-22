use perqed_core::dag::MathlibDag;
use perqed_core::roi::RoiEvaluator;
use perqed_core::types::Conjecture;
use std::collections::HashMap;

#[test]
fn test_mathlib_dag_topological_distance() {
    let dag = MathlibDag::new();

    // Distance to self is 0
    assert_eq!(dag.topological_distance("Init.Core", "Init.Core"), 0);

    // Direct dependency distance is 1 (Init.Core -> Mathlib.Logic.Basic)
    assert_eq!(dag.topological_distance("Init.Core", "Mathlib.Logic.Basic"), 1);

    // Multi-hop distance (Init.Core -> Logic.Basic -> Data.Nat.Basic -> Algebra.Ring.Basic)
    let d = dag.topological_distance("Init.Core", "Mathlib.Algebra.Ring.Basic");
    assert!(d >= 2);
}

#[test]
fn test_roi_ranking_promotes_high_value_conjectures() {
    let dag = MathlibDag::new();
    let evaluator = RoiEvaluator::new(dag);

    let mut vars = HashMap::new();
    vars.insert("n".to_string(), "Nat".to_string());

    // 1. High-value conjecture (unifies core algebra, concise, solvable by decision procedures)
    let high_value = Conjecture {
        conjecture_id: "conj_unifying_ring".to_string(),
        domain: "algebra.ring".to_string(),
        informal_claim: "a * (b + c) = a * b + a * c".to_string(),
        hypotheses: vec![],
        target: "a * (b + c) = a * b + a * c".to_string(),
        variables: vars.clone(),
        custom_predicates: vec![],
        provenance_source: None,
    };

    // 2. Low-value obscure conjecture (esoteric domain, huge description length)
    let low_value = Conjecture {
        conjecture_id: "conj_esoteric_bloat".to_string(),
        domain: "esoteric.subfield".to_string(),
        informal_claim: "An excessively long informal description of an ad-hoc polynomial identity with minimal mathematical unification".to_string(),
        hypotheses: vec![],
        target: "OverlyComplexTargetExpression".to_string(),
        variables: vars,
        custom_predicates: vec![],
        provenance_source: None,
    };

    let batch = vec![low_value, high_value];
    let ranked = evaluator.rank_and_filter(&batch, 50.0);

    assert_eq!(ranked.len(), 2);
    assert_eq!(ranked[0].0.conjecture_id, "conj_unifying_ring");
    assert!(ranked[0].1.is_promoted);
    assert!(!ranked[1].1.is_promoted);
    assert!(ranked[0].1.total_roi > ranked[1].1.total_roi);
}
