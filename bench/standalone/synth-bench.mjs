// CPU benchmark for the swim-test workload.
// Usage: node bench/bench.mjs [trials] [threads]
//   trials  default 4000
//   threads default: every core. The one-thread number is always measured too.
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
// Universe: a minimal off-grid atom simulator.
// Deterministic: only + - * / sqrt abs round are used in the step, so the same seed gives the same
// run in Node and in any browser. No dependencies.
//
// Atoms are unit-diameter discs in 2D still water. Everything an atom "is" comes from a rule set:
//   per type : mass, drag, valence (how many bonds), recharge (energy gained per time unit)
//   per pair : attraction/repulsion strength and range
//   per pair : bond rule (can bond, form distance, rest length, stiffness, snap strain,
//              lifetime, energy cost to form, kick released on break)
//   global   : linear drag g1, quadratic drag g2, shadow (drag shielding by neighbours),
//              bond damping, temperature, non-reciprocity
// Forces conserve momentum (unless nonrecip > 0), so anything that swims must push on the water.

const KCORE = 120;      // hard-core stiffness
const SH0 = 1.2, SH1 = 1.8; // shadow weight: 1 below SH0, falls to 0 at SH1
const MAXV = 6;         // max bonds per atom
const VCAP = 60;        // speed cap (hits are counted; a valid run has none)

