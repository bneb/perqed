//! Benchmark Suite & Autonomous Discovery Campaign Runner
//!
//! Evaluates the end-to-end asymmetric compute funnel across problem datasets
//! (e.g. MiniF2F, Mathlib targets, and empirical discovery campaigns)
//! tracking throughput, stage rejection rates, ROI rankings, and kernel certificates.

use crate::pipeline::{FrontierPipeline, PipelineResult};
use crate::types::Conjecture;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkItemResult {
    pub conjecture_id: String,
    pub domain: String,
    pub passed_falsification: bool,
    pub roi_total: f64,
    pub is_promoted: bool,
    pub proof_solved: bool,
    pub kernel_audit_passed: bool,
    pub elapsed_seconds: f64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkSummary {
    pub total_candidates: usize,
    pub falsified_count: usize,
    pub promoted_roi_count: usize,
    pub proofs_solved_count: usize,
    pub kernel_audited_count: usize,
    pub solve_rate_percent: f64,
    pub total_elapsed_seconds: f64,
    pub items: Vec<BenchmarkItemResult>,
}

pub struct BenchmarkRunner {
    pipeline: FrontierPipeline,
    output_dir: PathBuf,
}

impl BenchmarkRunner {
    pub fn new<P: AsRef<Path>>(workspace_root: P, output_dir: P) -> Self {
        let pipeline = FrontierPipeline::new(workspace_root);
        Self {
            pipeline,
            output_dir: output_dir.as_ref().to_path_buf(),
        }
    }

    /// Runs a batch benchmark campaign across a slice of conjectures
    pub async fn run_benchmark(&self, conjectures: &[Conjecture]) -> BenchmarkSummary {
        let start_time = Instant::now();
        let mut items = Vec::new();
        let mut falsified_count = 0;
        let mut promoted_count = 0;
        let mut solved_count = 0;
        let mut audited_count = 0;

        info!("Starting benchmark campaign over {} conjectures...", conjectures.len());

        for (idx, conj) in conjectures.iter().enumerate() {
            let item_start = Instant::now();
            info!("[{}/{}] Evaluating conjecture: {}", idx + 1, conjectures.len(), conj.conjecture_id);

            match self.pipeline.run_on_conjecture(conj).await {
                Ok(PipelineResult {
                    roi_score,
                    proof_search,
                    audit_report,
                    ..
                }) => {
                    let solved = proof_search.is_solved;
                    let audited = audit_report.kernel_audit_passed;
                    if roi_score.is_promoted {
                        promoted_count += 1;
                    }
                    if solved {
                        solved_count += 1;
                    }
                    if audited {
                        audited_count += 1;
                    }

                    items.push(BenchmarkItemResult {
                        conjecture_id: conj.conjecture_id.clone(),
                        domain: conj.domain.clone(),
                        passed_falsification: true,
                        roi_total: roi_score.total_roi,
                        is_promoted: roi_score.is_promoted,
                        proof_solved: solved,
                        kernel_audit_passed: audited,
                        elapsed_seconds: item_start.elapsed().as_secs_f64(),
                        error: None,
                    });
                }
                Err(e) => {
                    falsified_count += 1;
                    items.push(BenchmarkItemResult {
                        conjecture_id: conj.conjecture_id.clone(),
                        domain: conj.domain.clone(),
                        passed_falsification: false,
                        roi_total: 0.0,
                        is_promoted: false,
                        proof_solved: false,
                        kernel_audit_passed: false,
                        elapsed_seconds: item_start.elapsed().as_secs_f64(),
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        let total_elapsed = start_time.elapsed().as_secs_f64();
        let total_candidates = conjectures.len();
        let solve_rate = if total_candidates > 0 {
            (solved_count as f64 / total_candidates as f64) * 100.0
        } else {
            0.0
        };

        let summary = BenchmarkSummary {
            total_candidates,
            falsified_count,
            promoted_roi_count: promoted_count,
            proofs_solved_count: solved_count,
            kernel_audited_count: audited_count,
            solve_rate_percent: solve_rate,
            total_elapsed_seconds: total_elapsed,
            items,
        };

        // Write summary report to disk
        let _ = fs::create_dir_all(&self.output_dir);
        let report_file = self.output_dir.join("benchmark_report.json");
        if let Ok(json) = serde_json::to_string_pretty(&summary) {
            let _ = fs::write(&report_file, json);
        }

        summary
    }
}
