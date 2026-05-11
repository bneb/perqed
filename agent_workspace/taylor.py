import sympy

def compute_taylor(N):
    w = sympy.Symbol('w')
    phi = sympy.series(w**2 / (1 - w + w**2), w, 0, N+1).removeO()
    F = sympy.series(w / (1 + w), w, 0, N+1).removeO()
    
    current_term = phi
    for _ in range(10):
        F_next = sympy.series(current_term / (1 + current_term), w, 0, N+1).removeO()
        F = sympy.series(F + F_next, w, 0, N+1).removeO()
        current_term = sympy.series(current_term**2 / (1 - current_term + current_term**2), w, 0, N+1).removeO()
        if current_term == 0:
            break
            
    return F

F = compute_taylor(30)
coeffs = sympy.Poly(F).all_coeffs()
coeffs.reverse() # now from degree 0 to 30
for i, c in enumerate(coeffs):
    print(f"a_{i} = {c}")
