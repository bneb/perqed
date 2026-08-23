use perqed_core::{
    AsymptoticLeadingConstantEstimator, ConsecutiveCollisionInspector, FactorialSieveDensityEstimator,
    LegendreDigitParityEngine,
};

#[test]
fn test_legendre_digit_parity_formula() {
    // Test base-p digit sum and Legendre identity v_p(n!) = (n - S_p(n)) / (p - 1)
    for p in [2, 3, 5, 7] {
        for n in 1..=50 {
            let digit_sum = LegendreDigitParityEngine::compute_base_p_digit_sum(n, p);
            let v_p_direct = LegendreDigitParityEngine::compute_v_p_factorial(n, p);
            let v_p_legendre = (n - digit_sum) / (p - 1);
            assert_eq!(
                v_p_direct, v_p_legendre,
                "Legendre formula failure at n={}, p={}", n, p
            );
        }
    }
}

#[test]
fn test_squarefree_kernel_first_values() {
    let primes = vec![2, 3, 5, 7, 11, 13, 17, 19];
    // Sequence OEIS A055204: s(n!) for n = 1..10
    // s(1!) = 1, s(2!) = 2, s(3!) = 6, s(4!) = 6, s(5!) = 30,
    // s(6!) = 5, s(7!) = 35, s(8!) = 70, s(9!) = 70, s(10!) = 7
    let expected = vec![0, 1, 2, 6, 6, 30, 5, 35, 70, 70, 7];
    for n in 1..=10 {
        let s_n = LegendreDigitParityEngine::compute_squarefree_kernel(n, &primes);
        assert_eq!(s_n, expected[n as usize], "Mismatch at s({}!)", n);
    }
}

#[test]
fn test_asymptotic_sieve_parity_equidistribution() {
    // Delange / Mauduit-Sarkozy: Pr(p | s(n!)) -> 1/2 as X -> infty
    let limit = 5_000;
    for p in [2, 3, 5] {
        let density = FactorialSieveDensityEstimator::compute_empirical_density(p, limit);
        assert!(
            (density - 0.50).abs() < 0.05,
            "Prime p={} parity density {} deviated from 0.50", p, density
        );
    }

    // Joint independence: Pr(p1 | s(n!) and p2 | s(n!)) -> 1/4
    let joint_density = FactorialSieveDensityEstimator::compute_joint_empirical_density(2, 3, limit);
    assert!(
        (joint_density - 0.25).abs() < 0.05,
        "Joint parity density (2, 3) {} deviated from 0.25", joint_density
    );
}

#[test]
fn test_consecutive_collision_square_rigidity() {
    // Theorem: s(n!) = s((n+1)!) if and only if n + 1 is a perfect square
    let collisions = ConsecutiveCollisionInspector::find_squarefree_collisions(200);
    assert!(!collisions.is_empty());
    for (n, n_plus_1) in collisions {
        assert_eq!(n + 1, n_plus_1);
        let root = (n_plus_1 as f64).sqrt().round() as u64;
        assert_eq!(root * root, n_plus_1, "Consecutive collision {} -> {} must be a square", n, n_plus_1);
    }
}

#[test]
fn test_tao_asymptotic_leading_constant_and_counting() {
    // 1. Partial sum convergence to C_1 = 4.265293...
    let c1 = AsymptoticLeadingConstantEstimator::compute_asymptotic_leading_constant(80);
    assert!(
        (c1 - 4.265293).abs() < 1e-5,
        "Leading constant {} deviated from expected 4.265293", c1
    );

    // 2. Exponential tail decay
    let tail_50 = AsymptoticLeadingConstantEstimator::compute_tail_bound(50);
    assert!(tail_50 < 1e-5, "Tail after 50 terms must be < 1e-5, got {}", tail_50);

    // 3. Counting function convergence N_1(x) / sqrt(x) -> C_1
    let x_val = 100_000_000u64; // 10^8
    let count = AsymptoticLeadingConstantEstimator::count_exact_h1_solutions(x_val);
    let ratio = (count as f64) / (x_val as f64).sqrt();
    assert!(
        (ratio - c1).abs() < 0.01,
        "Asymptotic ratio N_1(10^8)/sqrt(10^8) = {} deviated from C_1 = {}", ratio, c1
    );
}
