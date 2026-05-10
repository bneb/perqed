import sympy as sp

x = sp.symbols('x')

# g(x) is a general quadratic
c2, c1, c0 = sp.symbols('c2 c1 c0')
g = c2*x**2 + c1*x + c0

# A(x) = (p1*x + p0) / (q2*x**2 + q1*x + q0)
p1, p0, q2, q1, q0 = sp.symbols('p1 p0 q2 q1 q0')
A_x = (p1*x + p0) / (q2*x**2 + q1*x + q0)
A_g = A_x.subs(x, g)

expr_A = A_x - A_g - 1/x
num_A = sp.cancel(expr_A).as_numer_denom()[0]
poly_A = sp.Poly(num_A, x)
eqs_A = poly_A.coeffs()

# B(x) = (u1*x + u0) / (v2*x**2 + v1*x + v0)
u1, u0, v2, v1, v0 = sp.symbols('u1 u0 v2 v1 v0')
B_x = (u1*x + u0) / (v2*x**2 + v1*x + v0)
B_g = B_x.subs(x, g)

expr_B = B_x - B_g - 1/(x-1)
num_B = sp.cancel(expr_B).as_numer_denom()[0]
poly_B = sp.Poly(num_B, x)
eqs_B = poly_B.coeffs()

all_eqs = eqs_A + eqs_B
print(f"Total equations: {len(all_eqs)}")

# We have 13 variables: c2,c1,c0, p1,p0,q2,q1,q0, u1,u0,v2,v1,v0
# But we can set q2=1 and v2=1 without loss of generality (if degrees are 2)
# Or set q1=1, v1=1, etc.
# Actually, Grobner basis on 13 variables is too slow.
# Let's just ask sympy to solve it.

import time
start = time.time()
print("Solving...")
sols = sp.solve(all_eqs, (c2,c1,c0, p1,p0,q2,q1,q0, u1,u0,v2,v1,v0), dict=True)
print(f"Done in {time.time()-start} seconds")

valid_sols = []
for sol in sols:
    # check denominators
    if sol.get(q2, q2) == 0 and sol.get(q1, q1) == 0 and sol.get(q0, q0) == 0:
        continue
    if sol.get(v2, v2) == 0 and sol.get(v1, v1) == 0 and sol.get(v0, v0) == 0:
        continue
    if sol.get(c2, c2) == 0:
        continue
    valid_sols.append(sol)

print("Valid solutions:", valid_sols)
