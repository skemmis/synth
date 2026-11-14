// Prototype 05: overnight evolution and the raid (PRD milestone 4).
// Day: arrange defences. Night: creatures evolve against a snapshot of the base. Then the best of three niches raid it.
import { LAYOUT, M, RECIPES, spawnRecipe, stripTerrain, validateRecipe, World, type Recipe } from '../../packages/sim/src/index.ts';
import { setDown } from '../../packages/sim/src/bench.ts';
import { BASE_CSS, GOO_SVG, Game, el } from '../../packages/game/src/app.ts';
import { gridEditor, legend, section } from '../../packages/game/src/panel.ts';
import { CHAT_CSS, miniGrid } from '../../packages/game/src/chat.ts';
import { Creatures, describeGenome } from '../../packages/game/src/creatures.ts';
import { Evolver, SEEDS, Trial, makeArena, nicheOf, nightConfig, toRecipe, type Elite, type Genome } from '../../packages/evo/src/index.ts';

const CSS = `
.phase{font-family:var(--display);font-size:15px;font-weight:700;padding:2px 12px;border-radius:999px;background:var(--panel2);border:1px solid var(--line)}
.phase.night{background:#1c2340;border-color:#5a6bd8;color:#c9d2ff}.phase.raid{background:#4a1f1f;border-color:var(--bad);color:#ffd0cd}
.meter{height:10px;border-radius:999px;background:#1d2127;border:1px solid var(--line);overflow:hidden}.meter i{display:block;height:100%;background:var(--accent);width:0}
.bars{display:flex;align-items:flex-end;gap:5px;height:70px;border-bottom:1px solid var(--line);padding-top:4px}
.bars div{flex:1;max-width:34px;background:var(--accent);border-radius:4px 4px 0 0;min-height:2px;position:relative}
.bars div span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--muted);white-space:nowrap}
.raider{display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}.raider:first-child{border-top:0}
.raider .who{flex:1;min-width:0}.raider b{display:block}.raider small{color:var(--muted)}
.dream{position:absolute;left:12px;top:10px;font-size:12.5px;color:#dfe5ff;background:#141a33cc;border-radius:9px;padding:5px 11px;pointer-events:none;max-width:calc(100% - 24px)}
`;
const app = document.getElementById('app')!; app.style.cssText = 'display:flex;flex-direction:column;height:100%';
document.head.append(Object.assign(el('style'), { textContent: BASE_CSS + CHAT_CSS + CSS }));
app.insertAdjacentHTML('beforeend', GOO_SVG);
const bar = el('header', 'bar'); const stat = el('span', 'tag'), phase = el('span', 'phase', 'Day 1');
bar.append(el('h1', '', 'Synth'), el('span', 'tag', 'Prototype 05 · night raid'), phase, el('span', 'spacer'), stat);
const wrap = el('div', 'wrap'), stage = el('div'), side = el('aside', 'side'); wrap.append(stage, side); app.append(bar, wrap);

const STASH_X = LAYOUT.home[1] - 110, WALL_X = LAYOUT.home[1] + 40, SPAWN_X = LAYOUT.burrow - 60;
function freshWorld(): World {
  const w = new World(stripTerrain());
  spawnRecipe(w, RECIPES.berryStack, STASH_X, w.terrain.groundY(STASH_X) - 32);
  setDown(w, { name: 'wall', grid: ['WW', 'WW', 'WW'] }, WALL_X, w.terrain.groundY(WALL_X));
  return w;
}
type Mode = 'day' | 'night' | 'raid' | 'dawn' | 'replay';
let mode: Mode = 'day', day = 1, real = freshWorld();
const zoo = new Creatures(); let evo = new Evolver(1, SEEDS);
// the dream: the newest champion's trial, replayed at a watchable speed while the search runs behind it
let dream: Trial | null = null, dreamOf: Genome | null = null, arena: World | null = null, lastShown: Genome | null = null;
let nightT0 = 0, nightSteps = 0, budget = nightConfig.trials;
// the raid
let eaten0 = 0; let party: Elite[] = [], raidStep = 0, raidStart: World | null = null, berries0 = 0, saved: World | null = null;
const log: { night: number; best: number; lost: number; eaten: number; party: { name: string; parent?: string; niche: string; grid: string[]; trialAte: number; ate: number; alive: boolean }[] }[] = [];
// raiders come one at a time, 8 seconds apart: a creature that met the base alone in its dream meets it nearly alone here
const RAID_GAP = 480, RAID_MAX = 44 * 60;

