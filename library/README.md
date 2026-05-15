# Perqed Mathematical Library

This library contains pristine, machine-verified mathematical proofs discovered or formalized by the Perqed engine.

## Standards

1. **Zero Sorrys**: No proof in this library may contain `sorry` or `admit`.
2. **Standard Namespacing**: All proofs must reside within the `Perqed` namespace.
3. **Documentation**: Every major theorem and lemma must be documented with a docstring.
4. **Toolchain Consistency**: The library must compile against the version specified in `lean-toolchain`.

## Structure

- **`Perqed.Erdos265`**: Resolution of Erdős Problem #265 (Ceiling Conjecture).
- **`Perqed.TorusDecomposition`**: Machine-checked proofs of directed Hamiltonian torus decompositions ($m=4, 6$).
- **`Perqed.Common`**: Reusable lemmas in analysis, number theory, and combinatorics.

## Building

To build the library:
```bash
lake update
lake build
```
