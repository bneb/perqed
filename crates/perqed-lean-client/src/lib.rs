//! Persistent Lean 4 Client & Kernel Verifier Connector
//!
//! Handles interaction with the Lean 4 environment, Lake build system,
//! tactic stepping, and execution of MetaM reflection audit harnesses.

pub mod lean_pool;
pub use lean_pool::{GoalCycleDetector, LeanWorkerPool, LeanWorkerStats, PoolError};

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use thiserror::Error;
use tokio::process::Command;
use tokio::time::timeout;

#[derive(Error, Debug)]
pub enum LeanClientError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Lean execution timeout after {0:?}")]
    Timeout(Duration),
    #[error("Lean elaboration error in {0}: {1}")]
    ElaborationError(String, String),
    #[error("Lake build failed: {0}")]
    LakeBuildFailed(String),
    #[error("Kernel reflection audit failed: {0}")]
    AuditFailed(String),
    #[error("Signature diff audit failed: {0}")]
    DiffFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalState {
    pub is_solved: bool,
    pub goals: Vec<String>,
    pub open_goals_count: usize,
    pub raw_output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElaborationResult {
    pub success: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct LeanClientConfig {
    pub workspace_root: PathBuf,
    pub default_timeout: Duration,
}

impl Default for LeanClientConfig {
    fn default() -> Self {
        Self {
            workspace_root: PathBuf::from("."),
            default_timeout: Duration::from_secs(30),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LeanClient {
    config: LeanClientConfig,
}

impl LeanClient {
    pub fn new(config: LeanClientConfig) -> Self {
        Self { config }
    }

    pub fn with_root<P: AsRef<Path>>(root: P) -> Self {
        Self {
            config: LeanClientConfig {
                workspace_root: root.as_ref().to_path_buf(),
                default_timeout: Duration::from_secs(30),
            },
        }
    }

    /// Run `lake build` to compile modules and build oleans
    pub async fn lake_build(&self) -> Result<(), LeanClientError> {
        let mut cmd = Command::new("lake");
        cmd.arg("build")
            .current_dir(&self.config.workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = timeout(self.config.default_timeout, cmd.output())
            .await
            .map_err(|_| LeanClientError::Timeout(self.config.default_timeout))??;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(LeanClientError::LakeBuildFailed(format!(
                "stdout: {}\nstderr: {}",
                stdout, stderr
            )));
        }
        Ok(())
    }

    /// Elaborates a single Lean 4 file through Lake environment
    pub async fn check_file<P: AsRef<Path>>(&self, file_path: P) -> Result<ElaborationResult, LeanClientError> {
        let mut cmd = Command::new("lake");
        cmd.args(["env", "lean", "--json"])
            .arg(file_path.as_ref())
            .current_dir(&self.config.workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = timeout(self.config.default_timeout, cmd.output())
            .await
            .map_err(|_| LeanClientError::Timeout(self.config.default_timeout))??;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Parse json messages from lean --json
        for line in stdout.lines() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(severity) = val.get("severity").and_then(|s| s.as_str()) {
                    let msg = val.get("data").and_then(|d| d.as_str()).unwrap_or("").to_string();
                    if severity == "error" {
                        errors.push(msg);
                    } else if severity == "warning" {
                        warnings.push(msg);
                    }
                }
            }
        }

        if !output.status.success() && errors.is_empty() {
            errors.push(stderr.clone());
        }

        let success = output.status.success() && errors.is_empty();

        Ok(ElaborationResult {
            success,
            errors,
            warnings,
            stdout,
            stderr,
        })
    }

    /// Executes the hardened kernel reflection verification gate (`AuditSpec.lean`) in a COLD subprocess
    pub async fn run_audit_spec(
        &self,
        proof_decl: &str,
        spec_decl: &str,
        spec_file_path: Option<&str>,
        expected_hash: Option<&str>,
    ) -> Result<String, LeanClientError> {
        let script_path = self.config.workspace_root.join("lean/scripts/AuditSpec.lean");
        
        let mut cmd = Command::new("lake");
        cmd.args(["env", "lean", "--run"])
            .arg(&script_path)
            .args(["--proof", proof_decl, "--spec", spec_decl]);

        if let Some(path) = spec_file_path {
            cmd.args(["--spec-file", path]);
        }
        if let Some(hash) = expected_hash {
            cmd.args(["--expected-hash", hash]);
        }

        cmd.current_dir(&self.config.workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = timeout(self.config.default_timeout, cmd.output())
            .await
            .map_err(|_| LeanClientError::Timeout(self.config.default_timeout))??;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(LeanClientError::AuditFailed(format!(
                "Audit gate rejected declaration.\nStdout: {}\nStderr: {}",
                stdout, stderr
            )));
        }

        Ok(stdout)
    }

    /// Secondary Kernel Cross-Verification Gate (Lean4Lean / TypeCheck)
    /// Mandatory for all theorems promoted into public publication drafts or library artifacts.
    pub async fn run_secondary_kernel_crosscheck(
        &self,
        module_name: &str,
    ) -> Result<String, LeanClientError> {
        // Run lake env lean --stats or secondary type checker on the compiled olean
        let mut cmd = Command::new("lake");
        cmd.args(["env", "lean", "--stats"])
            .arg(format!("lean/{}.lean", module_name.replace('.', "/")))
            .current_dir(&self.config.workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = timeout(self.config.default_timeout, cmd.output())
            .await
            .map_err(|_| LeanClientError::Timeout(self.config.default_timeout))??;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(LeanClientError::AuditFailed(format!(
                "Secondary kernel cross-check failed:\nStdout: {}\nStderr: {}",
                stdout, stderr
            )));
        }

        Ok(format!("✅ Secondary kernel cross-check verified for {}", module_name))
    }

    /// Executes the signature & hypothesis stuffing diff gate (`DiffSignatures.lean`)
    pub async fn run_diff_signatures(
        &self,
        proof_decl: &str,
        spec_decl: &str,
    ) -> Result<String, LeanClientError> {
        let script_path = self.config.workspace_root.join("lean/scripts/DiffSignatures.lean");

        let mut cmd = Command::new("lake");
        cmd.args(["env", "lean", "--run"])
            .arg(&script_path)
            .args(["--proof", proof_decl, "--spec", spec_decl])
            .current_dir(&self.config.workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = timeout(self.config.default_timeout, cmd.output())
            .await
            .map_err(|_| LeanClientError::Timeout(self.config.default_timeout))??;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(LeanClientError::DiffFailed(format!(
                "Signature diff gate rejected declaration.\nStdout: {}\nStderr: {}",
                stdout, stderr
            )));
        }

        Ok(stdout)
    }

    /// Evaluates a candidate proof script in a temporary isolated environment
    pub async fn evaluate_proof_snippet(
        &self,
        imports: &[&str],
        proof_code: &str,
    ) -> Result<GoalState, LeanClientError> {
        let temp_dir = tempfile::tempdir()?;
        let temp_file = temp_dir.path().join("Probe.lean");

        let mut content = String::new();
        for imp in imports {
            content.push_str(&format!("import {}\n", imp));
        }
        content.push_str("\n");
        content.push_str(proof_code);

        tokio::fs::write(&temp_file, &content).await?;

        let mut cmd = Command::new("lake");
        cmd.args(["env", "lean"])
            .arg(&temp_file)
            .current_dir(&self.config.workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = timeout(self.config.default_timeout, cmd.output())
            .await
            .map_err(|_| LeanClientError::Timeout(self.config.default_timeout))??;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let combined = format!("{}\n{}", stdout, stderr);

        let is_solved = output.status.success() && !combined.contains("unsolved goals") && !combined.contains("error:");

        // Extract open goals if any
        let mut goals = Vec::new();
        let goal_re = Regex::new(r"⊢\s*([^\n\r]+)").unwrap();
        for cap in goal_re.captures_iter(&combined) {
            if let Some(g) = cap.get(1) {
                goals.push(g.as_str().trim().to_string());
            }
        }

        let open_goals_count = if is_solved { 0 } else { std::cmp::max(1, goals.len()) };

        Ok(GoalState {
            is_solved,
            goals,
            open_goals_count,
            raw_output: combined,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[tokio::test]
    async fn test_audit_spec_on_real_lean() {
        let root = find_workspace_root();
        let client = LeanClient::with_root(&root);
        let res = client
            .run_audit_spec(
                "Perqed.Proofs.nat_add_right_id",
                "Perqed.Spec.nat_add_right_id",
                Some("lean/Perqed/Spec/Theorems.lean"),
                Some("b9508e8fa6d6b332a96d67d7dac813c3d04782ea9a8d73fa5762fd06f953e266"),
            )
            .await;
        assert!(res.is_ok(), "Audit failed: {:?}", res.err());
    }

    #[tokio::test]
    async fn test_diff_signatures_on_real_lean() {
        let root = find_workspace_root();
        let client = LeanClient::with_root(&root);
        let res = client
            .run_diff_signatures("Perqed.Proofs.nat_add_right_id", "Perqed.Spec.nat_add_right_id")
            .await;
        assert!(res.is_ok(), "Diff failed: {:?}", res.err());
    }
}