function rng32(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class World {
  // opts: { cap, boundary: 'open' | 'periodic' | 'box', W, H, seed, T (overrides rules.T) }
  constructor(rules, opts = {}) {
    this.rules = rules;
    const K = this.K = rules.K;
    this.dt = rules.dt || 0.02;
    this.boundary = opts.boundary || 'open';
    this.W = opts.W || 40; this.H = opts.H || 40;
    this.T = opts.T !== undefined ? opts.T : (rules.T || 0);
    this.rand = rng32(opts.seed === undefined ? 1 : opts.seed);
    const cap = this.cap = opts.cap || 256;
    this.n = 0;
    this.x = new Float64Array(cap); this.y = new Float64Array(cap);
    this.vx = new Float64Array(cap); this.vy = new Float64Array(cap);
    this.fx = new Float64Array(cap); this.fy = new Float64Array(cap);
    this.e = new Float64Array(cap);
    this.sw = new Float64Array(cap); this.sxx = new Float64Array(cap);
    this.sxy = new Float64Array(cap); this.syy = new Float64Array(cap);
    this.type = new Uint8Array(cap);
    this.nb = new Uint8Array(cap);
    this.slots = new Int32Array(cap * MAXV);
    const capB = this.capB = cap * MAXV / 2;
    this.ba = new Int32Array(capB); this.bb = new Int32Array(capB);
    this.bage = new Float64Array(capB);
    this.nbonds = 0;
    this.time = 0; this.steps = 0;
    this.stat = { formed: 0, expired: 0, snapped: 0, capHits: 0, energyUsed: 0 };
    this.formedBy = new Int32Array(K * K); // bond formations per type pair
    // compile rules
    this.mass = new Float64Array(K); this.drag = new Float64Array(K);
    this.val = new Uint8Array(K); this.recharge = new Float64Array(K);
    for (let t = 0; t < K; t++) {
      const ty = rules.types[t];
      this.mass[t] = ty.m; this.drag[t] = ty.drag;
      this.val[t] = Math.min(MAXV, ty.val); this.recharge[t] = ty.recharge || 0;
    }
    const KK = K * K;
    this.A = new Float64Array(KK); this.R = new Float64Array(KK);
    this.bon = new Uint8Array(KK); this.bform = new Float64Array(KK); this.br0 = new Float64Array(KK);
    this.bk = new Float64Array(KK); this.bsnap = new Float64Array(KK); this.blife = new Float64Array(KK);
    this.bcost = new Float64Array(KK); this.bkick = new Float64Array(KK);
    let rmax = SH1;
    const nr = rules.nonrecip || 0;
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
      const q = i * K + j, p = rules.pair[i][j], ps = rules.pair[j][i];
      // symmetric part plus (optionally) a non-reciprocal part
      this.A[q] = 0.5 * (p.a + ps.a) + nr * 0.5 * (p.a - ps.a);
      this.R[q] = Math.max(p.R, ps.R);
      if (this.R[q] > rmax) rmax = this.R[q];
      const lo = i < j ? i : j, hi = i < j ? j : i;
      const b = rules.bond[lo][hi];
      this.bon[q] = b.on ? 1 : 0; this.bform[q] = b.form; this.br0[q] = b.r0; this.bk[q] = b.k;
      this.bsnap[q] = b.snap; this.blife[q] = b.life || 0; this.bkick[q] = b.kick || 0;
      // Energy is conserved: a bond that forms stretched (form > r0) injects spring energy, and a kick
      // stores energy until the bond breaks. Both atoms pay half of that from their own store (0..1);
      // eUnit is how much mechanical energy one full store holds.
      const st = b.form > b.r0 ? b.form - b.r0 : 0, kk = b.kick || 0;
      const mech = 0.5 * b.k * st * st + 0.5 * kk * kk * (1 / rules.types[i].m + 1 / rules.types[j].m);
      this.bcost[q] = 0.5 * mech / (rules.eUnit || 50);
      if (b.on && b.form > rmax) rmax = b.form;
    }
    this.rmax = rmax; this.rmax2 = rmax * rmax;
    this.g1 = rules.g1; this.g2 = rules.g2 || 0; this.shadow = rules.shadow || 0;
    this.bdamp = rules.bdamp || 0;
    if (this.boundary !== 'open') {
      this.nx = Math.max(3, Math.floor(this.W / rmax)); this.ny = Math.max(3, Math.floor(this.H / rmax));
      this.cw = this.W / this.nx; this.ch = this.H / this.ny;
      this.head = new Int32Array(this.nx * this.ny); this.next = new Int32Array(cap);
    }
  }

  add(t, x, y, vx = 0, vy = 0) {
    const i = this.n++;
    if (i >= this.cap) throw new Error('world full');
    this.type[i] = t; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.e[i] = 1; this.nb[i] = 0;
    return i;
  }

  bonded(i, j) {
    const s = this.slots, o = i * MAXV, c = this.nb[i];
    for (let k = 0; k < c; k++) if (s[o + k] === j) return true;
    return false;
  }

  addBond(i, j) {
    const b = this.nbonds++;
    this.ba[b] = i; this.bb[b] = j; this.bage[b] = 0;
    this.slots[i * MAXV + this.nb[i]++] = j;
    this.slots[j * MAXV + this.nb[j]++] = i;
  }

  _unslot(i, j) {
    const s = this.slots, o = i * MAXV, c = this.nb[i];
    for (let k = 0; k < c; k++) if (s[o + k] === j) { s[o + k] = s[o + c - 1]; this.nb[i] = c - 1; return; }
  }

  removeBond(b) {
    const i = this.ba[b], j = this.bb[b];
    this._unslot(i, j); this._unslot(j, i);
    const l = --this.nbonds;
    this.ba[b] = this.ba[l]; this.bb[b] = this.bb[l]; this.bage[b] = this.bage[l];
  }

  // remove atom i (swap with last). Used by viewers, not by the search.
  removeAtom(i) {
    for (let b = this.nbonds - 1; b >= 0; b--) if (this.ba[b] === i || this.bb[b] === i) this.removeBond(b);
    const l = --this.n;
    if (i === l) return;
    this.type[i] = this.type[l]; this.x[i] = this.x[l]; this.y[i] = this.y[l];
    this.vx[i] = this.vx[l]; this.vy[i] = this.vy[l]; this.e[i] = this.e[l];
    this.nb[i] = this.nb[l];
    for (let k = 0; k < MAXV; k++) this.slots[i * MAXV + k] = this.slots[l * MAXV + k];
    this.nb[l] = 0;
    for (let b = 0; b < this.nbonds; b++) { if (this.ba[b] === l) this.ba[b] = i; if (this.bb[b] === l) this.bb[b] = i; }
    for (let k = 0; k < this.nb[i]; k++) {
      const p = this.slots[i * MAXV + k], o = p * MAXV;
      for (let q = 0; q < this.nb[p]; q++) if (this.slots[o + q] === l) this.slots[o + q] = i;
    }
  }

  _pair(i, j, dx, dy, r2) {
    const K = this.K, ti = this.type[i], tj = this.type[j], q = ti * K + tj;
    const r = Math.sqrt(r2);
    if (r < 1e-9) return;
    const ux = dx / r, uy = dy / r;
    if (r < 1) {
      const f = KCORE * (1 - r);
      this.fx[i] -= f * ux; this.fy[i] -= f * uy; this.fx[j] += f * ux; this.fy[j] += f * uy;
    } else {
      const R = this.R[q];
      if (r < R) {
        const s = 1 - Math.abs(2 * r - 1 - R) / (R - 1);
        const fi = this.A[q] * s, fj = this.A[tj * K + ti] * s;
        this.fx[i] += fi * ux; this.fy[i] += fi * uy; this.fx[j] -= fj * ux; this.fy[j] -= fj * uy;
      }
    }
    if (this.shadow > 0 && r < SH1) {
      const w = r < SH0 ? 1 : (SH1 - r) / (SH1 - SH0);
      const xx = w * ux * ux, xy = w * ux * uy, yy = w * uy * uy;
      this.sw[i] += w; this.sxx[i] += xx; this.sxy[i] += xy; this.syy[i] += yy;
      this.sw[j] += w; this.sxx[j] += xx; this.sxy[j] += xy; this.syy[j] += yy;
    }
    if (this.bon[q] && r < this.bform[q] && this.nb[i] < this.val[ti] && this.nb[j] < this.val[tj]) {
      const c = this.bcost[q];
      if (this.e[i] >= c && this.e[j] >= c && !this.bonded(i, j)) {
        this.e[i] -= c; this.e[j] -= c;
        this.addBond(i, j);
        this.stat.formed++; this.stat.energyUsed += 2 * c; this.formedBy[q]++;
      }
    }
  }

  step() {
    const n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, fx = this.fx, fy = this.fy;
    const dt = this.dt, type = this.type;
    fx.fill(0, 0, n); fy.fill(0, 0, n);
    if (this.shadow > 0) { this.sw.fill(0, 0, n); this.sxx.fill(0, 0, n); this.sxy.fill(0, 0, n); this.syy.fill(0, 0, n); }
    const rmax2 = this.rmax2;
    if (this.boundary === 'open') {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = x[j] - x[i], dy = y[j] - y[i], r2 = dx * dx + dy * dy;
        if (r2 < rmax2) this._pair(i, j, dx, dy, r2);
      }
    } else {
      const per = this.boundary === 'periodic';
      const nx = this.nx, ny = this.ny, W = this.W, H = this.H, head = this.head, next = this.next;
      head.fill(-1);
      for (let i = n - 1; i >= 0; i--) {
        let cx, cy;
        if (per) {
          let px = x[i] - W * Math.floor(x[i] / W), py = y[i] - H * Math.floor(y[i] / H);
          cx = Math.floor(px / this.cw); cy = Math.floor(py / this.ch);
          if (cx >= nx) cx = nx - 1; if (cy >= ny) cy = ny - 1;
        } else {
          cx = Math.floor(x[i] / this.cw); cy = Math.floor(y[i] / this.ch);
          if (cx < 0) cx = 0; else if (cx >= nx) cx = nx - 1;
          if (cy < 0) cy = 0; else if (cy >= ny) cy = ny - 1;
        }
        const c = cy * nx + cx;
        next[i] = head[c]; head[c] = i;
      }
      for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
        const c = cy * nx + cx;
        for (let i = head[c]; i >= 0; i = next[i]) {
          for (let j = next[i]; j >= 0; j = next[j]) {
            let dx = x[j] - x[i], dy = y[j] - y[i];
            if (per) { dx -= W * Math.round(dx / W); dy -= H * Math.round(dy / H); }
            const r2 = dx * dx + dy * dy;
            if (r2 < rmax2) this._pair(i, j, dx, dy, r2);
          }
          for (let s = 0; s < 4; s++) {
            let ox = s === 0 ? 1 : s - 2, oy = s === 0 ? 0 : 1;
            let c2x = cx + ox, c2y = cy + oy;
            if (per) { c2x = (c2x + nx) % nx; c2y = (c2y + ny) % ny; }
            else if (c2x < 0 || c2x >= nx || c2y >= ny) continue;
            for (let j = head[c2y * nx + c2x]; j >= 0; j = next[j]) {
              let dx = x[j] - x[i], dy = y[j] - y[i];
              if (per) { dx -= W * Math.round(dx / W); dy -= H * Math.round(dy / H); }
              const r2 = dx * dx + dy * dy;
              if (r2 < rmax2) this._pair(i, j, dx, dy, r2);
            }
          }
        }
      }
    }
    // bonds
    const K = this.K, per = this.boundary === 'periodic', bd = this.bdamp;
    for (let b = this.nbonds - 1; b >= 0; b--) {
      const i = this.ba[b], j = this.bb[b], q = type[i] * K + type[j];
      let dx = x[j] - x[i], dy = y[j] - y[i];
      if (per) { dx -= this.W * Math.round(dx / this.W); dy -= this.H * Math.round(dy / this.H); }
      const r = Math.sqrt(dx * dx + dy * dy) || 1e-9, ux = dx / r, uy = dy / r;
      const age = (this.bage[b] += dt), life = this.blife[q], r0 = this.br0[q];
      const expired = life > 0 && age > life, snapped = r > r0 * (1 + this.bsnap[q]);
      if (expired || snapped) {
        const kick = this.bkick[q];
        if (kick > 0) {
          const f = kick / dt;
          fx[i] -= f * ux; fy[i] -= f * uy; fx[j] += f * ux; fy[j] += f * uy;
        }
        if (expired) this.stat.expired++; else this.stat.snapped++;
        this.removeBond(b);
        continue;
      }
      let f = this.bk[q] * (r - r0);
      if (bd > 0) f += bd * ((vx[j] - vx[i]) * ux + (vy[j] - vy[i]) * uy);
      fx[i] += f * ux; fy[i] += f * uy; fx[j] -= f * ux; fy[j] -= f * uy;
    }
    // integrate
    const g1 = this.g1, g2 = this.g2, sh = this.shadow, T = this.T, rand = this.rand;
    for (let i = 0; i < n; i++) {
      const t = type[i], m = this.mass[t], g = g1 * this.drag[t];
      let ax = fx[i] / m, ay = fy[i] / m;
      let u = vx[i], v = vy[i];
      // linear drag, shielded along directions where neighbours sit
      let dxv = u, dyv = v;
      if (sh > 0 && this.sw[i] > 0) {
        const c = sh / (this.sw[i] > 1 ? this.sw[i] : 1);
        dxv = u - c * (this.sxx[i] * u + this.sxy[i] * v);
        dyv = v - c * (this.sxy[i] * u + this.syy[i] * v);
      }
      ax -= g * dxv / m; ay -= g * dyv / m;
      u += ax * dt; v += ay * dt;
      if (T > 0) {
        const amp = Math.sqrt(6 * g * T * dt) / m; // uniform noise with the variance of 2 g T dt
        u += amp * (2 * rand() - 1); v += amp * (2 * rand() - 1);
      }
      if (g2 > 0) {
        const sp = Math.sqrt(u * u + v * v), k = 1 / (1 + g2 * this.drag[t] * sp * dt / m);
        u *= k; v *= k;
      }
      const s2 = u * u + v * v;
      if (s2 > VCAP * VCAP) { const k = VCAP / Math.sqrt(s2); u *= k; v *= k; this.stat.capHits++; }
      vx[i] = u; vy[i] = v;
      x[i] += u * dt; y[i] += v * dt;
      const ne = this.e[i] + this.recharge[t] * dt;
      this.e[i] = ne > 1 ? 1 : ne;
    }
    if (this.boundary === 'box') {
      const W = this.W, H = this.H;
      for (let i = 0; i < n; i++) {
        if (x[i] < 0.5) { x[i] = 0.5; if (vx[i] < 0) vx[i] = -0.5 * vx[i]; }
        else if (x[i] > W - 0.5) { x[i] = W - 0.5; if (vx[i] > 0) vx[i] = -0.5 * vx[i]; }
        if (y[i] < 0.5) { y[i] = 0.5; if (vy[i] < 0) vy[i] = -0.5 * vy[i]; }
        else if (y[i] > H - 0.5) { y[i] = H - 0.5; if (vy[i] > 0) vy[i] = -0.5 * vy[i]; }
      }
    }
    this.time += dt; this.steps++;
  }

  // FNV-style hash of the state, for determinism checks
  hash() {
    let h = 2166136261 >>> 0;
    const f = new Float64Array(1), u = new Uint32Array(f.buffer);
    for (let i = 0; i < this.n; i++) {
      f[0] = this.x[i]; h = Math.imul(h ^ u[0], 16777619); h = Math.imul(h ^ u[1], 16777619);
      f[0] = this.y[i]; h = Math.imul(h ^ u[0], 16777619); h = Math.imul(h ^ u[1], 16777619);
    }
    return (h ^ this.nbonds) >>> 0;
  }
}

