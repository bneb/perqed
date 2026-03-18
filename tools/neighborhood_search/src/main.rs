//! `main.rs` — CLI entrypoint for the Neighborhood Search Generator.
//!
//! Spins up a rayon worker pool that continuously mutates the seed,
//! compiles adjacency matrices, evaluates Ramsey energy, and streams
//! results through an mpsc channel to a dedicated I/O sink thread.

use clap::Parser;
use neighborhood_search::{
    energy::ramsey_energy,
    matrix::{compile_adjacency, flatten_upper},
    mutation::mutate_seed_random_k,
    pipeline::{start_io_worker, Experience},
};
use rayon::prelude::*;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    mpsc, Arc,
};

/// High-throughput Ramsey neighborhood search — generates ML training data
/// by mutating a seed Cayley graph difference set and logging energy samples.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Comma-separated difference set seed (e.g. "5,7,10,14,15,20,21,25,28,30")
    #[arg(
        long,
        default_value = "5,7,10,14,15,20,21,25,28,30",
        help = "Starting difference set"
    )]
    seed: String,

    /// Graph order N (number of vertices, must be ≤ 64)
    #[arg(long, default_value_t = 35)]
    n: usize,

    /// Red clique size (K_r)
    #[arg(long, default_value_t = 4)]
    r: usize,

    /// Blue clique size (K_s / independent set size)
    #[arg(long, default_value_t = 6)]
    s: usize,

    /// Number of sample records to generate
    #[arg(long, default_value_t = 1_000_000)]
    target_samples: u64,

    /// Output JSONL file path
    #[arg(long, default_value = "experiences.jsonl")]
    output: String,

    /// Number of rayon worker threads (0 = use all logical CPUs)
    #[arg(long, default_value_t = 0)]
    threads: usize,
}

fn parse_seed(s: &str) -> Vec<usize> {
    s.split(',')
        .map(|t| t.trim().parse::<usize>().expect("invalid seed integer"))
        .collect()
}

fn main() {
    let args = Args::parse();

    let seed = parse_seed(&args.seed);
    let n = args.n;
    let r = args.r;
    let s = args.s;
    let target = args.target_samples;

    // Configure rayon thread pool
    let threads = if args.threads == 0 {
        num_cpus()
    } else {
        args.threads
    };
    rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build_global()
        .expect("failed to build rayon pool");

    eprintln!(
        "🦀 neighborhood_search v{} | N={n} R({r},{s}) | seed={:?} | target={target} | threads={threads} | output={}",
        env!("CARGO_PKG_VERSION"),
        seed,
        args.output
    );

    // Channel: workers → I/O sink
    let (tx, rx) = mpsc::sync_channel::<Experience>(65_536);

    // Spawn I/O sink thread
    let io_handle = start_io_worker(rx, &args.output);

    // Shared atomic counter for progress reporting
    let counter = Arc::new(AtomicU64::new(0));
    let counter_io = Arc::clone(&counter);

    // Progress reporter (every 100k)
    let _report_interval = 100_000u64;
    let t0 = std::time::Instant::now();
    let counter_reporter = Arc::clone(&counter);
    let reporter = std::thread::spawn(move || {
        let mut last = 0u64;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let current = counter_reporter.load(Ordering::Relaxed);
            if current >= target {
                break;
            }
            let delta = current - last;
            let elapsed = t0.elapsed().as_secs_f64();
            let rate = current as f64 / elapsed;
            eprintln!(
                "   ⚡ {current:>10} samples | +{delta} in 2s | {rate:.0} samples/sec"
            );
            last = current;
        }
    });

    // Parallel worker pool: each rayon thread loops generate → send until quota
    (0..threads).into_par_iter().for_each(|_| {
        let seed = seed.clone();
        loop {
            let already = counter_io.fetch_add(1, Ordering::Relaxed);
            if already >= target {
                break;
            }
            let diff_set = mutate_seed_random_k(&seed, n);
            let adj = compile_adjacency(&diff_set, n);
            let energy = ramsey_energy(&adj, n, r, s);
            let matrix_flat = flatten_upper(&adj, n);

            if tx
                .send(Experience {
                    diff_set,
                    matrix_flat,
                    energy,
                })
                .is_err()
            {
                break; // channel closed
            }
        }
    });

    drop(tx); // signal EOF to I/O worker

    let written = io_handle.join().expect("I/O worker panicked");
    let elapsed = t0.elapsed();

    let _ = reporter.join();

    eprintln!(
        "\n✅ Done! {written} samples written to {} in {:.1}s ({:.0} samples/sec)",
        args.output,
        elapsed.as_secs_f64(),
        written as f64 / elapsed.as_secs_f64()
    );
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}
