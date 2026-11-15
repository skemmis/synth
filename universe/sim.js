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

export const KCORE = 120;      // hard-core stiffness
export const SH0 = 1.2, SH1 = 1.8; // shadow weight: 1 below SH0, falls to 0 at SH1
export const MAXV = 6;         // max bonds per atom
export const VCAP = 60;        // speed cap (hits are counted; a valid run has none)

export function rng32(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
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
    this.candCap = cap * 4; this.ncand = 0;
    this.ci = new Int32Array(this.candCap); this.cj = new Int32Array(this.candCap);
    this.cr = new Float64Array(this.candCap); this.cord = new Int32Array(this.candCap);
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
    // bond candidates are only noted here; step() forms them closest-first, so the result does not
    // depend on the order atoms happen to be stored or visited in
    if (this.bon[q] && r < this.bform[q] && this.nb[i] < this.val[ti] && this.nb[j] < this.val[tj] && !this.bonded(i, j)) {
      const c = this.ncand++;
      if (c < this.candCap) { this.ci[c] = i < j ? i : j; this.cj[c] = i < j ? j : i; this.cr[c] = r; }
    }
  }

  _formBonds() {
    const n = this.ncand < this.candCap ? this.ncand : this.candCap, K = this.K;
    this.ncand = 0;
    if (n === 0) return;
    const ord = this.cord; for (let k = 0; k < n; k++) ord[k] = k;
    const cr = this.cr, ci = this.ci, cj = this.cj;
    // insertion sort by distance, ties by atom index (n is small)
    for (let a = 1; a < n; a++) {
      const v = ord[a]; let b = a - 1;
      while (b >= 0) { const u = ord[b]; if (cr[u] < cr[v] || (cr[u] === cr[v] && (ci[u] < ci[v] || (ci[u] === ci[v] && cj[u] < cj[v])))) break; ord[b + 1] = u; b--; }
      ord[b + 1] = v;
    }
    for (let a = 0; a < n; a++) {
      const k = ord[a], i = ci[k], j = cj[k], ti = this.type[i], tj = this.type[j], q = ti * K + tj;
      if (this.nb[i] >= this.val[ti] || this.nb[j] >= this.val[tj]) continue;
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
    this._formBonds();
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
