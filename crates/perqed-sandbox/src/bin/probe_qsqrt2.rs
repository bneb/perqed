//! Demo probe for the dynamic code-probing loop.
//!
//! Reads a discovery spec JSON on stdin:
//!   {"domain": "QQ[sqrt(2)]", "chromatic_claim": 2}
//! and emits a [`ProbeCertificate`] JSON on stdout: the canonical 8-star
//! unit-distance graph in ℚ(√2)² (origin + D₈ orbit of (1,0); χ = 2).
//!
//! The probe is compiled against the perqed-sandbox prelude; the harness
//! independently re-derives every number it emits.

use num_traits::Zero;
use perqed_sandbox::domain_synth::{AlgebraicNumber, AlgebraicNumberField, Point2DAlgebraic};
use perqed_sandbox::dynamic_probe::ProbeCertificate;
use std::io::Read;

fn main() {
    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .expect("read discovery spec from stdin");
    let spec: serde_json::Value = serde_json::from_str(&input).expect("discovery spec JSON");
    let field_name = spec["domain"].as_str().unwrap_or("QQ[sqrt(2)]");
    let chromatic_claim = spec["chromatic_claim"].as_u64().unwrap_or(2) as usize;

    let probe_id = format!("probe_qsqrt2::{field_name}");
    // The probe is a dumb emitter: validation lives only in the harness. On an
    // invalid spec we pass it through with no points so the harness's field
    // gate rejects the certificate — never panic.
    let field = match AlgebraicNumberField::from_spec(field_name) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("probe: invalid field spec {field_name}: {e}");
            let cert = ProbeCertificate {
                probe_id,
                field_spec: field_name.to_string(),
                witness_points: vec![],
                adjacency: vec![],
                chromatic_claim,
            };
            println!("{}", serde_json::to_string(&cert).expect("certificate serializes"));
            return;
        }
    };

    // Canonical 8-star: origin plus the D₈ orbit of (1, 0) under rotation by π/4.
    let origin = Point2DAlgebraic::origin(field.clone());
    let mut points: Vec<Point2DAlgebraic> = vec![origin];

    // Rotation matrix entries: cos π/4 = sin π/4 = √2/2 = [0, 1/2] in ℚ(√2).
    let half_sqrt2 = AlgebraicNumber::new(
        vec![
            num_rational::BigRational::zero(),
            num_rational::BigRational::new(1.into(), 2.into()),
        ],
        field.clone(),
    );
    let mut current = Point2DAlgebraic::new(
        AlgebraicNumber::one(field.clone()),
        AlgebraicNumber::zero(field.clone()),
    );
    for _ in 0..8 {
        if !points.contains(&current) {
            points.push(current.clone());
        }
        current = Point2DAlgebraic::new(
            current.x.mul(&half_sqrt2).sub(&current.y.mul(&half_sqrt2)),
            current.x.mul(&half_sqrt2).add(&current.y.mul(&half_sqrt2)),
        );
    }

    // Probe-side adjacency via the exact prelude (the harness re-derives it).
    let mut adjacency = Vec::new();
    for i in 0..points.len() {
        for j in (i + 1)..points.len() {
            if points[i].is_unit_distance(&points[j]) {
                adjacency.push((i, j));
            }
        }
    }

    let cert = ProbeCertificate {
        probe_id,
        field_spec: field_name.to_string(),
        witness_points: points
            .iter()
            .map(|p| [p.x.coeffs.clone(), p.y.coeffs.clone()])
            .collect(),
        adjacency,
        chromatic_claim,
    };
    println!("{}", serde_json::to_string(&cert).expect("certificate serializes"));
}
