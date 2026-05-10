import matplotlib.pyplot as plt
import numpy as np

# Data from CRACK 56 (Final Red Team) 
epsilon = np.array([5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
gb_betti = np.array([0, 0, 22, 47, 65, 110, 110, 194, 321, 429])
prime_betti = np.array([36373, 36373, 36373, 36373, 36373, 36374, 36374, 36374, 36374, 36374])

# Beautiful Nature-style Configuration
plt.style.use('seaborn-v0_8-whitegrid')
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
fig.suptitle(r'Topological Data Analysis (TDA) of the Goldbach Double Sieve', fontsize=20, fontweight='bold', y=1.05)

# Axis 1: Persistent Homology Barcode (Log Scale)
ax1.plot(epsilon, prime_betti, label=r'Random Prime Hierarchy ($\beta_1$)', color='#e74c3c', marker='o', linewidth=3, markersize=8)
ax1.plot(epsilon, gb_betti, label=r'Goldbach Point-Cloud ($\beta_1$)', color='#2980b9', marker='D', linewidth=3, markersize=8)
ax1.set_yscale('symlog', linthresh=10) # Log scale to show the massive divergence
ax1.set_xlabel(r'Vietoris-Rips Connections Radius ($\epsilon$)', fontsize=14)
ax1.set_ylabel(r'1st Betti Number ($\beta_1$) Topological Cycles', fontsize=14)
ax1.set_title(r'Persistent Homology: The 99% $\beta_1$ Divergence', fontsize=16)
ax1.legend(fontsize=12, loc='upper left')
ax1.grid(True, which="both", ls="--", alpha=0.5)

# Axis 2: Topological Structure ratio
ratio = gb_betti / prime_betti * 100
ax2.plot(epsilon, ratio, label=r'Structural Density Ratio', color='#27ae60', marker='s', linewidth=3, markersize=8)
ax2.fill_between(epsilon, 0, ratio, color='#27ae60', alpha=0.2)
ax2.set_xlabel(r'Connection Radius ($\epsilon$)', fontsize=14)
ax2.set_ylabel(r'% of Random Prime Cyclic Complexity', fontsize=14)
ax2.set_title(r'Geometric Repulsion Field', fontsize=16)
ax2.set_ylim(0, 1.5) # Max 1.5% - shows exactly how severely Goldbach resists cycles
ax2.legend(fontsize=12, loc='upper left')
ax2.grid(True, ls="--", alpha=0.5)

# Add mathematical annotations
ax2.annotate(r'$P_{GB} \ll P_{Random}$', xy=(30, 0.3), xytext=(15, 1.0),
             arrowprops=dict(facecolor='black', shrink=0.05, width=1.5, headwidth=8),
             fontsize=14, fontweight='bold')

plt.tight_layout()
plt.savefig('/Users/kevin/.gemini/antigravity/brain/4956b5d2-014a-436b-8656-c32378f00836/betti_persistent_homology.svg', format='svg', bbox_inches='tight', dpi=300)
print('SVG generated successfully.')
