// Prototype 01: the physics toy (PRD milestone 0). No AI, no enemies, no costs.
import { LAYOUT, M, RECIPES, spawnRecipe, stripTerrain, World } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, legend, section } from '../../packages/game/src/panel.ts';

const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 01 · physics toy'), el('span', 'spacer'));
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side); app.append(bar, wrap);

function freshWorld(): World {
  const w = new World(stripTerrain());
  w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135);
  const g = (x: number) => w.terrain.groundY(x);
  spawnRecipe(w, RECIPES.bucket, 880, g(880) - 60);
  spawnRecipe(w, RECIPES.raft, 450, LAYOUT.base - 10);
  spawnRecipe(w, RECIPES.rope, 1100, g(1100) - 20);
  spawnRecipe(w, RECIPES.thornClub, 1330, g(1330) - 70);
  spawnRecipe(w, RECIPES.dummy, 1480, g(1480) - 50);
  spawnRecipe(w, RECIPES.stoneBlock, 1640, g(1640) - 40);
  spawnRecipe(w, RECIPES.pitchBlock, 1800, g(1800) - 40);
  spawnRecipe(w, RECIPES.net, 1990, g(1990) - 50);
  spawnRecipe(w, RECIPES.berryPile, 2800, g(2800) - 40);
  return w;
}
const game = new Game({
  mount: stage, world: freshWorld(), startX: 560,
  labels: [[450, 'pond'], [(LAYOUT.home[0] + LAYOUT.home[1]) / 2, 'home'], [(LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2, 'dry ditch'], [LAYOUT.burrow, 'burrow']],
});
stage.append(Object.assign(el('div', 'hint'), { innerHTML: 'Drag anything. <kbd>Q</kbd> <kbd>E</kbd> turn what you hold. <kbd>X</kbd> deletes it. Drag the sky or press <kbd>A</kbd> <kbd>D</kbd> to move along the strip.' }));

// --- tools
const pause = el('button', '', 'Pause'); pause.onclick = () => { game.paused = !game.paused; pause.textContent = game.paused ? 'Play' : 'Pause'; };
const letters = el('button', '', 'Show letters'); letters.onclick = () => { game.showGlyphs = !game.showGlyphs; letters.textContent = game.showGlyphs ? 'Hide letters' : 'Show letters'; };
const reset = el('button', '', 'Reset world'); reset.onclick = () => { game.world = freshWorld(); };
const stat = el('span', 'tag'); bar.append(stat, pause, letters, reset);
setInterval(() => { let n = 0; for (let i = 0; i < game.world.n; i++) n += game.world.alive[i]; stat.textContent = `${n} nodes · ${game.stepMs.toFixed(1)} ms/step`; }, 500);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
  const w = game.world; if (!w.hand.active) return;
  for (const i of w.bodyNodes(w.hand.node)) w.removeNode(i);
});

// --- make something
const make = section(side, 'Make something', 'A recipe is a grid of letters. Each letter is one node; touching letters are bonded. Pick one, or type your own.');
const presets = el('div', 'row'); make.append(presets);
const editor = gridEditor('recipe', RECIPES.bucket);
const put = el('button', 'primary', 'Put on cursor');
for (const key of ['bucket', 'pail', 'rope', 'thornClub', 'wall', 'raft', 'stoneBlock', 'net', 'pitchBlock', 'spikeStrip', 'berryPile']) {
  const b = el('button', '', RECIPES[key].name); b.onclick = () => { editor.set(RECIPES[key]); put.click(); }; presets.append(b);
}
make.append(editor.root, put);
editor.onChange = (_r, v) => { put.disabled = !v.ok; };
put.onclick = () => { const v = editor.validation(); if (!v.ok) return; const r = editor.get(); game.hold(r, (x, y, a) => { spawnRecipe(game.world, r, x, y, { angle: a }); }); };
const water = el('button', '', 'Pour water at cursor'); water.title = 'A cheat for the toy: click, then click in the world';
water.onclick = () => { game.hold({ name: 'water', grid: ['.'] }, (x, y) => { game.world.spawnWater(x - 30, y - 30, x + 30, y + 30, game.world.tick + 1); }); };
make.append(water);
const mats = section(side, 'Materials'); legend(mats, (g) => g !== 'H' && g !== 'N');
section(side, 'Things to try', 'Push the bucket under the pond and carry water to the dry ditch. Hang the rope from one end. Hold the thorn club by its shaft and spin it into the dummy. Drop the pitch block and try to drag it away. Float the raft and stand a stone on it.');
(window as any).game = game; (window as any).M = M;
