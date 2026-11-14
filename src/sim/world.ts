import { CONFIG, type Config } from './config';
import { MATERIALS, Mat } from './materials';
import type { Terrain } from './terrain';

/** max bonds per node (8 lattice neighbours plus sticky bonds) */
const ADJ = 24;
const TAU = Math.PI * 2;

export const B_TENSION = 1;
export const B_STICKY = 2;

// material property columns, pulled out of the table once for speed
const M_DENS = MATERIALS.map((m) => m.density);
const M_HARD = MATERIALS.map((m) => m.hardness);
const M_SHARP = MATERIALS.map((m) => m.sharpness);
const M_STICK = MATERIALS.map((m) => m.stickiness);
const M_FRIC = MATERIALS.map((m) => m.friction);
const M_TENS = MATERIALS.map((m) => m.tensile);
const M_STIFF = MATERIALS.map((m) => m.bondStiffness);
const WATER = Mat.Water;

export interface Hand {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  grip: number[];
  ox: number[];
  oy: number[];
}

export interface BondOpts {
  flags?: number;
  stiffness?: number;
  limit?: number;
  amp?: number;
  phase?: number;
  freq?: number;
}

export interface WorldSnapshot {
  n: number; bn: number;
  nodes: Record<string, ArrayLike<number>>; bonds: Record<string, ArrayLike<number>>;
  freeNodes: number[]; freeBonds: number[];
  tick: number; subTick: number; time: number; nextBody: number;
  bodyKind: number[]; bodyDamage: number[]; bodyEaten: number[]; bodyHeart: number[]; berriesEaten: number;
}

const NODE_F64 = ['x', 'y', 'px', 'py', 'rad', 'invM', 'accX', 'accY', 'ax', 'ay', 'stickCd', 'hurtCd', 'head'] as const;
const BOND_F32 = ['bstiff', 'blimit', 'bamp', 'bphase', 'bfreq'] as const;
const SNAP_NODE = [...NODE_F64, 'hp', 'mat', 'alive', 'anch', 'stickN', 'adjN', 'wn', 'body', 'adj', 'trA', 'trC', 'trS'];
const SNAP_BOND = ['ba', 'bb', 'brest', ...BOND_F32, 'bflag', 'balive'];

/**
 * The whole simulation state. Nodes are circles, bonds are distance
 * constraints, water is unbonded small circles. Nothing here knows what a
 * bucket or a creature is.
 */
export class World {
  cap: number;
  n = 0;
  x!: Float64Array; y!: Float64Array; px!: Float64Array; py!: Float64Array;
  rad!: Float64Array; invM!: Float64Array;
  accX!: Float64Array; accY!: Float64Array;
  ax!: Float64Array; ay!: Float64Array; stickCd!: Float64Array;
  /** water only: y of the free surface of the body of water this particle belongs to */
  head!: Float64Array;
  /** time until this node can be hurt again */
  hurtCd!: Float64Array;
  hp!: Float32Array;
  mat!: Uint8Array; alive!: Uint8Array; anch!: Uint8Array; stickN!: Uint8Array;
  adjN!: Uint8Array;
  /** water only: touching water neighbours seen in the last contact pass */
  wn!: Uint8Array;
  body!: Int32Array; adj!: Int32Array;
  /** braces: for node i, slots i*4..i*4+3 hold the two ends of a straight run through it */
  trA!: Int32Array; trC!: Int32Array; trS!: Float32Array;
  freeNodes: number[] = [];

  bcap: number;
  bn = 0;
  ba!: Int32Array; bb!: Int32Array;
  brest!: Float64Array;
  bstiff!: Float32Array; blimit!: Float32Array; bamp!: Float32Array;
  bphase!: Float32Array; bfreq!: Float32Array;
  bflag!: Uint8Array; balive!: Uint8Array;
  freeBonds: number[] = [];

  tick = 0;
  subTick = 0;
  time = 0;
  nextBody = 0;
  /** per body: 0 = object, 1 = creature */
  bodyKind: number[] = [];
  bodyDamage: number[] = [];
  bodyEaten: number[] = [];
  /** per body: node index of its heart, -1 if none or destroyed */
  bodyHeart: number[] = [];
  berriesEaten = 0;

  hand: Hand = { active: false, x: 0, y: 0, angle: 0, grip: [], ox: [], oy: [] };

  // spatial hash scratch (not part of state)
  private bucketStart!: Int32Array;
  private entries!: Int32Array;
  private nodeBucket!: Int32Array;
  private mask = 0;

  constructor(public terrain: Terrain, public cfg: Config = CONFIG, cap = 1024, bcap = 4096) {
    this.cap = cap;
    this.bcap = bcap;
    this.allocNodes(cap);
    this.allocBonds(bcap);
    this.sizeHash();
  }

