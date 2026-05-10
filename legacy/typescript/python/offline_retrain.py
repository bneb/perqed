import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

class SATransitionDataset(Dataset):
    def __init__(self, jsonl_path):
        self.samples = []
        if os.path.exists(jsonl_path):
            with open(jsonl_path, 'r') as f:
                for line in f:
                    try:
                        data = json.loads(line.strip())
                        mat = data.get('matrix')
                        energy = data.get('energy', 1.0)
                        
                        if isinstance(mat, str):
                            mat = json.loads(mat) 
                            
                        # Flatten native JS multi-dimensional grids
                        if isinstance(mat, list):
                            flat = []
                            for row in mat:
                                if isinstance(row, list):
                                    flat.extend(row)
                                else:
                                    flat.append(row)
                            
                            energy_tensor = torch.tensor([float(energy)], dtype=torch.float32)
                            # Heavy 10x penalty/weighting on SAT boundaries (energy == 0) to ensure RL bias
                            weight = 10.0 if energy == 0.0 else 1.0
                            
                            self.samples.append({
                                'x': torch.tensor(flat, dtype=torch.float32),
                                'y': energy_tensor,
                                'weight': torch.tensor([weight], dtype=torch.float32)
                            })
                    except Exception as e:
                        print(f"Skipping malformed entry: {e}")
        
    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]

class EnergySurrogate(nn.Module):
    """
    Standard Feed-Forward surrogate block identifying local matrix symmetries.
    """
    def __init__(self, input_dim=1296): 
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )
        
    def forward(self, x):
        return self.net(x)

def run_retraining(workspace_dir):
    buffer_path = os.path.join(workspace_dir, "agent_workspace", "training_buffers", "sa_transitions.jsonl")
    weights_path = os.path.join(workspace_dir, "agent_workspace", "surrogate.pth")
    
    # Create dir if not exist
    os.makedirs(os.path.dirname(buffer_path), exist_ok=True)
    
    print(f"[Self-Play] Reading telemetry from {buffer_path}")
    dataset = SATransitionDataset(buffer_path)
    
    if len(dataset) == 0:
        print("[Self-Play] Buffer is empty. Skipping offline continuous learning.")
        return
        
    loader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    # Dynamically scale network layer to math trace dims
    sample_dim = dataset[0]['x'].shape[0]
    model = EnergySurrogate(input_dim=sample_dim)
    
    if os.path.exists(weights_path):
        print(f"[Self-Play] Loading previous epoch weights from {weights_path}")
        try:
            model.load_state_dict(torch.load(weights_path))
        except Exception as e:
            print(f"Failed to load weights matching dimension {sample_dim}. Reinitializing. {e}")
    
    optimizer = optim.AdamW(model.parameters(), lr=1e-3)
    epochs = 20
    
    print(f"[Self-Play] Initiating Proximal Retraining across {epochs} Epochs...")
    
    model.train()
    for epoch in range(epochs):
        total_loss = 0.0
        for batch in loader:
            x = batch['x']
            y = batch['y']
            w = batch['weight']
            
            optimizer.zero_grad()
            
            # Universal scaling zero padding to ensure varying topology attempts map to proxy dims
            if x.shape[1] < sample_dim:
                x = torch.cat([x, torch.zeros(x.shape[0], sample_dim - x.shape[1])], dim=1)
            elif x.shape[1] > sample_dim:
                x = x[:, :sample_dim]
                
            preds = model(x)
            
            # Weighted MSE Loss enforces structural bias towards known SAT instances
            loss = (w * (preds - y) ** 2).mean()
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
        print(f"Epoch {epoch+1:02d}/{epochs} | MSE Loss: {total_loss/len(loader):.4f}")
        
    os.makedirs(os.path.dirname(weights_path), exist_ok=True)
    torch.save(model.state_dict(), weights_path)
    print(f"✅ [Self-Play] Offline weights securely hot-swapped at {weights_path}")

if __name__ == "__main__":
    import sys
    wdir = sys.argv[1] if len(sys.argv) > 1 else "."
    run_retraining(wdir)
