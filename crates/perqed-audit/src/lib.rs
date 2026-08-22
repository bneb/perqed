//! Perqed Audit & Cryptographic Lockfile Engine
//!
//! Provides canonical AST normalization, SHA-256 statement hash-locking,
//! tampering detection, and axiom/signature verification gates.

pub mod mutation_gate;
pub use mutation_gate::{ConclusionMutationGate, MutationReport};

use chrono::{DateTime, Utc};
use hex::ToHex;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuditError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Hash mismatch! Expected {expected}, got {computed}. File has been tampered with!")]
    HashMismatch { expected: String, computed: String },
    #[error("Unauthorized axiom detected: {0}")]
    UnauthorizedAxiom(String),
    #[error("Proof contains prohibited cheat axiom: {0}")]
    CheatAxiomDetected(String),
    #[error("Audit failed: {0}")]
    AuditFailed(String),
}

/// Information stored in an immutable `spec.lock` file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SpecLock {
    pub spec_file: String,
    pub sha256_hash: String,
    pub canonical_len: usize,
    pub declarations: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub perqed_version: String,
}

/// One append-only run record in the prompt-keyed result ledger:
/// `input_hash` is the SHA-256 of the canonicalized run input (conjecture or
/// campaign spec), `verdict` is the stored outcome. Re-running the same input
/// is detected by hash lookup instead of re-executing the pipeline.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunRecord {
    pub input_hash: String,
    pub verdict: String,
    pub created_at: DateTime<Utc>,
}

pub struct StatementHasher;

impl StatementHasher {
    /// Canonicalize Lean code by removing line and block comments, normalizing whitespace
    pub fn canonicalize(source: &str) -> String {
        // Strip block comments /- ... -/
        let block_re = Regex::new(r"(?s)/-.*?-/").unwrap();
        let stripped_blocks = block_re.replace_all(source, "");

        // Strip line comments -- ...
        let line_re = Regex::new(r"--[^\n\r]*").unwrap();
        let stripped_lines = line_re.replace_all(&stripped_blocks, "");

        // Normalize multiple whitespaces and newlines
        let mut lines = Vec::new();
        for line in stripped_lines.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                lines.push(trimmed);
            }
        }
        lines.join("\n")
    }

    /// Computes the SHA-256 hash of canonicalized Lean code
    pub fn compute_hash(source: &str) -> String {
        let canonical = Self::canonicalize(source);
        let mut hasher = Sha256::new();
        hasher.update(canonical.as_bytes());
        let hash = hasher.finalize();
        hash.encode_hex::<String>()
    }

    /// Extracts top-level declaration names from Lean source
    pub fn extract_declarations(source: &str) -> Vec<String> {
        let mut decls = Vec::new();
        let re = Regex::new(r"(?m)^(?:def|theorem|lemma|axiom|opaque)\s+([A-Za-z0-9_.]+)").unwrap();
        for cap in re.captures_iter(source) {
            if let Some(m) = cap.get(1) {
                decls.push(m.as_str().to_string());
            }
        }
        decls
    }
}

pub struct LockManager;

impl LockManager {
    /// Create and write a `spec.lock` file alongside the given specification file
    pub fn create_lock<P: AsRef<Path>>(spec_path: P) -> Result<SpecLock, AuditError> {
        let content = fs::read_to_string(&spec_path)?;
        let sha256_hash = StatementHasher::compute_hash(&content);
        let canonical = StatementHasher::canonicalize(&content);
        let declarations = StatementHasher::extract_declarations(&content);

        let lock = SpecLock {
            spec_file: spec_path.as_ref().to_string_lossy().to_string(),
            sha256_hash,
            canonical_len: canonical.len(),
            declarations,
            created_at: Utc::now(),
            perqed_version: "0.2.0".to_string(),
        };

        let lock_path = Self::get_lock_path(&spec_path);
        let json_data = serde_json::to_string_pretty(&lock)?;
        fs::write(lock_path, json_data)?;

        Ok(lock)
    }

