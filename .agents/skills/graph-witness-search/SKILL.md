---
description: How to formulate a graph existence problem as a Simulated Annealing search
---

# Graph Witness Search via Simulated Annealing

## When to Use

Use this pattern when:
- The problem asks whether a specific finite graph **exists** with prescribed properties
- The search space is too large for exhaustive enumeration
- A candidate graph can be **verified** in polynomial time

## Architecture

```
src/math/graph/
  ├── AdjacencyMatrix.ts         # Flat Uint8Array, O(1) edge queries
  ├── CommonNeighbors.ts         # Shared neighbor counting
  ├── SRGEnergy.ts               # Parameterized SRG energy (k, λ, μ)
  └── DegreePreservingSwap.ts    # k-regular mutation operator

src/math/optim/
  ├── IState.ts                  # Generic optimization interface
  ├── SimulatedAnnealing.ts      # Metropolis-Hastings engine
  └── AnnealingSchedule.ts       # Configurable cooling/reheat
```

## Steps

1. **Define the target property** as constraints on an adjacency matrix.

2. **Design the energy function**: Count violations of each constraint. E=0 iff the graph satisfies all constraints. Include:
   - Degree penalties: `Σ (degree(v) - k)²`
   - Structural penalties: `Σ (actual - target)²` for each pair

3. **Choose a mutation operator**:
   - For k-regular graphs: use `degreePreservingSwap` (preserves degree invariant)
   - For unconstrained graphs: single edge flip (add/remove one edge)

4. **Implement `IState<T>`**:
   ```typescript
   class MyGraphState implements IState<Uint8Array> {
     getPayload() { return this.graph.raw; }
     getEnergy() { return myEnergyFunction(this.graph); }
     mutate() { return new MyGraphState(degreePreservingSwap(this.graph)); }
   }
   ```

5. **Run SA** with adaptive reheat:
   ```typescript
   SimulatedAnnealing.run(initialState, {
     maxIterations: 1_000_000,
     initialTemp: 50,
     coolingRate: 0.999998,
     adaptiveReheatWindow: 50_000,
   });
   ```

6. **Verify in Lean 4** if E=0 witness is found (see `lean-finite-graph` skill).

## Known Instances

| Problem | Parameters | Search Space | Energy Function |
|---------|-----------|-------------|-----------------|
| Torus decomposition | m=4,6 | 6^(m³-1) | Component + in-degree penalty |
| Conway's 99-graph | SRG(99,14,1,2) | ~10^132 | Common neighbor deviation |
| Any SRG(n,k,λ,μ) | Varies | ~2^(n²/2) | `srgEnergy(g, k, λ, μ)` |