  /** the collision table scales with capacity, so small arenas stay cheap to step */
  private sizeHash() {
    const bits = Math.min(this.cfg.hash.tableBits, Math.max(6, Math.ceil(Math.log2(this.cap)) + 1));
    const size = 1 << bits;
    this.mask = size - 1;
    this.bucketStart = new Int32Array(size + 1);
    this.entries = new Int32Array(this.cap);
    this.nodeBucket = new Int32Array(this.cap);
  }

  // ---------------------------------------------------------------- storage

  private allocNodes(cap: number) {
    const self = this as any;
    const grow = (old: any, Ctor: any, mult = 1) => {
      const a = new Ctor(cap * mult);
      if (old) a.set(old);
      return a;
    };
    for (const k of NODE_F64) self[k] = grow(self[k], Float64Array);
    this.hp = grow(this.hp, Float32Array);
    this.mat = grow(this.mat, Uint8Array);
    this.alive = grow(this.alive, Uint8Array);
    this.anch = grow(this.anch, Uint8Array);
    this.stickN = grow(this.stickN, Uint8Array);
    this.adjN = grow(this.adjN, Uint8Array);
    this.wn = grow(this.wn, Uint8Array);
    this.body = grow(this.body, Int32Array);
    this.adj = grow(this.adj, Int32Array, ADJ);
    this.trA = grow(this.trA, Int32Array, 4);
    this.trC = grow(this.trC, Int32Array, 4);
    this.trS = grow(this.trS, Float32Array, 4);
    this.cap = cap;
    if (this.bucketStart) this.sizeHash();
  }

  private allocBonds(bcap: number) {
    const self = this as any;
    const grow = (old: any, Ctor: any) => {
      const a = new Ctor(bcap);
      if (old) a.set(old);
      return a;
    };
    this.ba = grow(this.ba, Int32Array);
    this.bb = grow(this.bb, Int32Array);
    this.brest = grow(this.brest, Float64Array);
    for (const k of BOND_F32) self[k] = grow(self[k], Float32Array);
    this.bflag = grow(this.bflag, Uint8Array);
    this.balive = grow(this.balive, Uint8Array);
    this.bcap = bcap;
  }

  newBody(kind = 0): number {
    const b = this.nextBody++;
    this.bodyKind[b] = kind;
    this.bodyDamage[b] = 0;
    this.bodyEaten[b] = 0;
    this.bodyHeart[b] = -1;
    return b;
  }

  addNode(mat: number, x: number, y: number, body = -1, radius?: number): number {
    let i: number;
    if (this.freeNodes.length) i = this.freeNodes.pop()!;
    else {
      if (this.n >= this.cap) this.allocNodes(this.cap * 2);
      i = this.n++;
    }
    const m = MATERIALS[mat];
    const r = radius ?? m.radius;
    this.x[i] = this.px[i] = x;
    this.y[i] = this.py[i] = y;
    this.rad[i] = r;
    const rr = r / MATERIALS[0].radius;
    this.invM[i] = 1 / (m.density * rr * rr);
    this.accX[i] = this.accY[i] = 0;
    this.stickCd[i] = 0;
    this.hurtCd[i] = 0;
    this.head[i] = y;
    this.hp[i] = m.hitPoints;
    this.mat[i] = mat;
    this.alive[i] = 1;
    this.anch[i] = 0;
    this.stickN[i] = 0;
    this.adjN[i] = 0;
    for (let a = 0; a < 4; a++) this.trA[i * 4 + a] = -1;
    this.body[i] = body;
    if (mat === Mat.Heart && body >= 0) this.bodyHeart[body] = i;
    return i;
  }

  removeNode(i: number) {
    if (!this.alive[i]) return;
    const base = i * ADJ;
    for (const j of this.neighbours(i)) this.dropBraces(j, i);
    for (let a = 0; a < 4; a++) this.trA[i * 4 + a] = -1;
    while (this.adjN[i] > 0) this.removeBond(this.adj[base + this.adjN[i] - 1]);
    this.alive[i] = 0;
    this.anch[i] = 0;
    const b = this.body[i];
    if (this.mat[i] === Mat.Heart && b >= 0 && this.bodyHeart[b] === i) this.bodyHeart[b] = -1;
    this.freeNodes.push(i);
    const g = this.hand.grip.indexOf(i);
    if (g >= 0) {
      this.hand.grip.splice(g, 1); this.hand.ox.splice(g, 1); this.hand.oy.splice(g, 1);
      if (!this.hand.grip.length) this.hand.active = false;
    }
  }

