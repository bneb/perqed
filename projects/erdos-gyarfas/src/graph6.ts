/**
 * Sprint 21: Graph6 Decoder
 *
 * Parses Graph6 format strings (as output by nauty/geng) into adjacency lists.
 * Graph6 encodes the upper triangle of the adjacency matrix in 6-bit chunks
 * offset by 63 (the '?' character in ASCII).
 *
 * Reference: https://users.cecs.anu.edu.au/~bdm/data/formats.txt
 */

export class Graph6Decoder {
  /**
   * Decode a Graph6 string into an adjacency list.
   *
   * @returns adjacency list where adj[i] contains sorted neighbors of vertex i
   */
  static decode(g6: string): number[][] {
    if (!g6 || g6.length === 0) return [];

    // Parse N (number of vertices)
    // For N <= 62: single byte, value = charCode - 63
    // For N <= 258047: preceded by 126, then 3 bytes
    let n: number;
    let dataStart: number;

    const first = g6.charCodeAt(0) - 63;
    if (first <= 62) {
      n = first;
      dataStart = 1;
    } else {
      // Extended format (we only need n <= 18, so this branch is unlikely)
      n =
        ((g6.charCodeAt(1) - 63) << 12) |
        ((g6.charCodeAt(2) - 63) << 6) |
        (g6.charCodeAt(3) - 63);
      dataStart = 4;
    }

    if (n === 0) return [];

    const adj: number[][] = Array.from({ length: n }, () => []);

    // Extract bits from the data bytes
    // Each character encodes 6 bits (charCode - 63)
    let bitIndex = 0;
    const bits: number[] = [];

    for (let i = dataStart; i < g6.length; i++) {
      const val = g6.charCodeAt(i) - 63;
      // Extract 6 bits, MSB first
      for (let b = 5; b >= 0; b--) {
        bits.push((val >> b) & 1);
      }
    }

    // Read the upper triangle: for j = 1..n-1, for i = 0..j-1
    bitIndex = 0;
    for (let j = 1; j < n; j++) {
      for (let i = 0; i < j; i++) {
        if (bitIndex < bits.length && bits[bitIndex] === 1) {
          adj[i]!.push(j);
          adj[j]!.push(i);
        }
        bitIndex++;
      }
    }

    return adj;
  }
}
