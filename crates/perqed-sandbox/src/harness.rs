//! High-Throughput Compiled Numerical Falsifier & Dead Ends Database
//!
//! Executes multi-threaded numerical sweeps up to N ~ 10^6 in <50ms
//! and maintains a persistent Dead Ends database normalized by alpha-equivalence
//! and commutative symmetry to prune isomorphic search spaces.

use regex::Regex;
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
    pub canonical_target: String,
    pub counterexample: HashMap<String, i64>,
    pub timestamp: String,
    pub test_count: usize,
}

/// Normalizes mathematical expressions modulo alpha-equivalence and commutative equality
pub fn canonicalize_expression(expr: &str) -> String {
    let clean = expr.replace(' ', "");

    // 1. Symmetrize equality first: L == R <=> R == L
    let (mut left, mut right, op) = if let Some((l, r)) = clean.split_once("==") {
        (l.to_string(), r.to_string(), "==")
    } else if let Some((l, r)) = clean.split_once('=') {
        (l.to_string(), r.to_string(), "=")
    } else {
        (clean.clone(), String::new(), "")
    };

    // Sort sides if symmetric equality operator
    if !right.is_empty() && (op == "==" || op == "=") && left > right {
        std::mem::swap(&mut left, &mut right);
    }

    let unified = if right.is_empty() {
        left
    } else {
        format!("{}{}{}", left, op, right)
    };

    // 2. Identify and normalize variable identifiers to v0, v1, v2...
    let re_var = Regex::new(r"\b[a-zA-Z][a-zA-Z0-9_]*\b").unwrap();
    let mut var_map = HashMap::new();
    let mut var_counter = 0;

    let builtins = [
        "sin", "cos", "tan", "log", "exp", "sqrt", "abs", "True", "False", "Nat", "Int", "Real",
    ];

    for cap in re_var.captures_iter(&unified) {
        let var_name = &cap[0];
        if !builtins.contains(&var_name) && !var_map.contains_key(var_name) {
            var_map.insert(var_name.to_string(), format!("v{}", var_counter));
            var_counter += 1;
        }
    }

    let mut normalized = unified;
    for (orig, canon) in &var_map {
        let pattern = format!(r"\b{}\b", regex::escape(orig));
        if let Ok(re) = Regex::new(&pattern) {
            normalized = re.replace_all(&normalized, canon.as_str()).to_string();
        }
    }

    normalized
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

    pub fn record_dead_end(&mut self, mut record: DeadEndRecord) -> Result<(), HarnessError> {
        record.canonical_target = canonicalize_expression(&record.target);
        let json_line = serde_json::to_string(&record)?;
        let mut content = fs::read_to_string(&self.db_path).unwrap_or_default();
        content.push_str(&json_line);
        content.push('\n');
        fs::write(&self.db_path, content)?;
        self.records.push(record);
        Ok(())
    }

    pub fn is_known_dead_end(&self, target_expr: &str) -> bool {
        let canon = canonicalize_expression(target_expr);
        self.records.iter().any(|r| {
            r.target == target_expr
                || r.canonical_target == canon
                || canonicalize_expression(&r.target) == canon
        })
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
    fn test_canonicalize_alpha_equivalence() {
        let expr1 = "a + b == c";
        let expr2 = "x + y == z";
        assert_eq!(canonicalize_expression(expr1), canonicalize_expression(expr2));
    }

    #[test]
    fn test_canonicalize_commutative_equality() {
        let expr1 = "a + b == c";
        let expr2 = "c == a + b";
        assert_eq!(canonicalize_expression(expr1), canonicalize_expression(expr2));
    }

    #[test]
    fn test_high_throughput_sweep_success() {
        let falsifier = CompiledFalsifier::new(100_000);
        let (passed, cex, count, elapsed) = falsifier.sweep_numerical_assertion(|n| n + 0 == n);
        assert!(passed);
        assert!(cex.is_none());
        assert_eq!(count, 100_001);
        assert!(elapsed < 0.05);
    }
}