    /// Verifies that the spec file matches its frozen `spec.lock`
    pub fn verify_lock<P: AsRef<Path>>(spec_path: P) -> Result<bool, AuditError> {
        let lock_path = Self::get_lock_path(&spec_path);
        if !lock_path.exists() {
            return Err(AuditError::AuditFailed(format!(
                "Lockfile not found at: {}",
                lock_path.display()
            )));
        }

        let lock_json = fs::read_to_string(&lock_path)?;
        let lock: SpecLock = serde_json::from_str(&lock_json)?;

        let current_content = fs::read_to_string(&spec_path)?;
        let current_hash = StatementHasher::compute_hash(&current_content);

        if current_hash != lock.sha256_hash {
            return Err(AuditError::HashMismatch {
                expected: lock.sha256_hash,
                computed: current_hash,
            });
        }
        Ok(true)
    }

    pub fn get_lock_path<P: AsRef<Path>>(spec_path: P) -> PathBuf {
        let mut lock_path = spec_path.as_ref().to_path_buf();
        lock_path.set_extension("lock");
        lock_path
    }
}

/// Out-of-band Append-Only Cryptographic Provenance Ledger
pub struct ProvenanceLedger;

impl ProvenanceLedger {
    pub fn get_ledger_dir<P: AsRef<Path>>(workspace_root: P) -> PathBuf {
        workspace_root.as_ref().join(".perqed_ledger")
    }

    /// Commit specification hash to the immutable append-only ledger and mark file read-only
    pub fn commit_to_ledger<P: AsRef<Path>>(
        workspace_root: P,
        spec_path: P,
    ) -> Result<SpecLock, AuditError> {
        let lock = LockManager::create_lock(&spec_path)?;

        let ledger_dir = Self::get_ledger_dir(&workspace_root);
        fs::create_dir_all(&ledger_dir)?;
        let ledger_file = ledger_dir.join("ledger.jsonl");

        let entry = serde_json::to_string(&lock)?;
        let mut existing = fs::read_to_string(&ledger_file).unwrap_or_default();
        existing.push_str(&entry);
        existing.push('\n');
        fs::write(&ledger_file, existing)?;

        // Set file permissions to read-only on disk to prevent proof engine mutation
        if let Ok(metadata) = fs::metadata(&spec_path) {
            let mut perms = metadata.permissions();
            perms.set_readonly(true);
            let _ = fs::set_permissions(&spec_path, perms);
        }

        Ok(lock)
    }

    /// Retrieve the frozen expected hash from the immutable ledger
    pub fn get_frozen_hash<P: AsRef<Path>>(
        workspace_root: P,
        spec_file_name: &str,
    ) -> Result<Option<String>, AuditError> {
        let ledger_file = Self::get_ledger_dir(workspace_root).join("ledger.jsonl");
        if !ledger_file.exists() {
            return Ok(None);
        }
        let content = fs::read_to_string(&ledger_file)?;
        for line in content.lines().rev() {
            if let Ok(lock) = serde_json::from_str::<SpecLock>(line) {
                if lock.spec_file.ends_with(spec_file_name) || lock.declarations.iter().any(|d| d == spec_file_name) {
                    return Ok(Some(lock.sha256_hash));
                }
            }
        }
        Ok(None)
    }

    /// Path of the prompt-keyed run ledger (`runs.jsonl`).
    pub fn get_runs_file<P: AsRef<Path>>(workspace_root: P) -> PathBuf {
        Self::get_ledger_dir(workspace_root).join("runs.jsonl")
    }

    /// Append a run record keyed by the input's SHA-256. Append-only.
    pub fn commit_run<P: AsRef<Path>>(
        workspace_root: P,
        input_hash: &str,
        verdict: &str,
    ) -> Result<(), AuditError> {
        let record = RunRecord {
            input_hash: input_hash.to_string(),
            verdict: verdict.to_string(),
            created_at: Utc::now(),
        };
        let ledger_dir = Self::get_ledger_dir(&workspace_root);
        fs::create_dir_all(&ledger_dir)?;
        let runs_file = ledger_dir.join("runs.jsonl");
        let mut existing = fs::read_to_string(&runs_file).unwrap_or_default();
        existing.push_str(&serde_json::to_string(&record)?);
        existing.push('\n');
        fs::write(&runs_file, existing)?;
        Ok(())
    }

    /// Retrieve the most recent stored verdict for an input hash, if any.
    /// The ledger is append-only, so the latest matching row wins.
    pub fn lookup_run<P: AsRef<Path>>(
        workspace_root: P,
        input_hash: &str,
    ) -> Result<Option<String>, AuditError> {
        let runs_file = Self::get_runs_file(workspace_root);
        if !runs_file.exists() {
            return Ok(None);
        }
        let content = fs::read_to_string(&runs_file)?;
        for line in content.lines().rev() {
            if let Ok(record) = serde_json::from_str::<RunRecord>(line) {
                if record.input_hash == input_hash {
                    return Ok(Some(record.verdict));
                }
            }
        }
        Ok(None)
    }
}

