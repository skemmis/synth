import { MATERIALS, M, World, B_ANCHOR, B_BRACE, B_STICKY, B_TENSION, LAYOUT, type Layout } from '../../sim/src/index.ts';

export interface Camera { x: number; y: number; zoom: number; w: number; h: number; }
export const PAL = {
  skyTop: '#bfe3df', skyBot: '#f2efd3', hillFar: '#a9cfc0', hillNear: '#8dbb9f',
  ground: '#3f3a34', groundTop: '#5d7a3e', groundDeep: '#2c2925', water: '#3fa7dc', ink: '#23211e',
};
const VIEW_TOP = 130, VIEW_H = 640;
export const fitCamera = (cam: Camera, w: number, h: number) => { cam.w = w; cam.h = h; cam.zoom = h / VIEW_H; cam.y = VIEW_TOP; };
export const toWorld = (cam: Camera, sx: number, sy: number) => ({ x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom });

export function drawBackground(ctx: CanvasRenderingContext2D, cam: Camera, world: World, night = 0) {
  const { w, h } = cam;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(PAL.skyTop, '#1c2440', night)); g.addColorStop(1, mix(PAL.skyBot, '#4a4468', night));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // parallax hills
  for (const [par, col, amp, base] of [[0.25, PAL.hillFar, 60, 470], [0.5, PAL.hillNear, 40, 530]] as const) {
    ctx.fillStyle = mix(col, '#232a44', night * 0.85); ctx.beginPath(); ctx.moveTo(0, h);
    for (let sx = 0; sx <= w + 20; sx += 20) {
      const wx = cam.x * par + sx / cam.zoom;
      const y = base - amp * (Math.sin(wx * 0.004) + 0.5 * Math.sin(wx * 0.011 + 2));
      ctx.lineTo(sx, (y - cam.y) * cam.zoom);
    }
    ctx.lineTo(w, h); ctx.fill();
  }
}
export function drawTerrain(ctx: CanvasRenderingContext2D, cam: Camera, world: World, night = 0) {
  const { w, h } = cam, ter = world.terrain;
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let sx = 0; sx <= w + 8; sx += 8) ctx.lineTo(sx, (ter.groundY(cam.x + sx / cam.zoom) - cam.y) * cam.zoom);
  ctx.lineTo(w, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, (LAYOUT.base - cam.y) * cam.zoom, 0, h);
  g.addColorStop(0, mix(PAL.ground, '#191a26', night * 0.6)); g.addColorStop(1, mix(PAL.groundDeep, '#101018', night * 0.6));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineJoin = 'round'; ctx.strokeStyle = mix(PAL.groundTop, '#26364a', night * 0.7); ctx.lineWidth = 5 * cam.zoom;
  ctx.beginPath();
  for (let sx = -8; sx <= w + 8; sx += 8) { const y = (ter.groundY(cam.x + sx / cam.zoom) - cam.y) * cam.zoom; if (sx === -8) ctx.moveTo(sx, y); else ctx.lineTo(sx, y); }
  ctx.stroke();
}
export function drawWater(ctx: CanvasRenderingContext2D, cam: Camera, world: World) {
  ctx.clearRect(0, 0, cam.w, cam.h);
  ctx.fillStyle = PAL.water;
  const z = cam.zoom, r = 8.5 * z, x0 = cam.x - 20, x1 = cam.x + cam.w / z + 20;
  ctx.beginPath();
  for (let i = 0; i < world.n; i++) {
    if (!world.alive[i] || world.mat[i] !== M.WATER) continue;
    const x = world.x[i]; if (x < x0 || x > x1) continue;
    const sx = (x - cam.x) * z, sy = (world.y[i] - cam.y) * z;
    ctx.moveTo(sx + r, sy); ctx.arc(sx, sy, r, 0, 6.2832);
  }
  ctx.fill();
}
export interface DrawOpts { highlightBody?: number; showGlyphs?: boolean; dim?: (i: number) => boolean; }
export function drawSolids(ctx: CanvasRenderingContext2D, cam: Camera, world: World, opts: DrawOpts = {}) {
  const z = cam.zoom, x0 = cam.x - 40, x1 = cam.x + cam.w / z + 40;
  const X = (v: number) => (v - cam.x) * z, Y = (v: number) => (v - cam.y) * z;
  ctx.lineCap = 'round';
  // strands
  for (let k = 0; k < world.nb; k++) {
    if (!world.balive[k]) continue;
    const fl = world.bflags[k]; if (fl & B_BRACE) continue;
    const a = world.ba[k], b = world.bb[k];
    if (world.x[a] < x0 || world.x[a] > x1) continue;
    if (fl & B_ANCHOR) {
      ctx.strokeStyle = MATERIALS[M.PITCH].color; ctx.lineWidth = 5 * z;
      ctx.beginPath(); ctx.moveTo(X(world.x[a]), Y(world.y[a])); ctx.lineTo(X(world.bax[k]), Y(world.bay[k])); ctx.stroke();
      continue;
    }
    const ma = MATERIALS[world.mat[a]], mb = MATERIALS[world.mat[b]];
    const diag = world.brest[k] > 18;
    if (fl & B_STICKY) { ctx.strokeStyle = MATERIALS[M.PITCH].color; ctx.lineWidth = 4 * z; }
    else if (fl & B_TENSION) { ctx.strokeStyle = MATERIALS[M.FIBER].edge; ctx.lineWidth = (diag ? 1.5 : 3.5) * z; }
    else { ctx.strokeStyle = ma.strength <= mb.strength ? ma.edge : mb.edge; ctx.lineWidth = (diag ? 4 : 9) * z; }
    ctx.beginPath(); ctx.moveTo(X(world.x[a]), Y(world.y[a])); ctx.lineTo(X(world.x[b]), Y(world.y[b])); ctx.stroke();
  }
  // nodes
  for (let i = 0; i < world.n; i++) {
    if (!world.alive[i]) continue; const mi = world.mat[i]; if (mi === M.WATER) continue;
    const x = world.x[i]; if (x < x0 || x > x1) continue;
    const m = MATERIALS[mi], sx = X(x), sy = Y(world.y[i]), r = m.radius * z;
    // squash a little along the direction of travel
    const vx = x - world.px[i], vy = world.y[i] - world.py[i], sp = Math.min(0.25, Math.sqrt(vx * vx + vy * vy) * 0.25);
    ctx.save(); ctx.translate(sx, sy);
    if (sp > 0.02) { ctx.rotate(Math.atan2(vy, vx)); ctx.scale(1 + sp, 1 - sp * 0.6); }
    ctx.fillStyle = m.edge; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(0, 0, r - 1.6 * z, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(sx - r * 0.3, sy - r * 0.35, r * 0.28, 0, 6.2832); ctx.fill();
    if (mi === M.THORN) { ctx.strokeStyle = m.edge; ctx.lineWidth = 1.6 * z; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.047 + i; ctx.moveTo(sx + Math.cos(a) * r * 0.8, sy + Math.sin(a) * r * 0.8); ctx.lineTo(sx + Math.cos(a) * r * 1.45, sy + Math.sin(a) * r * 1.45); } ctx.stroke(); }
    if (mi === M.HEART) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, r * (0.3 + 0.12 * Math.sin(world.time * 8)), 0, 6.2832); ctx.fill(); }
    const hurt = 1 - world.hp[i] / m.hp;
    if (hurt > 0.05) { ctx.fillStyle = `rgba(20,10,10,${Math.min(0.6, hurt * 0.7)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill(); }
    if (opts.dim?.(i)) { ctx.fillStyle = 'rgba(30,30,40,.45)'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill(); }
    if (opts.showGlyphs) { ctx.fillStyle = PAL.ink; ctx.font = `${Math.round(9 * z)}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.glyph, sx, sy + 0.5); }
  }
  if (world.hand.active && world.hand.node >= 0) {
    const i = world.hand.node;
    ctx.strokeStyle = 'rgba(35,33,30,.55)'; ctx.lineWidth = 2 * z; ctx.setLineDash([4 * z, 4 * z]);
    ctx.beginPath(); ctx.moveTo(X(world.x[i]), Y(world.y[i])); ctx.lineTo(X(world.hand.x), Y(world.hand.y)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.5 * z; ctx.beginPath(); ctx.arc(X(world.hand.x), Y(world.hand.y), 7 * z, 0, 6.2832); ctx.stroke();
  }
}
/** Small labelled props so the strip has landmarks. Purely decorative. */
export function drawLandmarks(ctx: CanvasRenderingContext2D, cam: Camera, world: World, L: Layout = LAYOUT, labels: [number, string][] = []) {
  const z = cam.zoom;
  ctx.font = `600 ${Math.round(12 * z)}px "Nunito", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const [x, text] of labels) {
    const sx = (x - cam.x) * z; if (sx < -100 || sx > cam.w + 100) continue;
    const gy = world.terrain.groundY(x), sy = (gy - cam.y) * z + 26 * z;
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(text, sx, sy);
  }
  // burrow mouth
  const bx = (L.burrow - cam.x) * z, by = (world.terrain.groundY(L.burrow) - cam.y) * z;
  if (bx > -100 && bx < cam.w + 100) { ctx.fillStyle = '#14110f'; ctx.beginPath(); ctx.ellipse(bx + 20 * z, by - 4 * z, 30 * z, 22 * z, 0, Math.PI, 0); ctx.fill(); }
}
export function drawGhost(ctx: CanvasRenderingContext2D, cam: Camera, grid: string[], wx: number, wy: number, angle = 0, ok = true) {
  const z = cam.zoom, H = grid.length, W = Math.max(0, ...grid.map((l) => l.length));
  ctx.save(); ctx.translate((wx - cam.x) * z, (wy - cam.y) * z); ctx.rotate(angle); ctx.globalAlpha = 0.6;
  for (let r = 0; r < H; r++) for (let c = 0; c < grid[r].length; c++) {
    const ch = grid[r][c]; if (ch === '.') continue; const m = MATERIALS.find((t) => t.glyph === ch); if (!m) continue;
    ctx.fillStyle = ok ? m.color : '#888'; ctx.strokeStyle = m.edge; ctx.lineWidth = 1.5 * z;
    ctx.beginPath(); ctx.arc((c - (W - 1) / 2) * 16 * z, (r - (H - 1) / 2) * 16 * z, 7.5 * z, 0, 6.2832); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a; if (t >= 1) return b;
  const p = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
