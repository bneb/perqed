//! Failure-mode probe: outlives any reasonable timeout. Exercises the
//! harness's kill-on-timeout path end-to-end.

fn main() {
    std::thread::sleep(std::time::Duration::from_secs(5));
    println!("too late");
}