const game = new Game({
  mount: stage, world: real, startX: LAYOUT.home[1] - 420,
  labels: [[(LAYOUT.home[0] + LAYOUT.home[1]) / 2, 'home'], [LAYOUT.burrow, 'burrow']],
  canGrab: () => mode === 'day' || mode === 'raid' || mode === 'dawn',
  onStep: (g) => { if (mode === 'raid' || mode === 'replay') raidTick(g.world); else zoo.step(g.world); },
  onDraw: (g, ctx) => { if (mode !== 'night') zoo.drawLabels(g, ctx); },
});
const hint = el('div', 'hint'); stage.append(hint); const dreamTag = el('div', 'dream'); dreamTag.hidden = true; stage.append(dreamTag);
const HINTS: Record<Mode, string> = {
  day: 'Daytime. Drag things, add defences from the panel, then go to sleep. <kbd>Q</kbd> <kbd>E</kbd> turn what you hold. <kbd>X</kbd> removes it.',
  night: 'Night. Creatures are being bred against a copy of your base as it stood at dusk. You are watching the current best one try.',
  raid: 'Raid. The best three kinds are coming from the burrow. You can still use your hand.',
  dawn: 'Dawn. Survivors have gone home; the dead stay where they fell. Rebuild, then sleep again.',
  replay: 'Replay of the last raid, without your hand.',
};
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'x' || /TEXTAREA|INPUT/.test((e.target as HTMLElement).tagName) || mode === 'night' || mode === 'replay') return;
  const w = game.world; if (!w.hand.active) return; const nodes = w.bodyNodes(w.hand.node);
  if (nodes.some((i) => w.mat[i] === M.HEART)) return;
  for (const i of nodes) w.removeNode(i);
});

// ---------------------------------------------------------------- night
const nightSec = section(side, 'Night', 'Each night runs a fixed number of trials. A trial is one creature, alone, against a copy of your base for 20 seconds.');
const sleepRow = el('div', 'row'); const sleep = el('button', 'primary', 'Sleep'); const budgetSel = el('select'); budgetSel.style.cssText = 'font:inherit;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:4px 6px';
for (const n of [100, 200, 400]) { const o = el('option', '', `${n} trials`); o.value = String(n); if (n === 200) o.selected = true; budgetSel.append(o); }
const replayBtn = el('button', '', 'Replay raid'); replayBtn.disabled = true; const restart = el('button', '', 'Start over');
sleepRow.append(sleep, budgetSel, replayBtn, restart);
const meter = el('div', 'meter'); const fill = el('i'); meter.append(fill); const nightMsg = el('p'); nightSec.append(sleepRow, meter, nightMsg);
sleep.onclick = () => { if (mode === 'day' || mode === 'dawn') startNight(); };
restart.onclick = () => { real = freshWorld(); game.world = real; zoo.list = []; evo = new Evolver(1, SEEDS); day = 1; log.length = 0; party = []; raidStart = null; setMode('day'); renderLog(); game.centerOn(LAYOUT.home[1] - 100); };
replayBtn.onclick = () => { if ((mode === 'day' || mode === 'dawn') && raidStart) startReplay(); };

