import sys
import json
import random
import traceback
import math

# Strict fallback verification against the python environment.
try:
    import ray
    RAY_AVAILABLE = True
except ImportError:
    RAY_AVAILABLE = False
    
try:
    import requests
    # Use requests to talk to the surrogate batch predictor
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


def _flatten_matrix(matrix):
    n = len(matrix)
    chars = []
    for i in range(n):
        for j in range(i + 1, n):
            chars.append("1" if matrix[i][j] else "0")
    return "".join(chars)

def _unflatten_matrix(flat, n):
    matrix = [[0]*n for _ in range(n)]
    idx = 0
    for i in range(n):
        for j in range(i + 1, n):
            val = int(flat[idx]) if idx < len(flat) else 0
            matrix[i][j] = val
            matrix[j][i] = val
            idx += 1
    return matrix


if RAY_AVAILABLE:
    # We initialize the master worker on boot avoiding reinitialization fault failures 
    # to maintain high-uptime
    ray.init(ignore_reinit_error=True, logging_level="ERROR")

    @ray.remote(num_cpus=1)
    def _ray_neighborhood_funnel(flat_matrix, n, num_neighbors, max_flips):
        """
        Isolated task executed distributedly across edges.
        Locally rebuilds the matrix, randomly flips edges, and flattens it array back for 
        batch inferencing via PyTorch API.
        """
        base_matrix = _unflatten_matrix(flat_matrix, n)
        
        # Calculate permutations available without frozen bounds
        free_edges = []
        for i in range(n):
            for j in range(i + 1, n):
                free_edges.append((i, j))
                
        edge_count = len(free_edges)

        neighbors = []
        for _ in range(num_neighbors):
            actual_flips = min(max_flips, edge_count)
            if actual_flips == 0:
                neighbors.append(flat_matrix)
                continue
                
            num_flips = random.randint(1, actual_flips)
            flip_indices = random.sample(range(edge_count), num_flips)
            
            # Form neighbor
            neighbor_mat = [[val for val in row] for row in base_matrix]
            for f in flip_indices:
                i, j = free_edges[f]
                neighbor_mat[i][j] = 1 - neighbor_mat[i][j]
                neighbor_mat[j][i] = 1 - neighbor_mat[j][i]
                
            neighbors.append(_flatten_matrix(neighbor_mat))
            
        return neighbors

def execute_ray_dist(message_obj):
    command = message_obj.get("command")
    
    if command == "ping":
        return {"status": "ok", "ray_online": RAY_AVAILABLE}
        
    if not RAY_AVAILABLE:
        # Fallback to TS sequence if ray fails entirely
        return {"status": "RAY_UNAVAILABLE"}
        
    if command == "dispatch_funnel":
        flat_matrix = message_obj.get("flat_matrix")
        n = message_obj.get("n")
        total_neighbors = message_obj.get("neighbors", 500)
        chunks = message_obj.get("ray_chunks", 10)
        max_flips = message_obj.get("max_flips", 3)
        surrogate_url = message_obj.get("surrogate_url", "http://localhost:8765")
        
        if not flat_matrix or not n:
            return {"status": "ERROR", "message": "Missing topological params"}
            
        # 1. Distribute edge flips across the core fabric
        chunk_size = math.ceil(total_neighbors / chunks)
        
        futures = []
        for i in range(chunks):
            count = chunk_size if (i < chunks - 1) else (total_neighbors - (chunks - 1) * chunk_size)
            if count > 0:
                futures.append(_ray_neighborhood_funnel.remote(flat_matrix, n, count, max_flips))
                
        # Aggregate the matrices
        ray_results = ray.get(futures)
        
        all_neighbors = []
        for res_list in ray_results:
            all_neighbors.extend(res_list)
            
        # 2. Sync to central Value Network for batch evaluation via REST array stream
        # This keeps surrogate weights pinned centrally on CPU/GPU hardware isolated securely.
        predicted_energies = []
        if REQUESTS_AVAILABLE and all_neighbors:
            try:
                res = requests.post(f"{surrogate_url}/predict_batch", json={"matrices": all_neighbors})
                if res.status_code == 200:
                    predicted_energies = res.json().get("predictions", [])
                else:
                    return {"status": "ERROR", "message": f"Surrogate Error: HTTP {res.status_code}"}
            except Exception as e:
                return {"status": "ERROR", "message": f"Surrogate Connection Failed: {str(e)}"}
        else:
             return {"status": "ERROR", "message": "Python 'requests' dependency missing"}
             
        if not predicted_energies or len(predicted_energies) != len(all_neighbors):
             return {"status": "ERROR", "message": "Prediction topology array mismatch"}
             
        # 3. Pull optimal permutation
        best_energy = predicted_energies[0]
        best_idx = 0
        for i in range(1, len(predicted_energies)):
            if predicted_energies[i] < best_energy:
                best_energy = predicted_energies[i]
                best_idx = i
                
        return {
            "status": "SUCCESS",
            "bestEnergy": best_energy,
            "bestMatrixRaw": all_neighbors[best_idx]
        }
        
    return {"status": "UNKNOWN_COMMAND"}


if __name__ == "__main__":
    # Natively mount line by line IPC sequence to the Node Subprocess 
    for line in sys.stdin:
        try:
            line = line.strip()
            if not line:
                continue
            
            request = json.loads(line)
            req_id = request.get("reqId")
            
            response = execute_ray_dist(request)
            if req_id is not None:
                response["reqId"] = req_id
                
            print(json.dumps(response), flush=True)
            
        except json.JSONDecodeError:
            print(json.dumps({"status": "JSON_PARSE_ERROR"}), flush=True)
        except Exception as e:
            tb = traceback.format_exc()
            print(json.dumps({"status": "FATAL_ERROR", "trace": str(e), "tb": tb}), flush=True)