  addBond(a: number, b: number, rest: number, o: BondOpts = {}): number {
    if (this.adjN[a] >= ADJ || this.adjN[b] >= ADJ) return -1;
    let k: number;
    if (this.freeBonds.length) k = this.freeBonds.pop()!;
    else {
      if (this.bn >= this.bcap) this.allocBonds(this.bcap * 2);
      k = this.bn++;
    }
    const ma = this.mat[a], mb = this.mat[b];
    this.ba[k] = a; this.bb[k] = b;
    this.brest[k] = rest;
    this.bflag[k] = o.flags ?? 0;
    this.bstiff[k] = o.stiffness ?? Math.min(M_STIFF[ma], M_STIFF[mb]);
    this.blimit[k] = o.limit ?? Math.min(M_TENS[ma], M_TENS[mb]);
    this.bamp[k] = o.amp ?? 0;
    this.bphase[k] = o.phase ?? 0;
    this.bfreq[k] = o.freq ?? this.cfg.sinew.frequency;
    this.balive[k] = 1;
    this.adj[a * ADJ + this.adjN[a]++] = k;
    this.adj[b * ADJ + this.adjN[b]++] = k;
    return k;
  }

  removeBond(k: number) {
    if (!this.balive[k]) return;
    this.balive[k] = 0;
    this.unlink(this.ba[k], k);
    this.unlink(this.bb[k], k);
    if (this.bflag[k] & B_STICKY) {
      const a = this.ba[k];
      if (this.stickN[a] > 0) this.stickN[a]--;
      this.stickCd[a] = this.time + this.cfg.sticky.cooldown;
    }
    this.freeBonds.push(k);
    // a brace cannot outlive either of the two bonds it runs along
    if (!(this.bflag[k] & B_STICKY)) {
      this.dropBraces(this.ba[k], this.bb[k]);
      this.dropBraces(this.bb[k], this.ba[k]);
    }
  }

  /**
   * Bending stiffness. Node mid sits between a and c in a straight run; the
   * solver keeps it at their midpoint. Each node can be the middle of up to
   * four runs (one per lattice axis).
   */
  addBrace(a: number, mid: number, c: number, stiffness: number): boolean {
    for (let s = 0; s < 4; s++) {
      if (this.trA[mid * 4 + s] < 0) {
        this.trA[mid * 4 + s] = a; this.trC[mid * 4 + s] = c; this.trS[mid * 4 + s] = stiffness;
        return true;
      }
    }
    return false;
  }

  /** remove braces centred on node i that use node other as an end */
  private dropBraces(i: number, other: number) {
    for (let s = i * 4; s < i * 4 + 4; s++) {
      if (this.trA[s] >= 0 && (this.trA[s] === other || this.trC[s] === other)) this.trA[s] = -1;
    }
  }

  private unlink(i: number, k: number) {
    const base = i * ADJ;
    const n = this.adjN[i];
    for (let s = 0; s < n; s++) {
      if (this.adj[base + s] === k) {
        this.adj[base + s] = this.adj[base + n - 1];
        this.adjN[i] = n - 1;
        return;
      }
    }
  }

  /** bond index joining i and j, or -1 */
  findBond(i: number, j: number): number {
    const base = i * ADJ;
    for (let s = this.adjN[i] - 1; s >= 0; s--) {
      const k = this.adj[base + s];
      if (this.ba[k] === j || this.bb[k] === j) return k;
    }
    return -1;
  }

  /** node indices bonded to i */
  neighbours(i: number, includeSticky = true): number[] {
    const out: number[] = [];
    const base = i * ADJ;
    for (let s = 0; s < this.adjN[i]; s++) {
      const k = this.adj[base + s];
      if (!includeSticky && this.bflag[k] & B_STICKY) continue;
      out.push(this.ba[k] === i ? this.bb[k] : this.ba[k]);
    }
    return out;
  }

  /** every node reachable from i through bonds */
  component(i: number, includeSticky = false): number[] {
    const seen = new Set<number>([i]);
    const out = [i];
    for (let q = 0; q < out.length; q++) {
      for (const j of this.neighbours(out[q], includeSticky)) {
        if (!seen.has(j)) { seen.add(j); out.push(j); }
      }
    }
    return out;
  }

  /** mass of a node plus the nodes bonded directly to it */
  clusterMass(i: number): number {
    let m = 1 / this.invM[i];
    const base = i * ADJ;
    for (let s = this.adjN[i] - 1; s >= 0; s--) {
      const k = this.adj[base + s];
      m += 1 / this.invM[this.ba[k] === i ? this.bb[k] : this.ba[k]];
    }
    return m;
  }

  damage(i: number, amount: number) {
    if (amount <= 0 || !this.alive[i] || this.hurtCd[i] > this.time) return;
    this.hurtCd[i] = this.time + this.cfg.damage.cooldown;
    this.hp[i] -= amount;
    const b = this.body[i];
    if (b >= 0) this.bodyDamage[b] += amount;
    if (this.hp[i] <= 0) this.removeNode(i);
  }

