// Prototype 16: the armoury (15) with a guide for a first sitting: six small goals, each ticked by the game noticing
// that you did it, each with a button that pans to where it happens. Made for a person's first ten minutes.
import { LAYOUT, M, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe, type WorldSave } from '../../packages/sim/src/index.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, section } from '../../packages/game/src/panel.ts';
import { BOOK_CSS, Gatherer, RecipeBook, SOURCES, canAfford, missing, refund, spend } from '../../packages/game/src/gather.ts';
import { CHAT_CSS, SynthPanel } from '../../packages/game/src/chat.ts';
import { Creatures } from '../../packages/game/src/creatures.ts';
import { ARENA_MIN_X, NIGHT_CSS, NightCycle, SPAWN_X, type RaidLog } from '../../packages/game/src/nightcycle.ts';
import { LIBRARY } from '../../packages/synth/src/library.ts';
import { Evolver, SEEDS, evoConfig, fitnessConfig, makeArena, type EvoState } from '../../packages/evo/src/index.ts';

const DAY_STEPS = 100 * 60; // daylight is the scarce thing: about 500 units of gathering if you do nothing else
const START = { W: 30, S: 8, F: 12, T: 6, P: 4, B: 0 };
const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + BOOK_CSS + CHAT_CSS + NIGHT_CSS + '.goals{list-style:none;margin:0;padding:0;display:grid;gap:6px}.goals li{display:grid;grid-template-columns:20px 1fr auto;gap:6px;align-items:start;font-size:13px;opacity:.55}.goals li.now{opacity:1}.goals li.done{opacity:.7}.goals li.done b{text-decoration:line-through;font-weight:500}.goals li p{margin:2px 0 0;grid-column:2/4;font-size:12px}.goals li:not(.now) p{display:none}.goals button{font-size:11px;padding:1px 7px}.side{width:340px}.score{font-weight:700;font-size:13px}.over{position:absolute;inset:0;display:grid;place-items:center;background:#14161bcc;z-index:5}.over .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;max-width:420px;margin:16px;display:grid;gap:10px}.over h2{font-family:var(--display);margin:0;font-size:20px}.over p{margin:0;color:var(--muted)}' }));
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
const SAVE_KEY = 'synth-p16-save';
function readSave(): Save | null { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); return s && s.v === 1 && s.world?.v === 1 ? s : null; } catch { return null; } }
const loaded = readSave();
const gather = new Gatherer(loaded?.inv ?? START); const zoo = new Creatures();
const book = new RecipeBook('synth-p16-book', [RECIPES.wall,
  { name: 'thorn wall', grid: ['WT', 'WT', 'WT', 'WT', 'WT', 'PP'], note: 'Thorns face the burrow. Whatever leans on it gets hurt.' },
  { name: 'stone wall', grid: ['SS', 'SS', 'SS', 'PP'], note: 'Short and heavy. Hard to chew, hard to shove.' },
  { name: 'short spikes', grid: ['T.T.T', 'WWWWW', 'PPPPP'], note: 'A strip to walk over, if you dare.' },
  { name: 'tower', grid: [...Array(9).fill('WW'), 'PP'], note: 'Nine high. Mind where it lands if it falls.' },
  RECIPES.spikeStrip, RECIPES.berryStack, RECIPES.thornClub, RECIPES.bucket] as Recipe[]);
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
evoConfig.maxCells = 40; evoConfig.nicheBy = 'family';
// ---- the day shift
declare const __WORKER_SRC__: string;
const DAY_TRIALS = 600; const shiftMsg = el('p');
const shift = {
  worker: null as Worker | null, running: false, trials: 0, done: null as ((s: EvoState | null) => void) | null,
  init() { try { if (__WORKER_SRC__) this.worker = new Worker(URL.createObjectURL(new Blob([__WORKER_SRC__], { type: 'text/javascript' }))); } catch { this.worker = null; }
    if (!this.worker) { shiftMsg.textContent = 'No background worker here, so the burrow only breeds at night (200 bodies).'; return; }
    this.worker.onmessage = (e) => { const m = e.data; this.trials = m.trials; if (m.type === 'done') { this.running = false; if (this.drop) { this.drop = false; this.trials = 0; this.start(cycle.real); return; } this.result = m.state; this.done?.(m.state); this.done = null; } this.paint(); };
    this.worker.onerror = () => { this.running = false; this.done?.(null); this.done = null; }; },
  result: null as EvoState | null,
  paint() { shiftMsg.textContent = this.worker ? `Day shift: the burrow has tried ${this.trials} of ${DAY_TRIALS} bodies against ${cycle.lastDusk ? 'the base it met last night' : 'your base as it was at first light'}${this.running ? '.' : ', and is resting.'}` : shiftMsg.textContent; },
  /** Start breeding against a snapshot. The burrow's state is copied; the main thread keeps its own until dusk. */
  start(base: World) { if (!this.worker || this.running) return; this.running = true; this.trials = 0; this.result = null;
    this.worker.postMessage({ type: 'run', world: makeArena(base, ARENA_MIN_X).save(), state: JSON.parse(JSON.stringify(cycle.evo.state)), seed: 1, budget: DAY_TRIALS, spawnX: SPAWN_X, wreck: fitnessConfig.wreck, maxCells: evoConfig.maxCells, nicheBy: evoConfig.nicheBy }); this.paint(); },
  /** Dusk: stop the shift if it is still going and hand what it bred to the night. */
  async collect() { if (!this.worker) return; let s = this.result;
    if (this.running) { s = await new Promise<EvoState | null>((res) => { this.done = res; this.worker!.postMessage({ type: 'stop' }); setTimeout(() => res(null), 4000); }); }
    if (s) { cycle.evo = new Evolver(1, SEEDS, s); this.got = this.trials; } else this.got = 0; this.result = null; },
  got: 0, drop: false,
  /** New game: throw away whatever the shift was breeding and start it again from the fresh burrow. */
  restart() { if (!this.worker) return; this.result = null; if (this.running) { this.drop = true; this.worker.postMessage({ type: 'stop' }); } else this.start(cycle.real); },
};
const cycle: NightCycle = new NightCycle({
  game, zoo, seeds: SEEDS, raidSeconds: 60, rot: true, budgetFor: () => (shift.worker ? 100 : 200), beforeSleep: () => shift.collect(), state: loaded?.evo, day: loaded?.day, log: loaded?.log,
  hints: {
    day: 'Hold the mouse on a source to gather. Ask the synthesizer for what you need, Synthesize, click to place. <kbd>Q</kbd> <kbd>E</kbd> turn; <kbd>X</kbd> takes apart what you hold and gives the pieces back. Night falls when the light runs out.',
    dawn: 'Dawn. Survivors have gone home. <kbd>X</kbd> on a dead raider salvages its body, sinew included. What you leave is gone by nightfall. The light is already running.',
  },
  onMode: (m) => { if (m === 'dawn') light = DAY_STEPS; if (ready) { clock(); refresh(); } },
  onDawn: (e) => { const s = stash(); bestStash = Math.max(bestStash, s); lostTotal += e.lost; if (s === 0) gameOver(); else survived++; clock(); save('Saved at dawn.'); if (cycle.lastDusk) shift.start(cycle.lastDusk); },
});
bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 16 · first days'), cycle.phase, score, el('span', 'spacer'), invEl); app.append(bar, wrap);
const stash = () => cycle.real.countIn(M.BERRY, LAYOUT.home[0], LAYOUT.home[1] + 80);
function clock() {
  const m = cycle.mode; if (m === 'day' || m === 'dawn') { const s = Math.max(0, Math.ceil(light / 60)); cycle.label(` · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} of light`); }
  score.textContent = `Stash ${stash()} berries · ${survived} ${survived === 1 ? 'morning' : 'mornings'} survived`;
}
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName) || !cycle.canBuild) return;
  const w = game.world; if (!w.hand.active) return; const nodes = w.bodyNodes(w.hand.node);
  if (nodes.some((i) => w.mat[i] === M.HEART)) return; // a living creature cannot be taken apart
  if (nodes.some((i) => w.tag[i] >= 1000)) did.salvage = true; refund(gather.inv, w, nodes); for (const i of nodes) w.removeNode(i); gather.onChange();
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
// ---- the guide: goals are ticked by what the game sees, never by a button
const GOAL_KEY = 'synth-p16-goals';
const did: Record<string, boolean> = (() => { try { return JSON.parse(localStorage.getItem(GOAL_KEY) ?? '{}') ?? {}; } catch { return {}; } })();
const defences = () => { const w = cycle.real; let n = 0; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] < 1000 && w.mat[i] !== M.BERRY && w.mat[i] !== M.WATER && w.x[i] > LAYOUT.home[0] && w.x[i] < LAYOUT.home[1] + 300) n++; return n; };
const GOALS: { key: string; title: string; how: string; x?: number; test: () => boolean }[] = [
  { key: 'gather', title: 'Gather something', how: 'Hold the mouse on the tree, the outcrop or the bramble until your pockets (top right) go up.', x: SOURCES[0].x, test: () => Object.keys(gather.inv).some((k) => gather.inv[k] > (START as Record<string, number>)[k]) },
  { key: 'build', title: 'Put up a defence', how: 'In the recipe book below, press Make on a wall, then click the ground between your berries and the burrow. The burrow is to the right.', x: LAYOUT.home[1] - 40, test: () => defences() > 0 },
  { key: 'sleep', title: 'Sleep through a raid', how: 'Press Sleep. The burrow dreams up raiders against your base, then three of them walk in. Watch what they do to it.', test: () => cycle.log.length > 0 },
  { key: 'salvage', title: 'Take a dead raider apart', how: 'At dawn, pick up a dead raider and press X. Its pieces go in your pockets, sinew included. If none died, thorns help.', x: LAYOUT.home[1] + 60, test: () => !!did.salvage },
  { key: 'ask', title: 'Ask the synthesizer for something', how: 'Type what you need in the Synthesizer box ("a thorn wall, taller"), then Synthesize and place it.', test: () => !!did.ask },
  { key: 'three', title: 'See a third morning with berries left', how: 'The burrow studies yesterday\'s base all day. Change something every morning.', test: () => survived >= 3 },
];
const guideSec = section(side, 'First days'); const goalList = el('ol', 'goals'); const guideNote = el('p'); guideSec.append(goalList, guideNote);
function paintGoals() {
  let changed = false; for (const g of GOALS) if (!did[g.key] && g.test()) { did[g.key] = true; changed = true; }
  if (changed) { try { localStorage.setItem(GOAL_KEY, JSON.stringify(did)); } catch { /* the guide still works for this sitting */ } }
  const next = GOALS.find((g) => !did[g.key]); goalList.replaceChildren();
  for (const g of GOALS) { const li = el('li', did[g.key] ? 'done' : g === next ? 'now' : ''); li.append(el('span', '', did[g.key] ? '✓' : g === next ? '→' : '○'), el('b', '', g.title));
    if (g.x !== undefined && g === next) { const b = el('button', '', 'Show me'); const x = g.x; b.onclick = () => game.centerOn(x); li.append(b); } else li.append(el('span'));
    li.append(el('p', '', g.how)); goalList.append(li); }
  guideNote.textContent = next ? '' : 'That is the whole loop. From here it is you against the burrow.';
}
setInterval(paintGoals, 500);
const nightSec = section(side, 'Night', 'Sleep early if you are ready. The night is short: 100 bodies against your base as it stands, on top of what the day shift found.');
const again = el('button', '', 'Start over'); again.onclick = () => { if (cycle.busy) return; cycle.reset(freshWorld()); gather.inv = { ...START }; light = DAY_STEPS; bestStash = 0; survived = 0; lostTotal = 0; over = false; overlay.hidden = true; try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ } saveMsg.textContent = 'New game. It saves itself every dawn.'; shift.restart(); gather.onChange(); game.centerOn(LAYOUT.home[1] - 100); };
const WRECK = 4; fitnessConfig.wreck = loaded ? loaded.wreck : WRECK;
const lever = el('div', 'seg'); lever.setAttribute('role', 'group'); lever.setAttribute('aria-label', 'What raiders are bred for');
const paint = () => { for (const b of Array.from(lever.children) as HTMLButtonElement[]) b.classList.toggle('on', (b.dataset.v === 'on') === fitnessConfig.wreck > 0); };
for (const [v, label] of [['on', 'Bred to wreck and eat'], ['off', 'Bred to eat only']]) { const b = el('button', '', label); b.dataset.v = v; b.onclick = () => { if (cycle.busy) return; fitnessConfig.wreck = v === 'on' ? WRECK : 0; paint(); }; lever.append(b); }
paint(); const leverNote = el('p', '', 'Wreckers earn score for every hit point they take off your defences. Damage stays until you rebuild.');
const saveBtn = el('button', '', 'Save now'); saveBtn.onclick = () => save();
const saveRow = el('div', 'row'); saveRow.append(saveBtn, again); saveMsg.textContent = loaded ? `Picked up your game from ${new Date(loaded.at).toLocaleString()}.` : 'New game. It saves itself every dawn.';
nightSec.append(cycle.controls, shiftMsg, lever, leverNote, saveRow, saveMsg); shift.init(); shift.start(cycle.real); // first day: nothing met yet, so it studies the base as it is
const talk = section(side, 'Synthesizer');
const editWrap = el('div'); editWrap.hidden = true; const editor = gridEditor('edit', RECIPES.wall as Recipe); const apply = el('button', '', 'Use these letters'); editWrap.append(editor.root, apply);
const chat = new SynthPanel({
  inv: () => gather.inv, onSynthesize: (r) => { did.ask = true; tryMake(r); }, onSave: (r, t) => book.add(r, t.map((x) => ({ role: x.role, text: x.text }))),
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
(window as any).save = save; (window as any).state = () => ({ goals: { ...did }, defences: defences(), shiftTrials: shift.trials, shiftGot: shift.got, shiftRunning: shift.running, hasWorker: !!shift.worker, evoNight: cycle.evo.state.night, hash: cycle.real.hash(), archive: cycle.evo.state.archive.length, survived, over, mode: cycle.mode, day: cycle.day, log: cycle.log, light, stash: stash(), inv: gather.inv });
