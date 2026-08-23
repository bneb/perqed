//! Verification of Centralized Magic Constants and Modular Hyperparameter Configurations

use perqed_core::embeddings::{EmbedderConfig, SubwordEmbedder};
use perqed_core::falsification::FalsificationConfig;
use perqed_core::ingestion::{HybridPremiseWeights, PremiseIndex, PremiseItem};
use perqed_core::program_search::{GeneticSearchConfig, ProgramDatabase};
use perqed_core::roi::{RoiEvaluator, RoiWeights};
use perqed_core::tactic_generator::TacticGenerator;
use perqed_core::types::{Conjecture, ProofState, TacticPriorScores};
use perqed_core::{MathlibDag, ModelRouter};
use std::collections::HashMap;

#[test]
fn test_embedder_config_parameterization() {
    let custom_config = EmbedderConfig {
        token_weight: 4.0,
        subword_ngram_weight: 1.0,
        min_ngram: 3,
        max_ngram: 5,
        math_features: vec![
            ("add".to_string(), 2.5),
            ("zero".to_string(), 2.5),
            ("comm".to_string(), 3.0),
        ],
    };

    let text = "forall (x : Nat), x + 0 = x";

    let default_vec = SubwordEmbedder::embed(text);
    let custom_vec = SubwordEmbedder::embed_with_config(text, &custom_config);

    assert_eq!(default_vec.0.len(), 128);
    assert_eq!(custom_vec.0.len(), 128);

    // Both should be unit normalized
    let norm_def: f32 = default_vec.0.iter().map(|v| v * v).sum();
    let norm_cust: f32 = custom_vec.0.iter().map(|v| v * v).sum();
    assert!((norm_def - 1.0).abs() < 1e-4);
    assert!((norm_cust - 1.0).abs() < 1e-4);

    let sim = default_vec.cosine_similarity(&custom_vec);
    assert!(sim > 0.80, "Custom weighted vectors should retain semantic alignment with default embedder");
}

#[test]
fn test_hybrid_premise_weights_customization() {
    let mut index = PremiseIndex::with_weights(HybridPremiseWeights {
        dense_cosine_scale: 20.0,
        lexical_name_weight: 10.0,
        lexical_signature_weight: 5.0,
        lexical_docstring_weight: 3.0,
        head_symbol_bonus: 6.0,
        default_retrieval_limit: 3,
    });

    index.insert(PremiseItem {
        name: "Custom.add_zero".to_string(),
        signature: "∀ (n : Nat), n + 0 = n".to_string(),
        docstring: "Addition with zero on the right".to_string(),
        domain: "algebra.nat".to_string(),
        complexity_weight: 1.0,
        head_symbol: Some("Nat.add".to_string()),
    });

    index.insert(PremiseItem {
        name: "Custom.mul_zero".to_string(),
        signature: "∀ (n : Nat), n * 0 = 0".to_string(),
        docstring: "Multiplication with zero".to_string(),
        domain: "algebra.nat".to_string(),
        complexity_weight: 1.0,
        head_symbol: Some("Nat.mul".to_string()),
    });

    let results = index.hybrid_search("n + 0 = n", 2);
    assert!(!results.is_empty());
    assert_eq!(results[0].name, "Custom.add_zero");
}

#[test]
fn test_tactic_prior_scores_customization() {
    let custom_priors = TacticPriorScores {
        rfl_score: 0.99,
        decision_proc_score: 0.95,
        rewrite_premise_score: 0.90,
        exact_premise_score: 0.88,
        exact_hole_premise_score: 0.87,
        apply_premise_score: 0.86,
        simp_premise_score: 0.85,
        constructor_score: 0.92,
        intro_score: 0.96,
    };

    let router = ModelRouter::auto_discover();
    let tac_gen = TacticGenerator::with_scores(router, None, custom_priors);

    let _state = ProofState {
        open_goals: vec!["∀ (n : Nat), n + 0 = n".to_string()],
        hypotheses: vec![],
        is_solved: false,
        cumulative_tactics: vec![],
        search_depth: 0,
        raw_lean_state: "⊢ ∀ (n : Nat), n + 0 = n".to_string(),
    };

    assert_eq!(tac_gen.scores.rfl_score, 0.99);
    assert_eq!(tac_gen.scores.rewrite_premise_score, 0.90);
    assert_eq!(tac_gen.scores.intro_score, 0.96);
}

#[test]
fn test_roi_weights_customization() {
    let dag = MathlibDag::new();
    let custom_weights = RoiWeights {
        intrinsic_weight: 0.50,
        difficulty_weight: 0.30,
        novelty_weight: 0.20,
        mdl_lambda: 0.10, // aggressive MDL compression penalty
        token_bit_weight: 12.0,
        char_bit_weight: 4.0,
    };

    let evaluator = RoiEvaluator::with_weights(dag, custom_weights, Default::default());

    let mut vars = HashMap::new();
    vars.insert("n".to_string(), "Nat".to_string());

    let conj = Conjecture {
        conjecture_id: "test_conj".to_string(),
        domain: "algebra.nat".to_string(),
        informal_claim: "n + 0 = n".to_string(),
        hypotheses: vec![],
        target: "n + 0 == n".to_string(),
        variables: vars,
        custom_predicates: vec![],
        provenance_source: None,
    };

    let score = evaluator.evaluate_conjecture(&conj, 50);
    assert!(score.information_gain > 0.0);
    assert!(score.total_roi > 0.0);
}

#[test]
fn test_falsification_and_genetic_configs() {
    let falsify_cfg = FalsificationConfig {
        default_timeout_seconds: 10.0,
        default_sample_budget: 250,
        default_coord_min: -500.0,
        default_coord_max: 500.0,
        float_tolerance: 1e-8,
    };
    assert_eq!(falsify_cfg.default_sample_budget, 250);

    let genetic_cfg = GeneticSearchConfig {
        default_database_capacity: 100,
        crossover_temperature: 0.3,
        max_generation_budget: 30,
        min_terms_for_oeis_match: 4,
    };
    let db = ProgramDatabase::new(genetic_cfg.default_database_capacity);
    assert_eq!(db.len(), 0);
}
