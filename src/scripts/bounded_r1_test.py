#!/usr/bin/env python3
from fractions import Fraction

def generate_bounded_R1_sequence(a0, max_terms=15):
    # We want a sequence where R1(N) stays bounded.
    # To do this, let's just pick R1(N) values!
    # R1(N+1) = a_N R1(N) - P_N
    # So a_N = (P_N + R1(N+1)) / R1(N) (assuming q1=1)
    
    # Let's search for sequences of R1(N) in {1, 2, 3} such that a_N is an integer and a_N >= a_{N-1}^2 - a_{N-1} + 1.
    
    q1 = 1
    
    def search(term_idx, current_R1, P_N, current_a_prev, current_seq):
        if term_idx == max_terms:
            return current_seq
            
        for next_R1 in range(1, 4):
            num = q1 * P_N + next_R1
            if num % current_R1 == 0:
                a_next = num // current_R1
                if current_a_prev is None or a_next >= current_a_prev**2 - current_a_prev + 1:
                    res = search(term_idx + 1, next_R1, P_N * a_next, a_next, current_seq + [a_next])
                    if res: return res
        return None

    seq = search(0, 1, 1, None, [])
    
    if seq:
        print(f"Found bounded R1 sequence: {seq[:5]}...")
        s2 = Fraction(0)
        for k, a in enumerate(seq):
            c = a - 1
            s2 += Fraction(1, c)
            d_N = s2.denominator
            ratio = float(d_N) / c if c > 0 else float('inf')
            print(f"k={k:2d} | a_k={a:<30d} | d_N/c_N = {ratio:10.5f} | c={c:<30d} | d_N={d_N}")
    else:
        print("No bounded R1 sequence found.")

if __name__ == "__main__":
    generate_bounded_R1_sequence(2, 10)
