import { B_STICKY, B_TENSION, LAYOUT, MATERIALS, Mat, NODE_RADIUS, type World } from '../sim';

export interface Camera { x: number; y: number; scale: number; viewW: number; viewH: number }

export interface Ghost { grid: string[]; x: number; y: number; angle: number; ok: boolean }

export interface Scenery { kind: string; x: number; label: string; stock?: number }

export interface Floater { x: number; y: number; text: string; born: number; color?: string }

export interface DrawExtras {
  ghost?: Ghost | null;
  cursor?: { x: number; y: number; down: boolean } | null;
  scenery?: Scenery[];
  night?: number; // 0 day .. 1 night
  hover?: number; // node under cursor
  floaters?: Floater[];
  label?: { x: number; y: number; text: string } | null;
  time: number;
}

const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

const DARK = MATERIALS.map((m) => shade(m.color, -0.35));
const LIGHT = MATERIALS.map((m) => shade(m.color, 0.35));

export const PALETTE = {
  skyTop: '#f6e7c8', skyBottom: '#f3d6b3', nightTop: '#1d2140', nightBottom: '#3b3560',
  hillFar: '#e2c79c', hillNear: '#cfae82', soil: '#5d4a3c', soilDeep: '#463629', grass: '#8aa35b',
  water: '#4f9fdc', waterLight: '#9fd0f2', ink: '#2c2420',
};

