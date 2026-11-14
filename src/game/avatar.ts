// Variant: the player has a body. It walks (A/D), jumps (W), has an arm's
// reach, and can be knocked out. Everything else is the same game.
import { CONFIG, LAYOUT, spawnGrid } from '../sim';
import type { Game } from './game';
import type { Ui } from './ui';

export const AVATAR = {
  grid: ['.W.', 'WWW', 'WWW', 'W.W'],
  reach: 230,
  walkSpeed: 190,
  walkAccel: 1400,
  jumpSpeed: 430,
  kind: 3,
};

export function installAvatar(game: Game, ui: Ui, onDawn: (() => void)[]) {
  let core = -1, body = -1, out = false, jumpHeld = false;

  const find = () => {
    const w = game.world;
    body = w.bodyKind.findIndex((k) => k === AVATAR.kind);
    core = -1;
    if (body < 0) return;
    let best = -1;
    for (let i = 0; i < w.n; i++) if (w.alive[i] && w.body[i] === body && w.adjN[i] > best) { best = w.adjN[i]; core = i; }
  };
  const spawn = () => {
    const w = game.world;
    const x = LAYOUT.home.stashX - 160;
    const sp = spawnGrid(w, AVATAR.grid, x, w.terrain.heightAt(x) - 26, { kind: AVATAR.kind });
    body = sp.body;
    core = sp.nodes[2]; // middle of the second row
    out = false;
    game.faces = [sp.nodes[0]];
  };
  const alive = () => core >= 0 && !!game.world.alive[core] && game.world.body[core] === body;

  find();
  if (!alive()) spawn(); else game.faces = [game.world.component(core).sort((a, b) => game.world.y[a] - game.world.y[b])[0]];
  game.panKeys = false;
  const hint = document.getElementById('hint');
  if (hint) hint.innerHTML = '<kbd>A</kbd> <kbd>D</kbd> walk &nbsp;·&nbsp; <kbd>W</kbd> jump &nbsp;·&nbsp; your hand reaches a short way from your body &nbsp;·&nbsp; <kbd>Q</kbd> <kbd>E</kbd> rotate &nbsp;·&nbsp; right-click breaks down';
  game.centerOn(game.world.x[core]);

  const inReach = (x: number, y: number) => alive() && Math.hypot(x - game.world.x[core], y - game.world.y[core]) <= AVATAR.reach;
  game.handLimit = (x, y) => {
    if (!alive()) return [x, y];
    const w = game.world, dx = x - w.x[core], dy = y - w.y[core];
    const d = Math.hypot(dx, dy);
    return d <= AVATAR.reach ? [x, y] : [w.x[core] + (dx / d) * AVATAR.reach, w.y[core] + (dy / d) * AVATAR.reach];
  };
  // the reach check runs before every other click handler
  game.onClick.unshift((g) => {
    if (out) { g.float(g.cursor.x, g.cursor.y - 10, 'knocked out until dawn', '#b8423a'); return true; }
    if (!inReach(g.cursor.x, g.cursor.y)) { g.float(g.cursor.x, g.cursor.y - 10, 'too far: walk closer (A / D)', '#8a5a4a'); return true; }
    return false;
  });
  const canPlace = game.canPlace;
  game.canPlace = (g, grid) => {
    if (out || !inReach(g.cursor.x, g.cursor.y)) { g.float(g.cursor.x, g.cursor.y - 10, out ? 'knocked out until dawn' : 'too far to place', '#8a5a4a'); return false; }
    return canPlace(g, grid);
  };

  game.onStep.push((g) => {
    const w = g.world;
    if (!alive()) {
      if (!out) { out = true; w.release(); g.ghost = null; ui.toast('You were knocked out. You wake at dawn.'); }
      return;
    }
    const nodes: number[] = [];
    for (let i = 0; i < w.n; i++) if (w.alive[i] && w.body[i] === body) nodes.push(i);
    const h = CONFIG.dt / CONFIG.substeps;
    let vx = 0, grounded = false;
    for (const i of nodes) {
      vx += (w.x[i] - w.px[i]) / h;
      if (w.terrain.heightAt(w.x[i]) - w.y[i] < w.rad[i] + 3) grounded = true;
    }
    vx /= nodes.length;
    const k = g.keys;
    const dir = (k.has('a') ? -1 : 0) + (k.has('d') ? 1 : 0);
    // legs: push toward walking speed, harder on the ground than in the air
    const want = dir * AVATAR.walkSpeed;
    const push = Math.max(-1, Math.min(1, (want - vx) / 60)) * AVATAR.walkAccel * (grounded ? 1 : 0.35) * CONFIG.dt;
    if (dir !== 0 || grounded) for (const i of nodes) w.px[i] -= push * h;
    const jump = k.has('w');
    if (jump && !jumpHeld && grounded) for (const i of nodes) w.py[i] += AVATAR.jumpSpeed * h;
    jumpHeld = jump;
    // stay upright: a gentle righting push on the head
    const head = g.faces[0];
    if (head !== undefined && w.alive[head]) w.px[head] -= (w.x[core] - w.x[head]) * 6 * CONFIG.dt * h * 60;
    // drop anything held that has drifted out of reach
    if (w.hand.active && w.hand.grip.length && !inReach(w.x[w.hand.grip[0]], w.y[w.hand.grip[0]]) &&
        Math.hypot(w.x[w.hand.grip[0]] - w.x[core], w.y[w.hand.grip[0]] - w.y[core]) > AVATAR.reach * 1.5) w.release();
  });

  game.onFrame.push((g) => {
    if (!alive()) return;
    // the camera follows the body
    const target = g.world.x[core] - g.cam.viewW / 2;
    g.cam.x += (target - g.cam.x) * 0.08;
    g.clampCam();
  });

  onDawn.push(() => { find(); if (!alive()) { spawn(); ui.toast('You wake up at home.'); } });
  return { get alive() { return alive(); }, get core() { return core; }, respawn: () => { find(); if (!alive()) spawn(); } };
}
