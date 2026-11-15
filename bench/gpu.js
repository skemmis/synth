// WebGPU version of the swim-test workload.
// One GPU thread runs one whole trial, stepping its atoms in the same order as universe/sim.js, so
// the logic is the same and only the arithmetic differs: 32-bit floats here, 64-bit on the CPU.
// Thousands of trials run side by side. Positions come back at the half, three-quarter and end
// marks and are scored on the CPU with snapshotFit().
import { World, STEPS, MAXN, snapshotFit } from './workload.js';

const PS = 392, FS = 80, IS = 280; // per-trial strides: parameters, float state, integer state
const MAXB = 48;                   // most bonds in a trial (16 atoms x 6 slots / 2)

export const WGSL = /* wgsl */`
struct U { steps: u32, count: u32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read_write> SF: array<f32>;
@group(0) @binding(3) var<storage, read_write> SI: array<i32>;

const KCORE: f32 = 120.0;
const SH0: f32 = 1.2;
const SH1: f32 = 1.8;
const VCAP2: f32 = 3600.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let tr = gid.x;
  if (tr >= u.count) { return; }
  let pb = tr * ${PS}u; let fb = tr * ${FS}u; let ib = tr * ${IS}u;
  if (SI[ib + 226u] != 0) { return; }
  let n = i32(P[pb]);
  let dt = P[pb + 2u]; let g1 = P[pb + 3u]; let g2 = P[pb + 4u];
  let sh = P[pb + 5u]; let bd = P[pb + 6u]; let rmax2 = P[pb + 7u];

  var x: array<f32, 16>; var y: array<f32, 16>; var vx: array<f32, 16>; var vy: array<f32, 16>;
  var e: array<f32, 16>;
  var typ: array<i32, 16>; var nb: array<i32, 16>; var slots: array<i32, 96>;
  var ba: array<i32, 48>; var bb: array<i32, 48>; var bage: array<i32, 48>;
  for (var i = 0; i < n; i++) {
    let o = fb + u32(i);
    x[i] = SF[o]; y[i] = SF[o + 16u]; vx[i] = SF[o + 32u]; vy[i] = SF[o + 48u]; e[i] = SF[o + 64u];
    typ[i] = SI[ib + u32(i)]; nb[i] = SI[ib + 16u + u32(i)];
    for (var k = 0; k < 6; k++) { slots[i * 6 + k] = SI[ib + 32u + u32(i * 6 + k)]; }
  }
  var nbonds = SI[ib + 224u]; var formed = SI[ib + 225u]; var bad = 0;
  for (var b = 0; b < nbonds; b++) {
    ba[b] = SI[ib + 128u + u32(b)]; bb[b] = SI[ib + 176u + u32(b)]; bage[b] = SI[ib + 228u + u32(b)];
  }

  var fx: array<f32, 16>; var fy: array<f32, 16>;
  var sw: array<f32, 16>; var sxx: array<f32, 16>; var sxy: array<f32, 16>; var syy: array<f32, 16>;
  for (var s = 0u; s < u.steps; s++) {
    // cleared by hand each step: some drivers do not re-zero a variable declared inside a loop
    for (var i = 0; i < n; i++) { fx[i] = 0.0; fy[i] = 0.0; sw[i] = 0.0; sxx[i] = 0.0; sxy[i] = 0.0; syy[i] = 0.0; }

    // pair forces, drag shadow and bond formation, in the same i < j order as the CPU
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        let dx = x[j] - x[i]; let dy = y[j] - y[i]; let r2 = dx * dx + dy * dy;
        if (r2 >= rmax2) { continue; }
        let r = sqrt(r2);
        if (r < 1e-9) { continue; }
        let ti = typ[i]; let tj = typ[j];
        let q = pb + 32u + u32(ti * 6 + tj) * 10u;
        let q2 = pb + 32u + u32(tj * 6 + ti) * 10u;
        let ux = dx / r; let uy = dy / r;
        if (r < 1.0) {
          let f = KCORE * (1.0 - r);
          fx[i] -= f * ux; fy[i] -= f * uy; fx[j] += f * ux; fy[j] += f * uy;
        } else {
          let R = P[q + 1u];
          if (r < R) {
            let w = 1.0 - abs(2.0 * r - 1.0 - R) / (R - 1.0);
            let fi = P[q] * w; let fj = P[q2] * w;
            fx[i] += fi * ux; fy[i] += fi * uy; fx[j] -= fj * ux; fy[j] -= fj * uy;
          }
        }
        if (sh > 0.0 && r < SH1) {
          var w = 1.0;
          if (r >= SH0) { w = (SH1 - r) / (SH1 - SH0); }
          let xx = w * ux * ux; let xy = w * ux * uy; let yy = w * uy * uy;
          sw[i] += w; sxx[i] += xx; sxy[i] += xy; syy[i] += yy;
          sw[j] += w; sxx[j] += xx; sxy[j] += xy; syy[j] += yy;
        }
        if (P[q + 2u] > 0.5 && r < P[q + 3u]
            && nb[i] < i32(P[pb + 8u + u32(ti) * 4u + 2u]) && nb[j] < i32(P[pb + 8u + u32(tj) * 4u + 2u])) {
          let c = P[q + 8u];
          if (e[i] >= c && e[j] >= c) {
            var has = false;
            for (var k = 0; k < nb[i]; k++) { if (slots[i * 6 + k] == j) { has = true; } }
            if (!has) {
              e[i] -= c; e[j] -= c;
              ba[nbonds] = i; bb[nbonds] = j; bage[nbonds] = 0; nbonds++;
              slots[i * 6 + nb[i]] = j; nb[i]++;
              slots[j * 6 + nb[j]] = i; nb[j]++;
              formed++;
            }
          }
        }
      }
    }

    // bonds: springs, expiry, snapping and the kick on release
    for (var b = nbonds - 1; b >= 0; b--) {
      let i = ba[b]; let j = bb[b];
      let q = pb + 32u + u32(typ[i] * 6 + typ[j]) * 10u;
      let dx = x[j] - x[i]; let dy = y[j] - y[i];
      var r = sqrt(dx * dx + dy * dy);
      if (r == 0.0) { r = 1e-9; }
      let ux = dx / r; let uy = dy / r;
      bage[b]++;
      let life = i32(P[q + 7u]); let r0 = P[q + 4u];
      let expired = life > 0 && bage[b] >= life;
      let snapped = r > r0 * (1.0 + P[q + 6u]);
      if (expired || snapped) {
        let kick = P[q + 9u];
        if (kick > 0.0) {
          let f = kick / dt;
          fx[i] -= f * ux; fy[i] -= f * uy; fx[j] += f * ux; fy[j] += f * uy;
        }
        for (var k = 0; k < nb[i]; k++) {
          if (slots[i * 6 + k] == j) { slots[i * 6 + k] = slots[i * 6 + nb[i] - 1]; nb[i]--; break; }
        }
        for (var k = 0; k < nb[j]; k++) {
          if (slots[j * 6 + k] == i) { slots[j * 6 + k] = slots[j * 6 + nb[j] - 1]; nb[j]--; break; }
        }
        nbonds--;
        ba[b] = ba[nbonds]; bb[b] = bb[nbonds]; bage[b] = bage[nbonds];
        continue;
      }
      var f = P[q + 5u] * (r - r0);
      if (bd > 0.0) { f += bd * ((vx[j] - vx[i]) * ux + (vy[j] - vy[i]) * uy); }
      fx[i] += f * ux; fy[i] += f * uy; fx[j] -= f * ux; fy[j] -= f * uy;
    }

    // integrate
    for (var i = 0; i < n; i++) {
      let tb = pb + 8u + u32(typ[i]) * 4u;
      let m = P[tb]; let drag = P[tb + 1u]; let g = g1 * drag;
      var ax = fx[i] / m; var ay = fy[i] / m;
      var uu = vx[i]; var vv = vy[i];
      var dxv = uu; var dyv = vv;
      if (sh > 0.0 && sw[i] > 0.0) {
        let c = sh / max(sw[i], 1.0);
        dxv = uu - c * (sxx[i] * uu + sxy[i] * vv);
        dyv = vv - c * (sxy[i] * uu + syy[i] * vv);
      }
      ax -= g * dxv / m; ay -= g * dyv / m;
      uu += ax * dt; vv += ay * dt;
      if (g2 > 0.0) {
        let sp = sqrt(uu * uu + vv * vv);
        let k = 1.0 / (1.0 + g2 * drag * sp * dt / m);
        uu *= k; vv *= k;
      }
      if (uu * uu + vv * vv > VCAP2) { bad = 1; }
      vx[i] = uu; vy[i] = vv;
      x[i] += uu * dt; y[i] += vv * dt;
      e[i] = min(1.0, e[i] + P[tb + 3u] * dt);
    }
    if (bad != 0) { break; }
  }

  for (var i = 0; i < n; i++) {
    let o = fb + u32(i);
    SF[o] = x[i]; SF[o + 16u] = y[i]; SF[o + 32u] = vx[i]; SF[o + 48u] = vy[i]; SF[o + 64u] = e[i];
    SI[ib + 16u + u32(i)] = nb[i];
    for (var k = 0; k < 6; k++) { SI[ib + 32u + u32(i * 6 + k)] = slots[i * 6 + k]; }
  }
  for (var b = 0; b < nbonds; b++) {
    SI[ib + 128u + u32(b)] = ba[b]; SI[ib + 176u + u32(b)] = bb[b]; SI[ib + 228u + u32(b)] = bage[b];
  }
  SI[ib + 224u] = nbonds; SI[ib + 225u] = formed; SI[ib + 226u] = bad;
}`;