// Rule sets ("universes") and organisms (initial atom placements): sampling and mutation.

const lerp = (a, b, u) => a + (b - a) * u;
const logu = (a, b, u) => Math.exp(lerp(Math.log(a), Math.log(b), u));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function gauss(r) { return (r() + r() + r() + r() - 2) * 1.732; }

const RANGE = {
  m: [0.5, 3], drag: [0.3, 3], recharge: [0.02, 2],
  a: [-4, 4], R: [1.5, 3.5],
  r0: [0.8, 2], formRatio: [0.9, 1.8], k: [5, 150], snap: [0.2, 2], life: [0.2, 8], kick: [0.2, 6],
  g1: [0.2, 4], g2: [0.05, 1.5], shadow: [0.2, 0.95], bdamp: [0, 3], T: [0, 0.3], eUnit: [10, 400],
};

function randomBond(r) {
  const r0 = lerp(...RANGE.r0, r());
  return {
    on: r() < 0.5 ? 1 : 0, r0, form: r0 * lerp(...RANGE.formRatio, r()),
    k: logu(...RANGE.k, r()), snap: lerp(...RANGE.snap, r()),
    life: r() < 0.5 ? 0 : logu(...RANGE.life, r()),
    kick: r() < 0.6 ? 0 : logu(...RANGE.kick, r()),
  };
}
function randomType(r) {
  return { m: logu(...RANGE.m, r()), drag: logu(...RANGE.drag, r()), val: Math.floor(r() * 7), recharge: r() < 0.25 ? 0 : logu(...RANGE.recharge, r()) };
}
function randomPair(r) { return { a: r() < 0.2 ? 0 : lerp(...RANGE.a, r()), R: lerp(...RANGE.R, r()) }; }

