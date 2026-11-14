// Prototype 03: the synthesizer conversation (PRD milestone 2). Talk, get a draft, test it, build it.
import { LAYOUT, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, section } from '../../packages/game/src/panel.ts';
import { BOOK_CSS, Gatherer, RecipeBook, SOURCES, canAfford, missing, refund, spend } from '../../packages/game/src/gather.ts';
import { CHAT_CSS, SynthPanel } from '../../packages/game/src/chat.ts';
import { LIBRARY } from '../../packages/synth/src/library.ts';

const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + BOOK_CSS + CHAT_CSS + '.side{width:340px}' }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); const invEl = el('div'); bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 03 · synthesizer'), el('span', 'spacer'), invEl);
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side); app.append(bar, wrap);

const gather = new Gatherer({ W: 40, S: 12, F: 20, T: 10, P: 8, B: 6 });
const book = new RecipeBook('synth-p03-book', []);
function freshWorld(): World { const w = new World(stripTerrain()); w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135); spawnRecipe(w, RECIPES.dummy, 1400, w.terrain.groundY(1400) - 50); return w; }
const game = new Game({
  mount: stage, world: freshWorld(), startX: 800,
  labels: [[450, 'pond'], ...SOURCES.map((s) => [s.x, s.label] as [number, string]), [(LAYOUT.home[0] + LAYOUT.home[1]) / 2, 'home'], [(LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2, 'dry ditch'], [LAYOUT.burrow, 'burrow']],
  onClickWorld: (g, x, y, node) => gather.click(g, x, y, node),
  onStep: (g) => gather.step(g), onDrawBack: (g, ctx) => gather.drawBack(g, ctx), onDraw: (g, ctx) => gather.drawFront(g, ctx),
});
stage.append(Object.assign(el('div', 'hint'), { innerHTML: 'Tell the synthesizer what you need, then Synthesize and click to place. Hold the mouse on a source to gather. <kbd>Q</kbd> <kbd>E</kbd> turn; <kbd>X</kbd> takes apart what you hold.' }));
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName)) return;
  const w = game.world; if (!w.hand.active) return; const nodes = w.bodyNodes(w.hand.node); refund(gather.inv, w, nodes); for (const i of nodes) w.removeNode(i); gather.onChange();
});
function tryMake(r: Recipe) {
  const v = validateRecipe(r); if (!v.ok) { chat.add('err', v.errors[0]); return; }
  if (!canAfford(gather.inv, v.cost)) { chat.add('err', 'Need ' + missing(gather.inv, v.cost).join(', ') + '.'); return; }
  game.hold(r, (x, y, a) => { if (!canAfford(gather.inv, v.cost)) return; spend(gather.inv, v.cost); spawnRecipe(game.world, r, x, y, { angle: a }); gather.onChange(); });
}
const talk = section(side, 'Synthesizer');
const editWrap = el('div'); editWrap.hidden = true; const editor = gridEditor('edit', RECIPES.bucket); const apply = el('button', '', 'Use these letters');
editWrap.append(editor.root, apply);
const chat = new SynthPanel({
  inv: () => gather.inv, onSynthesize: tryMake, onSave: (r, t) => book.add(r, t.map((x) => ({ role: x.role, text: x.text }))),
  onEdit: (r) => { editor.set(r); editWrap.hidden = !editWrap.hidden; }, library: LIBRARY,
  suggestions: ['I need a bucket to move this water', 'I need a sword', 'Build me a wall to keep things out', 'I need a net to catch things'],
});
apply.onclick = () => { chat.setDraft({ ...editor.get(), parent: chat.draft?.name }); editWrap.hidden = true; chat.add('synth', 'Using your edited letters as the draft.'); };
talk.append(chat.root, editWrap);
const bookSec = section(side, 'Recipe book'); const list = el('div'); bookSec.append(list);
const refresh = () => { gather.chips(invEl); book.render(list, gather.inv, { use: tryMake, edit: (r) => chat.setDraft(r) }); chat.renderDraft(); };
gather.onChange = refresh; book.onChange = refresh; refresh();
(window as any).game = game; (window as any).gather = gather; (window as any).chat = chat;
