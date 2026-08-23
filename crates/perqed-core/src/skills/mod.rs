//! Mathematical Skills Taxonomy & Dynamic Injection Engine
//!
//! Provides a structured ontology of 40+ mathematical proof paradigms, formalization
//! guidelines, invariant heuristics, and tactic templates ported from Perqed V1.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SkillCategory {
    Combinatorics,
    Analysis,
    Algebra,
    Topology,
    Logic,
    NumberTheory,
    Metaheuristic,
    Formalization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MathematicalSkill {
    pub name: String,
    pub category: SkillCategory,
    pub description: String,
    pub trigger_keywords: Vec<String>,
    pub formalization_rules: Vec<String>,
    pub proof_templates: Vec<String>,
    pub invariant_hints: Vec<String>,
}

fn svec(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SkillRegistry {
    skills: HashMap<String, MathematicalSkill>,
}

impl SkillRegistry {
    pub fn new() -> Self {
        Self {
            skills: HashMap::new(),
        }
    }

    pub fn insert(&mut self, skill: MathematicalSkill) {
        self.skills.insert(skill.name.clone(), skill);
    }

    pub fn get(&self, name: &str) -> Option<&MathematicalSkill> {
        self.skills.get(name)
    }

    pub fn len(&self) -> usize {
        self.skills.len()
    }

    pub fn is_empty(&self) -> bool {
        self.skills.is_empty()
    }

    pub fn get_by_category(&self, cat: SkillCategory) -> Vec<&MathematicalSkill> {
        self.skills
            .values()
            .filter(|s| s.category == cat)
            .collect()
    }

    pub fn all_skills(&self) -> Vec<&MathematicalSkill> {
        self.skills.values().collect()
    }

    /// Generates LLM prompt directives from a set of matched skills
    pub fn render_prompt_guidance(skills: &[&MathematicalSkill]) -> String {
        if skills.is_empty() {
            return String::new();
        }

        let mut out = String::from("\n### Mathematical Reasoning & Formalization Directives\n");
        for skill in skills {
            out.push_str(&format!("\n#### Skill: {} ({:?})\n", skill.name, skill.category));
            out.push_str(&format!("**Description**: {}\n", skill.description));
            
            if !skill.formalization_rules.is_empty() {
                out.push_str("**Formalization Rules:**\n");
                for rule in &skill.formalization_rules {
                    out.push_str(&format!("- {}\n", rule));
                }
            }

            if !skill.proof_templates.is_empty() {
                out.push_str("**Proof Templates:**\n");
                for tmpl in &skill.proof_templates {
                    out.push_str(&format!("```lean\n{}\n```\n", tmpl));
                }
            }

            if !skill.invariant_hints.is_empty() {
                out.push_str("**Invariant & Bounding Hints:**\n");
                for hint in &skill.invariant_hints {
                    out.push_str(&format!("- {}\n", hint));
                }
            }
        }
        out
    }

    /// Initializes the comprehensive default catalog of 40+ mathematical skills
    pub fn default_catalog() -> Self {
        let mut reg = Self::new();

        // 1. COMBINATORICS & GRAPH THEORY
        reg.insert(MathematicalSkill {
            name: "probabilistic_method".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Prove existence of combinatorial structures by establishing non-zero probability in a probability space (Erdos-Renyi, Lovasz Local Lemma, Alteration method).".to_string(),
            trigger_keywords: svec(&["probabilistic", "random graph", "lovasz local lemma", "first moment", "second moment", "chernoff", "union bound", "expectation"]),
            formalization_rules: svec(&[
                "Define sample space as finite Fintype or measurable measure space.",
                "Use linearity of expectation: E[∑ X_i] = ∑ E[X_i] without requiring independence.",
                "Formalize existence via: (MeasureSpace.prob {ω | P ω} > 0) → ∃ ω, P ω.",
            ]),
            proof_templates: svec(&[
                "have h_exp : E[X] < 1 := by ...\nhave h_exist : ∃ ω, X ω = 0 := exists_of_lt_one h_exp",
            ]),
            invariant_hints: svec(&["Chernoff bound exp(-2t^2/n)", "Union bound P(⋃ A_i) ≤ ∑ P(A_i)"]),
        });

        reg.insert(MathematicalSkill {
            name: "spectral_graph_bounds".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Relate combinatorial graph parameters (chromatic number, independence number, expansion) to eigenvalues of the adjacency or Laplacian matrix (Hoffman bound, Cheeger inequality, Alon-Boppana).".to_string(),
            trigger_keywords: svec(&["spectral", "eigenvalue", "adjacency matrix", "laplacian", "hoffman", "cheeger", "rayleigh quotient", "algebraic connectivity"]),
            formalization_rules: svec(&[
                "Represent adjacency matrix as Matrix (Fin n) (Fin n) ℝ.",
                "State Hoffman bound: χ(G) ≥ 1 - λ_max / λ_min for regular graphs.",
                "Use Rayleigh-Ritz theorem for quadratic forms: xᵀAx ≤ λ_max ‖x‖².",
            ]),
            proof_templates: svec(&[
                "have h_hoffman : 1 - (λ_max / λ_min) ≤ χ G := by apply Matrix.Spectral.hoffman_bound",
            ]),
            invariant_hints: svec(&["Tr(A) = 0", "Tr(A²) = 2|E|", "Tr(A³) = 6 * (number of triangles)"]),
        });

        reg.insert(MathematicalSkill {
            name: "razborov_flag_algebras".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Asymptotic extremal combinatorics via semidefinite programming on limits of dense graph homomorphisms and positive semidefinite flag matrices.".to_string(),
            trigger_keywords: svec(&["flag algebra", "density", "homomorphism density", "semidefinite", "extremal graph", "turan density", "triangle-free"]),
            formalization_rules: svec(&[
                "Model graph limits as limit of homomorphism density functionals t(H, G).",
                "Express non-negativity as sum of squares in the flag algebra algebra Q_flags.",
            ]),
            proof_templates: svec(&[
                "have h_psd : ∀ f : FlagGraph, 0 ≤ ∫ (f x)^2 dμ := by apply FlagAlgebra.psd_positive",
            ]),
            invariant_hints: svec(&["Cauchy-Schwarz on flag products", "Turan density bounds t(K_r, G)"]),
        });

        reg.insert(MathematicalSkill {
            name: "double_counting".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Count incidences between two sets in two distinct ways to establish an exact equality or tight extremal inequality (Handshaking lemma, bipartite incidences).".to_string(),
            trigger_keywords: svec(&["double counting", "incidence", "handshaking", "bipartite count", "sum over rows", "sum over columns"]),
            formalization_rules: svec(&[
                "Use Finset.sum_comm on double sums: ∑ x, ∑ y, f x y = ∑ y, ∑ x, f x y.",
                "Equate ∑_{v ∈ V} deg(v) = 2 |E|.",
            ]),
            proof_templates: svec(&[
                "have h_double : ∑ v ∈ V, deg v = 2 * E.card := by apply Finset.sum_degrees_eq_two_edges",
            ]),
            invariant_hints: svec(&["Incidence matrix row-sums equal vertex degrees", "Column-sums equal edge cardinality (2)"]),
        });

        reg.insert(MathematicalSkill {
            name: "pigeonhole_principle".to_string(),
            category: SkillCategory::Combinatorics,
            description: "If n items are put into m containers with n > m, at least one container must contain more than n/m items (Dirichlet principle).".to_string(),
            trigger_keywords: svec(&["pigeonhole", "dirichlet", "boxes", "partitions", "majority", "averaging"]),
            formalization_rules: svec(&[
                "Apply Finset.exists_le_card_fiber_of_maps_to or Finset.exists_lt_card_fiber_of_maps_to.",
                "Ensure finite domain and codomain types with DecidableEq.",
            ]),
            proof_templates: svec(&[
                "obtain ⟨box, h_box, h_card⟩ := Finset.exists_lt_card_fiber_of_maps_to h_maps h_card_lt",
            ]),
            invariant_hints: svec(&["Average value bound: max x_i ≥ (1/n) ∑ x_i"]),
        });

        reg.insert(MathematicalSkill {
            name: "algebraic_graph_construction".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Construct graphs from algebraic groups, finite fields, or geometric lattices (Cayley graphs, Paley graphs, unit-distance graphs over algebraic number fields).".to_string(),
            trigger_keywords: svec(&["cayley graph", "paley graph", "algebraic graph", "circulant", "unit distance", "automorphism group"]),
            formalization_rules: svec(&[
                "Define vertices as group G or field F and edges as differences in a symmetric generating set S.",
                "Prove vertex-transitivity via group action automorphisms.",
            ]),
            proof_templates: svec(&[
                "def CayleyGraph (G : Type*) [Group G] (S : Set G) : SimpleGraph G where\n  Adj u v := u⁻¹ * v ∈ S ∧ u ≠ v",
            ]),
            invariant_hints: svec(&["Cayley graph is regular of degree |S|", "Paley graph P(q) has (q-1)/2 degree"]),
        });

        reg.insert(MathematicalSkill {
            name: "srg_parameters".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Strongly regular graph srg(v, k, λ, μ) parameter constraints, Krein conditions, and integrality of eigenvalue multiplicities.".to_string(),
            trigger_keywords: svec(&["strongly regular", "srg", "krein condition", "eigenvalue multiplicity", "adjacency spectrum"]),
            formalization_rules: svec(&[
                "Enforce matrix equation: A² = k I + λ A + μ (J - I - A).",
                "Require multiplicities f, g = (v-1)/2 ± ... to be non-negative integers.",
            ]),
            proof_templates: svec(&[
                "have h_srg_eq : A^2 = k • 1 + λ • A + μ • (J - 1 - A) := srg.matrix_equation",
            ]),
            invariant_hints: svec(&["(v - k - 1) μ = k (k - λ - 1)", "Eigenvalues are k and roots of x² - (λ-μ)x - (k-μ) = 0"]),
        });

        reg.insert(MathematicalSkill {
            name: "schur_partition_search".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Sum-free set partitions, Schur numbers S(k), and Ramsey-type arithmetic coloring bounds over integers {1, ..., n}.".to_string(),
            trigger_keywords: svec(&["schur", "sum-free", "partition", "arithmetic progression", "van der waerden"]),
            formalization_rules: svec(&[
                "Define SumFree set: ∀ x y ∈ S, x + y ∉ S.",
                "Model k-coloring as partition of [1..n] into k sum-free subsets.",
            ]),
            proof_templates: svec(&[
                "def IsSumFree (S : Set ℕ) : Prop := ∀ x y ∈ S, x + y ∉ S",
            ]),
            invariant_hints: svec(&["Density bound: Maximum sum-free subset of {1..n} has size ⌈n/2⌉"]),
        });

        reg.insert(MathematicalSkill {
            name: "ramsey_energy_optimization".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Constructive Ramsey lower bounds R(s, t) > n via discrete energy minimization counting monochromatic cliques K_s and independent sets I_t.".to_string(),
            trigger_keywords: svec(&["ramsey", "clique", "independent set", "monochromatic", "ramsey bound"]),
            formalization_rules: svec(&[
                "State Ramsey definition: R(s, t) > n ↔ ∃ G with |V|=n, ω(G) < s ∧ α(G) < t.",
                "Formalize energy functional: E(G) = |{s-cliques}| + |{t-independent sets}|.",
            ]),
            proof_templates: svec(&[
                "have h_ramsey : R s t > n := ⟨G_witness, h_no_clique, h_no_indep⟩",
            ]),
            invariant_hints: svec(&["E(G) = 0 witnesses constructive lower bound"]),
        });

        reg.insert(MathematicalSkill {
            name: "vdw_progression_hunt".to_string(),
            category: SkillCategory::Combinatorics,
            description: "Van der Waerden and Szemeredi arithmetic progression bounds W(r, k) via polynomial progression kernels and Behrend spherical projections.".to_string(),
            trigger_keywords: svec(&["van der waerden", "szemeredi", "arithmetic progression", "behrend", "ap-free"]),
            formalization_rules: svec(&[
                "Define k-term AP: (a, a+d, ..., a+(k-1)d) with d > 0.",
                "Formulate monochromatic AP avoidance in r-colorings.",
            ]),
            proof_templates: svec(&[
                "def HasMonochromaticAP (c : ℕ → Fin r) (k : ℕ) : Prop := ∃ a d > 0, ∀ i < k, c (a + i * d) = c a",
            ]),
            invariant_hints: svec(&["Behrend density: r_3(N) ≫ N exp(-c √log N)"]),
        });

        // 2. ANALYSIS & GEOMETRY
        reg.insert(MathematicalSkill {
            name: "generating_functions".to_string(),
            category: SkillCategory::Analysis,
            description: "Transform recurrence relations and sequence asymptotics into algebraic manipulations of formal power series and meromorphic functions.".to_string(),
            trigger_keywords: svec(&["generating function", "power series", "analytic combinatorics", "recurrence", "asymptotics", "flajolet", "singularities"]),
            formalization_rules: svec(&[
                "Use PowerSeries α or HahnSeries for formal algebraic manipulation.",
                "Use Complex.cauchy_integral_formula for asymptotic singularity analysis.",
            ]),
            proof_templates: svec(&[
                "have h_gf : F(z) * (1 - z - z^2) = z := by ring\nhave h_closed : [z^n] F(z) = (φ^n - ψ^n)/√5 := by ...",
            ]),
            invariant_hints: svec(&["Radius of convergence R = 1 / limsup |a_n|^(1/n)", "Dominant singularity determines leading asymptotic term"]),
        });

        reg.insert(MathematicalSkill {
            name: "analytic_continuation".to_string(),
            category: SkillCategory::Analysis,
            description: "Extend holomorphic and meromorphic functions across branch cuts and domain boundaries via analytic continuation and functional equations.".to_string(),
            trigger_keywords: svec(&["analytic continuation", "holomorphic", "meromorphic", "riemann zeta", "functional equation", "monodromy"]),
            formalization_rules: svec(&[
                "Use Mathlib's Complex.AnalyticAt and DifferentiableOn.",
                "Apply Identity Theorem for analytic functions on connected domains.",
            ]),
            proof_templates: svec(&[
                "have h_id : f = g := AnalyticOn.eq_of_locally_eq h_conn h_agree",
            ]),
            invariant_hints: svec(&["Zeroes of non-trivial analytic functions are isolated"]),
        });

        reg.insert(MathematicalSkill {
            name: "analytic_series".to_string(),
            category: SkillCategory::Analysis,
            description: "Summation, convergence bounds, and tail estimates for analytic and infinite rational series (Euler-Maclaurin, Abel summation, Ahmes series).".to_string(),
            trigger_keywords: svec(&["infinite series", "series convergence", "ahmes", "unit fraction", "tail bound", "euler-maclaurin"]),
            formalization_rules: svec(&[
                "Use HasSum, Summable, and tsum in Mathlib Topology.Instances.Real.",
                "Bound tails via comparison with geometric series: ∑_{k=N}^∞ r^k = r^N / (1 - r).",
            ]),
            proof_templates: svec(&[
                "have h_tail : ∑' k : ℕ, a (k + N) ≤ C * r^N := by apply tsum_le_geometric",
            ]),
            invariant_hints: svec(&["Ratio test: lim |a_{n+1}/a_n| < 1 implies exponential tail decay"]),
        });

        reg.insert(MathematicalSkill {
            name: "epsilon_delta_bounding".to_string(),
            category: SkillCategory::Analysis,
            description: "Rigorous metric and topological limit bounding using quantitative ε-δ estimates and triangle inequality chaining.".to_string(),
            trigger_keywords: svec(&["epsilon delta", "continuity", "uniform continuity", "triangle inequality", "norm bound", "lipschitz"]),
            formalization_rules: svec(&[
                "Decompose target |x - y| < ε into |x - z| + |z - y| < ε/2 + ε/2.",
                "Use metric space distance dist x y in MetricSpace.",
            ]),
            proof_templates: svec(&[
                "intro ε hε\nobtain ⟨δ, hδ_pos, hδ⟩ := h_cont (ε/2) (half_pos hε)\nuse δ, hδ_pos\nintro x hx\ncalc dist (f x) L ≤ dist (f x) (f x₀) + dist (f x₀) L := dist_triangle ...\n     _ < ε := by linarith",
            ]),
            invariant_hints: svec(&["Triangle inequality: ‖a + b‖ ≤ ‖a‖ + ‖b‖", "Reverse triangle: |‖a‖ - ‖b‖| ≤ ‖a - b‖"]),
        });

        reg.insert(MathematicalSkill {
            name: "fourier_analytic_transference".to_string(),
            category: SkillCategory::Analysis,
            description: "Transference principles, Hardy-Littlewood circle method, and Fourier analytic decay on additive structures.".to_string(),
            trigger_keywords: svec(&["fourier", "circle method", "exponential sum", "character", "gowers norm", "additive combinatorics"]),
            formalization_rules: svec(&[
                "Define Fourier transform f̂(r) = ∑_{x} f(x) e(-r x / N).",
                "Apply Parseval's identity: ∑ |f(x)|² = (1/N) ∑ |f̂(r)|².",
            ]),
            proof_templates: svec(&[
                "have h_parseval : ∑ x, ‖f x‖^2 = (1 / N) * ∑ r, ‖f_hat r‖^2 := parseval_identity",
            ]),
            invariant_hints: svec(&["Major arcs capture asymptotic main term", "Minor arcs bounded by Weyl inequality"]),
        });

        // 3. TOPOLOGY & GEOMETRY
        reg.insert(MathematicalSkill {
            name: "compactness_arguments".to_string(),
            category: SkillCategory::Topology,
            description: "Pass from local properties to global bounds using Heine-Borel, Bolzano-Weierstrass, or De Bruijn-Erdos compactness theorem for infinite graphs.".to_string(),
            trigger_keywords: svec(&["compactness", "heine-borel", "subcover", "de bruijn erdos", "bolzano weierstrass", "tychonoff"]),
            formalization_rules: svec(&[
                "Use IsCompact in Mathlib Topology.Basic.",
                "Apply de Bruijn-Erdős theorem to lift finite subgraph colorings to infinite graphs.",
            ]),
            proof_templates: svec(&[
                "have h_finite_sub : ∀ H : Subgraph G, H.Finite → χ H ≤ k := ...\nhave h_global : χ G ≤ k := deBruijn_Erdos h_finite_sub",
            ]),
            invariant_hints: svec(&["Continuous image of compact set is compact and achieves maximum/minimum"]),
        });

        reg.insert(MathematicalSkill {
            name: "geometric_flow_homotopy".to_string(),
            category: SkillCategory::Topology,
            description: "Deformation of continuous paths and algebraic cycles via homotopy equivalence, topological degree, and discrete curvature flows.".to_string(),
            trigger_keywords: svec(&["homotopy", "fundamental group", "geometric flow", "cycle deformation", "topological degree", "torus decomposition"]),
            formalization_rules: svec(&[
                "Model homotopy as continuous map H : I × X → Y.",
                "Use winding numbers / degree invariants to preserve non-contractibility.",
            ]),
            proof_templates: svec(&[
                "have h_homotopy : ContinuousMap.Homotopic f g := ...\nhave h_deg : degree f = degree g := Homotopic.degree_eq h_homotopy",
            ]),
            invariant_hints: svec(&["Euler characteristic χ = V - E + F is a homotopy invariant"]),
        });

        reg.insert(MathematicalSkill {
            name: "fixed_point_arguments".to_string(),
            category: SkillCategory::Topology,
            description: "Banach fixed-point theorem, Brouwer/Schauder fixed points, and Knaster-Tarski lattice theorem proving existence of invariant states.".to_string(),
            trigger_keywords: svec(&["fixed point", "banach", "contraction mapping", "brouwer", "knaster tarski", "monotone map"]),
            formalization_rules: svec(&[
                "For complete metric spaces with contraction ratio k < 1, apply `contracting_map.exists_fixed_point`.",
                "For complete lattices with monotone f, apply `OrderHom.fixedPoints` (Knaster-Tarski).",
            ]),
            proof_templates: svec(&[
                "obtain ⟨x_fix, h_fix⟩ := ContractingMap.exists_unique_fixed_point h_contr",
            ]),
            invariant_hints: svec(&["Geometric convergence: dist(x_n, x*) ≤ k^n / (1-k) dist(x_0, x_1)"]),
        });

        reg.insert(MathematicalSkill {
            name: "homological_cohomological_arguments".to_string(),
            category: SkillCategory::Topology,
            description: "Algebraic topology invariants: simplicial homology, Betti numbers, Mayer-Vietoris sequences, and exact chain complexes for boundary obstructions.".to_string(),
            trigger_keywords: svec(&["homology", "cohomology", "betti number", "exact sequence", "mayer vietoris", "chain complex", "boundary"]),
            formalization_rules: svec(&[
                "Define chain complex C_* with d ∘ d = 0.",
                "State Betti number as dim(ker d_k / im d_{k+1}).",
            ]),
            proof_templates: svec(&[
                "have h_boundary : d (d c) = 0 := ChainComplex.d_squared c",
            ]),
            invariant_hints: svec(&["Euler-Poincaré formula: ∑ (-1)^k Betti_k = ∑ (-1)^k Cell_k"]),
        });

        reg.insert(MathematicalSkill {
            name: "spherical_code_packing".to_string(),
            category: SkillCategory::Topology,
            description: "Kissing numbers, Delsarte linear programming bounds, and spherical t-designs in Euclidean d-space.".to_string(),
            trigger_keywords: svec(&["spherical code", "kissing number", "delsarte", "gegenbauer", "sphere packing", "lattice"]),
            formalization_rules: svec(&[
                "Model spherical points as vectors on unit sphere S^{d-1} with inner product ⟨x, y⟩ ≤ cos θ.",
                "Express Delsarte polynomials with Gegenbauer polynomial expansions.",
            ]),
            proof_templates: svec(&[
                "have h_delsarte : |C| ≤ delsarte_lp_bound d θ := delsarte_theorem h_angles",
            ]),
            invariant_hints: svec(&["Inner product upper bound: ⟨u, v⟩ ≤ 1/2 for kissing configs"]),
        });

        // 4. ALGEBRA & NUMBER THEORY
        reg.insert(MathematicalSkill {
            name: "local_to_global_hasse_principle".to_string(),
            category: SkillCategory::NumberTheory,
            description: "Resolve Diophantine and quadratic form solvability globally over ℚ by establishing solutions locally over all p-adic fields ℚ_p and ℝ.".to_string(),
            trigger_keywords: svec(&["hasse principle", "local to global", "p-adic", "quadratic form", "hilbert symbol", "diophantine", "legendre"]),
            formalization_rules: svec(&[
                "Quantify over all primes p and real place ∞: (∀ p, SolvableLocally p) ↔ SolvableGlobally.",
                "Use Hilbert reciprocity: ∏_v (a, b)_v = 1.",
            ]),
            proof_templates: svec(&[
                "have h_local : ∀ p : Place ℚ, HasLocalSolution Q p := ...\nhave h_global : HasGlobalSolution Q := hasse_minkowski h_local",
            ]),
            invariant_hints: svec(&["Product of local Hilbert symbols over all places is exactly 1"]),
        });

        reg.insert(MathematicalSkill {
            name: "invariants_and_monovariants".to_string(),
            category: SkillCategory::Algebra,
            description: "Construct quantities that remain strictly invariant or strictly monotonic under discrete state transitions to prove termination, bounds, or reachability.".to_string(),
            trigger_keywords: svec(&["invariant", "monovariant", "transition system", "lyapunov", "energy function", "termination", "parity", "valuation"]),
            formalization_rules: svec(&[
                "Define potential function Φ : State → ℕ or ℝ.",
                "Prove transition decreases potential: Step s s' → Φ s' < Φ s.",
                "Use WellFounded relation on ℕ to prove termination.",
            ]),
            proof_templates: svec(&[
                "theorem system_terminates (s : State) : Acc (· < ·) (Φ s) := WellFounded.apply (measure Φ).wf s",
            ]),
            invariant_hints: svec(&["Bounded monovariant on discrete lattice must reach local extremum in finite steps"]),
        });

        reg.insert(MathematicalSkill {
            name: "bijections_and_isomorphisms".to_string(),
            category: SkillCategory::Algebra,
            description: "Establish structural equivalence between sets, graphs, or algebraic structures by constructing explicit bijective morphisms with two-sided inverses.".to_string(),
            trigger_keywords: svec(&["bijection", "isomorphism", "equiv", "cardinality equivalence", "two-sided inverse"]),
            formalization_rules: svec(&[
                "Use Equiv α β with explicit toFun and invFun fields.",
                "Prove left_inv: invFun (toFun x) = x and right_inv: toFun (invFun y) = y.",
            ]),
            proof_templates: svec(&[
                "def my_equiv : α ≃ β where\n  toFun := f\n  invFun := g\n  left_inv := h_left\n  right_inv := h_right",
            ]),
            invariant_hints: svec(&["Cardinality preservation: Card(A) = Card(B) iff A ≃ B"]),
        });

        reg.insert(MathematicalSkill {
            name: "maximality_zorns_lemma".to_string(),
            category: SkillCategory::Algebra,
            description: "Prove existence of maximal elements, bases, or maximal ideals in partially ordered sets where every chain has an upper bound.".to_string(),
            trigger_keywords: svec(&["zorns lemma", "axiom of choice", "maximal element", "chain", "partial order", "poset"]),
            formalization_rules: svec(&[
                "Verify chain condition: ∀ c : Set α, IsChain (· ≤ ·) c → ∃ ub, ∀ x ∈ c, x ≤ ub.",
                "Apply zorn_le or zorn_subset to obtain maximal element m.",
            ]),
            proof_templates: svec(&[
                "obtain ⟨m, hm_max⟩ := zorn_le (fun c hc => ⟨ub c, hub c⟩)",
            ]),
            invariant_hints: svec(&["In finite sets, use induction or maximum directly without AC/Zorn"]),
        });

        reg.insert(MathematicalSkill {
            name: "duality_arguments".to_string(),
            category: SkillCategory::Algebra,
            description: "Linear programming duality, Pontryagin duality, and order-theoretic Galois connections translating difficult primal problems into solvable duals.".to_string(),
            trigger_keywords: svec(&["duality", "galois connection", "linear programming dual", "pontryagin", "adjoint"]),
            formalization_rules: svec(&[
                "State duality equality: max {cᵀx | Ax ≤ b} = min {bᵀy | Aᵀy = c, y ≥ 0}.",
                "Use Galois connection: f x ≤ y ↔ x ≤ g y.",
            ]),
            proof_templates: svec(&[
                "have h_dual : cᵀ x ≤ bᵀ y := lp_weak_duality h_primal_feas h_dual_feas",
            ]),
            invariant_hints: svec(&["Weak duality holds unconditionally: Primal ≤ Dual"]),
        });

        reg.insert(MathematicalSkill {
            name: "lattice_reduction_lll".to_string(),
            category: SkillCategory::Algebra,
            description: "Lenstra-Lenstra-Lovasz (LLL) lattice basis reduction and shortest vector problem (SVP) approximations for polynomial factorization and Diophantine bounds.".to_string(),
            trigger_keywords: svec(&["lll", "lattice reduction", "shortest vector", "gram schmidt", "diophantine approximation"]),
            formalization_rules: svec(&[
                "Define lattice Λ = {∑ c_i b_i | c_i ∈ ℤ}.",
                "Enforce Lovasz condition: δ ‖b*_i‖² ≤ ‖b*_{i+1} + μ_{i+1,i} b*_i‖².",
            ]),
            proof_templates: svec(&[
                "have h_lll : ‖b_1‖ ≤ 2^((n-1)/2) * λ_1(Λ) := lll_first_vector_bound",
            ]),
            invariant_hints: svec(&["Determinant is invariant under unimodular basis transformations"]),
        });

        reg.insert(MathematicalSkill {
            name: "modular_forms_q_expansions".to_string(),
            category: SkillCategory::NumberTheory,
            description: "Cusp forms, Eisenstein series, Hecke operators, and q-expansion coefficient bounds via modularity theorems.".to_string(),
            trigger_keywords: svec(&["modular form", "cusp form", "eisenstein", "hecke operator", "q-expansion", "ramanujan tau"]),
            formalization_rules: svec(&[
                "Model weight k modular form f(γ z) = (c z + d)^k f(z) for γ ∈ SL_2(ℤ).",
                "Expand as Fourier series f(z) = ∑ a_n q^n with q = exp(2π i z).",
            ]),
            proof_templates: svec(&[
                "have h_deligne : |a_n| ≤ d(n) * n^((k-1)/2) := deligne_bound",
            ]),
            invariant_hints: svec(&["Finite dimensionality of spaces of modular forms M_k(Γ)"]),
        });

        reg.insert(MathematicalSkill {
            name: "groebner_basis_elimination".to_string(),
            category: SkillCategory::Algebra,
            description: "Buchberger algorithm, monomial orderings, and ideal elimination theory for certifying polynomial system inconsistency (Hilbert Nullstellensatz).".to_string(),
            trigger_keywords: svec(&["groebner", "buchberger", "ideal", "elimination", "nullstellensatz", "polynomial system"]),
            formalization_rules: svec(&[
                "Define term ordering (lexicographic, degrevlex).",
                "Formulate Nullstellensatz certificate: 1 = ∑ p_i q_i ↔ V(I) = ∅.",
            ]),
            proof_templates: svec(&[
                "have h_nullstellen : 1 ∈ I := groebner_contains_one",
            ]),
            invariant_hints: svec(&["S-polynomials S(f, g) reduce to zero under valid Groebner basis"]),
        });

        reg.insert(MathematicalSkill {
            name: "galois_cohomology".to_string(),
            category: SkillCategory::Algebra,
            description: "Group cohomology of Galois groups H^n(Gal(L/K), M), Hilbert 90, and Brauer group obstruction theory.".to_string(),
            trigger_keywords: svec(&["galois cohomology", "hilbert 90", "brauer group", "cocycle", "coboundary", "etale"]),
            formalization_rules: svec(&[
                "State Hilbert 90: H^1(Gal(L/K), L*) = 0.",
                "Model 1-cocycles as maps σ ↦ a_σ with a_{στ} = a_σ σ(a_τ).",
            ]),
            proof_templates: svec(&[
                "have h_h90 : H1 (Gal L K) (Lˣ) ≃ Unit := hilbert_90",
            ]),
            invariant_hints: svec(&["Inflation-restriction exact sequence"]),
        });

        // 5. LOGIC & FOUNDATIONS
        reg.insert(MathematicalSkill {
            name: "cantors_diagonalization".to_string(),
            category: SkillCategory::Logic,
            description: "Prove uncountability, undecidability, or separation by constructing an element that differs from every element in an enumeration along its diagonal.".to_string(),
            trigger_keywords: svec(&["diagonalization", "uncountable", "halting problem", "incompleteness", "separation", "turing"]),
            formalization_rules: svec(&[
                "Assume enumeration f : ℕ → α.",
                "Construct diagonal d : ℕ → β such that d(n) ≠ f(n)(n).",
                "Derive contradiction from d = f(k) evaluating at k.",
            ]),
            proof_templates: svec(&[
                "by_contra h_surj\nobtain ⟨k, hk⟩ := h_surj (fun n => !f n n)\nhave h_contra : f k k = !f k k := by ...\ncontradiction",
            ]),
            invariant_hints: svec(&["Fixpoint theorem: every map without fixed point refutes surjectivity"]),
        });

        reg.insert(MathematicalSkill {
            name: "forcing_set_theory_independence".to_string(),
            category: SkillCategory::Logic,
            description: "Establish independence of statements (e.g. Continuum Hypothesis) from ZFC via generic filter extensions over partial orders.".to_string(),
            trigger_keywords: svec(&["forcing", "independence", "zfc", "continuum hypothesis", "generic filter", "boolean-valued model"]),
            formalization_rules: svec(&[
                "Define poset P with compatible ordering ≤.",
                "Model names and generic filter G intersecting all dense subsets.",
            ]),
            proof_templates: svec(&[
                "have h_dense : Dense (D_condition) := ...\nhave h_gen : G ∩ D_condition ≠ ∅ := generic_filter.meets h_dense",
            ]),
            invariant_hints: svec(&["Chain conditions (c.c.c.) preserve cardinals"]),
        });

        reg.insert(MathematicalSkill {
            name: "proof_by_contradiction".to_string(),
            category: SkillCategory::Logic,
            description: "Assume the negation of the proposition, deduce logically inconsistent statements, and conclude the original proposition (Classical RAA).".to_string(),
            trigger_keywords: svec(&["contradiction", "by_contra", "negation", "reductio ad absurdum", "falsehood"]),
            formalization_rules: svec(&[
                "Use `by_contra h_neg` to introduce ¬ P into hypotheses.",
                "Derive both Q and ¬ Q, then apply `contradiction` or `exact h_neg h_witness`.",
            ]),
            proof_templates: svec(&[
                "by_contra h\nhave h1 : x > 0 := ...\nhave h2 : x ≤ 0 := ...\nlinarith",
            ]),
            invariant_hints: svec(&["Check whether constructive/direct proof is shorter before using contradiction"]),
        });

        reg.insert(MathematicalSkill {
            name: "proof_by_contraposition".to_string(),
            category: SkillCategory::Logic,
            description: "Prove P → Q by establishing the logically equivalent contrapositive ¬ Q → ¬ P.".to_string(),
            trigger_keywords: svec(&["contrapositive", "contraposition", "implies negation"]),
            formalization_rules: svec(&[
                "Apply `contrapose!` or `contrapose` tactic.",
            ]),
            proof_templates: svec(&[
                "contrapose!\nintro h_not_q\n...",
            ]),
            invariant_hints: svec(&["P → Q ≡ ¬Q → ¬P in classical logic"]),
        });

        reg.insert(MathematicalSkill {
            name: "mathematical_induction".to_string(),
            category: SkillCategory::Logic,
            description: "Prove ∀ n : ℕ, P(n) by establishing base case P(0) and inductive step ∀ k, P(k) → P(k+1) (or strong/well-founded induction).".to_string(),
            trigger_keywords: svec(&["induction", "base case", "inductive step", "strong induction", "well-founded"]),
            formalization_rules: svec(&[
                "Use `induction n with | zero => ... | succ n ih => ...`.",
                "For strong induction, use `induction n using Nat.strong_induction_on`.",
            ]),
            proof_templates: svec(&[
                "induction n with\n| zero => simp\n| succ n ih =>\n  calc ... ≤ ... := by linarith",
            ]),
            invariant_hints: svec(&["Ensure induction variable is cleared from open goals before stepping"]),
        });

        reg.insert(MathematicalSkill {
            name: "extremal_principle_infinite_descent".to_string(),
            category: SkillCategory::Logic,
            description: "Choose an element that minimizes or maximizes an integer objective; show that any hypothetical counterexample creates a strictly smaller one, yielding a contradiction (Fermat descent).".to_string(),
            trigger_keywords: svec(&["infinite descent", "minimal counterexample", "well-ordering", "extremal principle", "fermat"]),
            formalization_rules: svec(&[
                "Use `Nat.find` or `Finset.exists_min_image` on non-empty finite set.",
                "Derive existence of strictly smaller natural number to trigger `Nat.lt_irrefl`.",
            ]),
            proof_templates: svec(&[
                "obtain ⟨x_min, h_min, h_least⟩ := Nat.exists_minimal_of_nonempty h_set\n...\nhave h_smaller : x_new < x_min := ...\nhave := h_least x_new h_smaller_in_set\nlinarith",
            ]),
            invariant_hints: svec(&["Every non-empty set of natural numbers contains a least element (Well-Ordering Principle)"]),
        });

        reg.insert(MathematicalSkill {
            name: "polynomial_time_reductions".to_string(),
            category: SkillCategory::Logic,
            description: "Mapping problem instances to known canonical problems (3-SAT, Clique, Vertex Cover) to establish hardness or algorithmic transfer.".to_string(),
            trigger_keywords: svec(&["reduction", "polynomial time", "np-complete", "hardness", "mapping"]),
            formalization_rules: svec(&[
                "Define reduction function f : InstanceA → InstanceB.",
                "Prove correctness in both directions: x ∈ A ↔ f(x) ∈ B.",
            ]),
            proof_templates: svec(&[
                "theorem reduction_sound_and_complete (x : α) : InLanguageA x ↔ InLanguageB (f x) := ⟨h_forward, h_backward⟩",
            ]),
            invariant_hints: svec(&["Equivalence of decision instances must preserve positive and negative witnesses"]),
        });

        // 6. META-HEURISTICS & SEARCH
        reg.insert(MathematicalSkill {
            name: "lns_z3_hybrid".to_string(),
            category: SkillCategory::Metaheuristic,
            description: "Large Neighborhood Search hybrid with Z3: freeze high-confidence core variables and resolve remaining combinatorial constraints via SMT.".to_string(),
            trigger_keywords: svec(&["lns", "large neighborhood search", "z3", "smt hybrid", "frozen core", "repair"]),
            formalization_rules: svec(&[
                "Split variables into Frozen S_core and Active S_free.",
                "Formulate S_free as Z3 SAT/SMT formula conditioned on S_core.",
            ]),
            proof_templates: svec(&[
                "have h_sat : Z3.Solve (constraints.freeze S_core) = SAT := ...",
            ]),
            invariant_hints: svec(&["Window size α ∈ [0.05, 0.25] balances SMT tractability and basin escape"]),
        });

        reg.insert(MathematicalSkill {
            name: "micro_sat_patch".to_string(),
            category: SkillCategory::Metaheuristic,
            description: "Local constraint violation repair by isolating minimal unsatisfiable cores and applying bounded combinatorial bit-flips.".to_string(),
            trigger_keywords: svec(&["micro sat", "unsat core", "bit flip", "local repair", "tabu"]),
            formalization_rules: svec(&[
                "Extract minimal unsatisfiable sub-clause set.",
                "Perform local search exclusively on variables participating in the conflict core.",
            ]),
            proof_templates: svec(&[
                "apply LocalRepair.patch_conflict_core",
            ]),
            invariant_hints: svec(&["Tabu list prevents 2-cycles in variable flipping"]),
        });

        reg.insert(MathematicalSkill {
            name: "polytope_facet_enumeration".to_string(),
            category: SkillCategory::Metaheuristic,
            description: "Convex hull facet enumeration, double description method, and integer linear programming cutting planes.".to_string(),
            trigger_keywords: svec(&["polytope", "facet", "cutting plane", "integer programming", "convex hull"]),
            formalization_rules: svec(&[
                "Model polytope as V-representation (vertices) or H-representation (halfspaces).",
                "Certify integrality via total unimodularity.",
            ]),
            proof_templates: svec(&[
                "have h_vertex : x ∈ Polytope.Vertices P := ...",
            ]),
            invariant_hints: svec(&["Minkowski-Weyl theorem: every bounded polyhedron is the convex hull of its extreme points"]),
        });

        reg.insert(MathematicalSkill {
            name: "circulant_matrix_bounds".to_string(),
            category: SkillCategory::Metaheuristic,
            description: "Circulant graph automorphism reductions: eigenvalues via discrete Fourier transform of the first row generator.".to_string(),
            trigger_keywords: svec(&["circulant", "dft", "cyclic group", "toeplitz", "generator vector"]),
            formalization_rules: svec(&[
                "Eigenvalues of circulant C are given by λ_j = ∑_{k=0}^{n-1} c_k ω^{j k} where ω = e^{2π i / n}.",
            ]),
            proof_templates: svec(&[
                "have h_circ_eval : λ_j = ∑ k : Fin n, c k * ω^(j * k) := circulant_eigenvalue_formula",
            ]),
            invariant_hints: svec(&["Circulant matrices commute and are simultaneously diagonalized by DFT matrix"]),
        });

        // 7. FORMALIZATION PROTOCOLS
        reg.insert(MathematicalSkill {
            name: "formalization_protocol".to_string(),
            category: SkillCategory::Formalization,
            description: "Mandatory top-down theorem anchoring protocol to prevent the Formalization Gap and Islands of Truth under Lean 4 kernel auditing.".to_string(),
            trigger_keywords: svec(&["formalization protocol", "anchor", "islands of truth", "sorry", "spec lock", "kernel audit"]),
            formalization_rules: svec(&[
                "RULE 1 (Literal Translation): Top-level signature must be a literal translation of the informal claim without altering quantifiers.",
                "RULE 2 (The Sorry Anchor): Lock top-level signature before writing any lemmas.",
                "RULE 3 (No Goalpost Moving): Never weaken conclusion or add ad-hoc hypotheses to make proof easier.",
                "RULE 4 (Closed Chain): Proof is only valid when top-level theorem compiles with zero sorrys and passes cold kernel audit.",
            ]),
            proof_templates: svec(&[
                "/-- Frozen Top-Level Anchor -/\ntheorem anchor_spec (x : α) (h : P x) : Q x := by\n  -- All helper lemmas must link into closing this exact goal\n  sorry",
            ]),
            invariant_hints: svec(&["SHA-256 hash lock must match between Spec.lean and cold audit file"]),
        });

        reg.insert(MathematicalSkill {
            name: "proof_by_exhaustion".to_string(),
            category: SkillCategory::Formalization,
            description: "Prove proposition across finite domain by exhaustive case analysis (`decide`, `fin_cases`, or kernel computation).".to_string(),
            trigger_keywords: svec(&["exhaustion", "decide", "case analysis", "fin_cases", "finite domain"]),
            formalization_rules: svec(&[
                "Use `decide` for Decidable propositions on finite structures.",
                "Use `interval_cases` or `fin_cases` to decompose finite variables into concrete instances.",
            ]),
            proof_templates: svec(&[
                "revert x\ndecide",
            ]),
            invariant_hints: svec(&["Ensure Decidable instance is available for the proposition"]),
        });

        reg.insert(MathematicalSkill {
            name: "direct_proof".to_string(),
            category: SkillCategory::Formalization,
            description: "Construct a forward sequence of logical deductions directly from hypotheses to the desired conclusion using definitional unfolding and equalities.".to_string(),
            trigger_keywords: svec(&["direct proof", "forward deduction", "calc", "definitional equality", "rfl"]),
            formalization_rules: svec(&[
                "Use `calc` blocks for multi-step equality and inequality chains.",
                "Use `intro` to bring universal quantifiers and hypotheses into local context.",
            ]),
            proof_templates: svec(&[
                "intro x hx\ncalc f x = g x := by rw [h1]\n     _ = h x := by rw [h2]",
            ]),
            invariant_hints: svec(&["Prefer calc blocks for readability and maintainability"]),
        });

        reg.insert(MathematicalSkill {
            name: "explicit_construction".to_string(),
            category: SkillCategory::Formalization,
            description: "Prove existential claim ∃ x, P(x) by providing an explicit mathematical witness term and verifying each property directly.".to_string(),
            trigger_keywords: svec(&["explicit construction", "witness", "exists", "use", "constructive"]),
            formalization_rules: svec(&[
                "Provide witness using `use witness_term` or `refine ⟨witness_term, ?_⟩`.",
                "Verify required properties on the concrete witness.",
            ]),
            proof_templates: svec(&[
                "use witness_point\nconstructor\n· exact h_property_one\n· exact h_property_two",
            ]),
            invariant_hints: svec(&["Exact arithmetic witnesses avoid floating-point rounding ambiguities"]),
        });

        reg
    }
}

/// Dynamic Skill Matcher that scores and retrieves relevant skills for any mathematical claim or query
pub struct SkillMatcher<'a> {
    registry: &'a SkillRegistry,
}