// opts: { K, medium: 'any' | 'linear' | 'quad' | 'shadow' | 'both', bonds: true/false, nonrecip }
function randomRules(r, opts = {}) {
  const K = opts.K || 1 + Math.floor(r() * 6);
  const med = opts.medium || 'any';
  const types = [], pair = [], bond = [];
  for (let i = 0; i < K; i++) types.push(randomType(r));
  for (let i = 0; i < K; i++) { pair.push([]); bond.push([]); }
  for (let i = 0; i < K; i++) for (let j = i; j < K; j++) {
    const p = randomPair(r);
    pair[i][j] = p; pair[j][i] = opts.nonrecip ? randomPair(r) : { ...p };
    pair[j][i].R = p.R;
    const b = randomBond(r);
    if (opts.bonds === false) b.on = 0;
    bond[i][j] = b; if (i !== j) bond[j][i] = null;
  }
  let g2 = r() < 0.5 ? 0 : logu(...RANGE.g2, r());
  let shadow = r() < 0.5 ? 0 : lerp(...RANGE.shadow, r());
  if (med === 'linear') { g2 = 0; shadow = 0; }
  if (med === 'quad') { g2 = logu(...RANGE.g2, r()); shadow = 0; }
  if (med === 'shadow') { g2 = 0; shadow = lerp(...RANGE.shadow, r()); }
  if (med === 'both') { g2 = logu(...RANGE.g2, r()); shadow = lerp(...RANGE.shadow, r()); }
  return {
    K, dt: 0.02, types, pair, bond,
    g1: logu(...RANGE.g1, r()), g2, shadow, bdamp: lerp(...RANGE.bdamp, r()),
    T: r() < 0.3 ? 0 : lerp(...RANGE.T, r()), nonrecip: opts.nonrecip || 0, eUnit: logu(...RANGE.eUnit, r()),
  };
}

