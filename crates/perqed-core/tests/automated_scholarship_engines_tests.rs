//! Unit and Integration Tests for Automated Peer-Review Scholarship Engines
//!
//! Verifies:
//! 1. ModularResidueObstructionEngine (Hasse/Local non-residue obstruction discovery)
//! 2. DivisorVarietyParametrizationEngine (Difference of squares algebraic parametrization)
//! 3. AcademicSanityLinter (Publication integrity, scope checks, CI pollution blocking)

use perqed_core::academic_linter::{AcademicLintSeverity, AcademicSanityLinter};
use perqed_core::divisor_param::DivisorVarietyParametrizationEngine;
use perqed_core::modular_obstruction::ModularResidueObstructionEngine;

#[test]
fn test_modular_residue_obstruction_engine_cunningham() {
    let engine = ModularResidueObstructionEngine::new();

    // Check k=2: p mod 4 in {1, 2, 3} are obstructed
    let obs_k2 = engine.analyze_cunningham_mod8_obstruction(2).expect("Must find obstruction for k=2");
    assert_eq!(obs_k2.modulus, 8);
    let obstructed_p2: Vec<u64> = obs_k2.obstructed_classes.iter().map(|c| c.residue_value).collect();
    assert!(obstructed_p2.contains(&1));
    assert!(obstructed_p2.contains(&2));
    assert!(obstructed_p2.contains(&3));
    assert!(!obstructed_p2.contains(&0)); // 0 mod 4 is not obstructed mod 8

    // Check k=3: p mod 4 in {1, 2, 3} are obstructed
    let obs_k3 = engine.analyze_cunningham_mod8_obstruction(3).expect("Must find obstruction for k=3");
    let obstructed_p3: Vec<u64> = obs_k3.obstructed_classes.iter().map(|c| c.residue_value).collect();
    assert_eq!(obstructed_p3, vec![1, 2, 3]);
}

#[test]
fn test_divisor_variety_parametrization_engine() {
    // k=2: exactly 0 solutions
    let report_k2 = DivisorVarietyParametrizationEngine::solve_cunningham_diophantine(2);
    assert_eq!(report_k2.solutions.len(), 0);
    assert!(report_k2.asymptotic_closed_form_verified);

    // k=3: exactly 1 solution (d1=3, p=4, z=7)
    let report_k3 = DivisorVarietyParametrizationEngine::solve_cunningham_diophantine(3);
    assert_eq!(report_k3.solutions.len(), 1);
    assert_eq!(report_k3.solutions[0].d1, 3);
    assert_eq!(report_k3.solutions[0].p, 4);
    assert_eq!(report_k3.solutions[0].z, 7);
    assert!(report_k3.asymptotic_closed_form_verified);

    // k=4: exactly 2 solutions: (d1=5, p=4, z=9) and (d1=7, p=24, z=31)
    let report_k4 = DivisorVarietyParametrizationEngine::solve_cunningham_diophantine(4);
    assert_eq!(report_k4.solutions.len(), 2);
    assert_eq!(report_k4.solutions[0].p, 4);
    assert_eq!(report_k4.solutions[0].z, 9);
    assert_eq!(report_k4.solutions[1].p, 24);
    assert_eq!(report_k4.solutions[1].z, 31);
    assert!(report_k4.asymptotic_closed_form_verified);

    // Test asymptotic closed-form identity for k=5, 6, 7, 8
    for k in 5..=8 {
        let rep = DivisorVarietyParametrizationEngine::solve_cunningham_diophantine(k);
        assert!(rep.asymptotic_closed_form_verified, "Failed asymptotic closed form for k={k}");
        let max_sol = rep.maximal_solution.expect("Must have maximal solution for k >= 3");
        let expected_p = (1u64 << (2 * k - 3)) - (1u64 << (k - 1));
        let expected_z = (1u64 << (2 * k - 3)) - 1;
        assert_eq!(max_sol.p, expected_p);
        assert_eq!(max_sol.z, expected_z);
    }
}

