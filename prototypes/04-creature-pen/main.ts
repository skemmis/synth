// Prototype 04: creatures (PRD milestone 3). Hearts, sinew, damage and death, corpses and salvage, seed crawlers.
import { LAYOUT, M, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, legend, section } from '../../packages/game/src/panel.ts';
import { CHAT_CSS, miniGrid } from '../../packages/game/src/chat.ts';
import { Creatures, describeGenome } from '../../packages/game/src/creatures.ts';
import { SEEDS, mutate, nicheOf, type Genome, GW, GH } from '../../packages/evo/src/index.ts';
import { Rng } from '../../packages/sim/src/rng.ts';

const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + CHAT_CSS }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); const stat = el('span', 'tag'); bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 04 · creature pen'), el('span', 'spacer'), stat);
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side); app.append(bar, wrap);

const zoo = new Creatures(); const rng = new Rng(4); let sinew = 0;
const HOME = (LAYOUT.home[0] + LAYOUT.home[1]) / 2;
function freshWorld(): World { const w = new World(stripTerrain()); spawnRecipe(w, RECIPES.berryPile, HOME, w.terrain.groundY(HOME) - 30); return w; }
const game = new Game({
  mount: stage, world: freshWorld(), startX: 3300,
  labels: [[HOME, 'home'], [(LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2, 'dry ditch'], [LAYOUT.burrow, 'burrow']],
  onStep: (g) => zoo.step(g.world),
  onDraw: (g, ctx) => zoo.drawLabels(g, ctx),
  onClickWorld: (g, _x, _y, node) => { if (node >= 0) { const c = zoo.byTag(g.world.tag[node]); if (c) { zoo.selected = c; inspect(); } } return false; },
});
stage.append(Object.assign(el('div', 'hint'), { innerHTML: 'Release a crawler at the burrow and watch it go for the berries at home. Drag anything, creatures included. Click a creature to read its body. <kbd>X</kbd> takes apart what you hold; a dead creature gives up its sinew.' }));
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName)) return;
  const w = game.world; if (!w.hand.active) return; const nodes = w.bodyNodes(w.hand.node);
  if (nodes.some((i) => w.mat[i] === M.HEART)) return; // a living creature cannot be taken apart
  for (const i of nodes) { if (w.mat[i] === M.SINEW) sinew++; w.removeNode(i); } refresh();
});

// --- release
const rel = section(side, 'Seed crawlers', 'Hand-picked walkers. Evolution will start from these.');
for (const s of SEEDS) {
  const row = el('div', 'row'); row.style.alignItems = 'center'; row.style.gap = '10px';
  const b = el('button', 'primary', 'Release'); b.onclick = () => { zoo.spawn(game.world, s, LAYOUT.burrow - 60 - (zoo.list.length % 4) * 130); game.centerOn(LAYOUT.burrow - 300); };
  const info = el('div'); info.style.flex = '1'; info.append(el('b', '', s.name ?? 'crawler'), el('p', '', describeGenome(s)));
  row.append(miniGrid(trim(s.grid)), info, b); rel.append(row);
}
const row2 = el('div', 'row'); const mut = el('button', '', 'Release a mutant'); mut.onclick = () => { const p = SEEDS[rng.int(SEEDS.length)]; let g = p; for (let i = 0; i < 4; i++) g = mutate(g, rng, `mutant of ${p.name}`); zoo.spawn(game.world, g, LAYOUT.burrow - 60); game.centerOn(LAYOUT.burrow - 300); };
const clear = el('button', '', 'Reset world'); clear.onclick = () => { game.world = freshWorld(); zoo.list = []; zoo.selected = null; inspect(); refresh(); };
row2.append(mut, clear); rel.append(row2);

