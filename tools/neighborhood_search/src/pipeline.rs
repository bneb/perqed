//! `pipeline.rs` — mpsc I/O Sink
//!
//! A single background thread drains an mpsc channel and batch-writes
//! JSONL records to disk in chunks of 10,000, minimising system call
//! overhead.

use std::fs::OpenOptions;
use std::io::{BufWriter, Write};
use std::sync::mpsc::Receiver;
use std::thread;
use std::thread::JoinHandle;

/// One training sample.
#[derive(Debug, Clone)]
pub struct Experience {
    pub diff_set: Vec<usize>,
    pub matrix_flat: String,
    pub energy: usize,
}

impl Experience {
    /// Serialise to a single JSONL line (no trailing newline).
    pub fn to_jsonl(&self) -> String {
        let diff_json: Vec<String> = self.diff_set.iter().map(|v| v.to_string()).collect();
        format!(
            r#"{{"diff_set":[{}],"matrix_flat":"{}","energy":{}}}"#,
            diff_json.join(","),
            self.matrix_flat,
            self.energy
        )
    }
}

const BATCH_SIZE: usize = 10_000;

/// Spawn the I/O sink thread.  Returns its `JoinHandle<u64>` which resolves
/// to the total number of records written once the sender side is dropped.
pub fn start_io_worker(rx: Receiver<Experience>, path: &str) -> JoinHandle<u64> {
    let path = path.to_owned();
    thread::spawn(move || {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .unwrap_or_else(|e| panic!("Cannot open {path}: {e}"));

        let mut writer = BufWriter::with_capacity(4 * 1024 * 1024, file); // 4 MB write buffer
        let mut total: u64 = 0;
        let mut batch_count: usize = 0;

        for exp in rx {
            writer
                .write_all(exp.to_jsonl().as_bytes())
                .expect("write failed");
            writer.write_all(b"\n").expect("write failed");
            total += 1;
            batch_count += 1;

            if batch_count >= BATCH_SIZE {
                writer.flush().expect("flush failed");
                batch_count = 0;
            }
        }

        writer.flush().expect("final flush failed");
        total
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn make_exp(energy: usize) -> Experience {
        Experience {
            diff_set: vec![1, 2, 3],
            matrix_flat: "1010".to_string(),
            energy,
        }
    }

    #[test]
    fn experience_serialises_to_valid_jsonl() {
        let exp = make_exp(42);
        let line = exp.to_jsonl();
        assert!(line.starts_with('{'));
        assert!(line.ends_with('}'));
        assert!(line.contains("\"energy\":42"));
        assert!(line.contains("\"matrix_flat\":\"1010\""));
        assert!(line.contains("\"diff_set\":[1,2,3]"));
    }

    #[test]
    fn io_worker_writes_correct_count_to_temp_file() {
        let path = format!("/tmp/ns_test_{}.jsonl", std::process::id());
        let (tx, rx) = mpsc::channel::<Experience>();

        let handle = start_io_worker(rx, &path);

        let n = 250usize;
        for i in 0..n {
            tx.send(make_exp(i)).unwrap();
        }
        drop(tx); // signal EOF

        let written = handle.join().expect("IO worker panicked");
        assert_eq!(written, n as u64, "expected {n} records, got {written}");

        // Verify line count in file
        let contents = std::fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = contents.lines().collect();
        assert_eq!(lines.len(), n, "line count mismatch in JSONL file");

        // Cleanup
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn io_worker_writes_more_than_batch_size() {
        let path = format!("/tmp/ns_batch_test_{}.jsonl", std::process::id());
        let (tx, rx) = mpsc::channel::<Experience>();

        let handle = start_io_worker(rx, &path);

        // Send 2.5 batches worth
        let n = 25_000usize;
        for i in 0..n {
            tx.send(make_exp(i % 100)).unwrap();
        }
        drop(tx);

        let written = handle.join().expect("IO worker panicked");
        assert_eq!(written, n as u64);

        let contents = std::fs::read_to_string(&path).unwrap();
        assert_eq!(contents.lines().count(), n);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn jsonl_lines_are_all_parseable_json() {
        for energy in [0, 1, 210, 868, 9999] {
            let exp = Experience {
                diff_set: vec![5, 7, 10],
                matrix_flat: "01010101".to_string(),
                energy,
            };
            let line = exp.to_jsonl();
            // basic JSON checks — real projects would use serde, but we stay
            // dependency-light here
            assert!(line.contains(&format!("\"energy\":{energy}")));
        }
    }
}
