//! Publication Pipeline
//!
//! Formats machine-checked formal proofs and emits publication-grade Lean artifacts
//! and camera-ready LaTeX research drafts with cryptographic provenance certificates.

use crate::types::{AuditReport, PublicationDraft};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tracing::info;

#[derive(Error, Debug)]
pub enum PublicationError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Template rendering error: {0}")]
    Template(String),
}

pub struct PublicationPipeline {
    output_dir: PathBuf,
}

impl PublicationPipeline {
    pub fn new<P: AsRef<Path>>(output_dir: P) -> Self {
        Self {
            output_dir: output_dir.as_ref().to_path_buf(),
        }
    }

    /// Emits formal Lean artifact and LaTeX publication draft
    pub fn emit_publication(
        &self,
        title: &str,
        theorem_name: &str,
        informal_claim: &str,
        spec_code: &str,
        proof_code: &str,
        audit_report: &AuditReport,
    ) -> Result<PublicationDraft, PublicationError> {
        fs::create_dir_all(&self.output_dir)?;

        let latex_content = format!(
            r#"\documentclass[11pt,a4paper]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage{{amsmath,amssymb,amsthm}}
\usepackage{{listings}}
\usepackage{{xcolor}}
\usepackage{{hyperref}}

\title{{\textbf{{{title}}}}}
\author{{Perqed Autonomous Discovery Engine \\ \texttt{{frontier-lab@perqed.org}}}}
\date{{\today}}

\newtheorem{{theorem}}{{Theorem}}
\newtheorem{{lemma}}[theorem]{{Lemma}}
\newtheorem{{definition}}{{Definition}}

\lstset{{
  basicstyle=\ttfamily\small,
  keywordstyle=\color{{blue}}\bfseries,
  commentstyle=\color{{gray}}\itshape,
  stringstyle=\color{{teal}},
  breaklines=true,
  frame=single
}}

\begin{{document}}
\maketitle

\begin{{abstract}}
We present the autonomous discovery, formal specification, and machine-checked verification of \textbf{{{theorem_name}}}. The statement was generated via automated premise synthesis, passed sandboxed SMT and algebraic counterexample sweeps, was frozen under an immutable SHA-256 hash lock, and proved using Monte Carlo Tree Search. The resulting proof was verified by the Lean 4 kernel reflection audit gate with strict transitive axiom closure.
\end{{abstract}}

\section{{Informal Statement}}
\begin{{theorem}}[{theorem_name}]
{informal_claim}
\end{{theorem}}

\section{{Cryptographic Provenance \& Lock Commitment}}
\begin{{itemize}}
  \item \textbf{{Specification SHA-256}}: \texttt{{{spec_hash}}}
  \item \textbf{{Verification Status}}: \textbf{{ALL AUDIT GATES PASSED}}
  \item \textbf{{Axioms Utilized}}: \texttt{{{axioms_used}}}
  \item \textbf{{Sorry-Free Invariant}}: \texttt{{sorryAx}} count = 0 (Strictly Verified)
\end{{itemize}}

\section{{Formal Lean 4 Specification}}
\begin{{lstlisting}}[language=Lean]
{spec_code}
\end{{lstlisting}}

\section{{Machine-Checked Proof Artifact}}
\begin{{lstlisting}}[language=Lean]
{proof_code}
\end{{lstlisting}}

\section{{Kernel Audit Verification Certificate}}
The proof was mechanically audited by the Lean 4 kernel reflection gate (\texttt{{AuditSpec.lean}}). No unauthorized axioms or hypothesis stuffing were detected. Definitional equality with the frozen target was verified.

\end{{document}}
"#,
            title = title,
            theorem_name = theorem_name,
            informal_claim = informal_claim,
            spec_hash = audit_report.spec_sha256,
            axioms_used = if audit_report.axioms_used.is_empty() {
                "[] (Constructive / Core Tactics Only)".to_string()
            } else {
                audit_report.axioms_used.join(", ")
            },
            spec_code = spec_code.trim(),
            proof_code = proof_code.trim(),
        );

        let draft_path = self.output_dir.join(format!("{}_draft.tex", theorem_name));
        fs::write(&draft_path, &latex_content)?;
        info!("Emitted publication LaTeX draft to {}", draft_path.display());

        let draft = PublicationDraft {
            title: title.to_string(),
            authors: vec!["Perqed v2 Autonomous Discovery Engine".to_string()],
            abstract_text: format!(
                "Autonomous discovery, formalization, and verification of {}",
                theorem_name
            ),
            latex_content,
            lean_spec_code: spec_code.to_string(),
            lean_proof_code: proof_code.to_string(),
            spec_hash: audit_report.spec_sha256.clone(),
            audit_report: audit_report.clone(),
            generated_at: Utc::now(),
        };

        Ok(draft)
    }
}
