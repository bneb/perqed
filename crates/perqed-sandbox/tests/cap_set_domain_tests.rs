use perqed_sandbox::domain::{
    cap_set_sweep, DomainPayload, DomainRegistry, DomainVerdict,
};

#[test]
fn test_cap_set_domain_propose_verify_dim2() {
    let registry = DomainRegistry::standard();
    let domain = registry.get("combinatorics.cap_set").unwrap();
    let spec = serde_json::json!({"dimension": 2, "target_size": 4});
    let payload = domain.propose(&spec).unwrap();
    let verdict = domain.verify(&payload).unwrap();
    match verdict {
        DomainVerdict::CapSet {
            verified,
            dimension,
            size,
            target_size,
            is_three_ap_free,
            ..
        } => {
            assert!(verified, "F_3^2 has a cap-set of size 4");
            assert_eq!(dimension, 2);
            assert_eq!(size, 4);
            assert_eq!(target_size, 4);
            assert!(is_three_ap_free);
        }
        other => panic!("expected CapSet verdict, got: {other:?}"),
    }
}

#[test]
fn test_cap_set_domain_propose_verify_dim3() {
    let registry = DomainRegistry::standard();
    let domain = registry.get("combinatorics.cap_set").unwrap();
    let spec = serde_json::json!({"dimension": 3, "target_size": 9});
    let payload = domain.propose(&spec).unwrap();
    let verdict = domain.verify(&payload).unwrap();
    match verdict {
        DomainVerdict::CapSet {
            verified,
            dimension,
            size,
            target_size,
            is_three_ap_free,
            ..
        } => {
            assert!(verified, "F_3^3 has a classical cap-set of size 9");
            assert_eq!(dimension, 3);
            assert_eq!(size, 9);
            assert_eq!(target_size, 9);
            assert!(is_three_ap_free);
        }
        other => panic!("expected CapSet verdict, got: {other:?}"),
    }
}

#[test]
fn test_cap_set_domain_rejects_collinear_3ap() {
    let registry = DomainRegistry::standard();
    let domain = registry.get("combinatorics.cap_set").unwrap();
    // (0,0), (1,1), (2,2) form a 3-AP line in F_3^2: 0+1+2 = 3 = 0 mod 3
    let payload = DomainPayload::CapSet {
        dimension: 2,
        vectors: vec![vec![0, 0], vec![1, 1], vec![2, 2]],
        target_size: 3,
    };
    let verdict = domain.verify(&payload).unwrap();
    match verdict {
        DomainVerdict::CapSet {
            verified,
            is_three_ap_free,
            reason,
            ..
        } => {
            assert!(!verified, "collinear 3-AP must be rejected");
            assert!(!is_three_ap_free);
            assert!(
                reason.contains("arithmetic progression") || reason.contains("3-AP") || reason.contains("collinear"),
                "reason: {reason}"
            );
        }
        other => panic!("expected CapSet verdict, got: {other:?}"),
    }
}

#[test]
fn test_cap_set_domain_rejects_duplicate_vector() {
    let registry = DomainRegistry::standard();
    let domain = registry.get("combinatorics.cap_set").unwrap();
    let payload = DomainPayload::CapSet {
        dimension: 2,
        vectors: vec![vec![0, 0], vec![0, 1], vec![0, 0]],
        target_size: 3,
    };
    let verdict = domain.verify(&payload).unwrap();
    match verdict {
        DomainVerdict::CapSet { verified, reason, .. } => {
            assert!(!verified, "duplicate vector must be rejected");
            assert!(reason.contains("duplicate"), "reason: {reason}");
        }
        other => panic!("expected CapSet verdict, got: {other:?}"),
    }
}

#[test]
fn test_cap_set_domain_rejects_out_of_range_coordinate() {
    let registry = DomainRegistry::standard();
    let domain = registry.get("combinatorics.cap_set").unwrap();
    let payload = DomainPayload::CapSet {
        dimension: 2,
        vectors: vec![vec![0, 0], vec![0, 3]], // 3 not in F_3 = {0, 1, 2}
        target_size: 2,
    };
    let verdict = domain.verify(&payload).unwrap();
    match verdict {
        DomainVerdict::CapSet { verified, reason, .. } => {
            assert!(!verified, "coordinate >= 3 must be rejected in F_3");
            assert!(reason.contains("F_3") || reason.contains("coordinate"), "reason: {reason}");
        }
        other => panic!("expected CapSet verdict, got: {other:?}"),
    }
}

#[test]
fn test_cap_set_lean_emission() {
    let registry = DomainRegistry::standard();
    let domain = registry.get("combinatorics.cap_set").unwrap();
    let spec = serde_json::json!({"dimension": 2, "target_size": 4});
    let payload = domain.propose(&spec).unwrap();
    let verdict = domain.verify(&payload).unwrap();
    let lean_spec = domain.generate_lean_spec(&payload, &verdict).unwrap();
    assert!(lean_spec.contains("is_3ap_free"), "spec must contain 3-AP check");
    assert!(lean_spec.contains("F3Vector"), "spec must define F_3 vector representation");
    assert!(!lean_spec.contains("sorry"), "spec must not contain sorry");
    let lean_proof = domain.generate_lean_proof(&payload, &verdict).unwrap();
    assert!(lean_proof.contains("decide"), "proof must be kernel-decidable via decide");
}

#[test]
fn test_cap_set_sweep_dimensions_1_to_4() {
    let rows = cap_set_sweep(4);
    assert_eq!(rows.len(), 4);
    // Classical cap-set bounds: C(1)=2, C(2)=4, C(3)=9, C(4)=20
    assert_eq!(rows[0].dimension, 1);
    assert_eq!(rows[0].size, 2);
    assert_eq!(rows[1].dimension, 2);
    assert_eq!(rows[1].size, 4);
    assert_eq!(rows[2].dimension, 3);
    assert_eq!(rows[2].size, 9);
    assert_eq!(rows[3].dimension, 4);
    assert!(rows[3].size >= 20, "F_3^4 cap set size >= 20");
}
