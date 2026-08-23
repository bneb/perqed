use perqed_core::coverage::{
    CoverageError, FormalGoalDescriptor, GoalCoverageGuard, GoalQuantifier,
    ProvedTheoremDescriptor,
};

#[test]
fn test_goal_coverage_guard_rejects_narrative_inflation() {
    let target = FormalGoalDescriptor {
        name: "cunningham_diophantine_no_solution".to_string(),
        target_predicate: "¬ ∃ (z : Nat), z^2 = p^2 + (2^k * p + 1)".to_string(),
        quantifier: GoalQuantifier::NegatedExistential,
        is_diophantine_classification: true,
    };

    let proved = ProvedTheoremDescriptor {
        proof_name: "cunningham_not_p_plus_one".to_string(),
        proved_predicate: "(p + 1)^2 < p^2 + (2^k * p + 1)".to_string(),
        quantifier: GoalQuantifier::SpecificPoint("z = p + 1".to_string()),
    };

    // Attempting to publish with an inflated narrative claim
    let narrative = "We have proved non-existence of solutions for all z in the Cunningham Diophantine equation";
    let res = GoalCoverageGuard::validate_coverage(&target, &proved, narrative);

    assert!(res.is_err());
    match res.unwrap_err() {
        CoverageError::NarrativeInflation { narrative_claim, .. } => {
            assert!(narrative_claim.contains("non-existence"));
        }
        err => panic!("Expected NarrativeInflation error, got {:?}", err),
    }
}

#[test]
fn test_goal_coverage_guard_rejects_sublemma_as_full_proof() {
    let target = FormalGoalDescriptor {
        name: "cunningham_diophantine_no_solution".to_string(),
        target_predicate: "¬ ∃ (z : Nat), z^2 = p^2 + (2^k * p + 1)".to_string(),
        quantifier: GoalQuantifier::NegatedExistential,
        is_diophantine_classification: true,
    };

    let proved = ProvedTheoremDescriptor {
        proof_name: "cunningham_not_p_plus_one".to_string(),
        proved_predicate: "(p + 1)^2 < p^2 + (2^k * p + 1)".to_string(),
        quantifier: GoalQuantifier::SpecificPoint("z = p + 1".to_string()),
    };

    // Honest narrative stating only what is proved
    let honest_narrative = "We proved (p+1)^2 is strictly less than p^2 + 2^k*p + 1";
    let res = GoalCoverageGuard::validate_coverage(&target, &proved, honest_narrative);

    assert!(res.is_err());
    match res.unwrap_err() {
        CoverageError::IncompleteDomainCoverage { proved_candidate, target_domain } => {
            assert_eq!(proved_candidate, "z = p + 1");
            assert_eq!(target_domain, "∀ z ∈ ℕ");
        }
        err => panic!("Expected IncompleteDomainCoverage, got {:?}", err),
    }
}

#[test]
fn test_exact_cunningham_lower_bound_counterexample_detection() {
    // Check that (p + 2^(k-1) - 1)^2 < p^2 + 2^k * p + 1 fails for small p
    let k = 3u64;
    let m = 1u64 << (k - 1); // m = 4

    // Test p = 2 (prime)
    let p = 2u64;
    let lower_bound = (p + m - 1).pow(2); // (2 + 4 - 1)^2 = 25
    let target_val = p.pow(2) + (1 << k) * p + 1; // 4 + 16 + 1 = 21
    assert!(
        lower_bound > target_val,
        "Lower bound 25 must exceed target 21, demonstrating the falsity of universal lower bound"
    );

    // Test p = 4 (composite square counterexample)
    let p_comp = 4u64;
    let val_comp = p_comp.pow(2) + (1 << k) * p_comp + 1; // 16 + 32 + 1 = 49
    assert_eq!(val_comp, 49);
    assert_eq!(7 * 7, val_comp, "p=4, k=3 is an exact perfect square solution (7^2)");
}

#[test]
fn test_cunningham_prime_divisibility_obstruction() {
    // For odd primes p, (z-p)(z+p) = 2^k*p + 1.
    // If d1 = p - 1, then p = (2^k + 4) / 3.
    // For all k >= 3, 2^k + 4 = 4 * (2^(k-2) + 1), which is divisible by 4.
    // Thus p is a multiple of 4, hence NEVER prime!
    for k in 3..=15 {
        if k % 2 == 1 {
            let num = (1u64 << k) + 4;
            if num % 3 == 0 {
                let p = num / 3;
                assert_eq!(p % 4, 0, "p = (2^k + 4)/3 must be a multiple of 4 for odd k >= 3");
                assert!(p > 2 && p % 2 == 0, "p is composite for all k >= 3");
            }
        }
    }
}
