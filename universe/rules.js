// Rule sets ("universes") and organisms (initial atom placements): sampling and mutation.
import { rng32 } from './sim.js';

const lerp = (a, b, u) => a + (b - a) * u;
const logu = (a, b, u) => Math.exp(lerp(Math.log(a), Math.log(b), u));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function gauss(r) { return (r() + r() + r() + r() - 2) * 1.732; }

export const RANGE = {
  m: [0.5, 3], drag: [0.3, 3], recharge: [0.02, 2],
  a: [-4, 4], R: [1.5, 3.5],
  r0: [0.8, 2], formRatio: [0.9, 1.8], k: [5, 150], snap: [0.2, 2], life: [0.2, 8], kick: [0.2, 6],
  g1: [0.2, 4], g2: [0.05, 1.5], shadow: [0.2, 0.95], bdamp: [0, 3], T: [0, 0.3], eUnit: [10, 400],
};

export function randomBond(r) {
  const r0 = lerp(...RANGE.r0, r());
  return {
    on: r() < 0.5 ? 1 : 0, r0, form: r0 * lerp(...RANGE.formRatio, r()),
    k: logu(...RANGE.k, r()), snap: lerp(...RANGE.snap, r()),
    life: r() < 0.5 ? 0 : logu(...RANGE.life, r()),
    kick: r() < 0.6 ? 0 : logu(...RANGE.kick, r()),
  };
}
export function randomType(r) {
  return { m: logu(...RANGE.m, r()), drag: logu(...RANGE.drag, r()), val: Math.floor(r() * 7), recharge: r() < 0.25 ? 0 : logu(...RANGE.recharge, r()) };
}
export function randomPair(r) { return { a: r() < 0.2 ? 0 : lerp(...RANGE.a, r()), R: lerp(...RANGE.R, r()) }; }

// opts: { K, medium: 'any' | 'linear' | 'quad' | 'shadow' | 'both', bonds: true/false, nonrecip }
export function randomRules(r, opts = {}) {
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
export function addType(r, R, type, selfBond) {
  const K = R.K; R.types.push({ ...randomType(r), ...type });
  for (let i = 0; i < K; i++) {
    const p = randomPair(r); R.pair[i][K] = p; R.bond[i][K] = randomBond(r);
  }
  R.pair[K] = []; R.bond[K] = [];
  for (let i = 0; i < K; i++) { R.pair[K][i] = { ...R.pair[i][K] }; R.bond[K][i] = null; }
  R.pair[K][K] = randomPair(r); R.bond[K][K] = { ...randomBond(r), ...selfBond };
  R.K = K + 1; return K;
}
export function ring(t, n, spacing, cx = 0, cy = 0) {
  const rad = n * spacing / 6.283185307, out = [];
  for (let i = 0; i < n; i++) out.push({ t, x: cx + rad * Math.cos(6.283185307 * i / n), y: cy + rad * Math.sin(6.283185307 * i / n) });
  return out;
}
export const clone = (o) => JSON.parse(JSON.stringify(o));

function mutNum(r, v, range, log, strength) {
  if (log) return clamp(Math.exp(Math.log(v) + gauss(r) * strength * Math.log(range[1] / range[0])), range[0], range[1]);
  return clamp(v + gauss(r) * strength * (range[1] - range[0]), range[0], range[1]);
}

// Mutate a rule set in place. lock: { medium: true } keeps g2/shadow zero-ness fixed.
export function mutateRules(r, R, rate = 0.15, strength = 0.15, lock = {}) {
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
export function randomOrganism(r, K, nMin = 3, nMax = 16) {
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
export function mutateOrganism(r, atoms, K, nMax = 24) {
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
export { rng32, gauss, lerp, logu, clamp };
