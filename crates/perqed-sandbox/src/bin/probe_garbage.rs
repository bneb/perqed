//! Failure-mode probe: emits non-JSON garbage. Exercises the harness's
//! Parse rejection path end-to-end.

fn main() {
    println!("this is not a certificate");
}
