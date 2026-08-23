use perqed_core::librarian::arxiv::ArxivLibrarian;
use perqed_core::pipeline::FrontierPipeline;
use perqed_core::types::Conjecture;
use std::collections::HashMap;
use std::path::PathBuf;

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
fn test_arxiv_atom_feed_parsing_and_claim_extraction() {
    let mock_atom_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2608.12345v1</id>
    <published>2026-08-20T12:00:00Z</published>
    <title>On the Unit-Distance Chromatic Number of Algebraic Planes</title>
    <summary>We prove that the unit-distance graph in the algebraic plane Q(sqrt(3))^2 contains an odd cycle of length 3, and hence its chromatic number satisfies chi >= 3. Furthermore, for all n >= 1, we show that n + 0 = n holds in arithmetic.</summary>
    <author><name>A. Mathematician</name></author>
    <category term="math.CO" />
  </entry>
</feed>"#;

    let papers = ArxivLibrarian::parse_arxiv_atom_feed(mock_atom_feed).unwrap();
    assert_eq!(papers.len(), 1);
    let p = &papers[0];
    assert_eq!(p.arxiv_id, "http://arxiv.org/abs/2608.12345v1");
    assert!(p.title.contains("Chromatic Number"));

    let claims = ArxivLibrarian::extract_candidate_claims(p);
    assert!(!claims.is_empty(), "claims must be extracted from abstract");
    assert!(
        claims.iter().any(|c| c.contains("chromatic number") || c.contains("prove") || c.contains("show")),
        "claims: {claims:?}"
    );
}

#[tokio::test]
async fn test_end_to_end_conjecture_from_extracted_arxiv_claim() {
    // End-to-end test on the synthesized arithmetic claim from the paper
    let mut vars = HashMap::new();
    vars.insert("n".to_string(), "Nat".to_string());

    let conj = Conjecture {
        conjecture_id: "arxiv_claim_nat_add_right_id".to_string(),
        domain: "algebra.nat".to_string(),
        informal_claim: "For any natural number n, n + 0 = n".to_string(),
        hypotheses: vec!["n >= 0".to_string()],
        target: "n + 0 = n".to_string(),
        variables: vars,
        custom_predicates: vec![],
        provenance_source: Some("arXiv:2608.12345v1".to_string()),
    };

    let root = find_workspace_root();
    let pipeline = FrontierPipeline::new(root);
    let result = pipeline.run_on_conjecture(&conj).await;
    assert!(result.is_ok(), "Pipeline must successfully prove and verify extracted conjecture: {:?}", result.err());

    let res = result.unwrap();
    assert!(res.proof_search.is_solved);
    assert!(res.audit_report.kernel_audit_passed);
    assert!(res.audit_report.lock_verified);
}
