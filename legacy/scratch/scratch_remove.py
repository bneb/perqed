with open("src/lean/affirmative_proof_core.lean", "r") as f:
    lines = f.readlines()

# We want to remove from 'def ValidSeq' (line 14) up to and including 'exact a_sum_converges E_0 h_cone' (line 232)
# Since python is 0-indexed, line 14 is index 13, line 232 is index 231
del lines[13:232]

with open("src/lean/affirmative_proof_core.lean", "w") as f:
    f.writelines(lines)