// --- inspector
const insp = section(side, 'Selected creature'); const inspBody = el('div'); insp.append(inspBody);
function inspect() {
  inspBody.replaceChildren(); const c = zoo.selected; if (!c) { inspBody.append(el('p', '', 'Click a creature in the world.')); return; }
  const r = zoo.recipeOf(c); const row = el('div', 'row'); row.style.gap = '10px'; const info = el('div'); info.style.flex = '1';
  info.append(el('b', '', `${c.name} (${nicheOf(c.g)})`), el('p', '', `${c.alive ? 'Alive' : 'Dead'}. Ate ${c.ate}. ${describeGenome(c.g)}.`));
  const copy = el('button', '', 'Edit a copy'); copy.onclick = () => { editor.set(r); freq.value = String(c.g.freq.toFixed(1)); };
  row.append(miniGrid(r.grid), info); inspBody.append(row, copy);
}
// --- build your own
const own = section(side, 'Build a creature', 'Letters as usual, plus N for sinew (muscle) and exactly one H for a heart.');
const editor = gridEditor('creature', { name: 'my crawler', grid: ['WNW.', 'NHNW', 'W.N.'] }, { allowCreature: true });
const freqRow = el('label', 'row'); freqRow.style.alignItems = 'center'; const freq = el('input'); freq.type = 'range'; freq.min = '0.5'; freq.max = '2.2'; freq.step = '0.1'; freq.value = '1.5'; freq.id = 'freq'; const fv = el('span', 'tag');
freqRow.append(document.createTextNode('Beat'), freq, fv); const upd = () => { fv.textContent = (+freq.value).toFixed(1) + ' per second'; }; freq.oninput = upd; upd();
const go = el('button', 'primary', 'Put on cursor'); const msg = el('div', 'msg');
go.onclick = () => {
  const r = editor.get(), v = validateRecipe(r, { allowCreature: true }); const hearts = r.grid.join('').split('H').length - 1;
  if (!v.ok) { msg.textContent = v.errors[0]; msg.className = 'msg bad'; return; }
  if (hearts !== 1) { msg.textContent = 'A creature needs exactly one H.'; msg.className = 'msg bad'; return; }
  if (r.grid.length > GH || r.grid[0].length > GW) { msg.textContent = `Creatures fit in ${GW} by ${GH}.`; msg.className = 'msg bad'; return; }
  msg.textContent = 'Click in the world to release it.'; msg.className = 'msg good';
  const g: Genome = { grid: r.grid, freq: +freq.value, cells: {}, name: r.name };
  for (let rr = 0; rr < r.grid.length; rr++) for (let c = 0; c < r.grid[rr].length; c++) if (r.grid[rr][c] === 'N') g.cells[`${c},${rr}`] = { phase: (c * 1.3 + rr * 0.7) % 6.28, amp: 0.35 };
  game.hold(r, (x) => { zoo.spawn(game.world, g, x); });
};
own.append(editor.root, freqRow, go, msg);
// --- defences to play with
const def = section(side, 'Things to put in the way'); const drow = el('div', 'row'); def.append(drow);
for (const k of ['wall', 'spikeStrip', 'stoneBlock', 'thornClub', 'net', 'berryPile']) { const b = el('button', '', RECIPES[k].name); b.onclick = () => game.hold(RECIPES[k] as Recipe); drow.append(b); }
legend(section(side, 'Materials'), (g) => g !== '~');
function trim(grid: string[]) { let g = grid.filter((r) => /[^.]/.test(r)); let c0 = 99, c1 = 0; for (const r of g) for (let c = 0; c < r.length; c++) if (r[c] !== '.') { c0 = Math.min(c0, c); c1 = Math.max(c1, c); } return g.map((r) => r.slice(c0, c1 + 1)); }
function refresh() { stat.textContent = `${game.world.count(M.BERRY)} berries left · ${zoo.aliveCount()} creatures alive · ${sinew} sinew salvaged`; }
zoo.onChange = () => { refresh(); if (zoo.selected) inspect(); }; setInterval(refresh, 500); inspect(); refresh();
(window as any).game = game; (window as any).zoo = zoo;