impl<'a> SkillMatcher<'a> {
    pub fn new(registry: &'a SkillRegistry) -> Self {
        Self { registry }
    }

    /// Matches the top-k most relevant skills for a given informal claim, theorem signature, or domain
    pub fn match_skills(&self, query: &str, top_k: usize) -> Vec<&'a MathematicalSkill> {
        let q_lower = query.to_lowercase();
        let query_tokens: Vec<&str> = q_lower
            .split(|c: char| !c.is_alphanumeric() && c != '_')
            .filter(|s| s.len() > 2)
            .collect();

        let mut scored_skills: Vec<(f64, &'a MathematicalSkill)> = Vec::new();

        for skill in self.registry.all_skills() {
            let mut score = 0.0;

            // Direct name match
            if q_lower.contains(&skill.name.replace('_', " ")) || q_lower.contains(&skill.name) {
                score += 10.0;
            }

            // Keyword triggers match
            for kw in &skill.trigger_keywords {
                let kw_lower = kw.to_lowercase();
                if q_lower.contains(&kw_lower) {
                    score += 5.0;
                } else {
                    for tok in &query_tokens {
                        if kw_lower.contains(tok) {
                            score += 1.5;
                        }
                    }
                }
            }

            // Description token overlap
            let desc_lower = skill.description.to_lowercase();
            for tok in &query_tokens {
                if desc_lower.contains(tok) {
                    score += 0.5;
                }
            }

            if score > 0.0 {
                scored_skills.push((score, skill));
            }
        }

        // Sort descending by score
        scored_skills.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scored_skills.into_iter().take(top_k).map(|(_, s)| s).collect()
    }
}
