// Day, night, raid, dawn: the loop shared by every prototype from 06 on.
// Night breeds creatures against a copy of the base at dusk while the view follows the champion's attempt;
// then the best of three niches come from the burrow one at a time.
import { LAYOUT, M, type World } from '../../sim/src/index.ts';
import { Evolver, Trial, makeArena, nicheOf, nightConfig, toRecipe, type Elite, type EvoState, type Genome } from '../../evo/src/index.ts';
import { el, type Game } from './app.ts';
import { miniGrid } from './chat.ts';
import type { Creatures } from './creatures.ts';

export type Mode = 'day' | 'night' | 'raid' | 'dawn' | 'replay';
export interface RaiderLog { name: string; parent?: string; niche: string; grid: string[]; trialAte: number; ate: number; alive: boolean; }
export interface RaidLog { night: number; best: number; lost: number; eaten: number; wrecked: number; pieces: number; party: RaiderLog[]; }
export interface NightOpts {
  game: Game; zoo: Creatures; seeds: Genome[]; seed?: number; state?: EvoState; day?: number; log?: RaidLog[];
  hints?: Partial<Record<Mode, string>>; raidSeconds?: number;
  /** Trials for a given night, overriding the picker. Lets the burrow search harder as the nights go by. */
  budgetFor?: (night: number) => number;
  /** Awaited before the night starts (for example to collect what a background search found during the day). */
  beforeSleep?: () => Promise<void>;
  /** The dead last one day: whatever is left of earlier raiders is cleared at dusk. Without it bodies pile up into a free barricade. */
  rot?: boolean;
  onMode?: (m: Mode) => void; onDawn?: (entry: RaidLog) => void;
}
export const NIGHT_CSS = `
.phase{font-family:var(--display);font-size:15px;font-weight:700;padding:2px 12px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);font-variant-numeric:tabular-nums}
.phase.night{background:#1c2340;border-color:#5a6bd8;color:#c9d2ff}.phase.raid{background:#4a1f1f;border-color:var(--bad);color:#ffd0cd}
.meter{height:10px;border-radius:999px;background:#1d2127;border:1px solid var(--line);overflow:hidden}.meter i{display:block;height:100%;background:var(--accent);width:0}
.bars{display:flex;align-items:flex-end;gap:5px;height:70px;border-bottom:1px solid var(--line);padding-top:16px}
.bars div{flex:1;max-width:34px;background:var(--accent);border-radius:4px 4px 0 0;min-height:2px;position:relative}
.bars div span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--muted);white-space:nowrap}
.raider{display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}.raider:first-child{border-top:0}
.raider .who{flex:1;min-width:0}.raider b{display:block}.raider small{color:var(--muted)}
.dream{position:absolute;left:12px;top:10px;font-size:12.5px;color:#dfe5ff;background:#141a33cc;border-radius:9px;padding:5px 11px;pointer-events:none;max-width:calc(100% - 24px)}
select{font:inherit;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:4px 6px}
`;
const HINTS: Record<Mode, string> = {
  day: 'Daytime. Build, then go to sleep.',
  night: 'Night. Creatures are being bred against a copy of your base as it stood at dusk. You are watching the current best one try.',
  raid: 'Raid. The best three kinds are coming from the burrow, one at a time. You can still use your hand.',
  dawn: 'Dawn. Survivors have gone home; the dead stay where they fell.',
  replay: 'Replay of the last raid, without your hand.',
};
// raiders come 8 seconds apart: a creature that met the base alone in its dream meets it nearly alone here
const RAID_GAP = 480, RAID_MAX = 44 * 60;
export const SPAWN_X = LAYOUT.burrow - 60, ARENA_MIN_X = LAYOUT.home[0] - 200;