// Add one more atom type to a rule set (in place). init can override fields of the new type's self bond.
function addType(r, R, type, selfBond) {
  const K = R.K; R.types.push({ ...randomType(r), ...type });
  for (let i = 0; i < K; i++) {
    const p = randomPair(r); R.pair[i][K] = p; R.bond[i][K] = randomBond(r);
  }
  R.pair[K] = []; R.bond[K] = [];
  for (let i = 0; i < K; i++) { R.pair[K][i] = { ...R.pair[i][K] }; R.bond[K][i] = null; }
  R.pair[K][K] = randomPair(r); R.bond[K][K] = { ...randomBond(r), ...selfBond };
  R.K = K + 1; return K;
}
function ring(t, n, spacing, cx = 0, cy = 0) {
  const rad = n * spacing / 6.283185307, out = [];
  for (let i = 0; i < n; i++) out.push({ t, x: cx + rad * Math.cos(6.283185307 * i / n), y: cy + rad * Math.sin(6.283185307 * i / n) });
  return out;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

function mutNum(r, v, range, log, strength) {
  if (log) return clamp(Math.exp(Math.log(v) + gauss(r) * strength * Math.log(range[1] / range[0])), range[0], range[1]);
  return clamp(v + gauss(r) * strength * (range[1] - range[0]), range[0], range[1]);
}

// Mutate a rule set in place. lock: { medium: true } keeps g2/shadow zero-ness fixed.
function mutateRules(r, R, rate = 0.15, strength = 0.15, lock = {}) {
  const K = R.K;
  for (let i = 0; i < K; i++) {
    const t = R.types[i];
    if (r() < rate) t.m = mutNum(r, t.m, RANGE.m, true, strength);
    if (r() < rate) t.drag = mutNum(r, t.drag, RANGE.drag, true, strength);
    if (r() < rate * 0.5) t.val = clamp(t.val + (r() < 0.5 ? -1 : 1), 0, 6);
    if (r() < rate) t.recharge = t.recharge === 0 ? (r() < 0.3 ? RANGE.recharge[0] * 5 : 0) : (r() < 0.05 ? 0 : mutNum(r, t.recharge, RANGE.recharge, true, strength));
  }
  for (let i = 0; i < K; i++) for (let j = i; j < K; j++) {
    const p = R.pair[i][j];
    if (r() < rate) { p.a = r() < 0.05 ? 0 : mutNum(r, p.a, RANGE.a, false, strength); if (!R.nonrecip) R.pair[j][i].a = p.a; }
    if (R.nonrecip && r() < rate) R.pair[j][i].a = mutNum(r, R.pair[j][i].a, RANGE.a, false, strength);
    if (r() < rate) { p.R = mutNum(r, p.R, RANGE.R, false, strength); R.pair[j][i].R = p.R; }
    const b = R.bond[i][j];
    if (!lock.bonds && r() < rate * 0.3) b.on = b.on ? 0 : 1;
    if (r() < rate) { const ratio = b.form / b.r0; b.r0 = mutNum(r, b.r0, RANGE.r0, false, strength); b.form = b.r0 * ratio; }
    if (r() < rate) b.form = b.r0 * mutNum(r, b.form / b.r0, RANGE.formRatio, false, strength);
    if (r() < rate) b.k = mutNum(r, b.k, RANGE.k, true, strength);
    if (r() < rate) b.snap = mutNum(r, b.snap, RANGE.snap, false, strength);
    if (r() < rate) b.life = b.life === 0 ? (r() < 0.3 ? logu(...RANGE.life, r()) : 0) : (r() < 0.07 ? 0 : mutNum(r, b.life, RANGE.life, true, strength));
    if (r() < rate) b.kick = b.kick === 0 ? (r() < 0.2 ? logu(...RANGE.kick, r()) : 0) : (r() < 0.07 ? 0 : mutNum(r, b.kick, RANGE.kick, true, strength));
  }
  if (r() < rate) R.g1 = mutNum(r, R.g1, RANGE.g1, true, strength);
  if (r() < rate) R.eUnit = mutNum(r, R.eUnit, RANGE.eUnit, true, strength);
  if (r() < rate) R.bdamp = mutNum(r, R.bdamp, RANGE.bdamp, false, strength);
  if (!lock.medium) {
    if (r() < rate) R.g2 = R.g2 === 0 ? (r() < 0.2 ? logu(...RANGE.g2, r()) : 0) : (r() < 0.05 ? 0 : mutNum(r, R.g2, RANGE.g2, true, strength));
    if (r() < rate) R.shadow = R.shadow === 0 ? (r() < 0.2 ? lerp(...RANGE.shadow, r()) : 0) : (r() < 0.05 ? 0 : mutNum(r, R.shadow, RANGE.shadow, false, strength));
  } else {
    if (R.g2 > 0 && r() < rate) R.g2 = mutNum(r, R.g2, RANGE.g2, true, strength);
    if (R.shadow > 0 && r() < rate) R.shadow = mutNum(r, R.shadow, RANGE.shadow, false, strength);
  }
  return R;
}

// An organism is nothing but a placement: [{t, x, y}, ...]. The rules decide which bonds form.
function randomOrganism(r, K, nMin = 3, nMax = 16) {
  const n = nMin + Math.floor(r() * (nMax - nMin + 1));
  const atoms = [{ t: Math.floor(r() * K), x: 0, y: 0 }];
  while (atoms.length < n) growAtom(r, atoms, K);
  return atoms;
}
function growAtom(r, atoms, K) {
  for (let tries = 0; tries < 20; tries++) {
    const p = atoms[Math.floor(r() * atoms.length)];
    const ang = r() * 6.283185307, d = lerp(0.95, 1.7, r());
    const x = p.x + d * Math.cos(ang), y = p.y + d * Math.sin(ang);
    let ok = true;
    for (const q of atoms) if ((q.x - x) ** 2 + (q.y - y) ** 2 < 0.8) { ok = false; break; }
    if (ok) { atoms.push({ t: r() < 0.5 ? p.t : Math.floor(r() * K), x, y }); return true; }
  }
  return false;
}
function mutateOrganism(r, atoms, K, nMax = 24) {
  const u = r();
  if (u < 0.35) { for (const a of atoms) if (r() < 0.3) { a.x += gauss(r) * 0.12; a.y += gauss(r) * 0.12; } }
  else if (u < 0.55 && atoms.length < nMax) growAtom(r, atoms, K);
  else if (u < 0.7 && atoms.length > 2) atoms.splice(Math.floor(r() * atoms.length), 1);
  else if (u < 0.85) atoms[Math.floor(r() * atoms.length)].t = Math.floor(r() * K);
  else if (u < 0.93) { const a = atoms[Math.floor(r() * atoms.length)]; a.x += gauss(r) * 0.5; a.y += gauss(r) * 0.5; }
  else if (atoms.length * 2 <= nMax) { // duplicate the whole body, shifted: repeats a working part
    let w = 0; for (const a of atoms) w = Math.max(w, a.x);
    let lo = 0; for (const a of atoms) lo = Math.min(lo, a.x);
    const sh = w - lo + 1.1; const copy = atoms.map(a => ({ t: a.t, x: a.x + sh, y: a.y }));
    atoms.push(...copy);
  }
  return atoms;
}

// Measurements. Everything here is a number computed from a run, so "interesting" is testable.

// Connected components by bond or by proximity (r < prox). Returns { comp[], sizes[], count }.
function components(w, prox = 1.5) {
  const n = w.n, parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let b = 0; b < w.nbonds; b++) { const a = find(w.ba[b]), c = find(w.bb[b]); if (a !== c) parent[a] = c; }
  if (prox > 0) {
    const p2 = prox * prox, per = w.boundary === 'periodic';
    {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = w.x[j] - w.x[i], dy = w.y[j] - w.y[i];
        if (per) { dx -= w.W * Math.round(dx / w.W); dy -= w.H * Math.round(dy / w.H); }
        if (dx * dx + dy * dy < p2) { const a = find(i), c = find(j); if (a !== c) parent[a] = c; }
      }
    }
  }
  const comp = new Int32Array(n), sizes = []; const id = new Map();
  for (let i = 0; i < n; i++) { const f = find(i); if (!id.has(f)) { id.set(f, sizes.length); sizes.push(0); } comp[i] = id.get(f); sizes[comp[i]]++; }
  return { comp, sizes, count: sizes.length };
}

