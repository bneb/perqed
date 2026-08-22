pub mod exact_math;
pub mod hadwiger_nelson;
pub mod harness;

pub use exact_math::{ArbInterval, DegeneracyChecker, ExactMathError, Point2DQ2, QuadraticFieldQ2};
pub use hadwiger_nelson::UnitDistanceGraphQ2;
pub use harness::{CompiledFalsifier, DeadEndRecord, DeadEndsDb, HarnessError};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use thiserror::Error;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;

#[derive(Error, Debug)]
pub enum SandboxError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Sandbox timeout: prober exceeded limit of {0:?}")]
    Timeout(Duration),
    #[error("Sandbox process failed with exit status: {0:?}, stderr: {1}")]
    ProcessFailed(Option<i32>, String),
    #[error("Prober script not found at path: {0}")]
    ScriptNotFound(PathBuf),
}

/// Custom predicate definition for non-vacuity separation tests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomPredicate {
    pub name: String,
    pub expr: String,
    #[serde(default)]
    pub variables: HashMap<String, String>,
    #[serde(default)]
    pub domain_bounds: Option<HashMap<String, (i64, i64)>>,
}

/// Structured payload submitted to the Sandboxed Falsification Gate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FalsificationPayload {
    pub conjecture_id: String,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub informal_claim: String,
    pub variables: HashMap<String, String>,
    pub hypotheses: Vec<String>,
    pub target: String,
    #[serde(default)]
    pub custom_predicates: Vec<CustomPredicate>,
    #[serde(default)]
    pub domain_bounds: Option<HashMap<String, (i64, i64)>>,
}

/// Structured response from the Sandboxed Falsification Gate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FalsificationVerdict {
    pub conjecture_id: String,
    pub passed: bool,
    pub hypothesis_consistent: bool,
    pub falsified: bool,
    pub counterexample: Option<HashMap<String, serde_json::Value>>,
    #[serde(default)]
    pub separation_results: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub load_bearing_report: HashMap<String, serde_json::Value>,
    pub reason: String,
    #[serde(default)]
    pub solver_details: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct SandboxConfig {
    pub python_path: PathBuf,
    pub prober_script: PathBuf,
    pub timeout_duration: Duration,
    pub max_memory_mb: usize,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            python_path: PathBuf::from("python3"),
            prober_script: PathBuf::from("python/perqed_probers/falsifier.py"),
            timeout_duration: Duration::from_secs(10),
            max_memory_mb: 512,
        }
    }
}

pub struct SandboxRunner {
    config: SandboxConfig,
}

impl SandboxRunner {
    pub fn new(config: SandboxConfig) -> Self {
        Self { config }
    }

    pub fn with_workspace_root<P: AsRef<Path>>(workspace_root: P) -> Self {
        let root = workspace_root.as_ref();
        let script = root.join("python/perqed_probers/falsifier.py");
        let mut config = SandboxConfig::default();
        config.prober_script = script;
        Self { config }
    }

    /// Executes the sandboxed falsification prober asynchronously
    pub async fn run_falsification(
        &self,
        payload: &FalsificationPayload,
    ) -> Result<FalsificationVerdict, SandboxError> {
        let script_path = if self.config.prober_script.is_absolute() {
            self.config.prober_script.clone()
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(&self.config.prober_script)
        };

        if !script_path.exists() {
            return Err(SandboxError::ScriptNotFound(script_path));
        }

        let input_json = serde_json::to_string(payload)?;

        let parent_dir = script_path.parent().unwrap();
        let python_path = format!("{}:{}", parent_dir.display(), parent_dir.parent().unwrap().display());

        let mut cmd = Command::new(&self.config.python_path);
        cmd.arg(&script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PYTHONUNBUFFERED", "1")
            .env("PYTHONPATH", python_path);

        let mut child = cmd.spawn()?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input_json.as_bytes()).await?;
            drop(stdin);
        }

        let wait_result = timeout(self.config.timeout_duration, child.wait_with_output()).await;

        match wait_result {
            Ok(Ok(output)) => {
                let stdout_str = String::from_utf8_lossy(&output.stdout);
                let stderr_str = String::from_utf8_lossy(&output.stderr);

                if !output.status.success() && stdout_str.trim().is_empty() {
                    return Err(SandboxError::ProcessFailed(
                        output.status.code(),
                        stderr_str.to_string(),
                    ));
                }

                // Parse json from stdout
                let verdict: FalsificationVerdict = serde_json::from_str(&stdout_str)
                    .map_err(|e| {
                        SandboxError::ProcessFailed(
                            output.status.code(),
                            format!("Failed to parse prober output: {e}\nStdout: {stdout_str}\nStderr: {stderr_str}"),
                        )
                    })?;

                Ok(verdict)
            }
            Ok(Err(e)) => Err(SandboxError::Io(e)),
            Err(_) => Err(SandboxError::Timeout(self.config.timeout_duration)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn find_workspace_root() -> PathBuf {
        let mut curr = std::env::current_dir().unwrap();
        for _ in 0..4 {
            if curr.join("python/perqed_probers/falsifier.py").exists() {
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
    async fn test_sandbox_runner_valid_conjecture() {
        let mut vars = HashMap::new();
        vars.insert("n".to_string(), "Int".to_string());
        vars.insert("m".to_string(), "Int".to_string());

        let payload = FalsificationPayload {
            conjecture_id: "rust_test_01".to_string(),
            domain: "arithmetic".to_string(),
            informal_claim: "n >= 1 and m >= 1 implies n + m > n".to_string(),
            variables: vars,
            hypotheses: vec!["n >= 1".to_string(), "m >= 1".to_string()],
            target: "n + m > n".to_string(),
            custom_predicates: vec![],
            domain_bounds: None,
        };

        let root = find_workspace_root();
        let runner = SandboxRunner::with_workspace_root(root);
        let verdict = runner.run_falsification(&payload).await;
        assert!(verdict.is_ok(), "Sandbox run failed: {:?}", verdict.err());
        let v = verdict.unwrap();
        assert!(v.passed);
        assert!(!v.falsified);
    }

    #[tokio::test]
    async fn test_sandbox_runner_counterexample_detection() {
        let mut vars = HashMap::new();
        vars.insert("n".to_string(), "Int".to_string());

        let payload = FalsificationPayload {
            conjecture_id: "rust_test_false_01".to_string(),
            domain: "arithmetic".to_string(),
            informal_claim: "n >= 5 implies n >= 10".to_string(),
            variables: vars,
            hypotheses: vec!["n >= 5".to_string()],
            target: "n >= 10".to_string(),
            custom_predicates: vec![],
            domain_bounds: None,
        };

        let root = find_workspace_root();
        let runner = SandboxRunner::with_workspace_root(root);
        let verdict = runner.run_falsification(&payload).await;
        assert!(verdict.is_ok());
        let v = verdict.unwrap();
        assert!(!v.passed);
        assert!(v.falsified);
        assert!(v.counterexample.is_some());
    }
}