function setMode(m: Mode) {
  mode = m; phase.className = 'phase' + (m === 'night' ? ' night' : m === 'raid' || m === 'replay' ? ' raid' : '');
  phase.textContent = m === 'day' ? `Day ${day}` : m === 'night' ? `Night ${day}` : m === 'raid' ? `Raid ${day}` : m === 'replay' ? 'Replay' : `Dawn, day ${day}`;
  hint.innerHTML = HINTS[m]; game.night = m === 'night' ? 1 : m === 'raid' || m === 'replay' ? 0.55 : 0; game.paused = m === 'night';
  const busy = m === 'night' || m === 'raid' || m === 'replay'; sleep.disabled = busy; budgetSel.disabled = busy; restart.disabled = busy; replayBtn.disabled = busy || !raidStart; dreamTag.hidden = m !== 'night';
  for (const b of Array.from(side.querySelectorAll<HTMLButtonElement>('button.place'))) b.disabled = m === 'night' || m === 'replay';
}
function startNight() {
  real.release(); game.ghost = null; zoo.dismiss(real);
  arena = makeArena(real, LAYOUT.home[0] - 200); budget = +budgetSel.value;
  evo.beginNight(arena, SPAWN_X, budget); nightT0 = performance.now(); nightSteps = 0; dream = null; dreamOf = null; lastShown = null; setMode('night');
}
function nightFrame() {
  // search: as many trial steps as fit in the time slice
  const t0 = performance.now(); let done = false;
  while (performance.now() - t0 < 11 && !done) { done = evo.advance(600); nightSteps += 600; }
  // dream: follow the newest champion
  const top = evo.raiders(1)[0];
  if (top && top.g !== lastShown && (!dream || dream.done)) { lastShown = top.g; dreamOf = top.g; dream = new Trial(arena!.clone(), top.g, { spawnX: SPAWN_X, seconds: nightConfig.trialSeconds }); }
  if (dream && !dream.done) dream.step(5);
  if (dream) { game.world = dream.w; const hx = dream.w.alive[dream.c.heart] ? dream.w.x[dream.c.heart] : SPAWN_X; game.cam.x += (hx - game.cam.w / game.cam.zoom * 0.45 - game.cam.x) * 0.08; game.clampCam(); }
  const secs = (performance.now() - nightT0) / 1000, sps = nightSteps / Math.max(secs, 0.01);
  fill.style.width = `${Math.min(100, (evo.trialsTonight / budget) * 100)}%`;
  nightMsg.textContent = `${evo.trialsTonight} of ${budget} trials · ${evo.state.archive.length} kinds alive · about ${Math.round(sps / 60)}× real time`;
  if (top && dreamOf) dreamTag.textContent = `Dreaming of ${dreamOf.name ?? 'a creature'} (${nicheOf(dreamOf)}). Best so far ate ${top.result.eaten} and scored ${Math.round(top.fitness)}.`;
  if (done) startRaid();
}
// ---------------------------------------------------------------- raid
function startRaid() {
  party = evo.raiders(nightConfig.raiders); game.world = real; raidStart = real.clone(); raidStep = 0; berries0 = real.count(M.BERRY); eaten0 = real.eaten; real.events.length = 0;
  fill.style.width = '100%'; nightMsg.textContent = `Night ${day} done in ${((performance.now() - nightT0) / 1000).toFixed(0)} s. ${party.length} raiders are on their way.`;
  setMode('raid'); game.centerOn(LAYOUT.home[1] + 60);
}
function startReplay() { saved = real; game.world = raidStart!.clone(); game.world.events.length = 0; zooSaved = zoo.list; zoo.list = []; raidStep = 0; berries0 = game.world.count(M.BERRY); setMode('replay'); game.centerOn(LAYOUT.home[1] + 60); }
let zooSaved: typeof zoo.list = [];
function raidTick(w: World) {
  if (raidStep % RAID_GAP === 0) { const k = raidStep / RAID_GAP; if (k < party.length) zoo.spawn(w, party[k].g, SPAWN_X); }
  zoo.step(w); raidStep++;
  const spawnedAll = raidStep > (party.length - 1) * RAID_GAP;
  if (spawnedAll && (raidStep >= RAID_MAX || zoo.aliveCount() === 0 || w.count(M.BERRY) === 0)) endRaid(w);
}
function endRaid(w: World) {
  if (mode === 'replay') { game.world = real = saved!; zoo.list = zooSaved; saved = null; setMode('dawn'); return; }
  const lost = berries0 - w.count(M.BERRY); const raiders = zoo.list.slice(-party.length);
  log.push({ night: day, best: evo.state.history[evo.state.history.length - 1]?.best ?? 0, lost, eaten: w.eaten - eaten0,
    party: party.map((e, i) => ({ name: e.g.name ?? 'creature', parent: e.g.parent, niche: e.niche, grid: toRecipe(e.g).grid, trialAte: e.result.eaten, ate: raiders[i]?.ate ?? 0, alive: raiders[i]?.alive ?? false })) });
  zoo.dismiss(w); day++; setMode('dawn'); renderLog();
}
// ---------------------------------------------------------------- report
const rep = section(side, 'What the nights produced'); const bars = el('div', 'bars'), repBody = el('div'); rep.append(bars, repBody);
function renderLog() {
  bars.replaceChildren(); repBody.replaceChildren();
  if (!log.length) { repBody.append(el('p', '', 'Nothing yet. Sleep to find out what comes.')); return; }
  const max = Math.max(...log.map((l) => l.best), 1);
  for (const l of log) { const b = el('div'); b.style.height = `${Math.max(3, (l.best / max) * 100)}%`; b.title = `Night ${l.night}: best score ${Math.round(l.best)}`; b.append(el('span', '', String(Math.round(l.best)))); bars.append(b); }
  const last = log[log.length - 1];
  repBody.append(el('p', '', `Bars are the best trial score each night (it can fall when you change the base). Last raid cost you ${last.lost} berries: ${last.eaten} eaten, ${last.lost - last.eaten} trampled.`));
  for (const p of last.party) {
    const row = el('div', 'raider'), who = el('div', 'who');
    who.append(el('b', '', p.name), el('small', '', `${p.niche}${p.parent ? ', bred from ' + p.parent : ''}. Ate ${p.trialAte} in its dream, ${p.ate} in the raid. ${p.alive ? 'Went home.' : 'Died here.'}`));
    row.append(miniGrid(p.grid), who); repBody.append(row);
  }
}
// ---------------------------------------------------------------- defences
const def = section(side, 'Defences', 'Free in this prototype. Click one, then click in the world.'); const drow = el('div', 'row'); def.append(drow);
for (const k of ['wall', 'woodBlock', 'stoneBlock', 'spikeStrip', 'pitchBlock', 'net', 'thornClub', 'berryStack']) {
  const b = el('button', 'place', RECIPES[k].name); b.onclick = () => { if (mode !== 'night' && mode !== 'replay') game.hold(RECIPES[k] as Recipe); }; drow.append(b);
}
const own = section(side, 'Your own design', 'Letters: W wood, S stone, F fiber, T thorn, P pitch, B berry.');
const editor = gridEditor('defence', { name: 'thorn hedge', grid: ['T.T.T', 'WTWTW', 'WWWWW'] });
const put = el('button', 'place primary', 'Put on cursor'); const msg = el('div', 'msg');
put.onclick = () => { const r = editor.get(), v = validateRecipe(r); if (!v.ok) { msg.textContent = v.errors[0]; msg.className = 'msg bad'; return; } msg.textContent = ''; if (mode !== 'night' && mode !== 'replay') game.hold(r); };
own.append(editor.root, put, msg);
legend(section(side, 'Materials'), (g) => g !== '~');

function refresh() { const w = mode === 'night' ? real : game.world; stat.textContent = `${w.count(M.BERRY)} berries · ${zoo.aliveCount()} raiders alive`; }
function loop() { requestAnimationFrame(loop); if (mode === 'night') nightFrame(); }
requestAnimationFrame(loop); setInterval(refresh, 400); setMode('day'); renderLog(); refresh(); game.centerOn(LAYOUT.home[1] - 100);
(window as any).game = game; (window as any).zoo = zoo; (window as any).state = () => ({ mode, day, log, eaten: real.eaten, berries: real.count(M.BERRY), trials: evo.trialsTonight, history: evo.state.history });