export class Renderer {
  ctx: CanvasRenderingContext2D;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(world: World, cam: Camera, ex: DrawExtras) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const night = ex.night ?? 0;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix(PALETTE.skyTop, PALETTE.nightTop, night));
    g.addColorStop(1, mix(PALETTE.skyBottom, PALETTE.nightBottom, night));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // far hills, with parallax
    for (const [par, col, base, amp] of [[0.25, PALETTE.hillFar, 430, 60], [0.5, PALETTE.hillNear, 480, 40]] as const) {
      ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * par * cam.scale, -cam.y * cam.scale);
      ctx.fillStyle = mix(col, PALETTE.nightBottom, night * 0.8);
      ctx.beginPath();
      const x0 = cam.x * par - 20, x1 = x0 + cam.viewW + 40;
      ctx.moveTo(x0, 900);
      for (let x = x0; x <= x1; x += 20) {
        ctx.lineTo(x, base - amp * (Math.sin(x * 0.004 + par * 9) * 0.6 + Math.sin(x * 0.011 + par * 3) * 0.4));
      }
      ctx.lineTo(x1, 900);
      ctx.fill();
    }

    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
    const x0 = cam.x - 30, x1 = cam.x + cam.viewW + 30;

    this.drawScenery(ex.scenery ?? [], world, x0, x1, ex.time);
    this.drawWater(world, x0, x1);
    this.drawTerrain(world, x0, x1, night);
    this.drawBonds(world, x0, x1, ex.time);
    this.drawNodes(world, x0, x1, ex);
    if (ex.ghost) this.drawGhost(ex.ghost);
    if (ex.cursor) this.drawHand(world, ex.cursor);
    ctx.textAlign = 'center';
    for (const f of ex.floaters ?? []) {
      const age = ex.time - f.born;
      if (age < 0 || age > 1.2) continue;
      ctx.globalAlpha = 1 - age / 1.2;
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillStyle = f.color ?? PALETTE.ink;
      ctx.fillText(f.text, f.x, f.y - age * 34);
    }
    ctx.globalAlpha = 1;
    if (ex.label) {
      ctx.font = '600 12px system-ui, sans-serif';
      const w = ctx.measureText(ex.label.text).width + 14;
      ctx.fillStyle = 'rgba(44,36,32,0.82)';
      ctx.beginPath();
      (ctx as any).roundRect(ex.label.x - w / 2, ex.label.y - 30, w, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#fff7ee';
      ctx.fillText(ex.label.text, ex.label.x, ex.label.y - 16);
    }
    if (night > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(20,18,50,${0.28 * night})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawTerrain(world: World, x0: number, x1: number, night: number) {
    const ctx = this.ctx, t = world.terrain;
    ctx.beginPath();
    ctx.moveTo(x0, 1200);
    for (let x = Math.floor(x0 / 8) * 8; x <= x1 + 8; x += 8) ctx.lineTo(x, t.heightAt(x));
    ctx.lineTo(x1 + 8, 1200);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 540, 0, 760);
    g.addColorStop(0, PALETTE.soil);
    g.addColorStop(1, PALETTE.soilDeep);
    ctx.fillStyle = g;
    ctx.fill();
    // a wobbly grass line on top
    ctx.beginPath();
    for (let x = Math.floor(x0 / 8) * 8; x <= x1 + 8; x += 8) {
      const y = t.heightAt(x) + 1.5;
      if (x <= x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = mix(PALETTE.grass, '#2b3350', night * 0.5);
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  private drawWater(world: World, x0: number, x1: number) {
    const ctx = this.ctx;
    const { x, y, rad, mat, alive } = world;
    ctx.fillStyle = PALETTE.water;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < world.n; i++) {
      if (!alive[i] || mat[i] !== Mat.Water || x[i] < x0 || x[i] > x1) continue;
      const r = rad[i] * 1.55;
      ctx.moveTo(x[i] + r, y[i]);
      ctx.arc(x[i], y[i], r, 0, 6.2832);
    }
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PALETTE.waterLight;
    ctx.beginPath();
    for (let i = 0; i < world.n; i++) {
      if (!alive[i] || mat[i] !== Mat.Water || x[i] < x0 || x[i] > x1) continue;
      const r = rad[i] * 0.55;
      ctx.moveTo(x[i] - 1 + r, y[i] - 1.2);
      ctx.arc(x[i] - 1, y[i] - 1.2, r, 0, 6.2832);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawBonds(world: World, x0: number, x1: number, time: number) {
    const ctx = this.ctx;
    const { x, y, ba, bb, bflag, balive, mat, bamp, bphase, bfreq } = world;
    ctx.lineCap = 'round';
    // three passes so each kind batches into one path
    for (let pass = 0; pass < 4; pass++) {
      ctx.beginPath();
      for (let k = 0; k < world.bn; k++) {
        if (!balive[k]) continue;
        const a = ba[k], b = bb[k];
        if (x[a] < x0 || x[a] > x1) continue;
        const f = bflag[k];
        const kind = f & B_STICKY ? 2 : bamp[k] !== 0 ? 3 : f & B_TENSION ? 1 : 0;
        if (kind !== pass) continue;
        if (kind === 3) {
          // muscles are drawn one by one so they can swell as they contract
          const s = Math.sin(6.2832 * bfreq[k] * world.time + bphase[k]);
          ctx.beginPath();
          ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b]);
          ctx.strokeStyle = '#c2504c';
          ctx.lineWidth = 4.5 - s * 2.2;
          ctx.stroke();
          continue;
        }
        ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b]);
        void mat;
      }
      if (pass === 0) { ctx.strokeStyle = 'rgba(70,50,35,0.55)'; ctx.lineWidth = 5.5; ctx.stroke(); }
      else if (pass === 1) { ctx.strokeStyle = '#6f9a45'; ctx.lineWidth = 2.6; ctx.stroke(); }
      else if (pass === 2) { ctx.strokeStyle = 'rgba(40,32,28,0.8)'; ctx.lineWidth = 3; ctx.stroke(); }
    }
    void time;
  }

  private drawNodes(world: World, x0: number, x1: number, ex: DrawExtras) {
    const ctx = this.ctx;
    const { x, y, rad, mat, alive, hp, anch } = world;
    for (let m = 0; m < MATERIALS.length; m++) {
      if (m === Mat.Water) continue;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < world.n; i++) {
        if (!alive[i] || mat[i] !== m || x[i] < x0 || x[i] > x1) continue;
        let r = rad[i] + 0.4;
        if (m === Mat.Heart) r *= 1 + 0.12 * Math.sin(ex.time * 7 + i);
        ctx.moveTo(x[i] + r, y[i]);
        ctx.arc(x[i], y[i], r, 0, 6.2832);
        any = true;
      }
      if (!any) continue;
      ctx.fillStyle = MATERIALS[m].color;
      ctx.fill();
      ctx.strokeStyle = DARK[m];
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // highlight
      ctx.beginPath();
      for (let i = 0; i < world.n; i++) {
        if (!alive[i] || mat[i] !== m || x[i] < x0 || x[i] > x1) continue;
        const r = rad[i] * 0.32;
        ctx.moveTo(x[i] - 1.8 + r, y[i] - 2);
        ctx.arc(x[i] - 1.8, y[i] - 2, r, 0, 6.2832);
      }
      ctx.fillStyle = LIGHT[m];
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      // thorns get spikes
      if (m === Mat.Thorn) {
        ctx.beginPath();
        for (let i = 0; i < world.n; i++) {
          if (!alive[i] || mat[i] !== m || x[i] < x0 || x[i] > x1) continue;
          for (let s = 0; s < 5; s++) {
            const a = i * 1.7 + s * 1.2566;
            ctx.moveTo(x[i] + Math.cos(a) * 5, y[i] + Math.sin(a) * 5);
            ctx.lineTo(x[i] + Math.cos(a) * 9.5, y[i] + Math.sin(a) * 9.5);
          }
        }
        ctx.strokeStyle = DARK[m];
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
    // wounded nodes show a dark crack; anchored pitch shows a drip
    ctx.beginPath();
    for (let i = 0; i < world.n; i++) {
      if (!alive[i] || mat[i] === Mat.Water || x[i] < x0 || x[i] > x1) continue;
      const full = MATERIALS[mat[i]].hitPoints;
      if (hp[i] < full * 0.7) {
        const r = rad[i] * (1 - hp[i] / full);
        ctx.moveTo(x[i] - r, y[i] - r * 0.6); ctx.lineTo(x[i], y[i] + r * 0.2); ctx.lineTo(x[i] + r * 0.7, y[i] - r * 0.3);
      }
      if (anch[i]) { ctx.moveTo(x[i] - 4, y[i] + 6); ctx.lineTo(x[i] + 4, y[i] + 6); }
    }
    ctx.strokeStyle = 'rgba(30,20,20,0.75)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (ex.hover !== undefined && ex.hover >= 0 && alive[ex.hover]) {
      ctx.beginPath();
      ctx.arc(x[ex.hover], y[ex.hover], rad[ex.hover] + 3, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawGhost(gh: Ghost) {
    const ctx = this.ctx;
    const h = gh.grid.length, w = gh.grid[0]?.length ?? 0;
    const s = NODE_RADIUS * 2;
    const ca = Math.cos(gh.angle), sa = Math.sin(gh.angle);
    ctx.globalAlpha = gh.ok ? 0.55 : 0.3;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const g = gh.grid[r][c];
      const m = MATERIALS.find((mm) => mm.glyph === g);
      if (!m) continue;
      const lx = (c - (w - 1) / 2) * s, ly = (r - (h - 1) / 2) * s;
      ctx.beginPath();
      ctx.arc(gh.x + lx * ca - ly * sa, gh.y + lx * sa + ly * ca, NODE_RADIUS, 0, 6.2832);
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.strokeStyle = gh.ok ? '#fff' : '#c33';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawHand(world: World, c: { x: number; y: number; down: boolean }) {
    const ctx = this.ctx;
    const h = world.hand;
    if (h.active && h.grip.length) {
      // a strand from the cursor to what it holds shows how hard the hand is pulling
      const g = h.grip[0];
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(world.x[g], world.y[g]);
      ctx.strokeStyle = 'rgba(44,36,32,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.down ? 5 : 7, 0, 6.2832);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }

  private drawScenery(items: Scenery[], world: World, x0: number, x1: number, time: number) {
    const ctx = this.ctx;
    for (const s of items) {
      if (s.x < x0 - 120 || s.x > x1 + 120) continue;
      const gy = world.terrain.heightAt(s.x);
      const sway = Math.sin(time * 0.8 + s.x) * 2;
      ctx.save();
      ctx.translate(s.x, gy);
      drawSource(ctx, s.kind, sway, s.stock ?? 1);
      ctx.restore();
    }
    void LAYOUT;
  }
}

/** Hand-drawn-ish props for the material sources. Origin is the ground point. */
function drawSource(ctx: CanvasRenderingContext2D, kind: string, sway: number, stock: number) {
  const blob = (x: number, y: number, r: number, col: string) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
  };
  ctx.lineCap = 'round';
  switch (kind) {
    case 'tree': {
      ctx.strokeStyle = '#8a5f3a'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-6, -70, sway, -130); ctx.stroke();
      for (const [x, y, r] of [[-34, -150, 38], [22, -165, 44], [-4, -200, 36], [44, -130, 28]]) blob(x + sway, y, r, '#7fa860');
      for (const [x, y, r] of [[-20, -168, 20], [26, -182, 22]]) blob(x + sway, y, r, '#93ba6e');
      break;
    }
    case 'outcrop': {
      for (const [x, y, r, c] of [[-26, -14, 26, '#7d838f'], [14, -24, 34, '#8d93a0'], [44, -8, 20, '#767b87'], [0, -44, 20, '#9aa0ad']] as const) blob(x, y, r, c);
      break;
    }
    case 'vines': {
      ctx.strokeStyle = '#7fae52'; ctx.lineWidth = 4;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath(); ctx.moveTo(-30 + k * 15, 2);
        ctx.bezierCurveTo(-40 + k * 15 + sway, -40, -10 + k * 12 - sway, -70, -24 + k * 13 + sway * 1.5, -105 - (k % 2) * 18);
        ctx.stroke();
      }
      for (let k = 0; k < 5; k++) blob(-24 + k * 13 + sway * 1.5, -105 - (k % 2) * 18, 6, '#9fc56a');
      break;
    }
    case 'bramble': {
      ctx.strokeStyle = '#6a3550'; ctx.lineWidth = 5;
      for (let k = 0; k < 6; k++) {
        const a = -2.6 + k * 0.42;
        ctx.beginPath(); ctx.moveTo(0, 2);
        ctx.quadraticCurveTo(Math.cos(a) * 30, -30, Math.cos(a) * 52 + sway * 0.5, Math.sin(a) * 52 - 6);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) {
        const a = -2.9 + k * 0.2, r = 30 + (k % 3) * 10;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.9 - 4);
        ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9) * 0.9 - 8); ctx.stroke();
      }
      break;
    }
    case 'resin': {
      ctx.strokeStyle = '#6b4a32'; ctx.lineWidth = 20;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(sway * 0.4, -110); ctx.stroke();
      for (const [x, y, r] of [[-24, -122, 30], [20, -128, 32], [0, -156, 28]]) blob(x + sway, y, r, '#5f7f4e');
      blob(8, -50, 7, '#3c3430'); blob(9, -38, 5, '#3c3430'); blob(-7, -70, 6, '#3c3430');
      break;
    }
    case 'bush': {
      for (const [x, y, r] of [[-22, -18, 24], [10, -26, 28], [34, -12, 20]]) blob(x + sway * 0.3, y, r, '#6f9a58');
      const berries = [[-26, -24], [-8, -38], [8, -18], [22, -34], [38, -16], [-14, -10], [28, -6]];
      for (let k = 0; k < Math.min(berries.length, Math.ceil(stock)); k++) blob(berries[k][0], berries[k][1], 5, '#d6336c');
      break;
    }
    case 'burrow': {
      ctx.fillStyle = '#463629';
      ctx.beginPath(); ctx.ellipse(0, 0, 70, 46, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#1c1512';
      ctx.beginPath(); ctx.ellipse(0, 2, 34, 26, 0, Math.PI, 0); ctx.fill();
      break;
    }
    case 'home': {
      ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -64); ctx.stroke();
      ctx.fillStyle = '#e8794a';
      ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(30 + sway, -54); ctx.lineTo(0, -42); ctx.fill();
      break;
    }
  }
}

function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