#[test]
fn test_academic_sanity_linter_catches_errors() {
    // 1. CI Provenance pollution
    let polluted_latex = r"
    \documentclass{article}
    \begin{document}
    \section{Cryptographic Provenance}
    The file hash is eb3b51e2928588f0374ff34a51293b640a6511c7b7153dd827db40c41caa7caa.
    \end{document}
    ";
    let findings = AcademicSanityLinter::lint_manuscript(polluted_latex);
    assert!(findings.iter().any(|f| f.rule_id == "NO_CI_PROVENANCE_IN_PAPER" && f.severity == AcademicLintSeverity::Blocking));

    // 2. Scope overclaim
    let overclaim_latex = r"
    \documentclass{article}
    \title{On the General Exponential Diophantine Equation $p^x + q^y = z^2$}
    \begin{document}
    We study $p^2 + (2p+1) = z^2$.
    \end{document}
    ";
    let findings_scope = AcademicSanityLinter::lint_manuscript(overclaim_latex);
    assert!(findings_scope.iter().any(|f| f.rule_id == "TITLE_SCOPE_OVERCLAIM" && f.severity == AcademicLintSeverity::Blocking));

    // 3. Clean paper passes without blocking errors
    let clean_latex = r"
    \documentclass{article}
    \title{A Note on the Cunningham Diophantine Equation $p^2 + (2^k p + 1) = z^2$}
    \begin{abstract}
    We prove a modular obstruction.
    \end{abstract}
    \begin{document}
    \begin{theorem}
    No solutions exist for $p \not\equiv 0 \pmod 4$.
    \end{theorem}
    \end{document}
    ";
    let clean_findings = AcademicSanityLinter::lint_manuscript(clean_latex);
    assert_eq!(clean_findings.len(), 0);

    // 4. Exhaustiveness overclaim on sporadic samples
    let overclaim_sporadic = r"
    \documentclass{article}
    \title{Complete Multi-Exponent Resolution of the Diophantine Equation $p^x + q^y = z^2$}
    \begin{abstract}
    We completely resolve the exponent space.
    \end{abstract}
    \begin{document}
    We find sporadic instances $3^3 + 13^2 = 14^2$.
    \end{document}
    ";
    let findings_sporadic = AcademicSanityLinter::lint_manuscript(overclaim_sporadic);
    assert!(findings_sporadic.iter().any(|f| f.rule_id == "EXHAUSTIVENESS_OVERCLAIM_ON_SPORADIC_SAMPLES" && f.severity == AcademicLintSeverity::Blocking));
}

#[test]
fn test_lean_spec_completeness_validator() {
    use perqed_core::lean_spec_validator::{LeanSpecCompletenessValidator, SpecValidationSeverity};

    // 1. Incomplete spec missing top-level target equation
    let incomplete_spec = r"
    def general_mod8_obstruction_spec (z : Nat) : Prop :=
      z^2 % 8 = 2 \/ z^2 % 8 = 5 \/ z^2 % 8 = 6 -> False
    ";
    let findings = LeanSpecCompletenessValidator::validate_diophantine_spec(
        incomplete_spec,
        "p^2 + (2^k * p + 1) = z^2",
        true,
    );
    assert!(findings.iter().any(|f| f.check_id == "TARGET_EQUATION_MISSING_IN_SPEC" && f.severity == SpecValidationSeverity::Blocking));

    // 2. Complete spec containing exact target equation and negation goal
    let complete_spec = r"
    def cunningham_odd_prime_no_sol_spec (p k z : Nat) : Prop :=
      k >= 2 -> p % 2 = 1 -> p^2 + (2^k * p + 1) = z^2 -> False
    ";
    let findings_complete = LeanSpecCompletenessValidator::validate_diophantine_spec(
        complete_spec,
        "p^2 + (2^k * p + 1) = z^2",
        true,
    );
    assert_eq!(findings_complete.len(), 0);
}

#[test]
fn test_actual_manuscripts_pass_linter() {
    let general_paper = include_str!("../../../artifacts/publications/general_cunningham_diophantine_paper.tex");
    let findings_general = AcademicSanityLinter::lint_manuscript(general_paper);
    assert_eq!(findings_general.len(), 0, "General paper must pass all academic linter rules: {:?}", findings_general);

    let draft_note = include_str!("../../../artifacts/publications/cunningham_diophantine_draft.tex");
    let findings_note = AcademicSanityLinter::lint_manuscript(draft_note);
    assert_eq!(findings_note.len(), 0, "Draft note must pass all academic linter rules: {:?}", findings_note);
}
