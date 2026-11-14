import './style.css';
import { GRID_RULES, LAYOUT, Mat, exportRegion, importRegion, spawnGrid } from '../sim';
import { installCycle } from './cycle';
import { h } from './dom';
import { Game } from './game';
import { installPlay } from './play';
import { applySave, clearSave, makeSave, readSave, storeSave } from './save';
import { isMuted, setMuted, sfx } from './sound';
import { Player, spawnStash } from './state';
import { installTalk } from './talk';
import { buildUi } from './ui';
import { PRESETS } from './presets';
import { VARIANT } from './variant';

GRID_RULES.allowHearts = VARIANT === 'tame';
const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);
game.reset(game.seed, false);
const player = new Player();
installPlay(game, player);
const ui = buildUi(game, player, document.getElementById('ui')!);
const bench = { showWorld: (...a: Parameters<ReturnType<typeof installCycle>['showWorld']>) => cycle.showWorld(...a) };
const talk = installTalk(game, player, ui, bench);
const cycle = installCycle(game, player, ui, sfx);

// ---------------------------------------------------------------- saves
const save = (quiet = false) => {
  const ok = storeSave(makeSave(game, player, cycle.evolver.save()));
  if (!quiet) ui.toast(ok ? `Saved day ${player.day}` : 'Could not save here (storage is unavailable)');
};
const load = (quiet = false) => {
  const text = readSave();
  if (!text) { if (!quiet) ui.toast('No saved world yet'); return false; }
  try {
    cycle.reset(applySave(text, game, player));
    ui.redraw();
    if (!quiet) ui.toast(`Loaded day ${player.day}`);
    return true;
  } catch (e) {
    if (!quiet) ui.toast(`That save could not be read: ${(e as Error).message}`);
    return false;
  }
};
cycle.onDawn.push(() => save(true));
cycle.onPhase((p) => { if (p === 'dream') save(true); });
ui.onNewWorld.push(() => { clearSave(); player.day = 1; cycle.reset(); });
const mute = h('button', { onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? 'Sound off' : 'Sound on'; } }, 'Sound on');
ui.menu.prepend(h('button', { onclick: () => save() }, 'Save now'), h('button', { onclick: () => load() }, 'Load last save'), mute);
// ------------------------------------------------------ sharing a base
const BASE_X0 = LAYOUT.home.x0 - 100, BASE_X1 = LAYOUT.ditch.x + LAYOUT.ditch.halfWidth + 30;
const shareText = h('textarea#sharetext', { rows: 7, spellcheck: 'false', placeholder: 'Base text appears here, or paste someone else\'s here' }) as HTMLTextAreaElement;
const shareMsg = h('div.stat', {}, 'A base is everything between your home site and the ditch: structures, berries and water.');
const share = h('div.panel#share', { hidden: true },
  h('h2', {}, 'Share a base'),
  shareMsg, shareText,
  h('div.row', {},
    h('button.primary', { onclick: async () => {
      shareText.value = exportRegion(game.world, BASE_X0, BASE_X1);
      shareText.select();
      try { await navigator.clipboard.writeText(shareText.value); shareMsg.textContent = `Copied ${Math.round(shareText.value.length / 1024)} KB of base text. Paste it to a friend.`; }
      catch { shareMsg.textContent = 'The text is selected below: copy it.'; }
    } }, 'Copy my base'),
    h('button', { onclick: () => {
      if (cycle.phase !== 'day') { shareMsg.textContent = 'Wait for day before loading a base.'; return; }
      try {
        const n = importRegion(game.world, shareText.value, BASE_X0, BASE_X1);
        shareMsg.textContent = `Loaded a base of ${n} pieces. Your own base was replaced.`;
        game.centerOn(LAYOUT.home.stashX);
      } catch (e) { shareMsg.textContent = `Could not load that: ${(e as Error).message}`; }
    } }, 'Replace my base with this text'),
    h('span.spacer'),
    h('button', { onclick: () => { share.hidden = true; } }, 'Close')),
);
document.getElementById('ui')!.append(share);
ui.menu.prepend(h('button', { onclick: () => { share.hidden = false; ui.menu.hidden = true; } }, 'Share a base…'));

if (load(true)) ui.toast(`Welcome back: day ${player.day}`);
else if (!game.world.count(Mat.Berry)) spawnStash(game.world);

// ----------------------------------------------- sounds for world events
let eaten = game.world.berriesEaten, hurt = 0, hearts = 0;
game.onStep.push((g) => {
  const w = g.world;
  if (w.berriesEaten !== eaten) { if (w.berriesEaten > eaten) { sfx('eat'); g.float(g.cam.x + g.cam.viewW / 2, 300, 'a berry was eaten', '#b8423a'); } eaten = w.berriesEaten; }
  if (w.tick % 6) return;
  let dmg = 0, alive = 0;
  for (let b = 0; b < w.nextBody; b++) { if (w.bodyKind[b] === 1) { dmg += w.bodyDamage[b]; if (w.bodyHeart[b] >= 0) alive++; } }
  if (dmg > hurt + 0.5) sfx('hurt', 0.08);
  if (alive < hearts && cycle.phase === 'raid') sfx('die');
  hurt = dmg; hearts = alive;
});

if (VARIANT === 'tame' && player.day === 1 && !player.inventory.N) player.add('N', 6);
if (VARIANT === 'garden') {
  // no nights, no costs: everything is a toy
  player.freeBuild = true;
  (document.getElementById('free') as HTMLInputElement).checked = true;
  for (const el of ui.topSlot.querySelectorAll<HTMLElement>('.phase, button')) el.hidden = true;
  PRESETS.forEach((p) => { if (!player.book.some((b) => b.name === p.name)) player.book.push({ ...p }); });
  if (game.world.liveNodes < 560) {
    const gy = (x: number) => game.world.terrain.heightAt(x);
    const put = (name: string, x: number) => { const r = PRESETS.find((p) => p.name === name)!; spawnGrid(game.world, r.grid, x, gy(x) - r.grid.length * 6 - 2); };
    put('Bucket', 700); put('Rope', 880); put('Flail', 1010); put('Net', 1140);
    spawnGrid(game.world, PRESETS.find((p) => p.name === 'Raft')!.grid, 380, 520);
  }
  ui.redraw();
  game.centerOn(620);
}
game.start();
Object.assign(window as any, { __game: game, __player: player, __ui: ui, __talk: talk, __cycle: cycle });
