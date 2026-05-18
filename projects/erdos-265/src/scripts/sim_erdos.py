def simulate():
    # We want to find the relationship between X_N, P_N, and C_N
    # P_{N+1} = P_N * X_N
    # C_{N+1} = X_N * C_N - P_N
    # X_N must be an integer, P_N integer, C_N integer.
    # C_N >= 1
    
    # Try to find a sequence where C_N is bounded.
    # Suppose C_N = 2.
    # C_{N+1} = 2 X_N - P_N.
    # Since C_{N+1} >= 1, we must have 2 X_N - P_N >= 1 => P_N <= 2 X_N - 1.
    # But P_N grows like X_0 ... X_{N-1}.
    # If P_N <= 2 X_N, then X_N >= P_N / 2.
    # Then P_{N+1} = P_N X_N >= P_N^2 / 2.
    # So P_N grows doubly exponentially.
    pass

simulate()
