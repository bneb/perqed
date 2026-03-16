# Erdős-Gyárfás Conjecture

> **Status: Shelved** — This project is archived for reference. The conjecture remains open.

## The Problem

*Every graph with minimum degree ≥ 3 contains a cycle whose length is a power of 2.*

This is an open conjecture by Erdős and Gyárfás (1995). Unlike the torus decomposition (which requires finding a specific finite witness), this conjecture makes a universal claim about all graphs and is not amenable to our SA + Lean witness-verification approach.

## What's Here

- **Z3 solver** (`erdos_gyarfas_z3.py`): Exhaustive SAT search for counterexamples, n=7 to n=14
- **SA hunters** (`deep_hunt.ts`, `hunt_frontier.ts`): Stochastic search for counterexample graphs
- **Lean proof** (`ErdosGyarfasN4.lean`): Verified base case (n=4, trivial)
- **Graph utilities**: `cycle_finder.ts`, `energy_calculator.ts`, `graph_mutator.ts`, `graph6.ts` — reusable for future graph problems

## Why Shelved

Our tools work best on **finite, witnessable** problems:
1. SA finds a combinatorial object
2. Lean kernel verifies it

The EG conjecture requires a **structural proof** about all graphs — fundamentally different. The codebase is preserved because the graph utilities may be useful for future projects.
