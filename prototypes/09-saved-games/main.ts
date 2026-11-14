// Prototype 09: big beasts (08) that remembers. The world, the burrow's breeding stock, your inventory and the score are
// saved in the browser every dawn and whenever you leave the page by day, and picked up again on the next visit.
import { LAYOUT, M, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe, type WorldSave } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, section } from '../../packages/game/src/panel.ts';
import { BOOK_CSS, Gatherer, RecipeBook, SOURCES, canAfford, missing, refund, spend } from '../../packages/game/src/gather.ts';
import { CHAT_CSS, SynthPanel } from '../../packages/game/src/chat.ts';
import { Creatures } from '../../packages/game/src/creatures.ts';
import { NIGHT_CSS, NightCycle, type RaidLog } from '../../packages/game/src/nightcycle.ts';
import { LIBRARY } from '../../packages/synth/src/library.ts';
import { SEEDS, evoConfig, fitnessConfig, type EvoState } from '../../packages/evo/src/index.ts';

const DAY_STEPS = 100 * 60; // daylight is the scarce thing: about 500 units of gathering if you do nothing else
const START = { W: 30, S: 8, F: 12, T: 6, P: 4, B: 0 };
const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + BOOK_CSS + CHAT_CSS + NIGHT_CSS + '.side{width:340px}.score{font-weight:700;font-size:13px}.over{position:absolute;inset:0;display:grid;place-items:center;background:#14161bcc;z-index:5}.over .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;max-width:420px;margin:16px;display:grid;gap:10px}.over h2{font-family:var(--display);margin:0;font-size:20px}.over p{margin:0;color:var(--muted)}' }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); const invEl = el('div'), score = el('span', 'score');
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side);

