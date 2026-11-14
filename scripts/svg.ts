import { MATERIALS } from '../packages/sim/src/materials.ts';
import type { World } from '../packages/sim/src/world.ts';
export function toSvg(w: World, x0: number, y0: number, x1: number, y1: number, scale = 1): string {
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${(x1 - x0) * scale}" height="${(y1 - y0) * scale}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}"><rect x="${x0}" y="${y0}" width="100%" height="100%" fill="#f3ead8"/>`];
  let p = `M${x0},${y1}`; for (let x = x0; x <= x1; x += 8) p += `L${x},${w.terrain.groundY(x).toFixed(1)}`; p += `L${x1},${y1}Z`;
  out.push(`<path d="${p}" fill="#6b5a45"/>`);
  for (let k = 0; k < w.nb; k++) { if (!w.balive[k] || w.bb[k] < 0) continue; const a = w.ba[k], b = w.bb[k]; out.push(`<line x1="${w.x[a].toFixed(1)}" y1="${w.y[a].toFixed(1)}" x2="${w.x[b].toFixed(1)}" y2="${w.y[b].toFixed(1)}" stroke="#3338" stroke-width="2"/>`); }
  for (let i = 0; i < w.n; i++) { if (!w.alive[i]) continue; const m = MATERIALS[w.mat[i]]; if (w.x[i] < x0 - 20 || w.x[i] > x1 + 20) continue; out.push(`<circle cx="${w.x[i].toFixed(1)}" cy="${w.y[i].toFixed(1)}" r="${m.radius}" fill="${m.color}" stroke="${m.edge}"/>`); }
  if (w.hand.active) out.push(`<circle cx="${w.hand.x}" cy="${w.hand.y}" r="5" fill="none" stroke="red" stroke-width="2"/>`);
  out.push('</svg>'); return out.join('');
}
