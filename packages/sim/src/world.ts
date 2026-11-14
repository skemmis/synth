import { config as defaultConfig, type Config } from './config.ts';
import { MATERIALS, M, massOf } from './materials.ts';
import { Terrain } from './terrain.ts';

export const B_TENSION = 1, B_ACTUATED = 2, B_STICKY = 4, B_ANCHOR = 8, B_BRACE = 16;

const NMAT = MATERIALS.length;
const RAD = new Float64Array(NMAT), INVM = new Float64Array(NMAT), FRIC = new Float64Array(NMAT),
  SHARP = new Float64Array(NMAT), HARD = new Float64Array(NMAT), STICK = new Uint8Array(NMAT), FLUID = new Uint8Array(NMAT), MASS = new Float64Array(NMAT);
MATERIALS.forEach((t, i) => {
  RAD[i] = t.radius; MASS[i] = massOf(i); INVM[i] = 1 / MASS[i]; FRIC[i] = t.friction; SHARP[i] = t.sharpness;
  HARD[i] = t.hardness; STICK[i] = t.stickiness > 0 ? 1 : 0; FLUID[i] = t.fluid ? 1 : 0;
});
let RMAX = 0; for (let i = 0; i < NMAT; i++) RMAX = Math.max(RMAX, RAD[i]);

export interface Hand { active: boolean; node: number; x: number; y: number; spin: number; }
export interface SimEvent { type: 'eat' | 'death' | 'break'; tick: number; node: number; other: number; x: number; y: number; mat: number; body: number; }

const SAVE_NODE = ['x', 'y', 'px', 'py', 'mat', 'hp', 'alive', 'wet', 'stick', 'anch', 'tag'] as const;
const SAVE_BOND = ['ba', 'bb', 'brest', 'bflags', 'bcomp', 'blimit', 'bamp', 'bphase', 'bfreq', 'bax', 'bay', 'balive', 'bmid'] as const;
export interface WorldSave { v: 1; n: number; nb: number; tick: number; time: number; eaten: number; heartsLost: number; damageDealt: number; nodes: Record<string, number[]>; bonds: Record<string, number[]>; }

export class World {
  cfg: Config; terrain: Terrain;
  n = 0; nb = 0; tick = 0; time = 0;
  x: Float64Array; y: Float64Array; px: Float64Array; py: Float64Array;
  mat: Uint8Array; hp: Float32Array; alive: Uint8Array; body: Int32Array; wet: Float32Array; wetNext: Float32Array;
  stick: Uint8Array; anch: Uint8Array; tag: Int32Array; // tag: free-form owner id (creature id, object id); survives splits
  ba: Int32Array; bb: Int32Array; brest: Float64Array; bflags: Uint8Array; bcomp: Float64Array; blimit: Float32Array;
  bamp: Float32Array; bphase: Float32Array; bfreq: Float32Array; bax: Float64Array; bay: Float64Array; balive: Uint8Array; bmid: Int32Array; bcur: Float64Array;
  bondKeys = new Set<number>();
  bodiesDirty = true; nbodies = 0;
  hand: Hand = { active: false, node: -1, x: 0, y: 0, spin: 0 };
  events: SimEvent[] = []; recordEvents = true;
  eaten = 0; // total berries eaten by hearts
  damageDealt = 0;
  // broadphase scratch
  private cellStart: Int32Array; private cellItems: Int32Array; private cellOf: Int32Array;
  private cs: number;
  private pairI: Int32Array; private pairJ: Int32Array; private pairQ: Float32Array; private npairs = 0;
  private candI: Int32Array; private candJ: Int32Array; private ncand = 0;
  private dens: Float32Array; private densNear: Float32Array;
  private free: number[] = []; private freeB: number[] = [];

  constructor(terrain: Terrain, cfg: Config = defaultConfig) {
    this.cfg = cfg; this.terrain = terrain;
    const N = cfg.maxNodes, NB = cfg.maxBonds;
    this.x = new Float64Array(N); this.y = new Float64Array(N); this.px = new Float64Array(N); this.py = new Float64Array(N);
    this.mat = new Uint8Array(N); this.hp = new Float32Array(N); this.alive = new Uint8Array(N); this.body = new Int32Array(N);
    this.wet = new Float32Array(N); this.wetNext = new Float32Array(N); this.stick = new Uint8Array(N); this.anch = new Uint8Array(N); this.tag = new Int32Array(N);
    this.ba = new Int32Array(NB); this.bb = new Int32Array(NB); this.brest = new Float64Array(NB); this.bflags = new Uint8Array(NB);
    this.bcomp = new Float64Array(NB); this.blimit = new Float32Array(NB); this.bamp = new Float32Array(NB); this.bphase = new Float32Array(NB);
    this.bfreq = new Float32Array(NB); this.bax = new Float64Array(NB); this.bay = new Float64Array(NB); this.balive = new Uint8Array(NB); this.bmid = new Int32Array(NB); this.bcur = new Float64Array(NB);
    this.cs = Math.max(2 * RMAX + cfg.wetMargin, cfg.fluidH) + cfg.pairSlack;
    this.candI = new Int32Array(N * 24); this.candJ = new Int32Array(N * 24);
    this.pairI = new Int32Array(N * 12); this.pairJ = new Int32Array(N * 12); this.pairQ = new Float32Array(N * 12);
    this.dens = new Float32Array(N); this.densNear = new Float32Array(N);
    const cols = Math.ceil(terrain.width / this.cs) + 2, rows = Math.ceil(terrain.height / this.cs) + 2;
    this.cellStart = new Int32Array(cols * rows + 2); this.cellItems = new Int32Array(N); this.cellOf = new Int32Array(N);
  }

