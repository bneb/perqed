#!/usr/bin/env python3
from fractions import Fraction

def search_bounded_R1(q1, max_R1, max_terms=8):
    def search(term_idx, current_R1, P_N, current_a_prev, current_seq):
        if term_idx == max_terms:
            return current_seq
            
        for next_R1 in range(1, max_R1 + 1):
            num = q1 * P_N + next_R1 - current_R1
            if num % current_R1 == 0:
                c_next = num // current_R1
                a_next = c_next + 1
                # Must be strictly increasing and fast growth
                if current_a_prev is None or a_next >= current_a_prev**2 - current_a_prev + 1:
                    res = search(term_idx + 1, next_R1, P_N * a_next, a_next, current_seq + [a_next])
                    if res: return res
        return None

    # We iterate over possible starting R1 values.
    for r1_start in range(1, max_R1 + 1):
        seq = search(0, r1_start, 1, None, [])
        if seq:
            return seq, r1_start
    return None, None

if __name__ == "__main__":
    for q1 in range(1, 10):
        seq, r1 = search_bounded_R1(q1, q1, max_terms=6)
        if seq:
            print(f"q1={q1}, R1_start={r1}: {seq}")
