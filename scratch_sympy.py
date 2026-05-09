import sympy as sp

x, a = sp.symbols('x a')

# Known generator for 1/x
g = a*x**2 - x + 1/a

# Let's search for B(x) = (u1*x + u0) / (v2*x**2 + v1*x + v0)
u1, u0, v2, v1, v0 = sp.symbols('u1 u0 v2 v1 v0')

B_x = (u1*x + u0) / (v2*x**2 + v1*x + v0)
B_g = B_x.subs(x, g)

expr = B_x - B_g - 1/(x-1)

# simplify and get numerator
num = sp.cancel(expr).as_numer_denom()[0]
poly = sp.Poly(num, x)

print("Degrees of x in numerator:", poly.degree())

coeffs = poly.coeffs()
print(f"Number of equations: {len(coeffs)}")

# Let's solve the system of equations.
# We have 5 variables: u1, u0, v2, v1, v0
# But equations are homogeneous in v's and u's if we fix one.
# Let's just pass it to sympy's non-linear solver.
print("Solving...")
solutions = sp.solve(coeffs, (u1, u0, v2, v1, v0))
print("Solutions:", solutions)