// A bond expires on the first step where its age, built by adding dt once per step in 64-bit, passes
// its lifetime. Counting steps on the GPU and comparing with that step number gives the same answer
// as the CPU without relying on 32-bit sums.
const lifeCache = new Map();
function lifeSteps(life, dt) {
  if (!(life > 0)) return 0;
  const key = life + '|' + dt; let k = lifeCache.get(key);
  if (k === undefined) { let a = 0; k = 0; do { a += dt; k++; } while (!(a > life)); lifeCache.set(key, k); }
  return k;
}

export function packTrials(trials) {
  const T = trials.length;
  const P = new Float32Array(T * PS), SF = new Float32Array(T * FS), SI = new Int32Array(T * IS);
  for (let t = 0; t < T; t++) {
    const { R, atoms } = trials[t];
    if (atoms.length > MAXN) throw new Error('body too large for the GPU layout');
    const w = new World(R, { cap: atoms.length + 1, boundary: 'open', T: 0, seed: 7 });
    const K = w.K, pb = t * PS, fb = t * FS, ib = t * IS;
    P[pb] = atoms.length; P[pb + 1] = K; P[pb + 2] = w.dt; P[pb + 3] = w.g1; P[pb + 4] = w.g2;
    P[pb + 5] = w.shadow; P[pb + 6] = w.bdamp; P[pb + 7] = w.rmax2;
    for (let k = 0; k < K; k++) {
      const o = pb + 8 + k * 4;
      P[o] = w.mass[k]; P[o + 1] = w.drag[k]; P[o + 2] = w.val[k]; P[o + 3] = w.recharge[k];
    }
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
      const q = i * K + j, o = pb + 32 + (i * 6 + j) * 10;
      P[o] = w.A[q]; P[o + 1] = w.R[q]; P[o + 2] = w.bon[q]; P[o + 3] = w.bform[q]; P[o + 4] = w.br0[q];
      P[o + 5] = w.bk[q]; P[o + 6] = w.bsnap[q]; P[o + 7] = lifeSteps(w.blife[q], w.dt);
      P[o + 8] = w.bcost[q]; P[o + 9] = w.bkick[q];
    }
    for (let i = 0; i < atoms.length; i++) {
      SF[fb + i] = atoms[i].x; SF[fb + 16 + i] = atoms[i].y; SF[fb + 64 + i] = 1;
      SI[ib + i] = atoms[i].t;
    }
  }
  return { P, SF, SI };
}

