import './style.css';
import { Mat } from '../sim';
import { installCycle } from './cycle';
import { h } from './dom';
import { Game } from './game';
import { installPlay } from './play';
import { applySave, clearSave, makeSave, readSave, storeSave } from './save';
import { isMuted, setMuted, sfx } from './sound';
import { Player, spawnStash } from './state';
import { installTalk } from './talk';
import { buildUi } from './ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);
game.reset(game.seed, false);
const player = new Player();
installPlay(game, player);
const ui = buildUi(game, player, document.getElementById('ui')!);
const talk = installTalk(game, player, ui);
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
ui.topSlot.append(h('button', { onclick: () => save() }, 'Save'), h('button', { onclick: () => load() }, 'Load'), mute);
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

game.start();
Object.assign(window as any, { __game: game, __player: player, __ui: ui, __talk: talk, __cycle: cycle });