  clone(): World {
    const w = new World(this.terrain, this.cfg);
    w.n = this.n; w.nb = this.nb; w.tick = this.tick; w.time = this.time;
    const n = this.n, nb = this.nb;
    for (const k of ['x', 'y', 'px', 'py', 'mat', 'hp', 'alive', 'body', 'wet', 'stick', 'anch', 'tag'] as const) (w[k] as any).set((this[k] as any).subarray(0, n));
    for (const k of ['ba', 'bb', 'brest', 'bflags', 'bcomp', 'blimit', 'bamp', 'bphase', 'bfreq', 'bax', 'bay', 'balive', 'bmid'] as const) (w[k] as any).set((this[k] as any).subarray(0, nb));
    w.bondKeys = new Set(this.bondKeys); w.bodiesDirty = true; w.nbodies = this.nbodies;
    w.hand = { ...this.hand }; w.heartsLost = this.heartsLost; w.eaten = this.eaten; w.damageDealt = this.damageDealt;
    (w as any).free = [...this.free]; (w as any).freeB = [...this.freeB];
    return w;
  }

  /** Everything needed to carry on later, as plain JSON. The saved copy is renumbered (see compact); this world is not touched. */
  save(): WorldSave {
    const w = this.clone(); w.release(); w.compact(); const n = w.n, nb = w.nb; const A = (a: ArrayLike<number>, len: number) => Array.from((a as any).subarray(0, len)) as number[];
    const nodes: Record<string, number[]> = {}, bonds: Record<string, number[]> = {};
    for (const k of SAVE_NODE) nodes[k] = A(w[k], n); for (const k of SAVE_BOND) bonds[k] = A(w[k], nb);
    return { v: 1, n, nb, tick: w.tick, time: w.time, eaten: w.eaten, heartsLost: w.heartsLost, damageDealt: w.damageDealt, nodes, bonds };
  }
  static load(terrain: Terrain, d: WorldSave, cfg: Config = defaultConfig): World {
    const w = new World(terrain, cfg); w.n = d.n; w.nb = d.nb; w.tick = d.tick; w.time = d.time; w.eaten = d.eaten; w.heartsLost = d.heartsLost; w.damageDealt = d.damageDealt;
    for (const k of SAVE_NODE) (w[k] as any).set(d.nodes[k]); for (const k of SAVE_BOND) (w[k] as any).set(d.bonds[k]);
    for (let k = 0; k < w.nb; k++) if (w.balive[k] && w.bb[k] >= 0) w.bondKeys.add(w.key(w.ba[k], w.bb[k]));
    w.bodiesDirty = true; return w;
  }

