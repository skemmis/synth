// Parts: a small building physics with named pieces. Deterministic (only + - * / sqrt in the step).
//
// Atoms: BEAD (plain), JITTER (tugs its springs and ropes in rhythm, spends energy), STICKY (grabs what it
// touches), PELLET (loose energy; eaten on touching a build that has a jitter in it).
// Links: ROD (stiff), SPRING (soft, stretchy), ROPE (pulls, never pushes), FUSE (stiff, snaps under a
// small stretch and kicks its ends apart), GLUE (what a sticky atom makes).
// A link remembers the length it was built at. The numbers below are hidden from the player and are
// what the search tunes.

export const BEAD = 0, JITTER = 1, STICKY = 2, PELLET = 3;
export const ROD = 0, SPRING = 1, ROPE = 2, FUSE = 3, GLUE = 4;
export const KCORE = 120, SH0 = 1.2, SH1 = 1.8, VCAP = 60;

export const DEFAULTS = {
  dt: 0.02,
  // water (from the universe search: without splash or slipstream nothing can swim)
  g1: 0.6, g2: 0.3, shadow: 0.8, T: 0.02,
  mass: [1, 1.5, 1, 0.5], drag: [1, 1, 1.6, 1],
  // links: stiffness, stretch at which it breaks (fraction of built length), internal damping
  k: [400, 30, 150, 300, 80], snap: [0.6, 2.5, 0.6, 0.12, 0.6], damp: [3, 0.6, 1.5, 3, 1.5],
  fuseKick: 8,
  // jitter: beats per second, how hard it tugs its springs and ropes, share of the beat spent pulling,
  // delay between jitters in the order they were placed (fraction of a beat), energy per beat per link
  jitHz: 1.2, jitForce: 60, // (two jitters on one link tug as one)
  jitDuty: 0.2, jitLag: 0.25, jitCost: 0.01, jitShake: 0,
  stickyReach: 1.15, stickyMax: 3, pelletEnergy: 0.5,
};

