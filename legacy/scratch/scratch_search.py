import sympy as sp

x = sp.Symbol('x')

# Let's try simple forms for A(x) and g(x)
# g(x) must be degree 2 to get the 2^n growth.
# Let g(x) = x^2 + a*x + b
a, b = sp.symbols('a b')
g = x**2 + a*x + b

# If A(x) - A(g) = 1/x, A(x) must have a pole at x=0.
# Let A(x) = 1/x + c/x^2 ... wait, if A(x) = c/(x+d) + ...
# Let's just try to set A(x) = c / (x + d)
# Then A(x) - A(g(x)) = c/(x+d) - c/(x^2 + ax + b + d)
# We want this to be 1/x.

# Let's expand c/(x+d) - c/(x^2+ax+b+d)
# = c (x^2 + ax + b + d - x - d) / ((x+d)(x^2+ax+b+d))
# = c (x^2 + (a-1)x + b) / ((x+d)(x^2+ax+b+d))

# We want this to equal 1/x
# So c x (x^2 + (a-1)x + b) = (x+d)(x^2+ax+b+d)
# c x^3 + c(a-1)x^2 + cb x = x^3 + ax^2 + (b+d)x + dx^2 + adx + d(b+d)
# c x^3 + c(a-1)x^2 + cb x = x^3 + (a+d)x^2 + (b+d+ad)x + d(b+d)

# Equating coefficients:
# x^3: c = 1
# x^2: c(a-1) = a+d  => a-1 = a+d => d = -1
# x^1: cb = b+d+ad => b = b - 1 - a => a = -1
# x^0: 0 = d(b+d) => -1(b-1) = 0 => b = 1

# Let's check!
# a = -1, b = 1, c = 1, d = -1
# g(x) = x^2 - x + 1
# A(x) = 1 / (x - 1)
# Then A(x) - A(g(x)) = 1/(x-1) - 1/(x^2-x) = x/(x(x-1)) - 1/(x(x-1)) = (x-1)/(x(x-1)) = 1/x !!!
# Wow!
print("Found g(x) and A(x) for 1/x!")
print("g(x) = x^2 - x + 1")
print("A(x) = 1/(x-1)")

# Now we need B(x) such that B(x) - B(g(x)) = 1/(x-1)
# B(x) must have a pole at x=1.
# Let B(x) = e / (x + f) + h / (x + k)
# We want B(x) - B(x^2 - x + 1) = 1/(x-1)
