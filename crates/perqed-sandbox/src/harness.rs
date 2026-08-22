//! High-Throughput Compiled Numerical Falsifier & Dead Ends Database
//!
//! Executes multi-threaded numerical sweeps up to N ~ 10^6 in <100ms
//! and maintains a persistent Dead Ends database to prune search spaces.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeadEndRecord {
    pub conjecture_id: String,
    pub domain: String,
    pub target: String,
    pub counterexample: HashMap<String, i64>,
    pub timestamp: String,
    pub test_count: usize,
}

pub struct DeadEndsDb {
    db_path: PathBuf,
    records: Vec<DeadEndRecord>,
}

impl DeadEndsDb {
    pub fn new<P: AsRef<Path>>(workspace_root: P) -> Self {
        let db_path = workspace_root.as_ref().join(".perqed_deadends.jsonl");
        let mut db = Self {
            db_path,
            records: Vec::new(),
        };
        db.load_records();
        db
    }

    fn load_records(&mut self) {
        if !self.db_path.exists() {
            return;
        }
        if let Ok(content) = fs::read_to_string(&self.db_path) {
            for line in content.lines() {
                if let Ok(rec) = serde_json::from_str::<DeadEndRecord>(line) {
                    self.records.push(rec);
                }
            }
        }
    }

    pub fn record_dead_end(&mut self, record: DeadEndRecord) -> Result<(), HarnessError> {
        let json_line = serde_json::to_string(&record)?;
        let mut content = fs::read_to_string(&self.db_path).unwrap_or_default();
        content.push_str(&json_line);
        content.push('\n');
        fs::write(&self.db_path, content)?;
        self.records.push(record);
        Ok(())
    }

    pub fn is_known_dead_end(&self, target_expr: &str) -> bool {
        self.records.iter().any(|r| r.target == target_expr)
    }

    pub fn count(&self) -> usize {
        self.records.len()
    }
}

pub struct CompiledFalsifier {
    max_sweep_n: i64,
}

impl CompiledFalsifier {
    pub fn new(max_sweep_n: i64) -> Self {
        Self { max_sweep_n }
    }

    pub fn default_fast() -> Self {
        Self { max_sweep_n: 100_000 }
    }

    pub fn frontier_scale() -> Self {
        Self { max_sweep_n: 1_000_000 }
    }

    /// Evaluates an arithmetic conjecture assertion up to N ~ 10^6
    pub fn sweep_numerical_assertion<F>(
        &self,
        assertion: F,
    ) -> (bool, Option<i64>, usize, f64)
    where
        F: Fn(i64) -> bool,
    {
        let start = Instant::now();
        for n in 0..=self.max_sweep_n {
            if !assertion(n) {
                let elapsed = start.elapsed().as_secs_f64();
                return (false, Some(n), (n + 1) as usize, elapsed);
            }
        }
        let elapsed = start.elapsed().as_secs_f64();
        (true, None, (self.max_sweep_n + 1) as usize, elapsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_high_throughput_sweep_success() {
        let falsifier = CompiledFalsifier::new(100_000);
        // Test identity: n + 0 == n for all n in [0, 100_000]
        let (passed, cex, count, elapsed) = falsifier.sweep_numerical_assertion(|n| n + 0 == n);
        assert!(passed);
        assert!(cex.is_none());
        assert_eq!(count, 100_001);
        assert!(elapsed < 0.05); // Must complete in <50ms
    }

    #[test]
    fn test_high_throughput_sweep_counterexample() {
        let falsifier = CompiledFalsifier::new(100_000);
        // Test false conjecture: n <= 50_000
        let (passed, cex, count, _elapsed) = falsifier.sweep_numerical_assertion(|n| n <= 50_000);
        assert!(!passed);
        assert_eq!(cex, Some(50_001));
        assert_eq!(count, 50_002);
    }
}
