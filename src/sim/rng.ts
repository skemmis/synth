// Seeded random numbers (mulberry32). The only source of randomness allowed
// in sim and evo.
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    let t = (this.s += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(n: number): number { return Math.floor(this.next() * n); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  get state(): number { return this.s; }
  set state(v: number) { this.s = v >>> 0; }
}
