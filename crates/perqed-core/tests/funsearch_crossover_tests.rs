//! Red-to-Green Test Suite: FunSearch Evolutionary Heuristic Synthesis Engine

use perqed_core::program_search::{FunSearchCrossover, HeuristicProgram, ProgramDatabase};

#[test]
fn test_program_database_ranking_and_crossover_selection() {
    let mut db = ProgramDatabase::new(10);

    let prog1 = HeuristicProgram {
        id: "prog_01".to_string(),
        code: "def heuristic(g):\n    return sum(g.degrees())".to_string(),
        fitness_score: 42.5,
        generation: 0,
        domain: "combinatorics.graph".to_string(),
    };

    let prog2 = HeuristicProgram {
        id: "prog_02".to_string(),
        code: "def heuristic(g):\n    return max(g.eigenvalues())".to_string(),
        fitness_score: 88.0,
        generation: 0,
        domain: "combinatorics.graph".to_string(),
    };

    let prog3 = HeuristicProgram {
        id: "prog_03".to_string(),
        code: "def heuristic(g):\n    return g.chromatic_number() * 2".to_string(),
        fitness_score: 95.5,
        generation: 1,
        domain: "combinatorics.graph".to_string(),
    };

    db.insert(prog1);
    db.insert(prog2);
    db.insert(prog3);

    assert_eq!(db.len(), 3);
    let best = db.best_program().expect("Should have best program");
    assert_eq!(best.id, "prog_03");
    assert_eq!(best.fitness_score, 95.5);

    // Test parent sampling
    let parents = db.sample_parents().expect("Should sample parents");
    assert_ne!(parents.0.id, parents.1.id, "Sampled parents must be distinct");
}

#[test]
fn test_funsearch_crossover_prompt_and_mutation() {
    let parent_a = HeuristicProgram {
        id: "parent_a".to_string(),
        code: "def search_step(state):\n    return state.greedy_swap()".to_string(),
        fitness_score: 70.0,
        generation: 1,
        domain: "geometry.unit_distance".to_string(),
    };

    let parent_b = HeuristicProgram {
        id: "parent_b".to_string(),
        code: "def search_step(state):\n    return state.spectral_perturbation()".to_string(),
        fitness_score: 85.0,
        generation: 1,
        domain: "geometry.unit_distance".to_string(),
    };

    let prompt = FunSearchCrossover::build_crossover_prompt(&parent_a, &parent_b, "geometry.unit_distance");
    assert!(prompt.contains("FunSearch Evolutionary AI"));
    assert!(prompt.contains("PARENT A"));
    assert!(prompt.contains("PARENT B"));
    assert!(prompt.contains("spectral_perturbation"));

    // Test AST heuristic mutation
    let mutated = FunSearchCrossover::mutate_heuristic(&parent_b, 2);
    assert_eq!(mutated.generation, 2);
    assert_eq!(mutated.domain, parent_b.domain);
    assert!(mutated.id.contains("mutant_"));
}
