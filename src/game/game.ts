import { CONFIG, LAYOUT, parseGrid, spawnGrid, validateGrid, type World } from '../sim';
import { Renderer, type Camera, type Floater, type Ghost, type Scenery } from './render';
import { buildWorld } from './worldgen';

export const VIEW_H = 640;
export const VIEW_TOP = 130;

/** Loop, camera and the hand. Milestone features hang off this. */
export class Game {
  renderer: Renderer;
  world: World;
  cam: Camera = { x: 0, y: VIEW_TOP, scale: 1, viewW: 1200, viewH: VIEW_H };
  cursor = { x: 0, y: 0, sx: 0, sy: 0, down: false, inside: false };
  keys = new Set<string>();
  ghost: Ghost | null = null;
  scenery: Scenery[] = [];
  floaters: Floater[] = [];
  label: { x: number; y: number; text: string } | null = null;
  clock = 0;
  paused = false;
  /** the live world stands still (during the dream) but the screen keeps drawing */
  frozen = false;
  speed = 1;
  seed = 1;
  night = 0;
  fps = 60;
  stepMs = 0;
  private acc = 0;
  private last = 0;
  private panning: { sx: number; camX: number } | null = null;
  /** hooks for later milestones */
  onStep: ((g: Game) => void)[] = [];
  onFrame: ((g: Game) => void)[] = [];
  onPlace: ((g: Game, grid: string[], body: number) => void)[] = [];
  /** return true to consume a click on empty space / a node */
  onClick: ((g: Game, node: number) => boolean)[] = [];
  onRightClick: ((g: Game, node: number) => void)[] = [];
  canPlace: (g: Game, grid: string[]) => boolean = () => true;
  /** set false when A and D mean something else (the avatar variant walks with them) */
  panKeys = true;
  /** optional limit on where the hand can be (the avatar variant has an arm's reach) */
  handLimit: ((x: number, y: number) => [number, number]) | null = null;
  /** nodes that get a face drawn on them */
  faces: number[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.world = buildWorld(this.seed);
    this.resize();
    this.centerOn(760);
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  reset(seed = this.seed, starters = true) {
    this.seed = seed;
    this.world = buildWorld(seed, starters);
    this.ghost = null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, hgt = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    this.cam.scale = this.canvas.height / VIEW_H;
    this.cam.viewW = this.canvas.width / this.cam.scale;
    this.clampCam();
  }

  clampCam() {
    const max = CONFIG.world.width - this.cam.viewW;
    this.cam.x = Math.max(0, Math.min(max, this.cam.x));
  }

  centerOn(x: number) {
    this.cam.x = x - this.cam.viewW / 2;
    this.clampCam();
  }

  private toWorld(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / r.width;
    this.cursor.sx = e.clientX - r.left;
    this.cursor.sy = e.clientY - r.top;
    this.cursor.x = this.cam.x + (this.cursor.sx * dpr) / this.cam.scale;
    this.cursor.y = this.cam.y + (this.cursor.sy * dpr) / this.cam.scale;
  }

  private typing(): boolean {
    const a = document.activeElement;
    return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
  }

  private bindInput() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      this.toWorld(e);
      this.cursor.inside = true;
      if (this.panning) {
        const r = c.getBoundingClientRect();
        const dpr = c.width / r.width;
        this.cam.x = this.panning.camX - ((e.clientX - this.panning.sx) * dpr) / this.cam.scale;
        this.clampCam();
      }
    });
    c.addEventListener('pointerleave', () => { this.cursor.inside = false; });
    c.addEventListener('pointerdown', (e) => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      c.setPointerCapture(e.pointerId);
      this.toWorld(e);
      this.cursor.down = true;
      if (e.button === 2) {
        if (this.ghost) { this.ghost = null; return; }
        const n2 = this.world.nodeAt(this.cursor.x, this.cursor.y);
        for (const f of this.onRightClick) f(this, n2);
        return;
      }
      if (this.ghost) { this.placeGhost(); return; }
      const node = this.world.nodeAt(this.cursor.x, this.cursor.y);
      for (const f of this.onClick) if (f(this, node)) return;
      if (node >= 0) this.world.grab(node);
      else this.panning = { sx: e.clientX, camX: this.cam.x };
    });
    const up = () => {
      this.cursor.down = false;
      this.panning = null;
      if (this.world.hand.active) this.world.release();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.x += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.2;
      this.clampCam();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (this.typing()) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Escape') this.ghost = null;
      if (e.key === ' ') { this.paused = !this.paused; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** put a recipe on the cursor, ready to drop */
  hold(grid: string[]) {
    this.ghost = { grid, x: this.cursor.x, y: this.cursor.y, angle: 0, ok: true };
  }

  private placeGhost() {
    const gh = this.ghost!;
    if (!gh.ok || !this.canPlace(this, gh.grid)) return;
    const sp = spawnGrid(this.world, gh.grid, gh.x, gh.y, { angle: gh.angle });
    for (const f of this.onPlace) f(this, gh.grid, sp.body);
    if (!this.keys.has('shift')) this.ghost = null;
  }

  /** would this recipe overlap the ground at the ghost position? */
  private ghostFits(gh: Ghost): boolean {
    const hgt = gh.grid.length, w = gh.grid[0].length;
    const ca = Math.cos(gh.angle), sa = Math.sin(gh.angle);
    for (let r = 0; r < hgt; r++) for (let c = 0; c < w; c++) {
      if (gh.grid[r][c] === '.') continue;
      const lx = (c - (w - 1) / 2) * 12, ly = (r - (hgt - 1) / 2) * 12;
      const x = gh.x + lx * ca - ly * sa, y = gh.y + lx * sa + ly * ca;
      if (y + 5 > this.world.terrain.heightAt(x)) return false;
    }
    return true;
  }

  start() {
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
      this.update(dt);
      this.render(now / 1000);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt: number) {
    const k = this.keys;
    const pan = ((this.panKeys && k.has('a')) || k.has('arrowleft') ? -1 : 0) + ((this.panKeys && k.has('d')) || k.has('arrowright') ? 1 : 0);
    if (pan) { this.cam.x += pan * 700 * dt; this.clampCam(); }
    // nudge the camera when carrying something to the edge of the screen
    if ((this.world.hand.active || this.ghost) && this.cursor.inside) {
      const w = this.canvas.clientWidth, edge = 70;
      const push = this.cursor.sx < edge ? -(1 - this.cursor.sx / edge) : this.cursor.sx > w - edge ? 1 - (w - this.cursor.sx) / edge : 0;
      if (push) {
        const old = this.cam.x;
        this.cam.x += push * 520 * dt;
        this.clampCam();
        this.cursor.x += this.cam.x - old;
      }
    }
    const rot = (k.has('q') ? -1 : 0) + (k.has('e') ? 1 : 0);
    if (this.ghost) {
      this.ghost.x = this.cursor.x; this.ghost.y = this.cursor.y;
      this.ghost.angle += rot * CONFIG.hand.rotateSpeed * dt;
      this.ghost.ok = this.ghostFits(this.ghost);
    }
    if (this.paused || this.frozen) return;
    this.acc += dt * this.speed;
    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= CONFIG.dt && steps < 4) {
      const hand = this.world.hand;
      if (hand.active) {
        if (this.handLimit) [hand.x, hand.y] = this.handLimit(this.cursor.x, this.cursor.y);
        else { hand.x = this.cursor.x; hand.y = this.cursor.y; }
        hand.angle += rot * CONFIG.hand.rotateSpeed * CONFIG.dt;
      }
      this.world.step();
      for (const f of this.onStep) f(this);
      this.acc -= CONFIG.dt;
      steps++;
    }
    if (steps) this.stepMs += ((performance.now() - t0) / steps - this.stepMs) * 0.1;
    if (this.acc > CONFIG.dt * 4) this.acc = 0;
  }

  float(x: number, y: number, text: string, color?: string) {
    this.floaters.push({ x, y, text, born: this.clock, color });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  render(time: number) {
    this.clock = time;
    const hover = !this.world.hand.active && !this.ghost && this.cursor.inside
      ? this.world.nodeAt(this.cursor.x, this.cursor.y) : -1;
    this.renderer.draw(this.world, this.cam, {
      ghost: this.ghost,
      cursor: this.cursor.inside ? this.cursor : null,
      scenery: this.scenery,
      night: this.night,
      hover,
      faces: this.faces,
      floaters: this.floaters,
      label: this.label,
      time,
    });
    for (const f of this.onFrame) f(this);
  }

  /** try to read text as a recipe grid; returns the grid or the errors */
  static readGrid(text: string): { grid?: string[]; errors: string[] } {
    const grid = parseGrid(text);
    const v = validateGrid(grid, { allowDisconnected: true });
    return v.ok ? { grid, errors: [] } : { errors: v.errors };
  }
}

export { LAYOUT };
