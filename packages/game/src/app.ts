// Shared shell for every prototype: canvases, camera, the hand, the fixed-step loop.
import { config, M, World, LAYOUT, type Recipe, spawnRecipe } from '../../sim/src/index.ts';
import { type Camera, drawBackground, drawGhost, drawLandmarks, drawSolids, drawTerrain, drawWater, fitCamera, toWorld } from './render.ts';

export interface GameOpts {
  mount: HTMLElement; world: World;
  labels?: [number, string][];
  onStep?: (g: Game) => void; // once per sim step
  onDraw?: (g: Game, ctx: CanvasRenderingContext2D) => void; // overlay, after solids
  onClickWorld?: (g: Game, x: number, y: number, node: number) => boolean; // return true to swallow the click
  canGrab?: (g: Game, node: number) => boolean;
  startX?: number;
}
export class Game {
  world: World; cam: Camera = { x: 0, y: 130, zoom: 1, w: 800, h: 600 };
  bg: HTMLCanvasElement; water: HTMLCanvasElement; fg: HTMLCanvasElement;
  mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, inside: false };
  ghost: { recipe: Recipe; angle: number; ok: boolean } | null = null;
  onPlace: ((x: number, y: number, angle: number) => void) | null = null;
  paused = false; speed = 1; night = 0; showGlyphs = false;
  keys = new Set<string>(); panning = false; panStart = 0; camStart = 0;
  opts: GameOpts; acc = 0; last = 0; stepMs = 0; fps = 60; frame = 0;
  constructor(opts: GameOpts) {
    this.opts = opts; this.world = opts.world;
    const m = opts.mount; m.classList.add('stage');
    this.bg = el('canvas'); this.water = el('canvas', 'water'); this.fg = el('canvas', 'fg');
    m.append(this.bg, this.water, this.fg);
    this.cam.x = (opts.startX ?? LAYOUT.home[0]) - 200;
    const ro = new ResizeObserver(() => this.resize()); ro.observe(m); this.resize();
    this.bind();
    requestAnimationFrame((t) => this.tick(t));
  }
  resize() {
    const r = this.opts.mount.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(200, Math.floor(r.width)), h = Math.max(200, Math.floor(r.height));
    for (const c of [this.bg, this.water, this.fg]) { c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; }
    fitCamera(this.cam, w * dpr, h * dpr); this.dpr = dpr; this.clampCam();
  }
  dpr = 1;
  clampCam() { const max = this.world.terrain.width - this.cam.w / this.cam.zoom; this.cam.x = Math.max(0, Math.min(max, this.cam.x)); }
  centerOn(x: number) { this.cam.x = x - this.cam.w / this.cam.zoom / 2; this.clampCam(); }
  private setMouse(e: PointerEvent) {
    const r = this.fg.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) * this.dpr; this.mouse.y = (e.clientY - r.top) * this.dpr;
    const p = toWorld(this.cam, this.mouse.x, this.mouse.y); this.mouse.wx = p.x; this.mouse.wy = p.y;
  }
  private bind() {
    const c = this.fg; c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId); this.setMouse(e); this.mouse.down = true; this.mouse.inside = true;
      const w = this.world;
      if (this.ghost) { if (this.ghost.ok) { const g = this.ghost; this.ghost = null; this.onPlace?.(this.mouse.wx, this.mouse.wy, g.angle); } return; }
      const node = w.nearestNode(this.mouse.wx, this.mouse.wy, 16, (i) => w.mat[i] !== M.WATER);
      if (this.opts.onClickWorld?.(this, this.mouse.wx, this.mouse.wy, node)) return;
      if (node >= 0 && (this.opts.canGrab?.(this, node) ?? true)) w.grab(node, this.mouse.wx, this.mouse.wy);
      else { this.panning = true; this.panStart = this.mouse.x; this.camStart = this.cam.x; }
    });
    c.addEventListener('pointermove', (e) => {
      this.setMouse(e); this.mouse.inside = true;
      if (this.panning) { this.cam.x = this.camStart - (this.mouse.x - this.panStart) / this.cam.zoom; this.clampCam(); }
    });
    const up = () => { this.mouse.down = false; this.panning = false; if (this.world.hand.active) this.world.release(); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.x += (e.deltaX || e.deltaY) / this.cam.zoom; this.clampCam(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement; if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Escape') this.ghost = null;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  /** Put a recipe on the cursor as a ghost; the next click places it. */
  hold(recipe: Recipe, place?: (x: number, y: number, angle: number) => void) {
    this.ghost = { recipe, angle: 0, ok: true };
    this.onPlace = place ?? ((x, y, a) => { spawnRecipe(this.world, recipe, x, y, { angle: a }); });
  }
  private tick(t: number) {
    requestAnimationFrame((n) => this.tick(n));
    const dt = Math.min(0.1, (t - (this.last || t)) / 1000); this.last = t; this.frame++;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.05;
    const w = this.world, k = this.keys, pan = 700 * dt;
    if (k.has('a') || k.has('arrowleft')) this.cam.x -= pan;
    if (k.has('d') || k.has('arrowright')) this.cam.x += pan;
    // carrying something toward the screen edge scrolls the view
    if ((w.hand.active || this.ghost) && this.mouse.inside) {
      const edge = this.cam.w * 0.12;
      if (this.mouse.x < edge) this.cam.x -= pan * (1 - this.mouse.x / edge);
      if (this.mouse.x > this.cam.w - edge) this.cam.x += pan * (1 - (this.cam.w - this.mouse.x) / edge);
    }
    this.clampCam();
    const p = toWorld(this.cam, this.mouse.x, this.mouse.y); this.mouse.wx = p.x; this.mouse.wy = p.y;
    const spin = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
    if (this.ghost) { this.ghost.angle += spin * 2.5 * dt; this.ghost.ok = this.mouse.wy < w.terrain.groundY(this.mouse.wx); }
    if (!this.paused) {
      this.acc += dt * this.speed; let n = 0; const t0 = performance.now();
      const maxSteps = Math.max(2, Math.ceil(this.speed * 2));
      while (this.acc >= config.dt && n < maxSteps) {
        if (w.hand.active) { w.hand.x = this.mouse.wx; w.hand.y = this.mouse.wy; w.hand.spin = spin; }
        w.step(); this.opts.onStep?.(this); this.acc -= config.dt; n++;
      }
      if (this.acc > config.dt * 3) this.acc = 0; // fell behind: drop time rather than spiral
      if (n) this.stepMs += ((performance.now() - t0) / n - this.stepMs) * 0.1;
    }
    this.draw();
  }
  draw() {
    const cam = this.cam, w = this.world;
    const b = this.bg.getContext('2d')!; drawBackground(b, cam, w, this.night); drawTerrain(b, cam, w, this.night); drawLandmarks(b, cam, w, LAYOUT, this.opts.labels ?? []);
    drawWater(this.water.getContext('2d')!, cam, w);
    const f = this.fg.getContext('2d')!; f.clearRect(0, 0, cam.w, cam.h);
    drawSolids(f, cam, w, { showGlyphs: this.showGlyphs });
    this.opts.onDraw?.(this, f);
    if (this.ghost && this.mouse.inside) drawGhost(f, cam, this.ghost.recipe.grid, this.mouse.wx, this.mouse.wy, this.ghost.angle, this.ghost.ok);
  }
}
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
}
/** Shared chrome: fonts, layout, panel styles. Each prototype's page includes this once. */
export const BASE_CSS = `
/* layout: full-bleed stage with a narrow tool panel on the right; stacks on phones */
:root{--ink:#23211e;--panel:#2b3038;--panel2:#363c46;--line:#4a515d;--text:#eef0ea;--muted:#a9b0b8;--accent:#f0b429;--good:#7ccf8a;--bad:#ef6f6c;
--display:"Baloo 2","Trebuchet MS",system-ui,sans-serif;--body:"Nunito",system-ui,-apple-system,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color-scheme:dark}
html,body{height:100%}
body{background:var(--panel);color:var(--text);font-family:var(--body);font-size:14px;line-height:1.4;display:flex;flex-direction:column;overflow:hidden}
header.bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-block:8px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));border-bottom:1px solid var(--line)}
header.bar h1{font-family:var(--display);font-size:20px;font-weight:700;margin:0;letter-spacing:.2px}
header.bar .tag{font-size:12px;color:var(--muted)}
header.bar .spacer{flex:1}
.wrap{flex:1;min-height:0;display:flex}
.stage{position:relative;flex:1;min-width:0;overflow:hidden;background:#bfe3df;cursor:grab}
.stage canvas{position:absolute;inset:0;display:block}
.stage canvas.water{filter:url(#goo);opacity:.86}
.side{width:300px;flex:none;border-left:1px solid var(--line);overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:14px}
.side h2{font-family:var(--display);font-size:15px;margin:0 0 6px;font-weight:600}
.side p{margin:0;color:var(--muted);font-size:12.5px}
.row{display:flex;flex-wrap:wrap;gap:6px}
button{font:inherit;font-weight:700;color:var(--text);background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:5px 10px;cursor:pointer}
button:hover{border-color:var(--accent)}
button:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
button.primary{background:var(--accent);color:#2a2000;border-color:var(--accent)}
button:disabled{opacity:.45;cursor:not-allowed}
textarea,input[type=text]{width:100%;box-sizing:border-box;font-family:var(--mono);font-size:14px;line-height:1.15;letter-spacing:.28em;background:#1d2127;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:8px}
input[type=text]{letter-spacing:0;font-family:var(--body)}
.msg{font-size:12.5px;min-height:1.2em}.msg.bad{color:var(--bad)}.msg.good{color:var(--good)}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:2px 9px 2px 4px;font-variant-numeric:tabular-nums}
.dot{width:14px;height:14px;border-radius:50%;display:inline-block;border:1.5px solid #0006}
.hint{position:absolute;left:12px;bottom:10px;font-size:12px;color:#23211ecc;background:#ffffffb0;border-radius:9px;padding:4px 10px;pointer-events:none;max-width:calc(100% - 24px)}
kbd{font-family:var(--mono);font-size:11px;background:#fff;border:1px solid #0003;border-radius:4px;padding:0 4px}
.legend{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;font-size:12px;color:var(--muted);align-items:center}
.legend b{color:var(--text);font-family:var(--mono)}
@media (max-width:760px){.wrap{flex-direction:column}.side{width:auto;border-left:0;border-top:1px solid var(--line);max-height:42%}}
`;
export const GOO_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="4"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter></svg>`;
