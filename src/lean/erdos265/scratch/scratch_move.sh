#!/bin/bash
# Move lines 1251 to end of kt_proof_d2.lean into affirmative_proof_core.lean
sed -n '1251,$p' src/lean/kt_proof_d2.lean > temp_chunk.lean

# Now we need to insert import kt_proof_d2 into affirmative_proof_core.lean
# affirmative_proof_core.lean starts with:
# import Mathlib
# import «verified_growth»
# import «kt_combinatorics»

sed -i '' '3a\
import «kt_proof_d2»
' src/lean/affirmative_proof_core.lean

cat temp_chunk.lean >> src/lean/affirmative_proof_core.lean

# Now remove the chunk from kt_proof_d2.lean
sed -i '' '1251,$d' src/lean/kt_proof_d2.lean

rm temp_chunk.lean