export function rng32(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Parts {
  // opts: { W, H, cap, seed, walls (default true), freeEnergy (jitters never run out) }
  constructor(params = {}, opts = {}) {
    this.p = { ...DEFAULTS, ...params };
    this.W = opts.W || 48; this.H = opts.H || 30; this.walls = opts.walls !== false;
    this.freeEnergy = !!opts.freeEnergy;
    const cap = this.cap = opts.cap || 1200;
    this.rand = rng32(opts.seed === undefined ? 1 : opts.seed);
    this.n = 0;
    this.x = new Float64Array(cap); this.y = new Float64Array(cap); this.vx = new Float64Array(cap); this.vy = new Float64Array(cap);
    this.fx = new Float64Array(cap); this.fy = new Float64Array(cap);
    this.sw = new Float64Array(cap); this.sxx = new Float64Array(cap); this.sxy = new Float64Array(cap); this.syy = new Float64Array(cap);
    this.kind = new Uint8Array(cap); this.e = new Float64Array(cap); this.order = new Int32Array(cap); this.glue = new Uint8Array(cap);
    this.capB = cap * 4; this.nb = 0;
    this.ba = new Int32Array(this.capB); this.bb = new Int32Array(this.capB); this.bk = new Uint8Array(this.capB); this.bl = new Float64Array(this.capB);
    this.time = 0; this.steps = 0; this.jitters = 0;
    this.stat = { snapped: 0, fuses: 0, eaten: 0, capHits: 0, glued: 0 };
    const cs = SH1; this.nx = Math.max(1, Math.floor(this.W / cs)); this.ny = Math.max(1, Math.floor(this.H / cs));
    this.cw = this.W / this.nx; this.ch = this.H / this.ny;
    this.head = new Int32Array(this.nx * this.ny); this.next = new Int32Array(cap);
    this.eatQ = [];
  }
  add(kind, x, y) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = 0; this.vy[i] = 0; this.e[i] = 1; this.glue[i] = 0;
    this.order[i] = kind === JITTER ? this.jitters++ : 0;
    return i;
  }
  linked(i, j) { for (let b = 0; b < this.nb; b++) if ((this.ba[b] === i && this.bb[b] === j) || (this.ba[b] === j && this.bb[b] === i)) return true; return false; }
  link(i, j, kind, len) {
    if (i === j || i < 0 || j < 0 || this.nb >= this.capB || this.linked(i, j)) return -1;
    const b = this.nb++; this.ba[b] = i; this.bb[b] = j; this.bk[b] = kind;
    this.bl[b] = len !== undefined ? len : Math.sqrt((this.x[i] - this.x[j]) ** 2 + (this.y[i] - this.y[j]) ** 2);
    return b;
  }
  unlink(b) {
    if (this.bk[b] === GLUE) { if (this.kind[this.ba[b]] === STICKY) this.glue[this.ba[b]]--; if (this.kind[this.bb[b]] === STICKY) this.glue[this.bb[b]]--; }
    const l = --this.nb; this.ba[b] = this.ba[l]; this.bb[b] = this.bb[l]; this.bk[b] = this.bk[l]; this.bl[b] = this.bl[l];
  }
  remove(i) {
    for (let b = this.nb - 1; b >= 0; b--) if (this.ba[b] === i || this.bb[b] === i) this.unlink(b);
    const l = --this.n; if (i === l) return;
    for (const a of [this.x, this.y, this.vx, this.vy, this.e, this.kind, this.order, this.glue]) a[i] = a[l];
    for (let b = 0; b < this.nb; b++) { if (this.ba[b] === l) this.ba[b] = i; if (this.bb[b] === l) this.bb[b] = i; }
  }
  // is this jitter tugging right now? 1 during the short pull at the start of each beat, else 0
  pulse(i) {
    const p = this.p; let ph = this.time * p.jitHz - this.order[i] * p.jitLag; ph -= Math.floor(ph);
    return ph < p.jitDuty ? 1 : 0;
  }
  _pair(i, j) {
    const dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i], r2 = dx * dx + dy * dy;
    if (r2 >= SH1 * SH1 || r2 < 1e-18) return;
    const r = Math.sqrt(r2), ux = dx / r, uy = dy / r, p = this.p;
    if (r < 1) { const f = KCORE * (1 - r); this.fx[i] -= f * ux; this.fy[i] -= f * uy; this.fx[j] += f * ux; this.fy[j] += f * uy; }
    if (p.shadow > 0) {
      const w = r < SH0 ? 1 : (SH1 - r) / (SH1 - SH0), xx = w * ux * ux, xy = w * ux * uy, yy = w * uy * uy;
      this.sw[i] += w; this.sxx[i] += xx; this.sxy[i] += xy; this.syy[i] += yy;
      this.sw[j] += w; this.sxx[j] += xx; this.sxy[j] += xy; this.syy[j] += yy;
    }
    const ki = this.kind[i], kj = this.kind[j];
    if (r < p.stickyReach) {
      if (ki === PELLET || kj === PELLET) { if (ki !== kj) this.eatQ.push(ki === PELLET ? i : j, ki === PELLET ? j : i); }
      else if ((ki === STICKY && this.glue[i] < p.stickyMax) || (kj === STICKY && this.glue[j] < p.stickyMax)) this.eatQ.push(-1 - i, j);
    }
  }
  // atoms joined to `start` through links
  component(start) {
    const seen = new Uint8Array(this.n), out = [start]; seen[start] = 1;
    for (let q = 0; q < out.length; q++) { const a = out[q]; for (let b = 0; b < this.nb; b++) { const o = this.ba[b] === a ? this.bb[b] : this.bb[b] === a ? this.ba[b] : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; out.push(o); } } }
    return out;
  }
  step() {
    const n = this.n, p = this.p, dt = p.dt, x = this.x, y = this.y, vx = this.vx, vy = this.vy, fx = this.fx, fy = this.fy;
    fx.fill(0, 0, n); fy.fill(0, 0, n);
    if (p.shadow > 0) { this.sw.fill(0, 0, n); this.sxx.fill(0, 0, n); this.sxy.fill(0, 0, n); this.syy.fill(0, 0, n); }
    const nx = this.nx, ny = this.ny, head = this.head, next = this.next;
    head.fill(-1);
    for (let i = n - 1; i >= 0; i--) {
      let cx = Math.floor(x[i] / this.cw), cy = Math.floor(y[i] / this.ch);
      if (cx < 0) cx = 0; else if (cx >= nx) cx = nx - 1; if (cy < 0) cy = 0; else if (cy >= ny) cy = ny - 1;
      const c = cy * nx + cx; next[i] = head[c]; head[c] = i;
    }
    this.eatQ.length = 0;
    for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
      for (let i = head[cy * nx + cx]; i >= 0; i = next[i]) {
        for (let j = next[i]; j >= 0; j = next[j]) this._pair(i, j);
        for (let s = 0; s < 4; s++) {
          const c2x = cx + (s === 0 ? 1 : s - 2), c2y = cy + (s === 0 ? 0 : 1);
          if (c2x < 0 || c2x >= nx || c2y >= ny) continue;
          for (let j = head[c2y * nx + c2x]; j >= 0; j = next[j]) this._pair(i, j);
        }
      }
    }
    // links
    for (let b = this.nb - 1; b >= 0; b--) {
      const i = this.ba[b], j = this.bb[b], k = this.bk[b];
      const dx = x[j] - x[i], dy = y[j] - y[i], r = Math.sqrt(dx * dx + dy * dy) || 1e-9, ux = dx / r, uy = dy / r;
      const L = this.bl[b];
      let tug = 0;
      if (k === SPRING || k === ROPE) { // a jitter with energy tugs the springs and ropes it holds
        if (this.kind[i] === JITTER && this.e[i] > 0) tug += this.pulse(i);
        if (this.kind[j] === JITTER && this.e[j] > 0) tug += this.pulse(j);
        if (tug > 0) { // the tug fades out as the link nears 60% of its built length, so it cannot crush
          const room = (r - 0.6 * L) / (0.4 * L), f = p.jitForce * (room <= 0 ? 0 : room > 1 ? 1 : room); fx[i] += f * ux; fy[i] += f * uy; fx[j] -= f * ux; fy[j] -= f * uy; }
      }
      if (r > this.bl[b] * (1 + p.snap[k])) {
        if (k === FUSE) { const f = p.fuseKick / dt; fx[i] -= f * ux; fy[i] -= f * uy; fx[j] += f * ux; fy[j] += f * uy; this.stat.fuses++; }
        this.stat.snapped++; this.unlink(b); continue;
      }
      let f = p.k[k] * (r - L);
      if (k === ROPE && f < 0) continue; // a rope goes slack
      f += p.damp[k] * ((vx[j] - vx[i]) * ux + (vy[j] - vy[i]) * uy);
      fx[i] += f * ux; fy[i] += f * uy; fx[j] -= f * ux; fy[j] -= f * uy;
    }
    // sticky grabs and pellets eaten (in a fixed order: by atom index)
    const q = this.eatQ; let dead = null;
    for (let a = 0; a < q.length; a += 2) {
      if (q[a] < 0) { const i = -1 - q[a], j = q[a + 1];
        const si = this.kind[i] === STICKY && this.glue[i] < p.stickyMax, sj = this.kind[j] === STICKY && this.glue[j] < p.stickyMax;
        if ((si || sj) && this.link(i, j, GLUE, 1) >= 0) { if (this.kind[i] === STICKY) this.glue[i]++; if (this.kind[j] === STICKY) this.glue[j]++; this.stat.glued++; }
      } else { const pel = q[a], eater = q[a + 1]; if (dead && dead.includes(pel)) continue;
        const js = this.component(eater).filter(o => this.kind[o] === JITTER); if (!js.length) continue;
        for (const o of js) { const v = this.e[o] + p.pelletEnergy / js.length; this.e[o] = v > 1 ? 1 : v; }
        (dead = dead || []).push(pel); this.stat.eaten++;
      }
    }
    // integrate
    const g1 = p.g1, g2 = p.g2, sh = p.shadow, T = p.T, rand = this.rand, cost = this.freeEnergy ? 0 : p.jitCost * p.jitHz * dt;
    for (let i = 0; i < n; i++) {
      const kd = this.kind[i], m = p.mass[kd], g = g1 * p.drag[kd];
      let u = vx[i], v = vy[i], dxv = u, dyv = v;
      if (sh > 0 && this.sw[i] > 0) { const c = sh / (this.sw[i] > 1 ? this.sw[i] : 1); dxv = u - c * (this.sxx[i] * u + this.sxy[i] * v); dyv = v - c * (this.sxy[i] * u + this.syy[i] * v); }
      u += (fx[i] - g * dxv) / m * dt; v += (fy[i] - g * dyv) / m * dt;
      let amp = T > 0 ? Math.sqrt(6 * g * T * dt) / m : 0;
      if (kd === JITTER && p.jitShake > 0 && this.e[i] > 0) amp += p.jitShake * Math.sqrt(dt) / m;
      if (amp > 0) { u += amp * (2 * rand() - 1); v += amp * (2 * rand() - 1); }
      if (g2 > 0) { const k = 1 / (1 + g2 * p.drag[kd] * Math.sqrt(u * u + v * v) * dt / m); u *= k; v *= k; }
      const s2 = u * u + v * v; if (s2 > VCAP * VCAP) { const k = VCAP / Math.sqrt(s2); u *= k; v *= k; this.stat.capHits++; }
      vx[i] = u; vy[i] = v; x[i] += u * dt; y[i] += v * dt;
      if (kd === JITTER && cost > 0 && this.e[i] > 0) { this.e[i] -= cost; if (this.e[i] < 0) this.e[i] = 0; }
      if (this.walls) {
        if (x[i] < 0.5) { x[i] = 0.5; if (vx[i] < 0) vx[i] *= -0.5; } else if (x[i] > this.W - 0.5) { x[i] = this.W - 0.5; if (vx[i] > 0) vx[i] *= -0.5; }
        if (y[i] < 0.5) { y[i] = 0.5; if (vy[i] < 0) vy[i] *= -0.5; } else if (y[i] > this.H - 0.5) { y[i] = this.H - 0.5; if (vy[i] > 0) vy[i] *= -0.5; }
      }
    }
    if (dead) { dead.sort((a, b) => b - a); for (const i of dead) this.remove(i); }
    this.time += dt; this.steps++;
  }
  // a build is plain data: { atoms: [[kind, x, y], ...], links: [[i, j, kind], ...] }
  load(build, ox = 0, oy = 0) {
    const base = this.n; for (const a of build.atoms) this.add(a[0], a[1] + ox, a[2] + oy);
    for (const l of build.links) this.link(base + l[0], base + l[1], l[2]);
    return base;
  }
  save() {
    const atoms = [], links = [];
    for (let i = 0; i < this.n; i++) atoms.push([this.kind[i], +this.x[i].toFixed(3), +this.y[i].toFixed(3)]);
    for (let b = 0; b < this.nb; b++) links.push([this.ba[b], this.bb[b], this.bk[b]]);
    return { atoms, links };
  }
}
