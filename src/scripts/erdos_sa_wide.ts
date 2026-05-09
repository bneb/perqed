import fs from 'fs';

// Fast approximate search using BigInt for numerators/denominators
// We want sum(1/a_i) and sum(1/(a_i - 1)) to be "close" to rationals.

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
let max_beta = 1.0;

function eval_beta(a: bigint[]) {
    // a_k^(1/2^k)
    const k = a.length - 1;
    if (k === 0) return 1.0;
    const ak = Number(a[k]);
    return Math.pow(ak, 1.0 / Math.pow(2, k));
}

function search(depth: number, currentA: bigint[], sum1: Frac, sum2: Frac) {
    if (depth === MAX_DEPTH) {
        const beta = eval_beta(currentA);
        if (beta > max_beta) {
            max_beta = beta;
            console.log(`New Max Beta: ${beta.toFixed(5)} | Seq: ${currentA.slice(0,4).join(',')}... | Denom: ${sum2.den}`);
        }
        return;
    }

    const lastA = currentA[currentA.length - 1];
    // Start from Sylvester bound
    const minNext = lastA * lastA - lastA + 1n;
    
    // We want sum1 + 1/x and sum2 + 1/(x-1) to have small denominators!
    // Instead of blind DFS, let's search a window up to 1000
    const window = 1000n;
    
    // To avoid massive branching, only pick x that keeps sum2.den small
    let best_x = minNext;
    let min_den = -1n;
    
    for (let i = 0n; i < window; i++) {
        const x = minNext + i;
        const f1 = sum1.add(new Frac(1n, x));
        const f2 = sum2.add(new Frac(1n, x - 1n));
        
        // We favor small denominators because a rational limit requires the residual to cleanly cancel.
        const score = f2.den; 
        if (min_den === -1n || score < min_den) {
            min_den = score;
            best_x = x;
        }
        
        // If it's exceptionally small, branch into it
        if (score < sum2.den * 1000n) {
            currentA.push(x);
            search(depth + 1, currentA, f1, f2);
            currentA.pop();
        }
    }
    
    // Always branch the best one if it wasn't branched
    currentA.push(best_x);
    search(depth + 1, currentA, sum1.add(new Frac(1n, best_x)), sum2.add(new Frac(1n, best_x - 1n)));
    currentA.pop();
}

async function main() {
    console.log("Igniting wider exact search...");
    for (let a0 = 2n; a0 <= 5n; a0++) {
        search(1, [a0], new Frac(1n, a0), new Frac(1n, a0 - 1n));
    }
    console.log("Search complete.");
}

main().catch(console.error);
