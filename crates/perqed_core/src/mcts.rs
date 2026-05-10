use std::collections::HashMap;

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum NodeStatus {
    Open,
    Working,
    Solved,
    DeadEnd,
}

#[derive(Debug, Clone)]
pub struct Node<S, T> {
    pub id: usize,
    pub parent_id: Option<usize>,
    pub state: S,
    pub tactic_applied: Option<T>,
    pub status: NodeStatus,
    pub children: Vec<usize>,
    pub visits: u32,
    pub score: f32,
}

pub struct ProofTree<S, T> {
    pub nodes: HashMap<usize, Node<S, T>>,
    pub root_id: usize,
    next_id: usize,
}

impl<S: Clone, T: Clone> ProofTree<S, T> {
    pub fn new(initial_state: S) -> Self {
        let mut nodes = HashMap::new();
        nodes.insert(
            0,
            Node {
                id: 0,
                parent_id: None,
                state: initial_state,
                tactic_applied: None,
                status: NodeStatus::Open,
                children: Vec::new(),
                visits: 0,
                score: 0.0,
            },
        );
        Self {
            nodes,
            root_id: 0,
            next_id: 1,
        }
    }

    pub fn add_child(&mut self, parent_id: usize, tactic: T, state: S) -> usize {
        let child_id = self.next_id;
        self.next_id += 1;

        self.nodes.insert(
            child_id,
            Node {
                id: child_id,
                parent_id: Some(parent_id),
                state,
                tactic_applied: Some(tactic),
                status: NodeStatus::Open,
                children: Vec::new(),
                visits: 0,
                score: 0.0,
            },
        );

        if let Some(parent) = self.nodes.get_mut(&parent_id) {
            parent.children.push(child_id);
        }

        child_id
    }

    pub fn backpropagate(&mut self, node_id: usize, score: f32) {
        let mut current_id = Some(node_id);
        while let Some(id) = current_id {
            if let Some(node) = self.nodes.get_mut(&id) {
                node.visits += 1;
                node.score += score;
                current_id = node.parent_id;
            } else {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tree_initialization() {
        let tree: ProofTree<String, String> = ProofTree::new("goal".to_string());
        assert_eq!(tree.nodes.len(), 1);
        assert_eq!(tree.root_id, 0);
        let root = tree.nodes.get(&0).unwrap();
        assert_eq!(root.state, "goal");
        assert_eq!(root.status, NodeStatus::Open);
    }

    #[test]
    fn test_add_child_and_backprop() {
        let mut tree: ProofTree<String, String> = ProofTree::new("goal".to_string());
        let child_id = tree.add_child(0, "intro".to_string(), "goal2".to_string());
        assert_eq!(child_id, 1);
        
        tree.backpropagate(child_id, 1.0);
        
        let root = tree.nodes.get(&0).unwrap();
        assert_eq!(root.visits, 1);
        assert_eq!(root.score, 1.0);
        
        let child = tree.nodes.get(&child_id).unwrap();
        assert_eq!(child.visits, 1);
        assert_eq!(child.score, 1.0);
    }
}
