// Prototype 06: the whole loop (PRD milestone 5). Gather by day against the clock, ask the synthesizer for defences,
// sleep, get raided by what the night bred, salvage the dead, do it again.
import { LAYOUT, M, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, section } from '../../packages/game/src/panel.ts';
import { BOOK_CSS, Gatherer, RecipeBook, SOURCES, canAfford, missing, refund, spend } from '../../packages/game/src/gather.ts';
import { CHAT_CSS, SynthPanel } from '../../packages/game/src/chat.ts';
import { Creatures } from '../../packages/game/src/creatures.ts';
import { NIGHT_CSS, NightCycle } from '../../packages/game/src/nightcycle.ts';
import { LIBRARY } from '../../packages/synth/src/library.ts';
import { SEEDS } from '../../packages/evo/src/index.ts';

const DAY_STEPS = 100 * 60; // daylight is the scarce thing: about 500 units of gathering if you do nothing else
const START = { W: 30, S: 8, F: 12, T: 6, P: 4, B: 0 };
const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + BOOK_CSS + CHAT_CSS + NIGHT_CSS + '.side{width:340px}.score{font-weight:700;font-size:13px}' }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); const invEl = el('div'), score = el('span', 'score');
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side);

const STASH_X = LAYOUT.home[1] - 110;
function freshWorld(): World {
  const w = new World(stripTerrain()); w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135);
  spawnRecipe(w, RECIPES.berryStack, STASH_X, w.terrain.groundY(STASH_X) - 32); return w;
}
const gather = new Gatherer(START); const zoo = new Creatures();
const book = new RecipeBook('synth-p06-book', [RECIPES.wall, RECIPES.spikeStrip, RECIPES.berryStack, RECIPES.thornClub, RECIPES.bucket] as Recipe[]);
let light = DAY_STEPS, bestStash = 0;
let ready = false;
const game: Game = new Game({
  mount: stage, world: freshWorld(), startX: LAYOUT.home[1] - 500,
  labels: [[450, 'pond'], ...SOURCES.map((s) => [s.x, s.label] as [number, string]), [(LAYOUT.home[0] + LAYOUT.home[1]) / 2, 'home'], [(LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2, 'dry ditch'], [LAYOUT.burrow, 'burrow']],
  canGrab: () => cycle.canBuild,
  onClickWorld: (g, x, y, node) => (cycle.canBuild ? gather.click(g, x, y, node) : true),
  onStep: (g) => {
    cycle.step(g.world); gather.step(g);
    if (cycle.mode === 'day' || cycle.mode === 'dawn') { light--; if (light % 30 === 0) clock(); if (light <= 0) cycle.sleep(); }
  },
  onDrawBack: (g, ctx) => gather.drawBack(g, ctx), onDraw: (g, ctx) => { gather.drawFront(g, ctx); if (cycle.mode !== 'night') zoo.drawLabels(g, ctx); },
});
const cycle: NightCycle = new NightCycle({
  game, zoo, seeds: SEEDS,
  hints: {
    day: 'Hold the mouse on a source to gather. Ask the synthesizer for what you need, Synthesize, click to place. <kbd>Q</kbd> <kbd>E</kbd> turn; <kbd>X</kbd> takes apart what you hold and gives the pieces back. Night falls when the light runs out.',
    dawn: 'Dawn. Survivors have gone home. <kbd>X</kbd> on a dead raider salvages its body, sinew included. The light is already running.',
  },
  onMode: (m) => { if (m === 'dawn') light = DAY_STEPS; if (ready) { clock(); refresh(); } },
  onDawn: () => { const s = stash(); bestStash = Math.max(bestStash, s); if (s === 0) chat.add('synth', 'The stash is empty. The berry bush still grows; gather some and stack them at home.'); },
});
bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 06 · day and night'), cycle.phase, score, el('span', 'spacer'), invEl); app.append(bar, wrap);
const stash = () => cycle.real.countIn(M.BERRY, LAYOUT.home[0], LAYOUT.home[1] + 80);
function clock() {
  const m = cycle.mode; if (m === 'day' || m === 'dawn') { const s = Math.max(0, Math.ceil(light / 60)); cycle.label(` · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} of light`); }
  score.textContent = `Stash ${stash()} berries`;
}
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName) || !cycle.canBuild) return;
  const w = game.world; if (!w.hand.active) return; const nodes = w.bodyNodes(w.hand.node);
  if (nodes.some((i) => w.mat[i] === M.HEART)) return; // a living creature cannot be taken apart
  refund(gather.inv, w, nodes); for (const i of nodes) w.removeNode(i); gather.onChange();
});
function tryMake(r: Recipe) {
  if (!cycle.canBuild) return;
  const v = validateRecipe(r); if (!v.ok) { chat.add('err', v.errors[0]); return; }
  if (!canAfford(gather.inv, v.cost)) { chat.add('err', 'Need ' + missing(gather.inv, v.cost).join(', ') + '.'); return; }
  game.hold(r, (x, y, a) => { if (!canAfford(gather.inv, v.cost)) return; spend(gather.inv, v.cost); spawnRecipe(game.world, r, x, y, { angle: a }); gather.onChange(); });
}
const nightSec = section(side, 'Night', 'Sleep early if you are ready. Each night breeds raiders against your base as it stands.');
const again = el('button', '', 'Start over'); again.onclick = () => { if (cycle.busy) return; cycle.reset(freshWorld()); gather.inv = { ...START }; light = DAY_STEPS; bestStash = 0; gather.onChange(); game.centerOn(LAYOUT.home[1] - 100); };
nightSec.append(cycle.controls, again);
const talk = section(side, 'Synthesizer');
const editWrap = el('div'); editWrap.hidden = true; const editor = gridEditor('edit', RECIPES.wall as Recipe); const apply = el('button', '', 'Use these letters'); editWrap.append(editor.root, apply);
const chat = new SynthPanel({
  inv: () => gather.inv, onSynthesize: tryMake, onSave: (r, t) => book.add(r, t.map((x) => ({ role: x.role, text: x.text }))),
  onEdit: (r) => { editor.set(r); editWrap.hidden = !editWrap.hidden; }, library: LIBRARY,
  suggestions: ['Build me a wall to keep things out', 'I need a sword', 'I need a net to catch things', 'I need a bucket to move this water'],
});
apply.onclick = () => { chat.setDraft({ ...editor.get(), parent: chat.draft?.name }); editWrap.hidden = true; chat.add('synth', 'Using your edited letters as the draft.'); };
talk.append(chat.root, editWrap);
section(side, 'What the nights produced').append(cycle.report);
const bookSec = section(side, 'Recipe book'); const list = el('div'); bookSec.append(list);
const refresh = () => { gather.chips(invEl); book.render(list, gather.inv, { use: tryMake, edit: (r) => chat.setDraft(r) }); chat.renderDraft(); again.disabled = cycle.busy; };
gather.onChange = refresh; book.onChange = refresh; ready = true; refresh(); clock(); game.centerOn(LAYOUT.home[1] - 100);
(window as any).game = game; (window as any).gather = gather; (window as any).chat = chat; (window as any).zoo = zoo; (window as any).cycle = cycle;
(window as any).state = () => ({ mode: cycle.mode, day: cycle.day, log: cycle.log, light, stash: stash(), inv: gather.inv });
