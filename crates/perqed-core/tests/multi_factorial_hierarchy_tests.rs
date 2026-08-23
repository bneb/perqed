use perqed_core::MultiFactorialHierarchyEngine;

#[test]
fn test_generalized_tao_constants_convergence() {
    // k=3: exponent 1/2 -> C_3 ≈ 4.265293
    let c3 = MultiFactorialHierarchyEngine::compute_generalized_constant(3, 80);
    assert!(
        (c3 - 4.265293).abs() < 1e-5,
        "C_3 = {} deviated from 4.265293", c3
    );

    // k=5: exponent 1.0 -> C_5 ≈ 2.287076
    let c5 = MultiFactorialHierarchyEngine::compute_generalized_constant(5, 80);
    assert!(
        (c5 - 2.287076).abs() < 1e-5,
        "C_5 = {} deviated from 2.287076", c5
    );

    // k=7: exponent 1.5 -> C_7 ≈ 1.649253
    let c7 = MultiFactorialHierarchyEngine::compute_generalized_constant(7, 80);
    assert!(
        (c7 - 1.649253).abs() < 1e-5,
        "C_7 = {} deviated from 1.649253", c7
    );

    // Monotonic decay in k: C_3 > C_5 > C_7 > 1.0
    assert!(c3 > c5 && c5 > c7 && c7 > 1.0);
}

#[test]
fn test_asymptotic_leading_coefficients_hierarchy() {
    // k=2: 1 / 1! = 1.0
    assert_eq!(MultiFactorialHierarchyEngine::compute_asymptotic_leading_coefficient(2), 1.0);

    // k=4: 1 / 2! = 0.5
    assert_eq!(MultiFactorialHierarchyEngine::compute_asymptotic_leading_coefficient(4), 0.5);

    // k=6: 1 / 3! = 1/6 ≈ 0.166667
    let coeff_6 = MultiFactorialHierarchyEngine::compute_asymptotic_leading_coefficient(6);
    assert!((coeff_6 - 1.0 / 6.0).abs() < 1e-6);

    // k=3: C_3 / 1! ≈ 4.265293
    let coeff_3 = MultiFactorialHierarchyEngine::compute_asymptotic_leading_coefficient(3);
    assert!((coeff_3 - 4.265293).abs() < 1e-5);

    // k=5: C_5 / 2! ≈ 1.143538
    let coeff_5 = MultiFactorialHierarchyEngine::compute_asymptotic_leading_coefficient(5);
    assert!((coeff_5 - 2.287076 / 2.0).abs() < 1e-5);
}

#[test]
fn test_exact_counting_convergence_k4_and_k5() {
    let x_val = 100_000_000u64; // 10^8

    // k=4: N_4(x) / x -> 0.5
    let count_4 = MultiFactorialHierarchyEngine::count_exact_multi_factorial_solutions(4, x_val);
    let ratio_4 = (count_4 as f64) / (x_val as f64);
    assert!(
        (ratio_4 - 0.5).abs() < 0.005,
        "k=4 ratio {} deviated from 0.5", ratio_4
    );

    // k=5: N_5(x) / x -> C_5 / 2 ≈ 1.143538
    let count_5 = MultiFactorialHierarchyEngine::count_exact_multi_factorial_solutions(5, x_val);
    let ratio_5 = (count_5 as f64) / (x_val as f64);
    let expected_5 = MultiFactorialHierarchyEngine::compute_asymptotic_leading_coefficient(5);
    assert!(
        (ratio_5 - expected_5).abs() < 0.01,
        "k=5 ratio {} deviated from expected {}", ratio_5, expected_5
    );
}
