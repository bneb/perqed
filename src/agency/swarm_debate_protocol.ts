import { SwarmDivSampler } from "./swarm_mcts";
import { PRCoTRepair } from "./pr_cot_repair";
import { CloudEscalationEngine } from "./cloud_escalation";

export class SwarmDebateProtocol {
    
    /**
     * Replaces standard LLM ideation with the fully unified Tiered-Consensus matrix.
     */
    public static async establishAbsoluteConsensus(prompt: string, apiKey: string): Promise<string> {
        console.log(`[Swarm Consensus] Initiating K=3 DivSampling across Native Memory Nodes...`);
        
        // 1. Generate DivSample Candidates Offline
        const candidates = await SwarmDivSampler.sampleKCandidates(prompt, 3);
        let derivationTrace = `[Offline Node Boot]\nIdentified ${candidates.length} distinct geometric trajectories.\n`;
        
        // 2. Local Skeptic MCTS Loop
        for (const candidate of candidates) {
            console.log(`[Swarm Consensus] Skeptic Node evaluating local branch with E=${candidate.energyScore.toFixed(3)}...`);
            const check = await SwarmDivSampler.offlineSkepticCheck(candidate);
            
            if (check.verified) {
                console.log(`[Swarm Consensus] ✅ Offline Convergence Achieved natively.`);
                return candidate.hypothesis;
            } else {
                console.log(`[Swarm Consensus] ❌ Skeptic invalidated limits: ${check.flawTrace}`);
                derivationTrace += `Branch Evaluated: ${candidate.hypothesis}\nError found: ${check.flawTrace}\n`;
                
                // 3. Process-Reward Offline Repair
                console.log(`[Swarm Consensus] Executing Offline PR-CoT Derivation Loop...`);
                const repair = await PRCoTRepair.orchestrateRepairLoop(candidate.hypothesis, check.flawTrace!);
                
                if (repair.resolved && repair.fixedHypothesis) {
                    console.log(`[Swarm Consensus] ✅ PR-CoT Successfully patched the tensor trace offline.`);
                    return repair.fixedHypothesis;
                } else {
                    derivationTrace += `[Offline PR-CoT Exhausted]\n`;
                }
            }
        }
        
        // 4. All offline branches exhausted -> Trigger Phone Home
        console.log(`[Swarm Consensus] 🌐 ALL OFFLINE ROUTES EXHAUSTED. Triggering Cloud Escalation...`);
        return await CloudEscalationEngine.escalateToFrontierLLM(apiKey, derivationTrace, prompt);
    }

}