const STASH_X = LAYOUT.home[1] - 110;
function freshWorld(): World {
  const w = new World(stripTerrain()); w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135);
  spawnRecipe(w, RECIPES.berryStack, STASH_X, w.terrain.groundY(STASH_X) - 32); return w;
}
// ---- save file: one JSON blob in the browser. Anything unreadable is ignored and the game starts fresh.
interface Save { v: 1; world: WorldSave; evo: EvoState; day: number; log: RaidLog[]; inv: Record<string, number>; light: number; survived: number; lostTotal: number; bestStash: number; wreck: number; at: number; }
const SAVE_KEY = 'synth-p09-save';
function readSave(): Save | null { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); return s && s.v === 1 && s.world?.v === 1 ? s : null; } catch { return null; } }
const loaded = readSave();
const gather = new Gatherer(loaded?.inv ?? START); const zoo = new Creatures();
const book = new RecipeBook('synth-p09-book', [RECIPES.wall, RECIPES.spikeStrip, RECIPES.berryStack, RECIPES.thornClub, RECIPES.bucket] as Recipe[]);
let light = loaded?.light ?? DAY_STEPS, bestStash = loaded?.bestStash ?? 0, survived = loaded?.survived ?? 0, lostTotal = loaded?.lostTotal ?? 0, over = false;
let ready = false;
const game: Game = new Game({
  mount: stage, world: loaded ? World.load(stripTerrain(), loaded.world) : freshWorld(), startX: LAYOUT.home[1] - 500,
  labels: [[450, 'pond'], ...SOURCES.map((s) => [s.x, s.label] as [number, string]), [(LAYOUT.home[0] + LAYOUT.home[1]) / 2, 'home'], [(LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2, 'dry ditch'], [LAYOUT.burrow, 'burrow']],
  canGrab: () => cycle.canBuild,
  onClickWorld: (g, x, y, node) => (cycle.canBuild ? gather.click(g, x, y, node) : true),
  onStep: (g) => {
    cycle.step(g.world); gather.step(g);
    if (cycle.mode === 'day' || cycle.mode === 'dawn') { light--; if (light % 30 === 0) clock(); if (light <= 0 && !over) cycle.sleep(); }
  },
  onDrawBack: (g, ctx) => gather.drawBack(g, ctx), onDraw: (g, ctx) => { gather.drawFront(g, ctx); if (cycle.mode !== 'night') zoo.drawLabels(g, ctx); },
});
evoConfig.maxCells = 40;
const cycle: NightCycle = new NightCycle({
  game, zoo, seeds: SEEDS, raidSeconds: 60, rot: true, state: loaded?.evo, day: loaded?.day, log: loaded?.log,
  hints: {
    day: 'Hold the mouse on a source to gather. Ask the synthesizer for what you need, Synthesize, click to place. <kbd>Q</kbd> <kbd>E</kbd> turn; <kbd>X</kbd> takes apart what you hold and gives the pieces back. Night falls when the light runs out.',
    dawn: 'Dawn. Survivors have gone home. <kbd>X</kbd> on a dead raider salvages its body, sinew included. What you leave is gone by nightfall. The light is already running.',
  },
  onMode: (m) => { if (m === 'dawn') light = DAY_STEPS; if (ready) { clock(); refresh(); } },
  onDawn: (e) => { const s = stash(); bestStash = Math.max(bestStash, s); lostTotal += e.lost; if (s === 0) gameOver(); else survived++; clock(); save('Saved at dawn.'); },
});
bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 09 · saved games'), cycle.phase, score, el('span', 'spacer'), invEl); app.append(bar, wrap);
const stash = () => cycle.real.countIn(M.BERRY, LAYOUT.home[0], LAYOUT.home[1] + 80);
function clock() {
  const m = cycle.mode; if (m === 'day' || m === 'dawn') { const s = Math.max(0, Math.ceil(light / 60)); cycle.label(` · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} of light`); }
  score.textContent = `Stash ${stash()} berries · ${survived} ${survived === 1 ? 'morning' : 'mornings'} survived`;
}
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName) || !cycle.canBuild) return;
  const w = game.world; if (!w.hand.active) return; const nodes = w.bodyNodes(w.hand.node);
  if (nodes.some((i) => w.mat[i] === M.HEART)) return; // a living creature cannot be taken apart
  refund(gather.inv, w, nodes); for (const i of nodes) w.removeNode(i); gather.onChange();
});
const overlay = el('div', 'over'); overlay.hidden = true; stage.append(overlay);
function gameOver() {
  over = true; overlay.replaceChildren(); const box = el('div', 'box'); const last = cycle.log[cycle.log.length - 1];
  box.append(el('h2', '', `The stash is gone after ${survived} ${survived === 1 ? 'morning' : 'mornings'}.`),
    el('p', '', `You lost ${lostTotal} berries in all. Your biggest stash was ${bestStash}. The last raid was led by ${last?.party[0]?.name ?? 'something'} (${last?.party[0]?.niche ?? 'unknown'}).`));
  const b = el('button', 'primary', 'Start over'); b.onclick = () => again.click(); const k = el('button', '', 'Keep playing'); k.onclick = () => { overlay.hidden = true; over = false; light = DAY_STEPS; };
  const row = el('div', 'row'); row.append(b, k); box.append(row); overlay.append(box); overlay.hidden = false;
}
const saveMsg = el('p');
function save(note = 'Saved.') {
  if (cycle.busy) return; // mid-night and mid-raid are not saved: you come back to the last dawn or the last daytime save
  const s: Save = { v: 1, world: cycle.real.save(), evo: cycle.evo.state, day: cycle.day, log: cycle.log, inv: gather.inv, light, survived, lostTotal, bestStash, wreck: fitnessConfig.wreck, at: Date.now() };
  try { const text = JSON.stringify(s); localStorage.setItem(SAVE_KEY, text); saveMsg.textContent = `${note} ${Math.round(text.length / 1024)} KB in this browser.`; }
  catch { saveMsg.textContent = 'Could not save here (storage is blocked or full). The game still runs.'; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
function tryMake(r: Recipe) {
  if (!cycle.canBuild) return;
  const v = validateRecipe(r); if (!v.ok) { chat.add('err', v.errors[0]); return; }
  if (!canAfford(gather.inv, v.cost)) { chat.add('err', 'Need ' + missing(gather.inv, v.cost).join(', ') + '.'); return; }
  game.hold(r, (x, y, a) => { if (!canAfford(gather.inv, v.cost)) return; spend(gather.inv, v.cost); spawnRecipe(game.world, r, x, y, { angle: a }); gather.onChange(); });
}
const nightSec = section(side, 'Night', 'Sleep early if you are ready. Each night breeds raiders against your base as it stands.');
const again = el('button', '', 'Start over'); again.onclick = () => { if (cycle.busy) return; cycle.reset(freshWorld()); gather.inv = { ...START }; light = DAY_STEPS; bestStash = 0; survived = 0; lostTotal = 0; over = false; overlay.hidden = true; try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ } saveMsg.textContent = 'New game. It saves itself every dawn.'; gather.onChange(); game.centerOn(LAYOUT.home[1] - 100); };
const WRECK = 4; fitnessConfig.wreck = loaded ? loaded.wreck : WRECK;
const lever = el('div', 'seg'); lever.setAttribute('role', 'group'); lever.setAttribute('aria-label', 'What raiders are bred for');
const paint = () => { for (const b of Array.from(lever.children) as HTMLButtonElement[]) b.classList.toggle('on', (b.dataset.v === 'on') === fitnessConfig.wreck > 0); };
for (const [v, label] of [['on', 'Bred to wreck and eat'], ['off', 'Bred to eat only']]) { const b = el('button', '', label); b.dataset.v = v; b.onclick = () => { if (cycle.busy) return; fitnessConfig.wreck = v === 'on' ? WRECK : 0; paint(); }; lever.append(b); }
paint(); const leverNote = el('p', '', 'Wreckers earn score for every hit point they take off your defences. Damage stays until you rebuild.');
const saveBtn = el('button', '', 'Save now'); saveBtn.onclick = () => save();
const saveRow = el('div', 'row'); saveRow.append(saveBtn, again); saveMsg.textContent = loaded ? `Picked up your game from ${new Date(loaded.at).toLocaleString()}.` : 'New game. It saves itself every dawn.';
nightSec.append(cycle.controls, lever, leverNote, saveRow, saveMsg);
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
const refresh = () => { gather.chips(invEl); book.render(list, gather.inv, { use: tryMake, edit: (r) => chat.setDraft(r) }); chat.renderDraft(); again.disabled = cycle.busy; saveBtn.disabled = cycle.busy; };
gather.onChange = refresh; book.onChange = refresh; ready = true; refresh(); clock(); game.centerOn(LAYOUT.home[1] - 100);
(window as any).game = game; (window as any).gather = gather; (window as any).chat = chat; (window as any).zoo = zoo; (window as any).cycle = cycle;
(window as any).save = save; (window as any).state = () => ({ hash: cycle.real.hash(), archive: cycle.evo.state.archive.length, survived, over, mode: cycle.mode, day: cycle.day, log: cycle.log, light, stash: stash(), inv: gather.inv });