// Swim test. Place the organism in open still water with no thermal noise and let the rules run.
// Sustained late displacement of a cohesive body can only come from an active cycle pushing on the
// water, because every internal force conserves momentum and drag only dissipates.
function swimTest(rules, atoms, opts = {}) {
  const steps = opts.steps || 4000, T = opts.T || 0;
  const r2 = opts.dt ? { ...rules, dt: opts.dt } : rules;
  const w = new World(r2, { cap: atoms.length + 1, boundary: 'open', T, seed: opts.seed || 7 });
  for (const a of atoms) w.add(a.t, a.x, a.y);
  const n = w.n, total = opts.dt ? Math.round(steps * 0.02 / opts.dt) : steps;
  const q1 = total >> 2, h = total >> 1, q3 = h + q1;
  const snap = () => ({ x: Float64Array.from(w.x.subarray(0, n)), y: Float64Array.from(w.y.subarray(0, n)) });
  let s0, s1, s2, f1 = 0, e1 = 0, void0 = 0;
  // shape oscillation: track mean squared pair distance (radius of gyration^2) through the late half
  let rgSum = 0, rgSq = 0, rgN = 0, rgPrev = 0, rgCross = 0; const rgSeries = [];
  for (let s = 0; s < total; s++) {
    w.step();
    if (s === h - 1) { s0 = snap(); f1 = w.stat.formed; e1 = w.stat.energyUsed; if (opts.voids) void0 = enclosedVoids(w).area; }
    if (s === q3 - 1) s1 = snap();
    if (s >= h && (s & 3) === 0) {
      let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += w.x[i]; cy += w.y[i]; } cx /= n; cy /= n;
      let rg = 0; for (let i = 0; i < n; i++) rg += (w.x[i] - cx) ** 2 + (w.y[i] - cy) ** 2; rg /= n;
      rgSum += rg; rgSq += rg * rg; rgN++; rgSeries.push(rg);
    }
    if (w.stat.capHits > 0 || !(w.x[0] === w.x[0])) return { fit: 0, bad: 'unstable' };
  }
  s2 = snap();
  const c = components(w, 1.5);
  let big = 0; for (let k = 1; k < c.count; k++) if (c.sizes[k] > c.sizes[big]) big = k;
  const body = []; for (let i = 0; i < n; i++) if (c.comp[i] === big) body.push(i);
  const cen = (s) => { let x = 0, y = 0; for (const i of body) { x += s.x[i]; y += s.y[i]; } return [x / body.length, y / body.length]; };
  const c0 = cen(s0), c1 = cen(s1), c2 = cen(s2);
  const d1 = [c1[0] - c0[0], c1[1] - c0[1]], d2 = [c2[0] - c1[0], c2[1] - c1[1]];
  const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
  const net = Math.hypot(d1[0] + d2[0], d1[1] + d2[1]);
  const halfTime = (total - h) * w.dt;
  // the body must already have been together at the half-way mark (no late assembly, no recoil)
  let spread0 = 0; for (const i of body) spread0 = Math.max(spread0, Math.hypot(s0.x[i] - c0[0], s0.y[i] - c0[1]));
  let spread2 = 0; for (const i of body) spread2 = Math.max(spread2, Math.hypot(s2.x[i] - c2[0], s2.y[i] - c2[1]));
  const cohesive = body.length >= 3 && body.length >= 0.75 * n && spread0 < spread2 * 1.5 + 1;
  const sustain = Math.min(l1, l2) / (Math.max(l1, l2) + 1e-9);
  const rgMean = rgSum / rgN, rgStd = Math.sqrt(Math.max(0, rgSq / rgN - rgMean * rgMean));
  // beat frequency from mean crossings of the shape series
  for (let k = 1; k < rgSeries.length; k++) if ((rgSeries[k - 1] - rgMean) * (rgSeries[k] - rgMean) < 0) rgCross++;
  const beatHz = rgCross / 2 / halfTime;
  const cycles = w.stat.formed - f1, energy = w.stat.energyUsed - e1;
  const speed = net / halfTime;
  let fit = cohesive ? speed * (0.25 + 0.75 * sustain) : 0;
  return {
    fit, speed, sustain, net, bodyN: body.length, n, cohesive, size: 2 * spread2 + 1,
    beatAmp: rgStd / (rgMean + 1e-9), beatHz, cycles, cyclesPerTime: cycles / halfTime, energyPerTime: energy / halfTime,
    bonds: w.nbonds, dir: [d1[0] + d2[0], d1[1] + d2[1]],
    voidArea: opts.voids ? Math.min(void0, enclosedVoids(w).area) : 0,
  };
}

// ---- Soup survey: fill a periodic box with a random mix and measure what the rules do on their own.
function soupTest(rules, opts = {}) {
  const N = opts.n || 200, W = opts.W || 30, burn = opts.burn || 2500, meas = opts.meas || 2000;
  const w = new World(rules, { cap: N, boundary: 'periodic', W, H: W, seed: opts.seed || 11, T: opts.T });
  const r = w.rand, K = rules.K;
  for (let i = 0; i < N; i++) w.add(i % K, r() * W, r() * W);
  // relax overlaps gently: the core force is stiff, so start with a few damped steps
  for (let s = 0; s < burn; s++) { w.step(); if (w.stat.capHits > 50) return { bad: 'unstable' }; }
  const x0 = Float64Array.from(w.x.subarray(0, N)), y0 = Float64Array.from(w.y.subarray(0, N));
  const nbr0 = neighbourPairs(w, 1.5), f0 = w.stat.formed, cap0 = w.stat.capHits;
  const voids0 = enclosedVoids(w);
  let ke = 0, keN = 0;
  for (let s = 0; s < meas; s++) {
    w.step();
    if ((s & 15) === 0) { for (let i = 0; i < N; i++) ke += 0.5 * w.mass[w.type[i]] * (w.vx[i] ** 2 + w.vy[i] ** 2); keN += N; }
  }
  if (!(w.x[0] === w.x[0])) return { bad: 'nan' };
  const dur = meas * w.dt;
  const nbr1 = neighbourPairs(w, 1.5);
  let keep = 0; for (const p of nbr0) if (nbr1.has(p)) keep++;
  let msd = 0; for (let i = 0; i < N; i++) msd += (w.x[i] - x0[i]) ** 2 + (w.y[i] - y0[i]) ** 2; msd /= N;
  const c = components(w, 1.3);
  let big = 0, inClusters = 0, nClusters = 0; for (const s of c.sizes) { if (s > big) big = s; if (s >= 3) { inClusters += s; nClusters++; } }
  let bondedAtoms = 0; for (let i = 0; i < N; i++) if (w.nb[i] > 0) bondedAtoms++;
  // cyclomatic number of the bond graph: independent bonded loops
  const cb = components(w, 0);
  const loops = w.nbonds - N + cb.count;
  const voids1 = enclosedVoids(w);
  return {
    temp: ke / keN, bathT: w.T, msd, drift: Math.sqrt(msd) / dur,
    persist: nbr0.size ? keep / nbr0.size : 0, contacts: nbr1.size / N,
    bigFrac: big / N, clusterFrac: inClusters / N, nClusters,
    bondedFrac: bondedAtoms / N, bondsPerAtom: w.nbonds / N, loops,
    turnover: (w.stat.formed - f0) / N / dur, capHits: w.stat.capHits - cap0,
    voids: Math.min(voids0.count, voids1.count), voidArea: Math.min(voids0.area, voids1.area),
  };
}

function neighbourPairs(w, d) {
  const n = w.n, s = new Set(), d2 = d * d;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let dx = w.x[j] - w.x[i], dy = w.y[j] - w.y[i];
    dx -= w.W * Math.round(dx / w.W); dy -= w.H * Math.round(dy / w.H);
    if (dx * dx + dy * dy < d2) s.add(i * 65536 + j);
  }
  return s;
}

