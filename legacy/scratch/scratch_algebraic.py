# We are looking for polynomials/rational functions.
# Let g(x) = (c2*x^2 + c1*x + c0) / (d2*x^2 + d1*x + d0)
# A(x) = (a1*x + a0) / (b1*x + b0)
# B(x) = (e1*x + e0) / (f1*x + f0)
# This is a bit complex. Let's just do a numerical search for integer sequences!

# We want a sequence a_n where a_{n+1} = g(a_n), and sum 1/a_n is rational, sum 1/(a_n-1) is rational.
# If they are rational, the tails must match the rational function A(x), B(x).
# But instead of finding A and B, we can just search for g(x) directly.
# If sum 1/a_n = P/Q, then 1/a_n + 1/a_{n+1} + ... = A(a_n).
# So A(x) is the tail sum.
# Let A(x) = 1/(x-c) for some c.
# Then 1/x = 1/(x-c) - 1/(g(x)-c)  => 1/(g(x)-c) = 1/(x-c) - 1/x = c / (x(x-c))
# => g(x) - c = x(x-c)/c = x^2/c - x
# => g(x) = x^2/c - x + c.

# We need a sequence of integers. So c must divide x^2. 
# If c=1, g(x) = x^2 - x + 1. (Sylvester)
# If c=-1, g(x) = -x^2 - x - 1. (Negative)
# If c=2, g(x) = x^2/2 - x + 2. To keep it integer, x must be even.
# Let's check c=2. a_0 = 4. a_1 = 16/2 - 4 + 2 = 6. a_2 = 36/2 - 6 + 2 = 14. a_3 = 196/2 - 14 + 2 = 86.
# If g(x) = x^2/c - x + c, then A(x) = c/(x-c) is the tail sum.
# Wait, A(x) - A(g(x)) = c/(x-c) - c/(x^2/c - x) = c/(x-c) - c^2/(x(x-c)) = c(x-c)/(x(x-c)) = c/x.
# We want 1/x, not c/x!
# So A(x) - A(g(x)) = c/x. We need A(x)/c - A(g(x))/c = 1/x.
# So the sum of 1/x is A(x)/c = 1/(x-c).
# Yes! For ANY c, g(x) = x^2/c - x + c gives a rational sum 1/(x-c) for the sequence!
# Let's verify for c=2: a_0 = 4, a_1 = 6, a_2 = 14, a_3 = 86.
# 1/4 + 1/6 + 1/14 + 1/86 = (1204 + 802.66 + 344 + 56)/4816... wait, 1/4 + 1/6 = 5/12.
# Formula says sum = 1/(a_0 - c) = 1/(4-2) = 1/2.
# Let's check: 1/4 + 1/6 + 1/14 + 1/86 + 1/3614 ...
# 1/4 + 1/6 = 10/24 = 5/12 = 0.41666...
# 1/14 = 0.071428... Sum = 0.488095...
# 1/86 = 0.011627... Sum = 0.49972...
# 1/3614 = 0.000276... Sum = 0.49999...
# It approaches 1/2 perfectly!

print("Success with c=2!")
