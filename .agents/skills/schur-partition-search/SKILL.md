---
name: schur-partition-search
description: >
  SA-based search for sum-free partitions (Schur numbers, Van der Waerden).
  Use this when algebraic partition rules have failed (E > 0) and you need
  to escalate to an SA optimizer that warm-starts from the best algebraic seed.
---

# Schur Partition SA Search Skill

## When to Apply
Use this skill when:
- The problem class is `schur_partition` (or any sum-free coloring)
- One or more `algebraic_partition_construction` nodes have already run with E > 0
- You want to escalate from algebraic Ansatz testing to actual optimization

## Node Type to Emit
```json
{
  "id": "partition_sa_from_seed",
  "kind": "partition_sa_search",
  "label": "SA optimizer warm-started from algebraic Ansatz",
  "dependsOn": ["<id-of-prior-algebraic_partition_construction-node>"],
  "config": {
    "domain_size": 537,
    "num_partitions": 6,
    "sa_iterations": 5000000,
    "warm_start_from_node": "<id-of-prior-algebraic_partition_construction-node>",
    "description": "Metropolis SA from modular-arithmetic warm start"
  }
}
```

## How It Works
1. Reads the `partition` (Int8Array) from the preceding node's result
2. Runs Metropolis SA: randomly swaps elements between color classes
3. Accepts moves with ΔE ≤ 0 always; ΔE > 0 with probability exp(-ΔE/T)
4. Uses incremental ΔE (O(N) per move) for speed
5. Returns the best partition seen; if E=0, records as a valid witness

## Parameters
| Field | Default | Notes |
|---|---|---|
| `domain_size` | required | Size of {1..N} to color |
| `num_partitions` | required | Number of color classes |
| `sa_iterations` | 5,000,000 | More = better quality, slower |
| `warm_start_from_node` | optional | Node id to seed from; omit for random start |

## Chaining Pattern
Ideal chain for Schur problems:
```
algebraic_partition_construction (fast algebraic Ansatz, E~1900)
  → partition_sa_search (warm SA, may reach E=0)
```

If SA still gives E > 0, emit another SA node with higher `sa_iterations`
or with the SA result itself as the next warm start.

## Example for S(6) ≥ 537
```json
{
  "kind": "partition_sa_search",
  "config": {
    "domain_size": 537,
    "num_partitions": 6,
    "sa_iterations": 10000000,
    "warm_start_from_node": "init_alg",
    "description": "10M-iter SA from period-18 algebraic warm start"
  }
}
```
