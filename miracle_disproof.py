import sympy as sp

def disproof_algebraic_miracle():
    z, a, b = sp.symbols('z a b')
    
    # P(x) = x^2 + ax + b. We use z = 1/x for asymptotic expansion at infinity.
    inv_P = z**2 / (1 + a*z + b*z**2)
    
    # Unknown coefficients for rational functions U and V
    c = sp.symbols('c1:8')
    d = sp.symbols('d1:8')
    
    Uz = sum(c[i] * z**(i+1) for i in range(7))
    UPz = sum(c[i] * (inv_P)**(i+1) for i in range(7))
    
    Vz = sum(d[i] * z**(i+1) for i in range(7))
    VPz = sum(d[i] * (inv_P)**(i+1) for i in range(7))
    
    diff_U = sp.series(Uz - UPz, z, 0, 8).removeO()
    diff_V = sp.series(Vz - VPz, z, 0, 8).removeO()
    
    # Target: 1/x -> z
    eqs_U = [diff_U.coeff(z, i) - (1 if i == 1 else 0) for i in range(1, 8)]
    # Target: 1/(x-1) -> z + z^2 + z^3 + ...
    eqs_V = [diff_V.coeff(z, i) - 1 for i in range(1, 8)]
    
    print("Solving U equations for a, b...")
    sol_U = sp.solve(eqs_U[:5], list(c[:4]) + [a, b], dict=True)
    print("Valid (a,b) for 1/x:", [{k: v for k, v in s.items() if str(k) in ['a', 'b']} for s in sol_U])
    
    print("\nSolving V equations for a, b...")
    sol_V = sp.solve(eqs_V[:5], list(d[:4]) + [a, b], dict=True)
    print("Valid (a,b) for 1/(x-1):", [{k: v for k, v in s.items() if str(k) in ['a', 'b']} for s in sol_V])

if __name__ == "__main__":
    disproof_algebraic_miracle()
