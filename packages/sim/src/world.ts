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

export class World {
  cfg: Config; terrain: Terrain;
  n = 0; nb = 0; tick = 0; time = 0;
  x: Float64Array; y: Float64Array; px: Float64Array; py: Float64Array;
  mat: Uint8Array; hp: Float32Array; alive: Uint8Array; body: Int32Array; wet: Float32Array; wetNext: Float32Array;
  stick: Uint8Array; anch: Uint8Array; tag: Int32Array; // tag: free-form owner id (creature id, object id); survives splits
  ba: Int32Array; bb: Int32Array; brest: Float64Array; bflags: Uint8Array; bcomp: Float64Array; blimit: Float32Array;
  bamp: Float32Array; bphase: Float32Array; bfreq: Float32Array; bax: Float64Array; bay: Float64Array; balive: Uint8Array; bmid: Int32Array;
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
    this.bfreq = new Float32Array(NB); this.bax = new Float64Array(NB); this.bay = new Float64Array(NB); this.balive = new Uint8Array(NB); this.bmid = new Int32Array(NB);
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
    w.hand = { ...this.hand }; w.eaten = this.eaten; w.damageDealt = this.damageDealt;
    (w as any).free = [...this.free]; (w as any).freeB = [...this.freeB];
    return w;
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
    for (let b = 0; b < this.nb; b++) if (this.balive[b] && (this.ba[b] === i || this.bb[b] === i)) this.removeBond(b);
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
    if (opts.sticky) { flags |= B_STICKY; strength = this.cfg.stickyStrength; stretch = this.cfg.stickyStretch; }
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
  addAnchor(a: number, ax: number, ay: number): number {
    const k = this.allocBond(); if (k < 0) return -1;
    const rest = Math.max(1, Math.hypot(this.x[a] - ax, this.y[a] - ay));
    this.ba[k] = a; this.bb[k] = -1; this.brest[k] = rest; this.bflags[k] = B_STICKY | B_ANCHOR;
    this.bcomp[k] = (this.cfg.stickyStretch * rest) / (this.cfg.stickyStrength * this.cfg.gravity); this.blimit[k] = this.cfg.stickyStretch;
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
    const t = this.time + 0; // actuation uses step time plus substep offset
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
    const TAU = Math.PI * 2;
    for (let it = 0; it < cfg.bondIterations; it++) for (let k = 0; k < nb; k++) {
      if (!this.balive[k]) continue;
      const a = ba[k], b = bb[k], fl = bflags[k];
      let rest = this.brest[k];
      if (fl & B_ACTUATED) rest *= 1 + this.bamp[k] * Math.sin(TAU * this.bfreq[k] * t + this.bphase[k]);
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
      const dl = c / (wa + wb + this.bcomp[k] / h2), nx = dx / d, ny = dy / d;
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
    const cs = Math.max(2 * RMAX + solidReach, fluidReach);
    const cols = Math.ceil(this.terrain.width / cs) + 2, rows = Math.ceil(this.terrain.height / cs) + 2;
    const cellStart = this.cellStart, items = this.cellItems, cellOf = this.cellOf;
    const nc = cols * rows;
    cellStart.fill(0, 0, nc + 2);
    let live = 0;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) { cellOf[i] = -1; continue; }
      let cx = (x[i] / cs) | 0, cy = (y[i] / cs) | 0;
      if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
      const c = cy * cols + cx; cellOf[i] = c; cellStart[c + 1]++; live++;
    }
    for (let c = 0; c < nc; c++) cellStart[c + 1] += cellStart[c];
    // Backwards fill keeps index order inside a cell. Afterwards cell c spans cellStart[c+1] .. cellStart[c+2].
    for (let i = n - 1; i >= 0; i--) { const c = cellOf[i]; if (c < 0) continue; items[--cellStart[c + 1]] = i; }
    cellStart[nc + 1] = live;
    const cI = this.candI, cJ = this.candJ, cap = cI.length; let nc2 = 0;
    const test = (i: number, j: number) => {
      const mi = mat[i], mj = mat[j];
      const reach = (FLUID[mi] & FLUID[mj] ? cfg.fluidH : RAD[mi] + RAD[mj] + cfg.wetMargin) + sp[i] + sp[j] + slack;
      const dx = x[j] - x[i], dy = y[j] - y[i];
      if (dx * dx + dy * dy < reach * reach && nc2 < cap) { cI[nc2] = i; cJ[nc2] = j; nc2++; }
    };
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
    this.ncand = nc2;
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
        const imp = vn / ws;
        if (imp > cfg.crushMinImpulse) { const c = (imp - cfg.crushMinImpulse) * cfg.crushScale; di += c; dj += c; }
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
      this.removeNode(i);
    }
  }

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
