//! Academic Sanity & Publication Integrity Linter
//!
//! Enforces peer-review standards on generated LaTeX drafts:
//! 1. Rejects CI/internal provenance jargon (`\\section{Cryptographic Provenance}`, raw hashes) in paper body.
//! 2. Detects Title/Abstract vs Body scope drift (e.g. general exponential title for single-exponent theorem).
//! 3. Enforces that all major claims in the abstract have matching theorem environments in the body.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcademicLintFinding {
    pub rule_id: String,
    pub severity: AcademicLintSeverity,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AcademicLintSeverity {
    Blocking,
    Warning,
}

pub struct AcademicSanityLinter;

impl AcademicSanityLinter {
    /// Lints a LaTeX manuscript for academic integrity and journal standards
    pub fn lint_manuscript(latex_content: &str) -> Vec<AcademicLintFinding> {
        let mut findings = Vec::new();

        // 1. CI Provenance pollution in LaTeX body
        let lower = latex_content.to_lowercase();
        if lower.contains("cryptographic provenance") || lower.contains("auditspec") || lower.contains("sha-256") || lower.contains("hash-lock") {
            findings.push(AcademicLintFinding {
                rule_id: "NO_CI_PROVENANCE_IN_PAPER".to_string(),
                severity: AcademicLintSeverity::Blocking,
                message: "Cryptographic hash locks, audit gates, and SHA-256 strings belong in repo metadata / README, not in a mathematics publication draft.".to_string(),
            });
        }

        // 2. Scope mismatch: General Exponential Diophantine title with only single quadratic power in body
        let has_general_title = lower.contains("exponential diophantine equation") 
            && (lower.contains("p^x") || lower.contains("general"));
        let only_has_quadratic = !latex_content.contains("x \\ge") && !latex_content.contains("y \\ge") 
            && (latex_content.contains("p^2 +") || latex_content.contains("p^2+"));

        if has_general_title && only_has_quadratic {
            findings.push(AcademicLintFinding {
                rule_id: "TITLE_SCOPE_OVERCLAIM".to_string(),
                severity: AcademicLintSeverity::Blocking,
                message: "Title claims general exponential equation p^x + ... = z^2, but the paper only addresses the quadratic exponent case x=2, y=1.".to_string(),
            });
        }

        // 3. Abstract vs Body alignment: Check if abstract claims "obstruction" or "unification" without a matching theorem
        if let Some(abs_start) = lower.find("\\begin{abstract}") {
            if let Some(abs_end) = lower[abs_start..].find("\\end{abstract}") {
                let abstract_text = &lower[abs_start..abs_start + abs_end];

                if abstract_text.contains("obstruction") && !latex_content.contains("\\begin{theorem}") {
                    findings.push(AcademicLintFinding {
                        rule_id: "ABSTRACT_BODY_THEOREM_MISMATCH".to_string(),
                        severity: AcademicLintSeverity::Blocking,
                        message: "Abstract claims an obstruction result, but no \\begin{theorem} environment exists in the body.".to_string(),
                    });
                }
            }
        }

        findings
    }
}
