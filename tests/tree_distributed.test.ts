import { describe, test, expect, mock } from "bun:test";
import { ProofTree, type RemoteTreeStore, type NodeMutation } from "../src/tree";

describe("ProofTree Distributed Async Batching", () => {
  test("backpropagate batches updates and flushes asynchronously to remote store", async () => {
    const mockStore: RemoteTreeStore = {
      flushMutations: mock(async (mutations: NodeMutation[]) => {}),
    };

    const tree = new ProofTree("⊢ a = a");
    tree.setRemoteStore(mockStore);

    const child1 = tree.addChild(tree.rootId, "rfl", "no goals");

    // This should queue mutations locally but not block
    tree.backpropagate(child1.id, 1.0);

    // Initial state: not flushed yet
    expect(mockStore.flushMutations).toHaveBeenCalledTimes(0);

    // Force flush
    await tree.flush();

    // Verify flush occurred with batched updates
    expect(mockStore.flushMutations).toHaveBeenCalledTimes(1);
    
    const mutations = (mockStore.flushMutations as any).mock.calls[0][0] as NodeMutation[];
    
    // We expect mutations for child1 and root
    const rootMutation = mutations.find(m => m.nodeId === tree.rootId);
    const childMutation = mutations.find(m => m.nodeId === child1.id);
    
    expect(rootMutation).toBeDefined();
    expect(rootMutation!.updates.visits).toBe(2); // 1 initial + 1
    
    expect(childMutation).toBeDefined();
    expect(childMutation!.updates.visits).toBe(1); // 0 initial + 1
  });
});