/// Hardened Axiom Whitelist Validator
pub struct AxiomAuditor;

impl AxiomAuditor {
    /// Allowed axioms in standard Lean 4 mathematics
    pub fn allowed_axioms() -> HashSet<&'static str> {
        let mut set = HashSet::new();
        set.insert("Classical.choice");
        set.insert("Quot.sound");
        set.insert("propext");
        set
    }

    /// Verifies that a list of axiom names used by a proof declaration is strictly sound
    pub fn audit_axioms(axioms: &[String]) -> Result<(), AuditError> {
        let allowed = Self::allowed_axioms();
        for ax in axioms {
            let clean = ax.trim().trim_start_matches('`');
            if clean.is_empty() {
                continue;
            }
            if clean == "sorryAx" {
                return Err(AuditError::CheatAxiomDetected(
                    "Proof contains 'sorryAx' (incomplete proof).".to_string(),
                ));
            }
            if clean == "Lean.ofReduceBool" {
                return Err(AuditError::CheatAxiomDetected(
                    "Proof contains unverified 'Lean.ofReduceBool' (native_decide).".to_string(),
                ));
            }
            if !allowed.contains(clean) {
                return Err(AuditError::UnauthorizedAxiom(clean.to_string()));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonicalize_and_hash() {
        let code1 = r#"
            -- First comment
            def test_spec (n : Nat) : Prop :=
              n + 0 = n
        "#;

        let code2 = r#"
            /- Multi-line
               comment -/
            def test_spec (n : Nat) : Prop :=
              n + 0 = n   -- trailing comment
        "#;

        let hash1 = StatementHasher::compute_hash(code1);
        let hash2 = StatementHasher::compute_hash(code2);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_ledger_run_commit_and_lookup() {
        let tmp = tempfile::tempdir().unwrap();

        // Unknown hash on an empty ledger: no record, not an error
        assert!(ProvenanceLedger::lookup_run(tmp.path(), "never-run").unwrap().is_none());

        ProvenanceLedger::commit_run(tmp.path(), "abc123", "verified").unwrap();
        let cached = ProvenanceLedger::lookup_run(tmp.path(), "abc123").unwrap();
        assert_eq!(cached.as_deref(), Some("verified"));

        // Different hash must not collide
        assert!(ProvenanceLedger::lookup_run(tmp.path(), "def456").unwrap().is_none());
    }

    #[test]
    fn test_ledger_run_latest_commit_wins() {
        let tmp = tempfile::tempdir().unwrap();
        ProvenanceLedger::commit_run(tmp.path(), "k", "first").unwrap();
        ProvenanceLedger::commit_run(tmp.path(), "k", "second").unwrap();
        assert_eq!(
            ProvenanceLedger::lookup_run(tmp.path(), "k").unwrap().as_deref(),
            Some("second"),
            "re-running the same input must surface the most recent verdict"
        );
    }

    #[test]
    fn test_ledger_run_append_only_preserves_history() {
        let tmp = tempfile::tempdir().unwrap();
        ProvenanceLedger::commit_run(tmp.path(), "k", "one").unwrap();
        ProvenanceLedger::commit_run(tmp.path(), "k", "two").unwrap();
        let content = std::fs::read_to_string(ProvenanceLedger::get_runs_file(tmp.path())).unwrap();
        assert_eq!(content.lines().count(), 2, "ledger is append-only");
    }

    #[test]
    fn test_axiom_auditor() {
        let valid_axioms = vec![
            "Classical.choice".to_string(),
            "propext".to_string(),
            "Quot.sound".to_string(),
        ];
        assert!(AxiomAuditor::audit_axioms(&valid_axioms).is_ok());

        let sorry_axioms = vec!["sorryAx".to_string()];
        assert!(AxiomAuditor::audit_axioms(&sorry_axioms).is_err());

        let cheat_axioms = vec!["Lean.ofReduceBool".to_string()];
        assert!(AxiomAuditor::audit_axioms(&cheat_axioms).is_err());

        let unauthorized = vec!["MyCustomAxiom".to_string()];
        assert!(AxiomAuditor::audit_axioms(&unauthorized).is_err());
    }
}
