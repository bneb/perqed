//! Sub-Lemma Isolation & Automated Decomposition Engine
//!
//! When an MCTS search branch exceeds search depth thresholds or stalls,
//! the Sub-Lemma Isolator extracts the open sub-goal into an independent lemma,
//! proves it in an isolated sub-search, and feeds it back as an available premise.

use crate::types::ProofState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tracing::info;

#[derive(Error, Debug)]
pub enum SublemmaError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Failed to isolate sub-lemma: {0}")]
    IsolationFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubLemma {
    pub name: String,
    pub statement: String,
    pub hypotheses: Vec<String>,
    pub goal_type: String,
    pub proof_script: Option<String>,
    pub is_proven: bool,
}

pub struct SubLemmaIsolator {
    library_dir: PathBuf,
}

impl SubLemmaIsolator {
    pub fn new<P: AsRef<Path>>(library_dir: P) -> Self {
        Self {
            library_dir: library_dir.as_ref().to_path_buf(),
        }
    }

    /// Extract current open goal into an independent auxiliary lemma
    pub fn isolate_sublemma(
        &self,
        base_name: &str,
        depth: usize,
        state: &ProofState,
    ) -> Result<Option<SubLemma>, SublemmaError> {
        let open_goal = match state.open_goals.first() {
            Some(g) => g,
            None => return Ok(None),
        };

        let sublemma_name = format!("{}_sub_{}", base_name.replace('.', "_"), depth);
        info!("Isolating sub-lemma: {} for goal: {}", sublemma_name, open_goal);

        let sublemma = SubLemma {
            name: sublemma_name.clone(),
            statement: format!("lemma {} : {} := by sorry", sublemma_name, open_goal),
            hypotheses: state.hypotheses.clone(),
            goal_type: open_goal.clone(),
            proof_script: None,
            is_proven: false,
        };

        Ok(Some(sublemma))
    }

    /// Persist verified sub-lemma to `Library/` directory for reuse
    pub fn persist_sublemma(&self, sublemma: &SubLemma) -> Result<PathBuf, SublemmaError> {
        fs::create_dir_all(&self.library_dir)?;
        let file_path = self.library_dir.join(format!("{}.lean", sublemma.name));
        
        let content = format!(
            "/-\n  Perqed.Library.{}\n  Automated Decomposed Sub-Lemma\n-/\n\nnamespace Perqed.Library\n\ntheorem {} : {} := by\n  {}\n\nend Perqed.Library\n",
            sublemma.name,
            sublemma.name,
            sublemma.goal_type,
            sublemma.proof_script.as_deref().unwrap_or("sorry")
        );

        fs::write(&file_path, content)?;
        info!("Saved decomposed sub-lemma to {}", file_path.display());
        Ok(file_path)
    }
}
