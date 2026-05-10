use async_trait::async_trait;
use perqed_core::TheoremProver;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::Mutex;
use std::sync::Arc;
use thiserror::Error;
use std::path::PathBuf;

#[derive(Debug, Error)]
pub enum LeanError {
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
    #[error("REPL Error: {0}")]
    Repl(String),
    #[error("Tactic Failed: {0}")]
    TacticFailed(String),
    #[error("Serialization Error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Serialize)]
pub struct ReplRequest {
    pub cmd: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<u32>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct Message {
    pub severity: String,
    pub data: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplResponse {
    pub env: Option<u32>,
    pub messages: Option<Vec<Message>>,
    pub goals: Option<Vec<String>>,
    pub proof_state: Option<u32>,
    pub message: Option<String>,
}

#[derive(Clone, Debug)]
pub struct LeanState {
    pub env: u32,
    pub goals: Vec<String>,
}

pub struct LeanProver {
    workspace_dir: PathBuf,
    process: Option<Child>,
    stdin: Option<Arc<Mutex<ChildStdin>>>,
    stdout: Option<Arc<Mutex<BufReader<ChildStdout>>>>,
}

impl LeanProver {
    pub fn new(workspace_dir: PathBuf) -> Result<Self, LeanError> {
        Ok(Self {
            workspace_dir,
            process: None,
            stdin: None,
            stdout: None,
        })
    }

    pub async fn start(&mut self) -> Result<(), LeanError> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
        let lake_bin = format!("{}/.elan/bin/lake", home);
        
        let mut child = Command::new(lake_bin)
            .args(["exe", "repl"])
            .current_dir(&self.workspace_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| LeanError::Repl("Failed to open stdin".to_string()))?;
        let stdout = child.stdout.take().ok_or_else(|| LeanError::Repl("Failed to open stdout".to_string()))?;

        self.process = Some(child);
        self.stdin = Some(Arc::new(Mutex::new(stdin)));
        self.stdout = Some(Arc::new(Mutex::new(BufReader::new(stdout))));

        Ok(())
    }

    async fn send_request(&self, req: ReplRequest) -> Result<ReplResponse, LeanError> {
        let stdin_arc = self.stdin.as_ref().ok_or_else(|| LeanError::Repl("No stdin".to_string()))?;
        let stdout_arc = self.stdout.as_ref().ok_or_else(|| LeanError::Repl("No stdout".to_string()))?;

        let payload = serde_json::to_string(&req)? + "\n\n";

        {
            let mut stdin = stdin_arc.lock().await;
            stdin.write_all(payload.as_bytes()).await?;
            stdin.flush().await?;
        }

        let mut stdout = stdout_arc.lock().await;
        let mut line = String::new();
        stdout.read_line(&mut line).await?;

        if line.trim().is_empty() {
            // Read one more line in case of blank lines
            line.clear();
            stdout.read_line(&mut line).await?;
        }

        if line.trim().is_empty() {
            return Err(LeanError::Repl("Empty response from Lean REPL".to_string()));
        }

        let resp: ReplResponse = serde_json::from_str(line.trim())?;
        Ok(resp)
    }
}

#[async_trait]
impl TheoremProver for LeanProver {
    type State = LeanState;
    type Tactic = String;
    type Error = LeanError;

    async fn verify(&self, state: &Self::State, tactic: &Self::Tactic) -> Result<Self::State, Self::Error> {
        let req = ReplRequest {
            cmd: tactic.clone(),
            env: if state.env > 0 { Some(state.env) } else { None },
        };

        let resp = self.send_request(req).await?;

        if let Some(msgs) = &resp.messages {
            let errors: Vec<_> = msgs.iter().filter(|m| m.severity == "error").collect();
            if !errors.is_empty() {
                return Err(LeanError::TacticFailed(errors[0].data.clone()));
            }
        }

        if let Some(env) = resp.env {
            Ok(LeanState {
                env,
                goals: resp.goals.unwrap_or_default(),
            })
        } else {
            Err(LeanError::Repl("No environment returned".to_string()))
        }
    }

    fn extract_goal(&self, state: &Self::State) -> String {
        state.goals.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[tokio::test]
    async fn test_lean_prover_connects_and_verifies() {
        // Need to run from project root to find lakefile.lean
        let mut root_dir = env::current_dir().unwrap();
        while !root_dir.join("lakefile.lean").exists() && root_dir.parent().is_some() {
            root_dir = root_dir.parent().unwrap().to_path_buf();
        }

        let mut prover = LeanProver::new(root_dir).unwrap();
        prover.start().await.expect("Failed to start Lean REPL");

        let initial_state = LeanState { env: 0, goals: vec![] };
        
        let result = prover.verify(&initial_state, &"example : 1 = 1 := by rfl".to_string()).await;
        
        assert!(result.is_ok(), "Expected tactic to succeed: {:?}", result);
        let new_state = result.unwrap();
        println!("New state: {:?}", new_state);
        assert!(new_state.goals.is_empty(), "Expected no goals after rfl");
    }
}
