import { MATERIALS } from './materials';
import type { World } from './world';

/** Dump a region of the world as SVG (debugging and test snapshots). */
export function toSvg(world: World, x0: number, y0: number, x1: number, y1: number, scale = 2): string {
  const out: string[] = [];
  const w = (x1 - x0) * scale, h = (y1 - y0) * scale;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}">`);
  out.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#f4efe6"/>`);
  let d = `M ${x0} ${y1}`;
  for (let x = x0; x <= x1; x += 4) d += ` L ${x} ${world.terrain.heightAt(x).toFixed(1)}`;
  out.push(`<path d="${d} L ${x1} ${y1} Z" fill="#6b5b4b"/>`);
  for (let k = 0; k < world.bn; k++) {
    if (!world.balive[k]) continue;
    const a = world.ba[k], b = world.bb[k];
    if (world.x[a] < x0 || world.x[a] > x1) continue;
    out.push(`<line x1="${world.x[a].toFixed(1)}" y1="${world.y[a].toFixed(1)}" x2="${world.x[b].toFixed(1)}" y2="${world.y[b].toFixed(1)}" stroke="#0004" stroke-width="1"/>`);
  }
  for (let i = 0; i < world.n; i++) {
    if (!world.alive[i] || world.x[i] < x0 || world.x[i] > x1) continue;
    out.push(`<circle cx="${world.x[i].toFixed(1)}" cy="${world.y[i].toFixed(1)}" r="${world.rad[i].toFixed(1)}" fill="${MATERIALS[world.mat[i]].color}"/>`);
  }
  if (world.hand.active) out.push(`<circle cx="${world.hand.x}" cy="${world.hand.y}" r="4" fill="none" stroke="red"/>`);
  out.push('</svg>');
  return out.join('\n');
}