// Compartments: raster the box, paint every atom as a disc and every bond as a thick line, then
// flood-fill the empty space. Every empty region except the largest ("outside") that is big enough
// to hold a few atoms is an enclosed compartment.
function enclosedVoids(w, res = 0.25, minArea = 3) {
  const per = w.boundary === 'periodic';
  let x0 = 0, y0 = 0, W = w.W, H = w.H;
  if (!per) {
    let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
    for (let i = 0; i < w.n; i++) { ax = Math.min(ax, w.x[i]); ay = Math.min(ay, w.y[i]); bx = Math.max(bx, w.x[i]); by = Math.max(by, w.y[i]); }
    x0 = ax - 3; y0 = ay - 3; W = bx - ax + 6; H = by - ay + 6;
  }
  const gx = Math.ceil(W / res), gy = Math.ceil(H / res), g = new Uint8Array(gx * gy);
  const disc = (px, py, rad) => {
    const r = Math.ceil(rad / res), cx = Math.floor((px - x0) / res), cy = Math.floor((py - y0) / res);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > (rad / res) ** 2) continue;
      let ix = cx + dx, iy = cy + dy;
      if (per) { ix = ((ix % gx) + gx) % gx; iy = ((iy % gy) + gy) % gy; } else if (ix < 0 || iy < 0 || ix >= gx || iy >= gy) continue;
      g[iy * gx + ix] = 1;
    }
  };
  for (let i = 0; i < w.n; i++) disc(w.x[i], w.y[i], 0.62);
  for (let b = 0; b < w.nbonds; b++) {
    const i = w.ba[b], j = w.bb[b];
    let dx = w.x[j] - w.x[i], dy = w.y[j] - w.y[i];
    if (per) { dx -= w.W * Math.round(dx / w.W); dy -= w.H * Math.round(dy / w.H); }
    const len = Math.hypot(dx, dy);
    if (len > 2.1) continue; // a gap an atom could pass through is not a wall
    const k = Math.ceil(len / res);
    for (let s = 1; s < k; s++) disc(w.x[i] + dx * s / k, w.y[i] + dy * s / k, 0.3);
  }
  const lab = new Int32Array(gx * gy), areas = [0], stack = [];
  let nl = 0;
  for (let c = 0; c < g.length; c++) {
    if (g[c] || lab[c]) continue;
    nl++; areas.push(0); lab[c] = nl; stack.push(c);
    while (stack.length) {
      const q = stack.pop(); areas[nl]++;
      const qx = q % gx, qy = (q - qx) / gx;
      for (let d = 0; d < 4; d++) {
        let ix = qx + (d === 0 ? 1 : d === 1 ? -1 : 0), iy = qy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (per) { ix = (ix + gx) % gx; iy = (iy + gy) % gy; } else if (ix < 0 || iy < 0 || ix >= gx || iy >= gy) continue;
        const p = iy * gx + ix;
        if (!g[p] && !lab[p]) { lab[p] = nl; stack.push(p); }
      }
    }
  }
  let bigL = 0; for (let l = 1; l <= nl; l++) if (areas[l] > (areas[bigL] || 0)) bigL = l;
  let count = 0, area = 0;
  for (let l = 1; l <= nl; l++) if (l !== bigL && areas[l] * res * res >= minArea) { count++; area += areas[l] * res * res; }
  return { count, area, lab, gx, gy, x0, y0, res, outside: bigL };
}

// The benchmark workload: a fixed, seeded list of swim-test trials.
// Trial i is a random rule set plus a random body, drawn from one seeded stream, exactly the way the
// swimmer search draws its first generation. Every machine runs the same trials.



const SEED = 20261115;
const STEPS = 4000;      // steps per trial, the swim test's default
const MAXN = 16;         // most atoms in a trial body
// The reference run: 4,000 trials in the cloud sandbox (4 threads of a 2.1 GHz Xeon, Node 22).
const CLOUD = { trials: 4000, checksum: '91801d7a', single: 250, multi: 965, threads: 4, cpu: 'Intel Xeon 2.1 GHz (cloud sandbox)' };

// The generator uses exp, log, sin and cos, which JavaScript engines may round differently in the last
// bit (Node 22 and Chrome 153 do). Rounding every generated number to six decimals removes that, so
// every engine gets the same trials. The simulation itself uses only exactly-rounded operations.
function quantize(o) {
  if (typeof o === 'number') return Math.round(o * 1e6) / 1e6;
  if (o && typeof o === 'object') for (const k in o) o[k] = quantize(o[k]);
  return o;
}

function makeTrials(count, seed = SEED) {
  const r = rng32(seed), out = [];
  for (let i = 0; i < count; i++) { const R = randomRules(r, {}); out.push(quantize({ R, atoms: randomOrganism(r, R.K) })); }
  return out;
}

// The CPU path is the search's own swim test, unchanged.
function runTrial(t) { const m = swimTest(t.R, t.atoms); return m.bad ? -1 : m.fit; }