  // ------------------------------------------------------------------- hand

  /** nearest non-water node within r of a point, or -1 */
  nodeAt(x: number, y: number, r: number = this.cfg.hand.pickRadius): number {
    let best = -1, bd = r * r;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || this.mat[i] === WATER) continue;
      const dx = this.x[i] - x, dy = this.y[i] - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** The hand closes on the picked node and the nodes bonded around it (a palm, not a pin). */
  grab(i: number) {
    const h = this.hand;
    h.active = true;
    h.x = this.x[i]; h.y = this.y[i]; h.angle = 0;
    const reach = this.cfg.hand.gripRadius;
    const grip = [i];
    const seen = new Set<number>(grip);
    for (let q = 0; q < grip.length; q++) {
      for (const j of this.neighbours(grip[q], false)) {
        if (seen.has(j) || this.bflag[this.findBond(grip[q], j)] & B_TENSION) continue;
        seen.add(j);
        const dx = this.x[j] - h.x, dy = this.y[j] - h.y;
        if (dx * dx + dy * dy <= reach * reach) grip.push(j);
      }
    }
    h.grip = grip;
    h.ox = grip.map((g) => this.x[g] - h.x);
    h.oy = grip.map((g) => this.y[g] - h.y);
  }

  release() {
    const h = this.hand;
    h.active = false; h.grip = []; h.ox = []; h.oy = [];
  }

  // ------------------------------------------------------------------- step

  step() {
    const S = this.cfg.substeps;
    const h = this.cfg.dt / S;
    for (let s = 0; s < S; s++) {
      this.time += h;
      this.integrate(h);
      this.buildHash();
      this.solveBonds();
      this.solveBraces();
      this.solveAnchors();
      this.solveContacts(h);
      this.solveTerrain();
    }
    this.breakBonds();
    this.tick++;
  }

