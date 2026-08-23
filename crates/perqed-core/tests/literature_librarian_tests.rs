//! Red-to-Green Test Suite: Scalable Mathlib 4 Index & Literature Ingestion Engine

use perqed_core::dag::{MathlibDag, MathlibNode};
use perqed_core::librarian::arxiv::ArxivLibrarian;

#[test]
fn test_arxiv_librarian_atom_feed_parsing_and_claim_extraction() {
    let mock_atom_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>Chromatic Bounds on Unit Distance Graphs in Cyclotomic Fields</title>
    <summary>We investigate the Hadwiger-Nelson problem over cyclotomic number fields. Theorem 1.1: Every finite unit-distance graph in Q(zeta_5) is 4-colorable. Furthermore, we conjecture that chromatic number is at least 5 for dense Cayley configurations.</summary>
    <published>2024-01-15T12:00:00Z</published>
    <author><name>Alex Erdős</name></author>
    <author><name>Maria Lovász</name></author>
    <category term="math.CO" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>"#;

    let papers = ArxivLibrarian::parse_arxiv_atom_feed(mock_atom_xml).expect("Should parse Atom feed");
    assert_eq!(papers.len(), 1);
    let paper = &papers[0];
    assert_eq!(paper.arxiv_id, "http://arxiv.org/abs/2401.12345v1");
    assert_eq!(paper.title, "Chromatic Bounds on Unit Distance Graphs in Cyclotomic Fields");
    assert!(paper.summary.contains("Hadwiger-Nelson problem"));
    assert_eq!(paper.authors, vec!["Alex Erdős", "Maria Lovász"]);
    assert_eq!(paper.categories, vec!["math.CO"]);

    // Test theorem/conjecture claim extraction from paper abstract
    let claims = ArxivLibrarian::extract_candidate_claims(paper);
    assert!(!claims.is_empty(), "Should extract candidate mathematical claims from abstract");
    assert!(
        claims.iter().any(|c| c.contains("Theorem") || c.contains("unit-distance") || c.contains("conjecture")),
        "Extracted claims: {:?}",
        claims
    );
}

#[test]
fn test_mathlib_dag_scalable_premise_retrieval() {
    let mut dag = MathlibDag::new();

    // Verify rich default Mathlib 4 index (at least 20+ core mathematical lemmas across domains)
    assert!(dag.len() >= 20, "Expected at least 20 Mathlib nodes in rich DAG, found {}", dag.len());

    // 1. Premise retrieval for arithmetic associativity / commutativity
    let nat_goal = "∀ a b : Nat, a + b = b + a";
    let nat_premises = dag.find_relevant_premises(nat_goal, 3);
    assert!(!nat_premises.is_empty());
    assert!(
        nat_premises.iter().any(|p| p.contains("Nat.add") || p.contains("AddCommGroup")),
        "Expected Nat.add / Commutativity premises, got: {:?}",
        nat_premises
    );

    // 2. Premise retrieval for graph coloring / chromatic bounds
    let graph_goal = "SimpleGraph.chromaticNumber G ≥ 5";
    let graph_premises = dag.find_relevant_premises(graph_goal, 3);
    assert!(!graph_premises.is_empty());
    assert!(
        graph_premises.iter().any(|p| p.contains("SimpleGraph") || p.contains("Combinatorics")),
        "Expected SimpleGraph premises, got: {:?}",
        graph_premises
    );

    // 3. Dynamic insertion and multi-hop topological distance
    dag.insert_node(MathlibNode {
        name: "Mathlib.Combinatorics.HadwigerNelson".to_string(),
        module: "Combinatorics.HadwigerNelson".to_string(),
        domain: "combinatorics.graph".to_string(),
        is_definition: false,
        statement: "Unit distance graphs in Euclidean planes".to_string(),
        dependencies: vec!["Mathlib.Combinatorics.SimpleGraph.Basic".to_string()],
    });

    let dist = dag.topological_distance(
        "Mathlib.Combinatorics.HadwigerNelson",
        "Mathlib.Data.Nat.Basic",
    );
    assert!(dist < 10, "Expected finite graph distance between Hadwiger-Nelson and Nat.Basic, got {}", dist);
}
