//! End-to-End Wiring Verification for Terence Tao Synthesis Discoveries
//!
//! Verifies:
//! 1. Multiplicative Integer Anatomy & Anti-Sieve Inspector
//! 2. Multi-Domain Dynamic Algebraic Symmetry Slicing (SL_n(Z), Galois C_d, Resultants, Pell-Powerful varieties)
//! 3. Empirical Discovery Registry & Negative Folklore Logging in FrontierPipeline

use perqed_core::{
    AlgebraicInvariantSearchEngine, AlgebraicInvariantTemplate, ConjectureStatus,
    FrontierPipeline, IntegerAnatomyInspector,
};
use tempfile::tempdir;

#[test]
fn test_erdos_graham_anatomy_and_anti_sieve() {
    // Verify Tao's 2026/03/31 Erdős-Graham example:
    // s(8 * 9 * 10) = s(720) = 5 = s(6!)
    let s_interval = IntegerAnatomyInspector::squarefree_product_interval(7, 3);
    assert_eq!(s_interval, 5);

    let anatomy_720 = IntegerAnatomyInspector::analyze(720); // 720 = 2^4 * 3^2 * 5
    assert_eq!(anatomy_720.squarefree_part, 5);
    assert_eq!(anatomy_720.largest_prime_factor, 5);
    assert_eq!(anatomy_720.omega_distinct, 3);
    assert_eq!(anatomy_720.big_omega_total, 7);

    // Powerful number verification (e.g. 72 = 2^3 * 3^2, 108 = 2^2 * 3^3)
    assert!(IntegerAnatomyInspector::is_powerful_number(72));
    assert!(IntegerAnatomyInspector::is_powerful_number(108));
    assert!(!IntegerAnatomyInspector::is_powerful_number(12)); // 12 = 2^2 * 3^1 (3 is not squared)

    let (a, b) = IntegerAnatomyInspector::powerful_decomposition(108).unwrap();
    assert_eq!(a * a * b * b * b, 108);

    // Anti-sieve small prime density calculation
    let density_normal = IntegerAnatomyInspector::anti_sieve_small_prime_density(101); // Prime > 19
    let density_clustered = IntegerAnatomyInspector::anti_sieve_small_prime_density(2 * 2 * 3 * 3 * 5 * 7);
    assert_eq!(density_normal, 0.0);
    assert!(density_clustered > 1.5, "Highly divisible composite must yield high anti-sieve score");
}

#[test]
fn test_symmetry_slicing_multi_domain_templates() {
    // 1. Algebraic Geometry & Jacobian
    let ag_templates = AlgebraicInvariantSearchEngine::generate_invariant_templates("algebraic_geometry", 3);
    assert_eq!(ag_templates.len(), 3);
    let cand_ag = AlgebraicInvariantSearchEngine::instantiate_candidate(&ag_templates[0]);
    assert!(cand_ag.degrees_of_freedom < 10, "Symmetry slicing must collapse degrees of freedom");

    // 2. Number Theory & Diophantine Variety Slicing
    let nt_templates = AlgebraicInvariantSearchEngine::generate_invariant_templates("number_theory", 4);
    assert_eq!(nt_templates.len(), 2);
    assert!(matches!(nt_templates[0], AlgebraicInvariantTemplate::AffineVarietySlice { .. }));
    assert!(matches!(nt_templates[1], AlgebraicInvariantTemplate::GroupEquivariantSlice { .. }));

    // 3. Combinatorics / Discrete Odometer
    let comb_templates = AlgebraicInvariantSearchEngine::generate_invariant_templates("combinatorics", 3);
    assert_eq!(comb_templates.len(), 1);
    assert!(matches!(comb_templates[0], AlgebraicInvariantTemplate::DiscreteOdometerShift { .. }));
}

#[test]
fn test_frontier_pipeline_registry_wiring() {
    let tmp = tempdir().unwrap();
    let pipeline = FrontierPipeline::new(tmp.path());

    // Verify initial empty registry
    let initial_reg = pipeline.get_registry();
    assert!(initial_reg.entries.is_empty());

    // Record verified and folklore entries into pipeline's shared registry
    if let Ok(mut reg) = pipeline.registry.lock() {
        reg.record(
            "thm-jacobian-reduction",
            "JacobianSL2CSlicing",
            "det DF = -2 in Sym1 x Sym2 -> Sym3",
            "algebraic_geometry",
            34.5,
            ConjectureStatus::VerifiedTheorem {
                proof_script: "exact SL2C.variety_slice_invariance".to_string(),
                kernel_duration_ms: 18,
            },
        );

        reg.record(
            "folklore-sendov",
            "SendovConjectureUnitDisk",
            "forall p, roots in unit disk implies critical point in dist 1",
            "complex_analysis",
            58.0,
            ConjectureStatus::EmpiricalFolkloreSurviving {
                sample_budget: 50_000,
                search_depth: 12,
                symmetry_slices_tested: vec!["UnitDiskRoots".to_string()],
            },
        );
    }

    let updated_reg = pipeline.get_registry();
    assert_eq!(updated_reg.verified_theorems().len(), 1);
    assert_eq!(updated_reg.folklore_surviving().len(), 1);

    let md_table = pipeline.export_registry_markdown();
    assert!(md_table.contains("JacobianSL2CSlicing"));
    assert!(md_table.contains("SendovConjectureUnitDisk"));
    assert!(md_table.contains("Folklore Surviving"));
    assert!(md_table.contains("Verified (Lean 4)"));
}
