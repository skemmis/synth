// Prototype 02: gathering, costs and the recipe book (PRD milestone 1). Still no AI and no enemies.
import { LAYOUT, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, legend, section } from '../../packages/game/src/panel.ts';
import { BOOK_CSS, Gatherer, RecipeBook, SOURCES, canAfford, missing, refund, spend } from '../../packages/game/src/gather.ts';

const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + BOOK_CSS }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); const invEl = el('div'); bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 02 · gather and craft'), el('span', 'spacer'), invEl);
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side); app.append(bar, wrap);

const gather = new Gatherer({ W: 6 });
const book = new RecipeBook('synth-p02-book', [RECIPES.bucket, RECIPES.rope, RECIPES.wall, RECIPES.thornClub]);
function freshWorld(): World { const w = new World(stripTerrain()); w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135); return w; }
const game = new Game({
  mount: stage, world: freshWorld(), startX: 1100,
  labels: [[450, 'pond'], ...SOURCES.map((s) => [s.x, s.label] as [number, string]), [(LAYOUT.home[0] + LAYOUT.home[1]) / 2, 'home'], [(LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2, 'dry ditch'], [LAYOUT.burrow, 'burrow']],
  onClickWorld: (g, x, y, node) => gather.click(g, x, y, node),
  onStep: (g) => gather.step(g),
  onDrawBack: (g, ctx) => gather.drawBack(g, ctx),
  onDraw: (g, ctx) => gather.drawFront(g, ctx),
});
const hint = Object.assign(el('div', 'hint'), { innerHTML: 'Hold the mouse on a tree, outcrop, vines, bramble, resin tree or bush to gather. Drag things; <kbd>Q</kbd> <kbd>E</kbd> turn; <kbd>X</kbd> takes what you hold apart and gives the material back.' });
stage.append(hint);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName)) return;
  const w = game.world; if (!w.hand.active) return;
  const nodes = w.bodyNodes(w.hand.node); refund(gather.inv, w, nodes); for (const i of nodes) w.removeNode(i); gather.onChange();
});

// --- recipe editor
const make = section(side, 'Recipe', 'Each letter costs one unit of that material.');
const editor = gridEditor('recipe', RECIPES.bucket);
const msg = el('div', 'msg'); const btns = el('div', 'row');
const synth = el('button', 'primary', 'Synthesize'); const keep = el('button', '', 'Save to book');
btns.append(synth, keep); make.append(editor.root, btns, msg);
function tryMake(r: Recipe) {
  const v = validateRecipe(r); if (!v.ok) { say(v.errors[0], true); return; }
  if (!canAfford(gather.inv, v.cost)) { say('Need ' + missing(gather.inv, v.cost).join(', ') + '.', true); return; }
  say('Click in the world to place it. Esc cancels.');
  game.hold(r, (x, y, a) => { if (!canAfford(gather.inv, v.cost)) return; spend(gather.inv, v.cost); spawnRecipe(game.world, r, x, y, { angle: a }); gather.onChange(); say(`Made ${r.name}.`); });
}
const say = (t: string, bad = false) => { msg.textContent = t; msg.className = 'msg ' + (bad ? 'bad' : 'good'); };
synth.onclick = () => tryMake(editor.get());
keep.onclick = () => { const v = editor.validation(); if (!v.ok) { say(v.errors[0], true); return; } book.add(editor.get()); say('Saved.'); };

// --- book
const bookSec = section(side, 'Recipe book'); const list = el('div'); bookSec.append(list);
const io = el('div', 'row'); const exp = el('button', '', 'Copy book as text'); const impBtn = el('button', '', 'Import from text');
const imp = el('textarea'); imp.id = 'import'; imp.rows = 4; imp.placeholder = '# name: thing\nWWW'; imp.setAttribute('aria-label', 'Recipes to import'); imp.hidden = true;
io.append(exp, impBtn); bookSec.append(io, imp);
exp.onclick = async () => { const t = book.exportText(); try { await navigator.clipboard.writeText(t); say('Book copied to the clipboard.'); } catch { imp.hidden = false; imp.value = t; imp.select(); say('Copy the text from the box below.'); } };
impBtn.onclick = () => { if (imp.hidden) { imp.hidden = false; imp.value = ''; imp.focus(); say('Paste recipes in the box, then press Import again.'); return; } const r = book.importText(imp.value); say(`Imported ${r.added}.` + (r.errors.length ? ' Skipped: ' + r.errors.join('; ') : ''), r.errors.length > 0 && !r.added); if (r.added) imp.hidden = true; };
const refresh = () => { gather.chips(invEl); book.render(list, gather.inv, { use: tryMake, edit: (r) => editor.set(r) }); synth.disabled = !editor.validation().ok; };
gather.onChange = refresh; book.onChange = refresh; editor.onChange = refresh; refresh();
const mats = section(side, 'Materials'); legend(mats, (g) => g !== 'H' && g !== 'N');
(window as any).game = game; (window as any).gather = gather; (window as any).book = book;