export class NightCycle {
  mode: Mode = 'day'; day: number; real: World; evo: Evolver; log: RaidLog[];
  phase = el('span', 'phase'); hint = el('div', 'hint'); dreamTag = el('div', 'dream');
  controls = el('div'); report = el('div');
  private sleepBtn = el('button', 'primary', 'Sleep'); private budgetSel = el('select'); private replayBtn = el('button', '', 'Replay raid');
  private fill = el('i'); private msg = el('p'); private bars = el('div', 'bars'); private body = el('div');
  private dream: Trial | null = null; private dreamOf: Genome | null = null; private lastShown: Genome | null = null; private arena: World | null = null;
  private t0 = 0; private steps = 0; private budget = nightConfig.trials;
  private party: Elite[] = []; private raidStep = 0; private raidStart: World | null = null; private berries0 = 0; private eaten0 = 0; private base0 = { hp: 0, n: 0 };
  private saved: World | null = null; private zooSaved: Creatures['list'] = [];
  constructor(public o: NightOpts) {
    this.real = o.game.world; this.day = o.day ?? 1; this.log = o.log ?? []; this.evo = new Evolver(o.seed ?? 1, o.seeds, o.state);
    for (const n of [100, 200, 400]) { const op = el('option', '', `${n} trials`); op.value = String(n); if (n === 200) op.selected = true; this.budgetSel.append(op); }
    this.budgetSel.setAttribute('aria-label', 'Trials per night');
    const row = el('div', 'row'); row.append(this.sleepBtn, this.budgetSel, this.replayBtn); const meter = el('div', 'meter'); meter.append(this.fill); meter.style.margin = '8px 0 4px';
    this.controls.append(row, meter, this.msg); this.report.append(this.bars, this.body);
    this.sleepBtn.onclick = () => this.sleep(); this.replayBtn.onclick = () => { if ((this.mode === 'day' || this.mode === 'dawn') && this.raidStart) this.startReplay(); };
    this.dreamTag.hidden = true; o.game.opts.mount.append(this.hint, this.dreamTag);
    const loop = () => { requestAnimationFrame(loop); if (this.mode === 'night') this.nightFrame(); }; requestAnimationFrame(loop);
    if (o.budgetFor) this.budgetSel.hidden = true;
    this.setMode('day'); this.renderLog();
  }
  /** Hit points and piece count of everything the player built (not creatures, berries or water). */
  private baseHp(w: World) { let hp = 0, n = 0; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] < 1000 && w.mat[i] !== M.BERRY && w.mat[i] !== M.WATER) { hp += Math.max(0, w.hp[i]); n++; } return { hp, n }; }
  get busy() { return this.mode === 'night' || this.mode === 'raid' || this.mode === 'replay'; }
  /** True when the player may build and take things apart. */
  get canBuild() { return this.mode !== 'night' && this.mode !== 'replay'; }
  label(extra = '') { const m = this.mode, d = this.day; this.phase.textContent = (m === 'day' ? `Day ${d}` : m === 'night' ? `Night ${d}` : m === 'raid' ? `Raid ${d}` : m === 'replay' ? 'Replay' : `Dawn, day ${d}`) + extra; }
  setMode(m: Mode) {
    this.mode = m; const g = this.o.game; this.phase.className = 'phase' + (m === 'night' ? ' night' : m === 'raid' || m === 'replay' ? ' raid' : ''); this.label();
    this.hint.innerHTML = this.o.hints?.[m] ?? HINTS[m]; g.night = m === 'night' ? 1 : m === 'raid' || m === 'replay' ? 0.55 : 0; g.paused = m === 'night';
    this.sleepBtn.disabled = this.busy; this.budgetSel.disabled = this.busy; this.replayBtn.disabled = this.busy || !this.raidStart; this.dreamTag.hidden = m !== 'night';
    this.o.onMode?.(m);
  }
  /** Start again with a new world and a fresh burrow. */
  reset(world: World) { this.real = this.o.game.world = world; this.o.zoo.list = []; this.evo = new Evolver(this.o.seed ?? 1, this.o.seeds); this.day = 1; this.log.length = 0; this.party = []; this.raidStart = null; this.setMode('day'); this.renderLog(); }
  private sleeping = false;
  sleep() {
    if ((this.mode !== 'day' && this.mode !== 'dawn') || this.sleeping) return;
    if (!this.o.beforeSleep) { this.fallAsleep(); return; }
    this.sleeping = true; this.sleepBtn.disabled = true; this.o.beforeSleep().catch(() => {}).then(() => { this.sleeping = false; this.fallAsleep(); });
  }
  /** The base as it stood at the last dusk, before the raid touched it. */
  get lastDusk(): World | null { return this.raidStart; }
  private fallAsleep() {
    if (this.mode !== 'day' && this.mode !== 'dawn') return; const g = this.o.game;
    this.real = g.world; this.real.release(); g.ghost = null; this.o.zoo.dismiss(this.real);
    if (this.o.rot) { const w = this.real; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] >= 1000) w.removeNode(i); this.o.zoo.list = []; }
    // renumber so the raiders land after everything else, in the arena and here alike: the raid then matches the dream
    const map = this.real.compact(); for (const c of this.o.zoo.list) { c.nodes = c.nodes.map((i) => map[i] ?? -1).filter((i) => i >= 0); c.heart = map[c.heart] ?? -1; }
    this.arena = makeArena(this.real, ARENA_MIN_X); this.budget = this.o.budgetFor ? this.o.budgetFor(this.day) : +this.budgetSel.value;
    this.evo.beginNight(this.arena, SPAWN_X, this.budget); this.t0 = performance.now(); this.steps = 0; this.dream = null; this.dreamOf = null; this.lastShown = null; this.setMode('night');
  }
  private nightFrame() {
    const g = this.o.game, evo = this.evo; const t0 = performance.now(); let done = false;
    while (performance.now() - t0 < 11 && !done) { done = evo.advance(600); this.steps += 600; }
    const top = evo.raiders(1)[0];
    if (top && top.g !== this.lastShown && (!this.dream || this.dream.done)) { this.lastShown = this.dreamOf = top.g; this.dream = new Trial(this.arena!.clone(), top.g, { spawnX: SPAWN_X, seconds: nightConfig.trialSeconds }); }
    const d = this.dream; if (d && !d.done) d.step(5);
    if (d) { g.world = d.w; const hx = d.w.alive[d.c.heart] ? d.w.x[d.c.heart] : SPAWN_X; g.cam.x += (hx - (g.cam.w / g.cam.zoom) * 0.45 - g.cam.x) * 0.08; g.clampCam(); }
    const secs = (performance.now() - this.t0) / 1000;
    this.fill.style.width = `${Math.min(100, (evo.trialsTonight / this.budget) * 100)}%`;
    this.msg.textContent = `${evo.trialsTonight} of ${this.budget} trials · ${evo.state.archive.length} kinds alive · about ${Math.round(this.steps / Math.max(secs, 0.01) / 60)}× real time`;
    if (top && this.dreamOf) this.dreamTag.textContent = `Dreaming of ${this.dreamOf.name ?? 'a creature'} (${nicheOf(this.dreamOf)}). Best so far ate ${top.result.eaten} and scored ${Math.round(top.fitness)}.`;
    if (done) this.startRaid();
  }
  private startRaid() {
    const g = this.o.game, real = this.real; this.party = this.evo.raiders(nightConfig.raiders); g.world = real; this.raidStart = real.clone(); this.raidStep = 0;
    this.berries0 = real.count(M.BERRY); this.eaten0 = real.eaten; this.base0 = this.baseHp(real); real.events.length = 0;
    this.fill.style.width = '100%'; this.msg.textContent = `Night ${this.day} took ${((performance.now() - this.t0) / 1000).toFixed(0)} s. ${this.party.length} raiders are on their way.`;
    this.setMode('raid'); g.centerOn(LAYOUT.home[1] + 60);
  }
  private startReplay() {
    const g = this.o.game, zoo = this.o.zoo; this.saved = this.real; g.world = this.raidStart!.clone(); g.world.events.length = 0; this.zooSaved = zoo.list; zoo.list = [];
    this.raidStep = 0; this.berries0 = g.world.count(M.BERRY); this.setMode('replay'); g.centerOn(LAYOUT.home[1] + 60);
  }
  /** Call once per simulation step from the game's onStep. */
  step(w: World) {
    const zoo = this.o.zoo; if (this.mode !== 'raid' && this.mode !== 'replay') { zoo.step(w); return; }
    if (this.raidStep % RAID_GAP === 0) { const k = this.raidStep / RAID_GAP; if (k < this.party.length) zoo.spawn(w, this.party[k].g, SPAWN_X); }
    zoo.step(w); this.raidStep++;
    const all = this.raidStep > (this.party.length - 1) * RAID_GAP;
    if (all && (this.raidStep >= (this.o.raidSeconds ? this.o.raidSeconds * 60 : RAID_MAX) || zoo.aliveCount() === 0 || w.count(M.BERRY) === 0)) this.endRaid(w);
  }
  private endRaid(w: World) {
    const g = this.o.game, zoo = this.o.zoo;
    if (this.mode === 'replay') { g.world = this.real = this.saved!; zoo.list = this.zooSaved; this.saved = null; this.setMode('dawn'); return; }
    const lost = this.berries0 - w.count(M.BERRY); const raiders = zoo.list.slice(-this.party.length); const h = this.evo.state.history;
    const b1 = this.baseHp(w);
    const entry: RaidLog = { night: this.day, best: h[h.length - 1]?.best ?? 0, lost, eaten: w.eaten - this.eaten0, wrecked: Math.max(0, Math.round(this.base0.hp - b1.hp)), pieces: Math.max(0, this.base0.n - b1.n),
      party: this.party.map((e, i) => ({ name: e.g.name ?? 'creature', parent: e.g.parent, niche: e.niche, grid: toRecipe(e.g).grid, trialAte: e.result.eaten, ate: raiders[i]?.ate ?? 0, alive: raiders[i]?.alive ?? false })) };
    this.log.push(entry); zoo.dismiss(w); this.day++; this.setMode('dawn'); this.renderLog(); this.o.onDawn?.(entry);
  }
  renderLog() {
    const { bars, body, log } = this; bars.replaceChildren(); body.replaceChildren();
    if (!log.length) { bars.hidden = true; body.append(el('p', '', 'Nothing yet. Sleep to find out what comes.')); return; }
    bars.hidden = false; const max = Math.max(...log.map((l) => l.best), 1);
    for (const l of log.slice(-10)) { const b = el('div'); b.style.height = `${Math.max(3, (l.best / max) * 100)}%`; b.title = `Night ${l.night}: best score ${Math.round(l.best)}`; b.append(el('span', '', String(Math.round(l.best)))); bars.append(b); }
    const last = log[log.length - 1];
    body.append(el('p', '', `Bars are the best trial score each night (it can fall when you change the base). Last raid cost you ${last.lost} berries: ${last.eaten} eaten, ${last.lost - last.eaten} trampled.` + (last.wrecked ? ` Your defences took ${last.wrecked} damage and lost ${last.pieces} pieces.` : '')));
    for (const p of last.party) {
      const row = el('div', 'raider'), who = el('div', 'who');
      who.append(el('b', '', p.name), el('small', '', `${p.niche}${p.parent ? ', bred from ' + p.parent : ''}. Ate ${p.trialAte} in its dream, ${p.ate} in the raid. ${p.alive ? 'Went home.' : 'Died here.'}`));
      row.append(miniGrid(p.grid), who); body.append(row);
    }
  }
}