// Order-sensitive hash of every result, to twelve decimals. Equal checksums mean the same results.
function checksum(fits) {
  let h = 2166136261 >>> 0;
  const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  for (let i = 0; i < fits.length; i++) { f[0] = Math.round(fits[i] * 1e12); h = Math.imul(h ^ u[0], 16777619); h = Math.imul(h ^ u[1], 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---- Scoring from snapshots. The GPU cannot run the swim test's bookkeeping, so it hands back the
// atom positions at the half, three-quarter and end marks plus the final bonds, and this function
// repeats the swim test's arithmetic on them. snapshotFit(cpuSnapshots(t)) equals runTrial(t) exactly.
function snapshotFit(s) {
  if (s.bad) return -1;
  const n = s.n;
  for (let i = 0; i < n; i++) if (!(s.x2[i] === s.x2[i]) || !(s.y2[i] === s.y2[i])) return -1;
  const c = components({ n, nbonds: s.nbonds, ba: s.ba, bb: s.bb, x: s.x2, y: s.y2, boundary: 'open' }, 1.5);
  let big = 0; for (let k = 1; k < c.count; k++) if (c.sizes[k] > c.sizes[big]) big = k;
  const body = []; for (let i = 0; i < n; i++) if (c.comp[i] === big) body.push(i);
  const cen = (X, Y) => { let x = 0, y = 0; for (const i of body) { x += X[i]; y += Y[i]; } return [x / body.length, y / body.length]; };
  const c0 = cen(s.x0, s.y0), c1 = cen(s.x1, s.y1), c2 = cen(s.x2, s.y2);
  const d1 = [c1[0] - c0[0], c1[1] - c0[1]], d2 = [c2[0] - c1[0], c2[1] - c1[1]];
  const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
  const net = Math.hypot(d1[0] + d2[0], d1[1] + d2[1]);
  const halfTime = (STEPS - (STEPS >> 1)) * s.dt;
  let spread0 = 0; for (const i of body) spread0 = Math.max(spread0, Math.hypot(s.x0[i] - c0[0], s.y0[i] - c0[1]));
  let spread2 = 0; for (const i of body) spread2 = Math.max(spread2, Math.hypot(s.x2[i] - c2[0], s.y2[i] - c2[1]));
  const cohesive = body.length >= 3 && body.length >= 0.75 * n && spread0 < spread2 * 1.5 + 1;
  const sustain = Math.min(l1, l2) / (Math.max(l1, l2) + 1e-9);
  return cohesive ? (net / halfTime) * (0.25 + 0.75 * sustain) : 0;
}

// Run a trial on the CPU but only keep what the GPU path keeps. `stopAt` cuts the run short (for
// comparing early positions with the GPU, before rounding differences have had time to grow).
function cpuSnapshots(t, stopAt = STEPS) {
  const w = new World(t.R, { cap: t.atoms.length + 1, boundary: 'open', T: 0, seed: 7 });
  for (const a of t.atoms) w.add(a.t, a.x, a.y);
  const n = w.n, h = STEPS >> 1, q3 = h + (STEPS >> 2), s = { n, dt: w.dt, bad: false };
  const grab = (k) => { s['x' + k] = Float64Array.from(w.x.subarray(0, n)); s['y' + k] = Float64Array.from(w.y.subarray(0, n)); };
  for (let i = 0; i < stopAt; i++) {
    w.step();
    if (i === h - 1) grab(0);
    if (i === q3 - 1) grab(1);
    if (w.stat.capHits > 0 || !(w.x[0] === w.x[0])) { s.bad = true; break; }
  }
  grab(2);
  s.nbonds = w.nbonds; s.ba = w.ba.slice(0, w.nbonds); s.bb = w.bb.slice(0, w.nbonds); s.formed = w.stat.formed;
  return s;
}

function summarize(fits) {
  let bad = 0, zero = 0, pos = 0, sum = 0, best = 0;
  for (const f of fits) { if (f < 0) bad++; else if (f < 1e-4) zero++; else pos++; if (f > 0) sum += f; if (f > best) best = f; }
  return { trials: fits.length, unstable: bad, still: zero, moving: pos, meanFit: sum / fits.length, bestFit: best };
}


if (!isMainThread) {
  const trials = makeTrials(workerData.count);
  for (let i = 0; i < 30; i++) runTrial(trials[i]); // warm up the JIT
  parentPort.on('message', ([a, b]) => {
    const out = new Float64Array(b - a);
    for (let i = a; i < b; i++) out[i - a] = runTrial(trials[i]);
    parentPort.postMessage({ a, out });
  });
  parentPort.postMessage('ready');
} else {
  const count = +process.argv[2] || 4000;
  const threads = +process.argv[3] || os.availableParallelism?.() || os.cpus().length;
  const self = fileURLToPath(import.meta.url);

  const single = () => {
    const trials = makeTrials(count), fits = new Float64Array(count);
    for (let i = 0; i < Math.min(200, count); i++) runTrial(trials[i]); // warm up the JIT
    const t0 = performance.now();
    for (let i = 0; i < count; i++) fits[i] = runTrial(trials[i]);
    return { fits, sec: (performance.now() - t0) / 1000 };
  };

  const multi = (nt) => new Promise((resolve, reject) => {
    const fits = new Float64Array(count), CH = 25;
    let next = 0, done = 0, ready = 0, t0 = 0;
    const ws = [];
    const give = (w) => { if (next < count) { const a = next; next = Math.min(count, a + CH); w.postMessage([a, next]); } };
    for (let k = 0; k < nt; k++) {
      const w = new Worker(self, { workerData: { count } });
      ws.push(w);
      w.on('error', reject);
      w.on('message', (m) => {
        if (m === 'ready') { if (++ready === nt) { t0 = performance.now(); ws.forEach(give); } return; }
        fits.set(m.out, m.a); done += m.out.length;
        if (done === count) { const sec = (performance.now() - t0) / 1000; ws.forEach(x => x.terminate()); resolve({ fits, sec }); }
        else give(w);
      });
    }
  });

  const cpu = os.cpus()[0]?.model || 'unknown CPU';
  console.log(`Swim-test benchmark: ${count} trials, seed ${SEED}`);
  console.log(`Machine: ${cpu}, ${threads} threads, ${process.platform} ${process.arch}, Node ${process.version}`);
  const s = single();
  const sum = checksum(s.fits), info = summarize(s.fits);
  console.log(`1 thread : ${(count / s.sec).toFixed(0)} trials/s  (${s.sec.toFixed(2)} s)`);
  const m = await multi(threads);
  console.log(`${threads} threads: ${(count / m.sec).toFixed(0)} trials/s  (${m.sec.toFixed(2)} s)`);
  const same = checksum(m.fits) === sum;
  console.log(`Results  : ${info.moving} moving, ${info.still} still, ${info.unstable} unstable, best fit ${info.bestFit.toFixed(5)}`);
  console.log(`Checksum : ${sum}${same ? '' : '  (threads disagree: ' + checksum(m.fits) + ')'}` +
    (count === CLOUD.trials ? (sum === CLOUD.checksum ? '  matches the cloud run' : '  DIFFERS from the cloud run (' + CLOUD.checksum + ')') : ''));
  console.log(`Cloud sandbox for comparison: ${CLOUD.single} trials/s on 1 thread, ${CLOUD.multi} on ${CLOUD.threads}.` +
    ` This machine: ${(count / s.sec / CLOUD.single).toFixed(1)}x per thread, ${(count / m.sec / CLOUD.multi).toFixed(1)}x overall.`);
}