  addNode(mat: number, x: number, y: number, tag = 0): number {
    let i: number;
    if (this.free.length) i = this.free.pop()!; else { if (this.n >= this.cfg.maxNodes) return -1; i = this.n++; }
    this.x[i] = this.px[i] = x; this.y[i] = this.py[i] = y; this.mat[i] = mat; this.hp[i] = MATERIALS[mat].hp;
    this.alive[i] = 1; this.body[i] = -1; this.wet[i] = 0; this.stick[i] = 0; this.anch[i] = 0; this.tag[i] = tag; this.bodiesDirty = true;
    return i;
  }
  removeNode(i: number) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    // a brace runs through its middle node, so it goes when that node goes (otherwise it would grab whatever reuses the slot)
    for (let b = 0; b < this.nb; b++) if (this.balive[b] && (this.ba[b] === i || this.bb[b] === i || ((this.bflags[b] & B_BRACE) && this.bmid[b] === i))) this.removeBond(b);
    this.free.push(i); this.free.sort((a, b) => b - a); // lowest index reused first: deterministic
    if (this.hand.node === i) { this.hand.active = false; this.hand.node = -1; }
    this.bodiesDirty = true;
  }
  private key(a: number, b: number) { return a < b ? a * 65536 + b : b * 65536 + a; }
  bonded(a: number, b: number) { return this.bondKeys.has(this.key(a, b)); }

  /** Bond two nodes. Behaviour comes from the two materials (the PRD bonding rule). */
  addBond(a: number, b: number, opts: { amp?: number; phase?: number; freq?: number; sticky?: boolean; brace?: number } = {}): number {
    if (a === b || this.bonded(a, b)) return -1;
    const k = this.allocBond(); if (k < 0) return -1;
    const ma = MATERIALS[this.mat[a]], mb = MATERIALS[this.mat[b]];
    const weak = ma.strength <= mb.strength ? ma : mb;
    const dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a];
    const rest = Math.hypot(dx, dy);
    let flags = 0; let strength = weak.strength, stretch = weak.stretch;
    if (opts.sticky) { flags |= B_STICKY; strength = this.cfg.stickyGrip; stretch = this.cfg.stickyStretch; }
    else if (opts.brace !== undefined) flags |= B_BRACE;
    else {
      if (ma.mode === 'tension' || mb.mode === 'tension') flags |= B_TENSION;
      if (ma.actuation > 0 || mb.actuation > 0) flags |= B_ACTUATED;
    }
    this.ba[k] = a; this.bb[k] = b; this.brest[k] = rest; this.bflags[k] = flags;
    this.bcomp[k] = (stretch * rest) / (strength * this.cfg.gravity); this.blimit[k] = stretch;
    this.bamp[k] = opts.amp ?? Math.max(ma.actuation, mb.actuation); this.bphase[k] = opts.phase ?? 0; this.bfreq[k] = opts.freq ?? 1;
    this.bmid[k] = opts.brace ?? -1;
    this.balive[k] = 1; this.bondKeys.add(this.key(a, b)); this.bodiesDirty = true;
    return k;
  }
  addAnchor(a: number, ax: number, ay: number, strength = this.cfg.stickyStrength): number {
    const k = this.allocBond(); if (k < 0) return -1;
    const rest = Math.max(1, Math.hypot(this.x[a] - ax, this.y[a] - ay));
    this.ba[k] = a; this.bb[k] = -1; this.brest[k] = rest; this.bflags[k] = B_STICKY | B_ANCHOR;
    this.bcomp[k] = (this.cfg.stickyStretch * rest) / (strength * this.cfg.gravity); this.blimit[k] = this.cfg.stickyStretch;
    this.bax[k] = ax; this.bay[k] = ay; this.balive[k] = 1; this.anch[a] = 1;
    return k;
  }
  private allocBond(): number {
    if (this.freeB.length) return this.freeB.pop()!;
    if (this.nb >= this.cfg.maxBonds) return -1;
    return this.nb++;
  }
  removeBond(k: number) {
    if (!this.balive[k]) return;
    this.balive[k] = 0;
    const a = this.ba[k], b = this.bb[k];
    if (this.bflags[k] & B_STICKY) { if (this.stick[a] > 0) this.stick[a]--; if (b >= 0 && STICK[this.mat[b]] && this.stick[b] > 0) this.stick[b]--; }
    if (b >= 0) this.bondKeys.delete(this.key(a, b)); else this.anch[a] = 0;
    this.freeB.push(k); this.freeB.sort((p, q) => q - p);
    this.bodiesDirty = true;
  }

  /** Connected components over bonds. Water and loose nodes get their own ids. */
  computeBodies() {
    if (!this.bodiesDirty) return;
    const n = this.n, parent = this.body;
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = (i: number) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let k = 0; k < this.nb; k++) {
      if (!this.balive[k] || this.bb[k] < 0) continue;
      const a = find(this.ba[k]), b = find(this.bb[k]);
      if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; }
    }
    for (let i = 0; i < n; i++) parent[i] = find(i);
    this.bodiesDirty = false;
  }
  bodyNodes(i: number): number[] {
    this.computeBodies(); const id = this.body[i], out: number[] = [];
    for (let j = 0; j < this.n; j++) if (this.alive[j] && this.body[j] === id) out.push(j);
    return out;
  }

  spawnWater(x0: number, y0: number, x1: number, y1: number, jitterSeed = 1): number {
    const r = RAD[M.WATER], sp = r * 2.05; let c = 0, s = jitterSeed;
    for (let y = y1 - r; y > y0; y -= sp * 0.9) for (let x = x0 + r; x < x1; x += sp) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = (s / 4294967296 - 0.5) * 0.5;
      if (y + r < this.terrain.groundY(x) && this.addNode(M.WATER, x + j, y) >= 0) c++;
    }
    return c;
  }

  nearestNode(x: number, y: number, maxDist: number, filter?: (i: number) => boolean): number {
    let best = -1, bd = maxDist * maxDist;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue; if (filter && !filter(i)) continue;
      const dx = this.x[i] - x, dy = this.y[i] - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  grab(node: number, x: number, y: number) { this.hand.active = true; this.hand.node = node; this.hand.x = x; this.hand.y = y; }
  release() { this.hand.active = false; this.hand.node = -1; this.hand.spin = 0; }
  count(mat: number): number { let c = 0; for (let i = 0; i < this.n; i++) if (this.alive[i] && this.mat[i] === mat) c++; return c; }
  countIn(mat: number, x0: number, x1: number, y0 = -1e9, y1 = 1e9): number {
    let c = 0; for (let i = 0; i < this.n; i++) if (this.alive[i] && this.mat[i] === mat && this.x[i] >= x0 && this.x[i] <= x1 && this.y[i] >= y0 && this.y[i] <= y1) c++; return c;
  }

  /** FNV-1a over the bit patterns of live node positions. For determinism tests and replays. */
  hash(): string {
    let h = 0x811c9dc5;
    const f = new Float64Array(1), u = new Uint8Array(f.buffer);
    const mix = (v: number) => { f[0] = v; for (let i = 0; i < 8; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } };
    for (let i = 0; i < this.n; i++) { if (!this.alive[i]) continue; mix(this.x[i]); mix(this.y[i]); mix(this.hp[i]); mix(this.mat[i]); }
    mix(this.tick);
    return (h >>> 0).toString(16);
  }

  step() {
    const cfg = this.cfg, sub = cfg.substeps, h = cfg.dt / sub;
    this.computeBodies();
    // muscles: this step's rest length for every actuated bond (rule 7)
    const TAU = Math.PI * 2, t = this.time;
    for (let k = 0; k < this.nb; k++) {
      if (!this.balive[k] || !(this.bflags[k] & B_ACTUATED)) continue;
      let rest = this.brest[k] * (1 + this.bamp[k] * Math.sin(TAU * this.bfreq[k] * t + this.bphase[k]));
      const b = this.bb[k], minRest = RAD[this.mat[this.ba[k]]] + (b >= 0 ? RAD[this.mat[b]] : 0);
      if (rest < minRest) rest = minRest; // a muscle cannot pull two nodes into each other
      this.bcur[k] = rest;
    }
    this.buildPairs();
    for (let s = 0; s < sub; s++) this.substep(h);
    this.breakBonds();
    this.tick++; this.time = this.tick * cfg.dt;
  }

  private substep(h: number) {
    const cfg = this.cfg, n = this.n, g = cfg.gravity, h2 = h * h;
    const x = this.x, y = this.y, px = this.px, py = this.py, mat = this.mat, alive = this.alive, wet = this.wet;
    const maxMove = cfg.maxSpeed * h;
    const airK = 1 - cfg.airDamping * h, waterK = 1 - cfg.waterDamping * h;
    // --- hand torque (Q/E): tangential acceleration around the held node
    const hand = this.hand; let spinAcc = 0, hb = -2;
    if (hand.active && hand.node >= 0 && alive[hand.node] && hand.spin !== 0) {
      hb = this.body[hand.node]; let I = 0; const cx = x[hand.node], cy = y[hand.node];
      for (let i = 0; i < n; i++) if (alive[i] && this.body[i] === hb) { const dx = x[i] - cx, dy = y[i] - cy; I += MASS[mat[i]] * (dx * dx + dy * dy); }
      spinAcc = hand.spin * cfg.handTorque * Math.min(1, cfg.handTorqueInertia / Math.max(I, 1));
    }
    // --- integrate
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const m = mat[i];
      let vx = x[i] - px[i], vy = y[i] - py[i];
      let ax = 0, ay = g;
      if (FLUID[m]) { vx *= waterK; vy *= waterK; }
      else {
        vx *= airK; vy *= airK;
        const w = wet[i];
        if (w > 0) {
          const frac = w >= cfg.wetFull ? 1 : w / cfg.wetFull;
          ay -= g * frac * cfg.waterDensity * INVM[m] * (RAD[m] * RAD[m] / 64);
          const dk = 1 - cfg.waterDrag * frac * h; vx *= dk; vy *= dk;
        }
      }
      if (hand.active) {
        if (i === hand.node) {
          const im = INVM[m];
          let fx = hand.x - x[i], fy = hand.y - y[i];
          const d = Math.sqrt((fx) * (fx) + (fy) * (fy)), fmax = cfg.handForce * g;
          const f = Math.min(d / cfg.handReach, 1) * fmax;
          if (d > 1e-9) { fx = (fx / d) * f; fy = (fy / d) * f; }
          const dk = 1 / (1 + cfg.handDamping * h * im);
          vx *= dk; vy *= dk;
          ax += fx * im; ay += fy * im;
        } else if (spinAcc !== 0 && this.body[i] === hb) {
          const dx = x[i] - x[hand.node], dy = y[i] - y[hand.node];
          ax += -dy * spinAcc; ay += dx * spinAcc;
        }
      }
      let mx = vx + ax * h2, my = vy + ay * h2;
      const d2 = mx * mx + my * my;
      if (d2 > maxMove * maxMove) { const k = maxMove / Math.sqrt(d2); mx *= k; my *= k; }
      px[i] = x[i]; py[i] = y[i]; x[i] += mx; y[i] += my;
    }
    // --- bonds (XPBD, one iteration per substep)
    const ba = this.ba, bb = this.bb, nb = this.nb, bflags = this.bflags;
    const muscleMax = cfg.sinewForce * g * h2 / cfg.bondIterations;
    for (let it = 0; it < cfg.bondIterations; it++) for (let k = 0; k < nb; k++) {
      if (!this.balive[k]) continue;
      const a = ba[k], b = bb[k], fl = bflags[k];
      let rest = this.brest[k];
      if (fl & B_ACTUATED) rest = this.bcur[k];
      if (fl & B_BRACE) { // straightness: hold the middle node at the midpoint of the two ends
        const m = this.bmid[k];
        const cx = x[m] - 0.5 * (x[a] + x[b]), cy = y[m] - 0.5 * (y[a] + y[b]);
        const wm = INVM[mat[m]], wa = INVM[mat[a]], wb = INVM[mat[b]];
        const s = -1 / (wm + 0.25 * (wa + wb) + this.bcomp[k] / h2);
        x[m] += cx * s * wm; y[m] += cy * s * wm;
        x[a] -= 0.5 * cx * s * wa; y[a] -= 0.5 * cy * s * wa; x[b] -= 0.5 * cx * s * wb; y[b] -= 0.5 * cy * s * wb;
        continue;
      }
      if (b < 0) {
        const dx = x[a] - this.bax[k], dy = y[a] - this.bay[k], d = Math.sqrt((dx) * (dx) + (dy) * (dy));
        if (d < rest || d < 1e-9) continue;
        const wa = INVM[mat[a]], c = d - rest, dl = -c / (wa + this.bcomp[k] / h2);
        x[a] += (dx / d) * dl * wa; y[a] += (dy / d) * dl * wa;
        continue;
      }
      const dx = x[b] - x[a], dy = y[b] - y[a], d = Math.sqrt((dx) * (dx) + (dy) * (dy));
      if (d < 1e-9) continue;
      const c = d - rest;
      if ((fl & (B_TENSION | B_STICKY)) && c < 0) continue;
      const wa = INVM[mat[a]], wb = INVM[mat[b]];
      let dl = c / (wa + wb + this.bcomp[k] / h2); const nx = dx / d, ny = dy / d;
      if (fl & B_ACTUATED) { if (dl > muscleMax) dl = muscleMax; else if (dl < -muscleMax) dl = -muscleMax; } // muscles have a force limit
      x[a] += nx * dl * wa; y[a] += ny * dl * wa; x[b] -= nx * dl * wb; y[b] -= ny * dl * wb;
    }
    // --- contacts
    this.collide(h);
    // --- terrain and world bounds
    const ter = this.terrain, W = ter.width, gf = cfg.groundFriction;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const m = mat[i], r = RAD[m];
      if (x[i] < r) x[i] = r; else if (x[i] > W - r) x[i] = W - r;
      const gy = ter.groundY(x[i]);
      if (y[i] + r * 1.5 < gy) continue;
      const sl = ter.slope(x[i]), inv = 1 / Math.sqrt(1 + sl * sl);
      const dist = (gy - y[i]) * inv;
      if (dist >= r) continue;
      const nx = sl * inv, ny = -inv, pen = r - dist;
      x[i] += nx * pen; y[i] += ny * pen;
      // friction along the tangent
      const mu = Math.sqrt(FRIC[m] * gf);
      if (mu > 0) {
        const tx = -ny, ty = nx;
        const dt = (x[i] - px[i]) * tx + (y[i] - py[i]) * ty;
        const lim = mu * pen;
        const corr = dt > lim ? lim : dt < -lim ? -lim : dt;
        x[i] -= tx * corr; y[i] -= ty * corr;
      }
      // sticky nodes grab the ground (rule 5)
      if (STICK[m] && this.stick[i] < cfg.stickyMaxBonds && !this.anch[i]) {
        if (this.addAnchor(i, x[i] - nx * r, y[i] - ny * r) >= 0) this.stick[i]++;
      }
    }
    this.time += h;
  }

  /** Broadphase, once per step: list every pair that could touch during the step. */
  private buildPairs() {
    const cfg = this.cfg, n = this.n;
    const x = this.x, y = this.y, mat = this.mat, alive = this.alive;
    // margin covers the distance two nodes can close during one step
    let vmax = 0;
    const sp = this.dens, stepMax = cfg.maxSpeed * cfg.dt; // dens doubles as scratch: distance each node may travel this step
    for (let i = 0; i < n; i++) { if (!alive[i]) continue; const dx = x[i] - this.px[i], dy = y[i] - this.py[i]; let v = Math.sqrt(dx * dx + dy * dy) * cfg.substeps; if (v > stepMax) v = stepMax; sp[i] = v; if (v > vmax) vmax = v; }
    const margin = 2 * vmax + cfg.pairSlack, slack = cfg.pairSlack;
    const solidReach = cfg.wetMargin + margin, fluidReach = cfg.fluidH + margin;
    const cI = this.candI, cJ = this.candJ, cap = cI.length; let nc2 = 0;
    const test = (i: number, j: number) => {
      const mi = mat[i], mj = mat[j];
      const reach = (FLUID[mi] & FLUID[mj] ? cfg.fluidH : RAD[mi] + RAD[mj] + cfg.wetMargin) + sp[i] + sp[j] + slack;
      const dx = x[j] - x[i], dy = y[j] - y[i];
      if (dx * dx + dy * dy < reach * reach && nc2 < cap) { cI[nc2] = i; cJ[nc2] = j; nc2++; }
    };
    // bounding box of everything alive; the grid only covers that
    let bx0 = 1e30, bx1 = -1e30, by0 = 1e30, by1 = -1e30, live = 0;
    for (let i = 0; i < n; i++) { if (!alive[i]) continue; live++; const xi = x[i], yi = y[i]; if (xi < bx0) bx0 = xi; if (xi > bx1) bx1 = xi; if (yi < by0) by0 = yi; if (yi > by1) by1 = yi; }
    if (live <= 40) { // few nodes: test every pair, in index order
      for (let i = 0; i < n; i++) { if (!alive[i]) continue; for (let j = i + 1; j < n; j++) if (alive[j]) test(i, j); }
      this.ncand = nc2; return;
    }
    let cs = Math.max(2 * RMAX + solidReach, fluidReach);
    const cellStart = this.cellStart, items = this.cellItems, cellOf = this.cellOf;
    let cols = Math.floor((bx1 - bx0) / cs) + 1, rows = Math.floor((by1 - by0) / cs) + 1;
    while (cols * rows + 2 > cellStart.length) { cs *= 1.5; cols = Math.floor((bx1 - bx0) / cs) + 1; rows = Math.floor((by1 - by0) / cs) + 1; }
    const nc = cols * rows;
    cellStart.fill(0, 0, nc + 2);
    for (let i = 0; i < n; i++) {
      if (!alive[i]) { cellOf[i] = -1; continue; }
      const cx = ((x[i] - bx0) / cs) | 0, cy = ((y[i] - by0) / cs) | 0;
      const c = cy * cols + cx; cellOf[i] = c; cellStart[c + 1]++;
    }
    for (let c = 0; c < nc; c++) cellStart[c + 1] += cellStart[c];
    // Backwards fill keeps index order inside a cell. Afterwards cell c spans cellStart[c+1] .. cellStart[c+2].
    for (let i = n - 1; i >= 0; i--) { const c = cellOf[i]; if (c < 0) continue; items[--cellStart[c + 1]] = i; }
    cellStart[nc + 1] = live;
    for (let c = 0; c < nc; c++) {
      const s0 = cellStart[c + 1], e0 = cellStart[c + 2];
      if (e0 <= s0) continue;
      const cx = c % cols, cy = (c / cols) | 0;
      for (let q = s0; q < e0; q++) {
        const i = items[q];
        for (let q2 = q + 1; q2 < e0; q2++) test(i, items[q2]);
        for (let k = 0; k < 4; k++) { // forward neighbours: E, SW, S, SE
          const nx = cx + (k === 0 ? 1 : k - 2), ny = cy + (k === 0 ? 0 : 1);
          if (nx < 0 || nx >= cols || ny >= rows) continue;
          const c2 = ny * cols + nx, e2 = cellStart[c2 + 2];
          for (let q2 = cellStart[c2 + 1]; q2 < e2; q2++) test(i, items[q2]);
        }
      }
    }
    // Canonical order: by lower index, then higher. The grid's visiting order depends on the bounding box of the whole
    // world, so without this a pond sloshing far away would change the order two nearby nodes are resolved in, and
    // a creature would not behave in a raid as it did in its trial.
    let keys = this.candKey; if (!keys) keys = this.candKey = new Float64Array(cap);
    for (let q = 0; q < nc2; q++) { const i = cI[q], j = cJ[q]; keys[q] = i < j ? i * 65536 + j : j * 65536 + i; }
    keys.subarray(0, nc2).sort();
    for (let q = 0; q < nc2; q++) { const k = keys[q], i = Math.floor(k / 65536); cI[q] = i; cJ[q] = k - i * 65536; }
    this.ncand = nc2;
  }
  private candKey: Float64Array | null = null;

  /**
   * Renumber live nodes and bonds without changing their order, and empty the free lists, so the next thing spawned
   * is appended at the end. Returns old index to new index (-1 for removed nodes).
   */
  compact(): Int32Array {
    const n = this.n, map = new Int32Array(n).fill(-1); let m = 0;
    const NA = [this.x, this.y, this.px, this.py, this.mat, this.hp, this.alive, this.body, this.wet, this.stick, this.anch, this.tag] as any[];
    for (let i = 0; i < n; i++) { if (!this.alive[i]) continue; map[i] = m; if (m !== i) for (const a of NA) a[m] = a[i]; m++; }
    this.alive.fill(0, m, n); this.n = m;
    const BA = [this.ba, this.bb, this.brest, this.bflags, this.bcomp, this.blimit, this.bamp, this.bphase, this.bfreq, this.bax, this.bay, this.balive, this.bmid, this.bcur] as any[];
    let kb = 0; this.bondKeys.clear();
    for (let k = 0; k < this.nb; k++) {
      if (!this.balive[k]) continue; if (kb !== k) for (const a of BA) a[kb] = a[k];
      this.ba[kb] = map[this.ba[kb]]; if (this.bb[kb] >= 0) { this.bb[kb] = map[this.bb[kb]]; this.bondKeys.add(this.key(this.ba[kb], this.bb[kb])); }
      if (this.bmid[kb] >= 0) this.bmid[kb] = map[this.bmid[kb]]; kb++;
    }
    this.balive.fill(0, kb, this.nb); this.nb = kb; this.free = []; this.freeB = [];
    if (this.hand.node >= 0) { this.hand.node = map[this.hand.node]; if (this.hand.node < 0) this.hand.active = false; }
    this.bodiesDirty = true; return map;
  }

  private collide(h: number) {
    const cfg = this.cfg, n = this.n;
    const x = this.x, y = this.y, px = this.px, py = this.py, alive = this.alive;
    this.wetNext.fill(0, 0, n); this.dens.fill(0, 0, n); this.densNear.fill(0, 0, n); this.npairs = 0;
    const wetReach = cfg.wetMargin, cI = this.candI, cJ = this.candJ, ncand = this.ncand;
    for (let p = 0; p < ncand; p++) { const i = cI[p], j = cJ[p]; if (alive[i] && alive[j]) this.pair(i, j, h, wetReach); }
    // Water: double-density relaxation (Clavet et al. 2005). Pressure pushes crowded particles apart,
    // near-pressure stops them stacking, and a little negative pressure makes blobs hold together.
    {
      const np = this.npairs, pI = this.pairI, pJ = this.pairJ, pQ = this.pairQ, dens = this.dens, dn = this.densNear;
      const k = cfg.fluidK * h * h, kn = cfg.fluidKNear * h * h, rho0 = cfg.fluidRest, visc = cfg.fluidViscosity, minP = -cfg.fluidCohesion * rho0;
      for (let p = 0; p < np; p++) {
        const i = pI[p], j = pJ[p], q = pQ[p];
        let Pi = dens[i] - rho0, Pj = dens[j] - rho0;
        if (Pi < minP) Pi = minP; if (Pj < minP) Pj = minP;
        const D = 0.5 * (k * (Pi + Pj) * 0.5 * q + kn * (dn[i] + dn[j]) * 0.5 * q * q);
        let dx = x[j] - x[i], dy = y[j] - y[i]; const d = Math.sqrt((dx) * (dx) + (dy) * (dy));
        if (d > 1e-9) { dx /= d; dy /= d; } else { dx = 0; dy = 1; }
        // viscosity: damp relative motion along the line between the two particles
        const u = ((x[i] - px[i]) - (x[j] - px[j])) * dx + ((y[i] - py[i]) - (y[j] - py[j])) * dy;
        const V = D + visc * q * u;
        x[i] -= dx * V; y[i] -= dy * V; x[j] += dx * V; y[j] += dy * V;
      }
    }
    const t = this.wet; this.wet = this.wetNext; this.wetNext = t;
  }

  private pair(i: number, j: number, h: number, wetReach: number) {
    const x = this.x, y = this.y, mat = this.mat;
    const mi = mat[i], mj = mat[j];
    const ri = RAD[mi], rj = RAD[mj], rs = ri + rj;
    const dx = x[j] - x[i], dy = y[j] - y[i];
    const d2 = dx * dx + dy * dy;
    const fi = FLUID[mi], fj = FLUID[mj];
    if (fi & fj) { // water-water: remember the pair for the fluid relaxation pass
      const H = this.cfg.fluidH;
      if (d2 >= H * H) return;
      const q = 1 - Math.sqrt(d2) / H, np = this.npairs;
      if (np >= this.pairI.length) return;
      this.pairI[np] = i; this.pairJ[np] = j; this.pairQ[np] = q; this.npairs = np + 1;
      this.dens[i] += q * q; this.dens[j] += q * q; this.densNear[i] += q * q * q; this.densNear[j] += q * q * q;
      return;
    }
    const reach = rs + wetReach;
    if (d2 >= reach * reach) return;
    if (fi !== fj) { if (fi) this.wetNext[j]++; else this.wetNext[i]++; }
    if (d2 >= rs * rs) return;
    const d = Math.sqrt(d2);
    let nx: number, ny: number;
    if (d > 1e-9) { nx = dx / d; ny = dy / d; } else { nx = 0; ny = 1; }
    const pen = rs - d;
    const wi = INVM[mi], wj = INVM[mj], ws = wi + wj;
    const px = this.px, py = this.py;
    if (fi & fj) return;
    // rule 8: a heart touching a berry removes the berry
    if ((mi === M.HEART && mj === M.BERRY) || (mj === M.HEART && mi === M.BERRY)) {
      const berry = mi === M.BERRY ? i : j, heart = mi === M.BERRY ? j : i;
      this.eaten++;
      if (this.recordEvents) this.events.push({ type: 'eat', tick: this.tick, node: berry, other: heart, x: x[berry], y: y[berry], mat: M.BERRY, body: this.tag[heart] });
      this.removeNode(berry);
      return;
    }
    const sameBody = !fi && !fj && this.body[i] === this.body[j];
    // rule 4: damage from sharp contact and heavy impacts (never inside one body, never to water)
    if (!fi && !fj && !sameBody) {
      const vn = (((x[i] - px[i]) - (x[j] - px[j])) * nx + ((y[i] - py[i]) - (y[j] - py[j])) * ny) / h; // closing speed
      if (vn > 0) {
        const cfg = this.cfg;
        let di = 0, dj = 0;
        if (vn > cfg.sharpMinSpeed) { const s = (vn - cfg.sharpMinSpeed) * cfg.sharpScale; dj += SHARP[mi] * s; di += SHARP[mj] * s; }
        // crushing: the striker's own momentum has to clear a threshold, so heavy things crush and light ones do not
        const vc = vn > cfg.maxSpeed ? cfg.maxSpeed : vn; const pi = vc * MASS[mi], pj = vc * MASS[mj];
        if (pi > cfg.crushMinImpulse) dj += (pi - cfg.crushMinImpulse) * cfg.crushScale;
        if (pj > cfg.crushMinImpulse) di += (pj - cfg.crushMinImpulse) * cfg.crushScale;
        if (di > 0) this.damage(i, di / HARD[mi], j);
        if (dj > 0) this.damage(j, dj / HARD[mj], i);
        if (!this.alive[i] || !this.alive[j]) return;
      }
    }
    // rule 2: push apart, weighted by inverse mass
    const ci = pen * wi / ws, cj = pen * wj / ws;
    x[i] -= nx * ci; y[i] -= ny * ci; x[j] += nx * cj; y[j] += ny * cj;
    if (fi || fj) return;
    if (!sameBody) {
      const mu = Math.sqrt(FRIC[mi] * FRIC[mj]);
      if (mu > 0) {
        const tx = -ny, ty = nx;
        const dt = ((x[i] - px[i]) - (x[j] - px[j])) * tx + ((y[i] - py[i]) - (y[j] - py[j])) * ty;
        const lim = mu * pen;
        const corr = dt > lim ? lim : dt < -lim ? -lim : dt;
        x[i] -= tx * corr * wi / ws; y[i] -= ty * corr * wi / ws;
        x[j] += tx * corr * wj / ws; y[j] += ty * corr * wj / ws;
      }
    }
    // rule 5: sticky nodes bond to what they touch
    if (STICK[mi] | STICK[mj]) {
      const max = this.cfg.stickyMaxBonds;
      const okI = !STICK[mi] || this.stick[i] < max, okJ = !STICK[mj] || this.stick[j] < max;
      if (okI && okJ && !this.bonded(i, j)) {
        if (this.addBond(i, j, { sticky: true }) >= 0) { if (STICK[mi]) this.stick[i]++; if (STICK[mj]) this.stick[j]++; }
      }
    }
  }

  damage(i: number, amount: number, by = -1) {
    if (!this.alive[i] || amount <= 0) return;
    this.hp[i] -= amount; this.damageDealt += amount;
    if (this.hp[i] <= 0) {
      if (this.recordEvents) this.events.push({ type: 'death', tick: this.tick, node: i, other: by, x: this.x[i], y: this.y[i], mat: this.mat[i], body: this.tag[i] });
      if (this.mat[i] === M.HEART) this.stopCreature(this.tag[i]);
      this.removeNode(i);
    }
  }

  /** A creature whose heart is destroyed stops moving: its sinew goes slack and the body stays as salvage. */
  stopCreature(tag: number) {
    if (tag <= 0) return;
    for (let k = 0; k < this.nb; k++) if (this.balive[k] && (this.bflags[k] & B_ACTUATED) && this.tag[this.ba[k]] === tag) this.bflags[k] &= ~B_ACTUATED;
    this.heartsLost++;
  }
  heartsLost = 0;
  /** Rule 3: a bond stretched past its limit breaks. Checked once per step. */
  private breakBonds() {
    const x = this.x, y = this.y;
    for (let k = 0; k < this.nb; k++) {
      if (!this.balive[k]) continue;
      const a = this.ba[k], b = this.bb[k];
      let d: number, rest = this.brest[k];
      if (b < 0) d = Math.sqrt((x[a] - this.bax[k]) * (x[a] - this.bax[k]) + (y[a] - this.bay[k]) * (y[a] - this.bay[k]));
      else d = Math.sqrt((x[b] - x[a]) * (x[b] - x[a]) + (y[b] - y[a]) * (y[b] - y[a]));
      if (this.bflags[k] & B_BRACE) { // a brace lives only while both of the bonds it stiffens do
        const m = this.bmid[k];
        if (!this.alive[m] || !this.bonded(a, m) || !this.bonded(m, b)) this.removeBond(k);
        continue;
      }
      if (this.bflags[k] & B_ACTUATED) rest *= 1 + Math.abs(this.bamp[k]);
      if ((d - rest) / rest > this.blimit[k]) {
        if (this.recordEvents) this.events.push({ type: 'break', tick: this.tick, node: a, other: b, x: x[a], y: y[a], mat: this.mat[a], body: this.tag[a] });
        this.removeBond(k);
      }
    }
  }
}
export { RAD, MASS };
