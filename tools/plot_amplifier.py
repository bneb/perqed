import matplotlib.pyplot as plt
import numpy as np
import os

N_vals = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]

# Precomputed results from goldbach_amplifier_fft.c
data = {
    'Selberg':     [0.226026, 0.219271, 0.229724, 0.234956, 0.228943, 0.194369, 0.172155, 0.144972, 0.111978, 0.077511, 0.060947],
    'Sharp':       [0.387097, 0.360656, 0.311475, 0.245098, 0.205592, 0.158025, 0.104865, 0.072497, 0.052138, 0.034538, 0.024772],
    'SmoothQuad':  [0.237443, 0.321041, 0.282473, 0.309423, 0.248665, 0.235892, 0.179698, 0.131570, 0.100853, 0.065999, 0.044499],
    'Ramanujan':   [0.297022, 0.250825, 0.257634, 0.193087, 0.177568, 0.158958, 0.109675, 0.081350, 0.066159, 0.045623, 0.034408]
}

plt.figure(figsize=(10, 6), dpi=200)

colors = {
    'Selberg': '#4a90e2',    # Blue
    'Sharp': '#e74c3c',      # Red
    'SmoothQuad': '#f39c12', # Orange
    'Ramanujan': '#2ecc71'   # Green
}

for name, ratios in data.items():
    plt.plot(N_vals, ratios, marker='o', label=f'{name} (a_n)', color=colors.get(name), linewidth=2)

plt.xscale('log')
plt.ylim(0, 0.45)
plt.xlim(40, 120000)

plt.axhline(0.1, color='gray', linestyle='--', alpha=0.5, label='10% Threshold')
plt.axhline(0.05, color='black', linestyle=':', alpha=0.5, label='5% Threshold')

plt.title(r'Decay of Off-Diagonal vs Diagonal Moment: $\max|S(h)| / S(0)$', fontsize=14, pad=15)
plt.xlabel('Amplifier Cutoff Length N (Log Scale)', fontsize=12)
plt.ylabel('Ratio', fontsize=12)

plt.grid(True, which='both', linestyle='--', alpha=0.4)
plt.legend(fontsize=11)

plt.tight_layout()
os.makedirs('/Users/kevin/projects/perqed/website/public/images/blog', exist_ok=True)
plt.savefig('/Users/kevin/projects/perqed/website/public/images/blog/amplifier_scaling.png')
print("Chart generated successfully at /Users/kevin/projects/perqed/website/public/images/blog/amplifier_scaling.png")
