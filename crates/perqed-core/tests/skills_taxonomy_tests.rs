//! Red-to-Green Test Suite: Mathematical Skills Taxonomy & Dynamic Injection Engine

use perqed_core::skills::{SkillCategory, SkillMatcher, SkillRegistry};

#[test]
fn test_skill_registry_catalogs_comprehensive_methods() {
    let registry = SkillRegistry::default_catalog();
    
    // Verify comprehensive catalog size (at least 35+ core mathematical skills)
    assert!(
        registry.len() >= 35,
        "Expected at least 35 skills in default catalog, found {}",
        registry.len()
    );

    // Verify presence of critical skills across all required categories
    let categories = [
        SkillCategory::Combinatorics,
        SkillCategory::Analysis,
        SkillCategory::Algebra,
        SkillCategory::Topology,
        SkillCategory::Logic,
        SkillCategory::NumberTheory,
        SkillCategory::Metaheuristic,
        SkillCategory::Formalization,
    ];

    for cat in &categories {
        let skills_in_cat = registry.get_by_category(*cat);
        assert!(
            !skills_in_cat.is_empty(),
            "Category {:?} has 0 registered skills!",
            cat
        );
    }

    // Verify key landmark skills ported from V1
    let landmark_skills = [
        "probabilistic_method",
        "spectral_graph_bounds",
        "razborov_flag_algebras",
        "generating_functions",
        "analytic_continuation",
        "compactness_arguments",
        "local_to_global_hasse_principle",
        "cantors_diagonalization",
        "forcing_set_theory_independence",
        "formalization_protocol",
        "double_counting",
        "pigeonhole_principle",
        "invariants_and_monovariants",
        "maximality_zorns_lemma",
        "lns_z3_hybrid",
        "extremal_principle_infinite_descent",
    ];

    for skill_name in &landmark_skills {
        let skill = registry.get(skill_name);
        assert!(
            skill.is_some(),
            "Landmark skill '{}' missing from registry!",
            skill_name
        );
        let s = skill.unwrap();
        assert!(!s.description.is_empty(), "Skill '{}' has empty description", skill_name);
        assert!(!s.trigger_keywords.is_empty(), "Skill '{}' has no trigger keywords", skill_name);
        assert!(!s.formalization_rules.is_empty(), "Skill '{}' has no formalization rules", skill_name);
        assert!(!s.proof_templates.is_empty(), "Skill '{}' has no proof templates", skill_name);
    }
}

#[test]
fn test_skill_matcher_selects_relevant_skills() {
    let registry = SkillRegistry::default_catalog();
    let matcher = SkillMatcher::new(&registry);

    // 1. Graph / Combinatorics query
    let graph_query = "Find bounds on the chromatic number of unit-distance Cayley graphs using adjacency eigenvalues";
    let matches = matcher.match_skills(graph_query, 3);
    assert!(!matches.is_empty());
    let match_names: Vec<&str> = matches.iter().map(|s| s.name.as_str()).collect();
    assert!(
        match_names.contains(&"spectral_graph_bounds") || match_names.contains(&"probabilistic_method") || match_names.contains(&"algebraic_graph_construction"),
        "Expected graph/spectral skill matches, got: {:?}",
        match_names
    );

    // 2. Analytic / Series query
    let analytic_query = "Estimate the limsup growth of the Ahmes unit fraction series expansion under asymptotic bounds";
    let matches = matcher.match_skills(analytic_query, 3);
    let match_names: Vec<&str> = matches.iter().map(|s| s.name.as_str()).collect();
    assert!(
        match_names.contains(&"generating_functions") || match_names.contains(&"analytic_series") || match_names.contains(&"analytic_continuation") || match_names.contains(&"epsilon_delta_bounding"),
        "Expected analytic skill matches, got: {:?}",
        match_names
    );

    // 3. Logic / Set Theory query
    let logic_query = "Prove independence from ZFC via Cohen generic filters and poset forcing extensions";
    let matches = matcher.match_skills(logic_query, 2);
    let match_names: Vec<&str> = matches.iter().map(|s| s.name.as_str()).collect();
    assert!(
        match_names.contains(&"forcing_set_theory_independence"),
        "Expected forcing skill match, got: {:?}",
        match_names
    );
}

#[test]
fn test_skill_prompt_guidance_rendering() {
    let registry = SkillRegistry::default_catalog();
    let matcher = SkillMatcher::new(&registry);

    let query = "Investigate Ramsey R(4, 6) upper bounds using Paley graphs";
    let skills = matcher.match_skills(query, 2);
    let guidance = SkillRegistry::render_prompt_guidance(&skills);

    assert!(guidance.contains("### Mathematical Reasoning & Formalization Directives"));
    assert!(guidance.contains("Formalization Rules:"));
    assert!(guidance.contains("Proof Templates:"));
}
