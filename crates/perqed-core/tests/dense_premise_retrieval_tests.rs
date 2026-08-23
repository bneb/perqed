use perqed_core::embeddings::{SubwordEmbedder, EMBEDDING_DIM};
use perqed_core::ingestion::PremiseIndex;
use perqed_core::mcts::MctsOrchestrator;
use perqed_core::model_client::ModelRouter;
use perqed_core::tactic_generator::TacticGenerator;
use perqed_core::types::MctsConfig;
use perqed_lean_client::LeanClient;
use std::path::PathBuf;
use tempfile::tempdir;

fn find_workspace_root() -> PathBuf {
    let mut curr = std::env::current_dir().unwrap();
    for _ in 0..4 {
        if curr.join("lakefile.lean").exists() {
            return curr;
        }
        if let Some(parent) = curr.parent() {
            curr = parent.to_path_buf();
        } else {
            break;
        }
    }
    PathBuf::from(".")
}

#[test]
fn test_dense_vector_embedding_properties() {
    let v1 = SubwordEmbedder::embed("∀ (n : Nat), n + 0 = n");
    assert_eq!(v1.0.len(), EMBEDDING_DIM);

    // Verify unit L2 normalization
    let norm: f32 = v1.0.iter().map(|&x| x * x).sum::<f32>().sqrt();
    assert!((norm - 1.0).abs() < 1e-5, "Vector must be unit normalized");

    // Identical text -> cosine similarity 1.0
    let v2 = SubwordEmbedder::embed("∀ (n : Nat), n + 0 = n");
    let sim_same = v1.cosine_similarity(&v2);
    assert!((sim_same - 1.0).abs() < 1e-4, "Self-similarity must be ~1.0");

    // Semantic relevance check: Nat addition comm vs Real addition comm vs Graph coloring
    let v_nat_add = SubwordEmbedder::embed("Nat.add_comm ∀ (a b : Nat), a + b = b + a");
    let v_real_add = SubwordEmbedder::embed("Real.add_comm ∀ (a b : Real), a + b = b + a");
    let v_graph = SubwordEmbedder::embed("SimpleGraph.chromaticNumber G <= 4");

    let sim_algebra = v_nat_add.cosine_similarity(&v_real_add);
    let sim_cross_domain = v_nat_add.cosine_similarity(&v_graph);

    assert!(
        sim_algebra > sim_cross_domain,
        "Algebraic addition premises must be closer to each other ({}) than to graph theory ({})",
        sim_algebra,
        sim_cross_domain
    );
}

#[test]
fn test_hybrid_premise_retrieval_semantic_queries() {
    let index = PremiseIndex::new();
    assert!(index.len() >= 30, "Mathlib 4 premise catalog must be populated");

    // Query 1: Natural addition commutativity (paraphrased)
    let hits1 = index.hybrid_search("natural numbers commutativity of addition a + b = b + a", 3);
    assert!(!hits1.is_empty());
    assert_eq!(hits1[0].name, "Nat.add_comm");

    // Query 2: Metric triangle inequality
    let hits2 = index.hybrid_search("metric space triangle inequality dist x z <= dist x y + dist y z", 3);
    assert!(!hits2.is_empty());
    assert_eq!(hits2[0].name, "dist_triangle");

    // Query 3: Classical logic excluded middle
    let hits3 = index.hybrid_search("law of excluded middle P or not P", 3);
    assert!(!hits3.is_empty());
    assert_eq!(hits3[0].name, "Classical.em");

    // Query 4: 3-AP free cap set in affine space
    let hits4 = index.hybrid_search("affine cap set 3-AP progression free in F_3^n", 3);
    assert!(!hits4.is_empty());
    assert_eq!(hits4[0].name, "is_3ap_free");
}

#[tokio::test]
async fn test_mcts_dynamic_subgoal_premise_guided_proof() {
    let root = find_workspace_root();
    let client = LeanClient::with_root(&root);
    let router = ModelRouter::auto_discover();
    let tac_gen = TacticGenerator::new(router, None);
    let tmp = tempdir().unwrap();

    let config = MctsConfig {
        max_iterations: 15,
        max_depth: 6,
        exploration_c: 1.414,
        timeout_seconds: 20,
        num_candidates_per_step: 6,
        sublemma_depth_threshold: 4,
        ..Default::default()
    };

    let orchestrator = MctsOrchestrator::new(tac_gen, client, tmp.path().to_path_buf(), config);

    // Goal: ∀ (n : Nat), n + 0 = n
    let res = orchestrator
        .search_proof("nat_add_zero_probe", "∀ (n : Nat), n + 0 = n")
        .await
        .expect("MCTS proof search must complete");

    assert!(res.is_solved, "MCTS must solve goal via dynamic premise retrieval");
    assert!(!res.proof_script.is_empty());
}