// Run trials on the GPU. Returns { fits, snaps, sec, chunk } where sec covers packing, simulation,
// reading back and scoring. stopAt < STEPS returns early positions only (no fits).
export async function gpuRun(device, pipeline, trials, opts = {}) {
  const stopAt = opts.stopAt || STEPS, T = trials.length, t0 = performance.now();
  const { P, SF, SI } = packTrials(trials);
  const mk = (arr, usage) => { const b = device.createBuffer({ size: arr.byteLength, usage }); device.queue.writeBuffer(b, 0, arr); return b; };
  const BU = GPUBufferUsage;
  const bP = mk(P, BU.STORAGE | BU.COPY_DST);
  const bF = mk(SF, BU.STORAGE | BU.COPY_DST | BU.COPY_SRC);
  const bI = mk(SI, BU.STORAGE | BU.COPY_DST | BU.COPY_SRC);
  const bU = device.createBuffer({ size: 8, usage: BU.UNIFORM | BU.COPY_DST });
  const rF = device.createBuffer({ size: SF.byteLength, usage: BU.MAP_READ | BU.COPY_DST });
  const rI = device.createBuffer({ size: SI.byteLength, usage: BU.MAP_READ | BU.COPY_DST });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: bU } }, { binding: 1, resource: { buffer: bP } },
    { binding: 2, resource: { buffer: bF } }, { binding: 3, resource: { buffer: bI } }] });
  const groups = Math.ceil(T / 64);
  // Short dispatches keep the browser responsive and clear of the GPU watchdog; the chunk grows
  // until one dispatch takes about targetMs.
  let chunk = opts.chunk || 10; const targetMs = opts.targetMs || 80;
  const advance = async (steps) => {
    let left = steps;
    while (left > 0) {
      const k = Math.min(chunk, left), a = performance.now();
      device.queue.writeBuffer(bU, 0, new Uint32Array([k, T]));
      const enc = device.createCommandEncoder(), pass = enc.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(groups); pass.end();
      device.queue.submit([enc.finish()]);
      await device.queue.onSubmittedWorkDone();
      const ms = performance.now() - a; left -= k;
      if (k === chunk) { if (ms < targetMs / 2) chunk = Math.min(1000, chunk * 2); else if (ms > targetMs * 2) chunk = Math.max(1, chunk >> 1); }
      if (opts.onProgress) opts.onProgress((steps - left) / steps);
    }
  };
  const read = async (src, dst, Ctor) => {
    const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(src, 0, dst, 0, dst.size);
    device.queue.submit([enc.finish()]);
    await dst.mapAsync(GPUMapMode.READ);
    const out = new Ctor(dst.getMappedRange().slice(0)); dst.unmap(); return out;
  };
  const h = STEPS >> 1, q3 = h + (STEPS >> 2);
  let F0, F1, F2, I2;
  if (stopAt < STEPS) { await advance(stopAt); F2 = await read(bF, rF, Float32Array); I2 = await read(bI, rI, Int32Array); }
  else {
    const prog = opts.onProgress; let base = 0;
    const seg = async (steps) => { opts.onProgress = prog && ((f) => prog((base + f * steps) / STEPS)); await advance(steps); base += steps; };
    await seg(h); F0 = await read(bF, rF, Float32Array);
    await seg(q3 - h); F1 = await read(bF, rF, Float32Array);
    await seg(STEPS - q3); F2 = await read(bF, rF, Float32Array); I2 = await read(bI, rI, Int32Array);
  }
  const fits = new Float64Array(T), snaps = [];
  for (let t = 0; t < T; t++) {
    const n = trials[t].atoms.length, fb = t * FS, ib = t * IS, nbonds = I2[ib + 224];
    const s = {
      n, dt: trials[t].R.dt || 0.02, bad: I2[ib + 226] !== 0, nbonds, formed: I2[ib + 225],
      x2: F2.subarray(fb, fb + n), y2: F2.subarray(fb + 16, fb + 16 + n),
      ba: I2.subarray(ib + 128, ib + 128 + nbonds), bb: I2.subarray(ib + 176, ib + 176 + nbonds),
    };
    if (F0) {
      s.x0 = F0.subarray(fb, fb + n); s.y0 = F0.subarray(fb + 16, fb + 16 + n);
      s.x1 = F1.subarray(fb, fb + n); s.y1 = F1.subarray(fb + 16, fb + 16 + n);
      fits[t] = snapshotFit(s);
    }
    if (opts.keepSnaps) snaps.push(s);
  }
  const sec = (performance.now() - t0) / 1000;
  for (const b of [bP, bF, bI, bU, rF, rI]) b.destroy();
  return { fits, snaps, sec, chunk };
}

// How closely two sets of results agree, trial by trial.
export function compareFits(a, b) {
  const cls = (f) => f < 0 ? 0 : f < 1e-4 ? 1 : 2;
  let same = 0, close = 0, both = 0, n = Math.min(a.length, b.length);
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.max(0, a[i]), y = Math.max(0, b[i]);
    if (cls(a[i]) === cls(b[i])) same++;
    if (cls(a[i]) === 2 && cls(b[i]) === 2) { both++; if (Math.abs(x - y) <= 0.1 * Math.max(x, y)) close++; }
    sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  const cov = sab / n - sa / n * sb / n, va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  return { n, sameClass: same / n, bothMoving: both, within10pct: both ? close / both : 1, corr: cov / Math.sqrt(va * vb || 1) };
}