  private integrate(h: number) {
    const cfg = this.cfg;
    const h2 = h * h;
    const { x, y, px, py, accX, accY, alive, invM } = this;
    // The hand: a spring on the gripped nodes, with a cap on total force.
    const hand = this.hand;
    if (hand.active && hand.grip.length) {
      const c = Math.cos(hand.angle), s = Math.sin(hand.angle);
      const K = cfg.hand.stiffness, C = cfg.hand.damping;
      const n = hand.grip.length;
      const fx = new Array<number>(n), fy = new Array<number>(n);
      let total = 0;
      for (let k = 0; k < n; k++) {
        const g = hand.grip[k];
        const tx = hand.x + c * hand.ox[k] - s * hand.oy[k];
        const ty = hand.y + s * hand.ox[k] + c * hand.oy[k];
        const ax = K * (tx - x[g]) - (C * (x[g] - px[g])) / h;
        const ay = K * (ty - y[g]) - (C * (y[g] - py[g])) / h;
        fx[k] = ax; fy[k] = ay;
        total += Math.sqrt(ax * ax + ay * ay) / invM[g];
      }
      const scale = total > cfg.hand.maxForce ? cfg.hand.maxForce / total : 1;
      for (let k = 0; k < n; k++) {
        const g = hand.grip[k];
        px[g] -= fx[k] * scale * h2;
        py[g] -= fy[k] * scale * h2;
      }
    }
    const damp = 1 - cfg.airDamping * h;
    const maxD = cfg.maxSpeed * h;
    const gh2 = cfg.gravity * h2;
    const rise = cfg.water.headRise * h;
    const jig = cfg.water.jiggle * h;
    const sub = this.subTick++;
    const { head, mat } = this;
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      let vx = (x[i] - px[i]) * damp + accX[i] * h2;
      let vy = (y[i] - py[i]) * damp + accY[i] * h2 + gh2;
      const v2 = vx * vx + vy * vy;
      if (v2 > maxD * maxD) {
        const f = maxD / Math.sqrt(v2);
        vx *= f; vy *= f;
      }
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx; y[i] += vy;
      accX[i] = 0; accY[i] = 0;
      if (mat[i] === WATER) {
        // Thermal jiggle: packed circles jam like sand, and a little seeded
        // noise is what lets them flow like a liquid. Only below the surface layer,
        // so a full bucket does not shed its top row.
        if (this.wn[i] && y[i] - head[i] > 9) {
          let r = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(sub, 0x85ebca6b);
          r = Math.imul(r ^ (r >>> 15), 0x2c1b3c6d);
          r ^= r >>> 12;
          // moved without momentum: position and previous position shift together
          const jx = (((r & 0xffff) / 32768) - 1) * jig, jy = ((((r >>> 16) & 0xffff) / 32768) - 1) * jig;
          x[i] += jx; px[i] += jx; y[i] += jy; py[i] += jy;
        }
        // the surface estimate drifts down each step and is pulled back up by neighbours
        // a lone droplet is its own surface
        const hd = this.wn[i] ? head[i] + rise : y[i];
        head[i] = hd < y[i] ? hd : y[i];
        this.wn[i] = 0;
      }
    }
  }

  private bucketOf(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }

  private buildHash() {
    const { x, y, alive, bucketStart, entries, nodeBucket } = this;
    const inv = 1 / this.cfg.hash.cell;
    bucketStart.fill(0);
    let total = 0;
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      const b = this.bucketOf(Math.floor(x[i] * inv), Math.floor(y[i] * inv));
      nodeBucket[i] = b;
      bucketStart[b]++;
      total++;
    }
    const size = this.mask + 1;
    for (let b = 1; b < size; b++) bucketStart[b] += bucketStart[b - 1];
    bucketStart[size] = total;
    // fill from the end so each bucket lists nodes in ascending index order;
    // afterwards bucket b spans bucketStart[b] .. bucketStart[b + 1]
    for (let i = this.n - 1; i >= 0; i--) {
      if (!alive[i]) continue;
      entries[--bucketStart[nodeBucket[i]]] = i;
    }
  }

  private solveBonds() {
    const { x, y, ba, bb, brest, bstiff, bamp, bphase, bfreq, bflag, balive, invM } = this;
    const t = this.time;
    for (let k = 0; k < this.bn; k++) {
      if (!balive[k]) continue;
      const a = ba[k], b = bb[k];
      const dx = x[b] - x[a], dy = y[b] - y[a];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-9) continue;
      let rest = brest[k];
      if (bamp[k] !== 0) rest *= 1 + bamp[k] * Math.sin(TAU * bfreq[k] * t + bphase[k]);
      if (bflag[k] & B_TENSION && d <= rest) continue;
      const wa = invM[a], wb = invM[b];
      const c = ((d - rest) / d) * bstiff[k] / (wa + wb);
      x[a] += dx * c * wa; y[a] += dy * c * wa;
      x[b] -= dx * c * wb; y[b] -= dy * c * wb;
    }
  }

  private solveBraces() {
    const { x, y, trA, trC, trS, invM, alive } = this;
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      for (let s = i * 4; s < i * 4 + 4; s++) {
        const a = trA[s];
        if (a < 0) continue;
        const c = trC[s];
        const wa = invM[a], wb = invM[i], wc = invM[c];
        const k = trS[s] / (wa * 0.25 + wc * 0.25 + wb);
        const ex = ((x[a] + x[c]) * 0.5 - x[i]) * k;
        const ey = ((y[a] + y[c]) * 0.5 - y[i]) * k;
        x[i] += ex * wb; y[i] += ey * wb;
        x[a] -= ex * wa * 0.5; y[a] -= ey * wa * 0.5;
        x[c] -= ex * wc * 0.5; y[c] -= ey * wc * 0.5;
      }
    }
  }

  private solveAnchors() {
    const { x, y, ax, ay, anch } = this;
    const s = this.cfg.sticky.anchorStiffness;
    const lim = this.cfg.sticky.anchorBreak;
    for (let i = 0; i < this.n; i++) {
      if (!anch[i]) continue;
      const dx = ax[i] - x[i], dy = ay[i] - y[i];
      if (dx * dx + dy * dy > lim * lim) {
        anch[i] = 0;
        this.stickCd[i] = this.time + this.cfg.sticky.cooldown;
      } else {
        x[i] += dx * s; y[i] += dy * s;
      }
    }
  }

  private solveContacts(h: number) {
    const cfg = this.cfg;
    const { x, y, px, py, rad, invM, mat, alive, bucketStart, entries, accX, accY, head } = this;
    const inv = 1 / cfg.hash.cell;
    const range = cfg.water.range;
    const dragF = Math.min(1, cfg.water.drag * h);
    // pressure per unit depth on one particle's worth of surface, in mass x acceleration
    const pressK = (cfg.gravity / 144) * 7.2 * cfg.water.lift;
    const maxDepth = cfg.water.maxDepth;
    const touch = cfg.water.touch;
    const minSp = cfg.damage.minSpeed * h;
    const sharpK = cfg.damage.sharpScale / h;
    const crushK = cfg.damage.crushScale / h;
    const seen = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      const cx = Math.floor(x[i] * inv), cy = Math.floor(y[i] * inv);
      let ns = 0;
      for (let oy = -1; oy <= 1 && alive[i]; oy++) {
        for (let ox = -1; ox <= 1 && alive[i]; ox++) {
          const b = this.bucketOf(cx + ox, cy + oy);
          let dup = false;
          for (let s = 0; s < ns; s++) if (seen[s] === b) { dup = true; break; }
          if (dup) continue;
          seen[ns++] = b;
          const end = bucketStart[b + 1];
          for (let e = bucketStart[b]; e < end; e++) {
            const j = entries[e];
            if (j <= i || !alive[j]) continue;
            let dx = x[j] - x[i], dy = y[j] - y[i];
            const rs = rad[i] + rad[j];
            const mi = mat[i], mj = mat[j];
            const wi = mi === WATER, wj = mj === WATER;
            const mixed = wi !== wj;
            const reach = mixed ? rs * range : wi ? rs * touch : rs;
            const d2 = dx * dx + dy * dy;
            if (d2 >= reach * reach) continue;
            const im = invM[i], jm = invM[j];
            const wsum = im + jm;
            if (mixed) {
              // rule 6: water pushes on what it touches, harder the deeper it is, and
              // is pushed back equally (so momentum is conserved); plus drag
              const sN = wi ? j : i, wN = wi ? i : j;
              let depth = y[wN] - head[wN];
              if (depth > 0) {
                if (depth > maxDepth) depth = maxDepth;
                const dd = Math.sqrt(d2) || 1e-9;
                const sgn = wi ? 1 : -1; // normal from the water particle to the node
                const F = pressK * depth;
                const fx = (dx / dd) * sgn * F, fy = (dy / dd) * sgn * F;
                accX[sN] += fx * invM[sN]; accY[sN] += fy * invM[sN];
                accX[wN] -= fx * invM[wN]; accY[wN] -= fy * invM[wN];
              }
              const dvx = (x[j] - px[j]) - (x[i] - px[i]);
              const dvy = (y[j] - py[j]) - (y[i] - py[i]);
              const ex = dvx * dragF / wsum, ey = dvy * dragF / wsum;
              px[i] -= ex * im; py[i] -= ey * im;
              px[j] += ex * jm; py[j] += ey * jm;
              if (d2 >= rs * rs) continue;
            } else if (wi) {
              // touching water shares one surface level: the highest point of the body
              if (head[i] < head[j]) head[j] = head[i]; else head[i] = head[j];
              this.wn[i] = 1; this.wn[j] = 1;
              if (d2 >= rs * rs) continue;
            }
            let frictionless = wi || wj;
            if (!wi && !wj) {
              const k = this.findBond(i, j);
              if (k >= 0) {
                if (!(this.bflag[k] & B_TENSION)) continue; // the bond already holds them apart
                frictionless = true;
              } else {
                // rule 8: a heart eats a berry
                if (mi === Mat.Heart && mj === Mat.Berry) { this.eat(i, j); continue; }
                if (mj === Mat.Heart && mi === Mat.Berry) { this.eat(j, i); break; }
                // rule 4: contact damage
                const rvx = (x[j] - px[j]) - (x[i] - px[i]);
                const rvy = (y[j] - py[j]) - (y[i] - py[i]);
                const sp = Math.sqrt(rvx * rvx + rvy * rvy);
                if (sp > minSp) {
                  const d = Math.sqrt(d2) || 1e-9;
                  const vn = -(rvx * dx + rvy * dy) / d;
                  let di = M_SHARP[mj] * sp * sharpK - M_HARD[mi];
                  let dj = M_SHARP[mi] * sp * sharpK - M_HARD[mj];
                  if (vn > 0) {
                    // a node hits with the weight of what is bonded behind it
                    const J = (vn / (1 / this.clusterMass(i) + 1 / this.clusterMass(j))) * crushK;
                    if (J - M_HARD[mi] > di) di = J - M_HARD[mi];
                    if (J - M_HARD[mj] > dj) dj = J - M_HARD[mj];
                  }
                  if (dj > 0) this.damage(j, dj);
                  if (di > 0) this.damage(i, di);
                  if (!alive[i]) break;
                  if (!alive[j]) continue;
                }
                // rule 5: sticky nodes bond to what they touch
                if (M_STICK[mi] > 0 || M_STICK[mj] > 0) {
                  const d = Math.sqrt(d2);
                  if (M_STICK[mi] > this.stickN[i] && this.stickCd[i] <= this.time) {
                    if (this.addBond(i, j, d, { flags: B_STICKY }) >= 0) { this.stickN[i]++; continue; }
                  } else if (M_STICK[mj] > this.stickN[j] && this.stickCd[j] <= this.time) {
                    if (this.addBond(j, i, d, { flags: B_STICKY }) >= 0) { this.stickN[j]++; continue; }
                  }
                }
              }
            }
            // rule 2: circles collide, with friction
            let d = Math.sqrt(d2);
            if (d < 1e-9) { dx = 0; dy = -1; d = 1e-9; } else { dx /= d; dy /= d; }
            const pen = rs - d;
            const ci = (pen * im) / wsum, cj = (pen * jm) / wsum;
            x[i] -= dx * ci; y[i] -= dy * ci;
            x[j] += dx * cj; y[j] += dy * cj;
            if (!frictionless) {
              const mu = Math.sqrt(M_FRIC[mi] * M_FRIC[mj]);
              const tx = -dy, ty = dx;
              const rt = ((x[j] - px[j]) - (x[i] - px[i])) * tx + ((y[j] - py[j]) - (y[i] - py[i])) * ty;
              const lim = mu * pen;
              const c = (rt > lim ? lim : rt < -lim ? -lim : rt) / wsum;
              x[i] += tx * c * im; y[i] += ty * c * im;
              x[j] -= tx * c * jm; y[j] -= ty * c * jm;
            }
          }
        }
      }
    }
  }

  private eat(heart: number, berry: number) {
    this.removeNode(berry);
    this.berriesEaten++;
    const b = this.body[heart];
    if (b >= 0) this.bodyEaten[b]++;
  }

  private solveTerrain() {
    const { x, y, px, py, rad, mat, alive, anch } = this;
    const ter = this.terrain;
    const W = ter.width;
    const floor = this.cfg.world.height + 300;
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      const r = rad[i];
      if (x[i] < r) x[i] = r;
      else if (x[i] > W - r) x[i] = W - r;
      const hx = ter.heightAt(x[i]);
      if (y[i] + r * 2.5 < hx) continue;
      if (y[i] > floor) { this.removeNode(i); continue; }
      const m = ter.slopeAt(x[i]);
      const il = 1 / Math.sqrt(1 + m * m);
      const pen = r - (hx - y[i]) * il;
      if (pen <= 0) continue;
      const nx = m * il, ny = -il;
      x[i] += nx * pen; y[i] += ny * pen;
      const mi = mat[i];
      const mu = M_FRIC[mi];
      if (mu > 0) {
        const tx = il, ty = m * il;
        const vt = (x[i] - px[i]) * tx + (y[i] - py[i]) * ty;
        const lim = mu * pen;
        const c = vt > lim ? lim : vt < -lim ? -lim : vt;
        x[i] -= tx * c; y[i] -= ty * c;
      }
      if (M_STICK[mi] > 0 && !anch[i] && this.stickCd[i] <= this.time) {
        anch[i] = 1; this.ax[i] = x[i]; this.ay[i] = y[i];
      }
    }
  }

  /** rule 3: a bond breaks when stretched past its limit */
  private breakBonds() {
    const { x, y, ba, bb, brest, blimit, bamp, bphase, bfreq, balive } = this;
    for (let k = 0; k < this.bn; k++) {
      if (!balive[k]) continue;
      const dx = x[bb[k]] - x[ba[k]], dy = y[bb[k]] - y[ba[k]];
      let rest = brest[k];
      if (bamp[k] !== 0) rest *= 1 + bamp[k] * Math.sin(TAU * bfreq[k] * this.time + bphase[k]);
      const lim = rest * (1 + blimit[k]);
      if (dx * dx + dy * dy > lim * lim) this.removeBond(k);
    }
  }

  // ---------------------------------------------------------------- utility

  clone(terrain: Terrain = this.terrain): World {
    const w = new World(terrain, this.cfg, this.cap, this.bcap);
    const self = this as any, o = w as any;
    for (const k of [...NODE_F64, 'hp', 'mat', 'alive', 'anch', 'stickN', 'adjN', 'wn', 'body', 'adj',
      'ba', 'bb', 'brest', 'trA', 'trC', 'trS', ...BOND_F32, 'bflag', 'balive']) o[k].set(self[k]);
    w.n = this.n; w.bn = this.bn;
    w.freeNodes = this.freeNodes.slice(); w.freeBonds = this.freeBonds.slice();
    w.tick = this.tick; w.subTick = this.subTick; w.time = this.time; w.nextBody = this.nextBody;
    w.bodyKind = this.bodyKind.slice(); w.bodyDamage = this.bodyDamage.slice();
    w.bodyEaten = this.bodyEaten.slice(); w.bodyHeart = this.bodyHeart.slice();
    w.berriesEaten = this.berriesEaten;
    return w;
  }

  /** Everything needed to rebuild this world (typed arrays are copied, trimmed to what is in use). */
  snapshot(): WorldSnapshot {
    const self = this as any;
    const nodes: Record<string, ArrayLike<number>> = {};
    for (const k of SNAP_NODE) nodes[k] = self[k].slice(0, this.n * (k === 'adj' ? ADJ : k.startsWith('tr') ? 4 : 1));
    const bonds: Record<string, ArrayLike<number>> = {};
    for (const k of SNAP_BOND) bonds[k] = self[k].slice(0, this.bn);
    return {
      n: this.n, bn: this.bn, nodes, bonds,
      freeNodes: this.freeNodes.slice(), freeBonds: this.freeBonds.slice(),
      tick: this.tick, subTick: this.subTick, time: this.time, nextBody: this.nextBody,
      bodyKind: this.bodyKind.slice(), bodyDamage: this.bodyDamage.slice(),
      bodyEaten: this.bodyEaten.slice(), bodyHeart: this.bodyHeart.slice(), berriesEaten: this.berriesEaten,
    };
  }

  static restore(s: WorldSnapshot, terrain: Terrain, cfg: Config = CONFIG): World {
    let cap = 256, bcap = 512;
    while (cap < s.n + 64) cap *= 2;
    while (bcap < s.bn + 128) bcap *= 2;
    const w = new World(terrain, cfg, cap, bcap);
    const o = w as any;
    for (const k of SNAP_NODE) o[k].set(s.nodes[k]);
    for (const k of SNAP_BOND) o[k].set(s.bonds[k]);
    // slots beyond n must read as "no brace"
    w.trA.fill(-1, s.n * 4);
    w.n = s.n; w.bn = s.bn;
    w.freeNodes = s.freeNodes.slice(); w.freeBonds = s.freeBonds.slice();
    w.tick = s.tick; w.subTick = s.subTick; w.time = s.time; w.nextBody = s.nextBody;
    w.bodyKind = s.bodyKind.slice(); w.bodyDamage = s.bodyDamage.slice();
    w.bodyEaten = s.bodyEaten.slice(); w.bodyHeart = s.bodyHeart.slice(); w.berriesEaten = s.berriesEaten;
    return w;
  }

  /**
   * A new world holding only the nodes with x in [x0, x1] (and the bonds,
   * braces and anchors among them). Used to cut an arena out of the live
   * world so overnight trials do not pay for the pond.
   */
  extract(x0: number, x1: number): World {
    const w = new World(this.terrain, this.cfg, 512, 2048);
    const map = new Int32Array(this.n).fill(-1);
    w.time = this.time; w.tick = this.tick; w.subTick = this.subTick;
    w.nextBody = this.nextBody;
    w.bodyKind = this.bodyKind.slice(); w.bodyDamage = this.bodyDamage.slice();
    w.bodyEaten = this.bodyEaten.slice(); w.bodyHeart = this.bodyHeart.map(() => -1);
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || this.x[i] < x0 || this.x[i] > x1) continue;
      const j = w.addNode(this.mat[i], this.x[i], this.y[i], this.body[i], this.rad[i]);
      map[i] = j;
      w.px[j] = this.px[i]; w.py[j] = this.py[i];
      w.hp[j] = this.hp[i]; w.head[j] = this.head[i]; w.wn[j] = this.wn[i];
      w.anch[j] = this.anch[i]; w.ax[j] = this.ax[i]; w.ay[j] = this.ay[i];
      w.stickCd[j] = this.stickCd[i]; w.hurtCd[j] = this.hurtCd[i];
    }
    for (let k = 0; k < this.bn; k++) {
      if (!this.balive[k]) continue;
      const a = map[this.ba[k]], b = map[this.bb[k]];
      if (a < 0 || b < 0) continue;
      const nk = w.addBond(a, b, this.brest[k], {
        flags: this.bflag[k], stiffness: this.bstiff[k], limit: this.blimit[k],
        amp: this.bamp[k], phase: this.bphase[k], freq: this.bfreq[k],
      });
      if (nk >= 0 && this.bflag[k] & B_STICKY) w.stickN[a]++;
    }
    for (let i = 0; i < this.n; i++) {
      const j = map[i];
      if (j < 0) continue;
      for (let s = 0; s < 4; s++) {
        const a = this.trA[i * 4 + s];
        if (a < 0) continue;
        const c = this.trC[i * 4 + s];
        if (map[a] >= 0 && map[c] >= 0) w.addBrace(map[a], j, map[c], this.trS[i * 4 + s]);
      }
    }
    return w;
  }

  /** FNV-1a over positions of live nodes; used by the determinism test */
  stateHash(): string {
    let hsh = 0x811c9dc5;
    const view = new DataView(new ArrayBuffer(8));
    const feed = (v: number) => {
      view.setFloat64(0, v);
      for (let b = 0; b < 8; b++) hsh = Math.imul(hsh ^ view.getUint8(b), 0x01000193);
    };
    feed(this.tick);
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      feed(i); feed(this.x[i]); feed(this.y[i]); feed(this.hp[i]);
    }
    for (let k = 0; k < this.bn; k++) if (this.balive[k]) feed(k);
    return (hsh >>> 0).toString(16);
  }

  count(mat: number): number {
    let c = 0;
    for (let i = 0; i < this.n; i++) if (this.alive[i] && this.mat[i] === mat) c++;
    return c;
  }

  get liveNodes(): number {
    return this.n - this.freeNodes.length;
  }
}
