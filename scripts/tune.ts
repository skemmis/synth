import { stripWorld, run } from '../packages/sim/src/scenarios.ts';
import { config } from '../packages/sim/src/config.ts';
for (const [k, kn, visc, rest] of [[60000,90000,0.08,2],[20000,40000,0.08,2],[20000,40000,0.2,2],[8000,20000,0.15,2],[20000,60000,0.15,2.4],[30000,30000,0.15,2.4]]) {
  Object.assign(config, { fluidK: k, fluidKNear: kn, fluidViscosity: visc, fluidRest: rest });
  const w = stripWorld(); run(w, 4);
  const ys: number[] = []; let v = 0, vmax = 0, minD = 1e9;
  for (let i = 0; i < w.n; i++) { ys.push(w.y[i]); const s = Math.hypot(w.x[i] - w.px[i], w.y[i] - w.py[i]) * 480; v += s; vmax = Math.max(vmax, s); }
  for (let i = 0; i < w.n; i++) for (let j = i + 1; j < w.n; j++) { const d = Math.hypot(w.x[i] - w.x[j], w.y[i] - w.y[j]); if (d < minD) minD = d; }
  ys.sort((a, b) => a - b);
  console.log({ k, kn, visc, rest }, 'surface', ys[10].toFixed(0), 'p50', ys[w.n >> 1].toFixed(0), 'avgSpeed', (v / w.n).toFixed(1), 'max', vmax.toFixed(0), 'minDist', minD.toFixed(1));
}
