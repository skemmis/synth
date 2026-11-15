// Measurements. Everything here is a number computed from a run, so "interesting" is testable.
import { World } from './sim.js';

// Connected components by bond or by proximity (r < prox). Returns { comp[], sizes[], count }.
export function components(w, prox = 1.5) {
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
export function swimTest(rules, atoms, opts = {}) {
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
export function soupTest(rules, opts = {}) {
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
export function enclosedVoids(w, res = 0.25, minArea = 3) {
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
