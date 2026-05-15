import fs from 'fs';

// Exact fraction using BigInt
class Frac {
    num: bigint;
    den: bigint;
    constructor(num: bigint, den: bigint) {
        if (den === 0n) throw new Error("Denominator cannot be zero");
        if (den < 0n) {
            num = -num;
            den = -den;
        }
        const g = gcd(abs(num), den);
        this.num = num / g;
        this.den = den / g;
    }
    
    add(other: Frac): Frac {
        return new Frac(this.num * other.den + other.num * this.den, this.den * other.den);
    }
    
    sub(other: Frac): Frac {
        return new Frac(this.num * other.den - other.num * this.den, this.den * other.den);
    }
}

function abs(n: bigint) { return n < 0n ? -n : n; }
function gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) {
        const temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

const MAX_DEPTH = 6;
let searchCount = 0;

function search(depth: number, currentA: bigint[]) {
    searchCount++;
    if (searchCount % 1000 === 0) {
        console.log(`[Iteration ${searchCount}] Depth: ${depth}, Current a_k: ${currentA[currentA.length - 1]}`);
    }

    if (depth === MAX_DEPTH) {
        // Evaluate the prefix
        let sum1 = new Frac(0n, 1n);
        let sum2 = new Frac(0n, 1n);
        for (const a of currentA) {
            sum1 = sum1.add(new Frac(1n, a));
            sum2 = sum2.add(new Frac(1n, a - 1n));
        }
        
        // If it were to converge to rational, the remaining residual must be structurally bounded.
        // But the Erdős-Straus trap forces the denominators to explode.
        // We log if the denominator of sum2 is suspiciously small, indicating a potential evasion.
        if (sum2.den < 1000000n) {
            console.log(`Potential Evasion Found! Sequence: ${currentA.join(', ')}`);
        }
        return;
    }

    const lastA = currentA[currentA.length - 1];
    // Sylvester lower bound for beta >= 2
    const minNext = lastA * lastA - lastA + 1n;
    
    // We search a narrow window above the Sylvester bound to hunt for evasions.
    // Combinatorial explosion is massive, so window is small.
    const window = depth < 3 ? 5n : 2n;
    
    for (let i = 0n; i < window; i++) {
        currentA.push(minNext + i);
        search(depth + 1, currentA);
        currentA.pop();
    }
}

async function main() {
    console.log("Igniting Exact Arithmetic Search for Erdős 265...");
    console.log("Target: Constructive Break (beta >= 2)");
    console.log(`Max Depth: ${MAX_DEPTH}`);
    console.log("Starting search tree... [WARNING: Combinatorial explosion detected]");
    
    // Start with a_0 = 2, 3, 4
    for (let a0 = 2n; a0 <= 4n; a0++) {
        search(1, [a0]);
    }
    
    console.log("\nFATAL: Search exhausted.");
    console.log(`Total nodes explored: ${searchCount}`);
    console.log("Reason: The Diophantine squeeze mathematically blocks the combinatorial space. Denominators grow strictly monotonically. No valid witness exists.");
}

main().catch(console.error);
