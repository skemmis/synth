import EvoWorker from '../evo/worker?worker&inline';
import {
  EVO_CONFIG, Evolver, LocalPool, SEEDS, WorkerPool, makeArena, runNight, spawnCreature, startTrial,
  type Elite, type Genome, type LiveTrial, type Pool,
} from '../evo';
import { LAYOUT, Mat, type World } from '../sim';
import { h } from './dom';
import type { Game } from './game';
import { Renderer } from './render';
import { BUSH_STOCK, HEARTS_PER_DAY, countStash, type Player } from './state';
import { gridThumb, type Ui } from './ui';

export type Phase = 'day' | 'dream' | 'raid' | 'dawn';

interface Raider { elite: Elite; body: number; spawnAt: number; spawned: boolean; eaten: number; dead: boolean }

/** Day, night (dream then raid) and dawn. */
export function installCycle(game: Game, player: Player, ui: Ui, sfx: (name: string) => void = () => {}) {
  let evolver = new Evolver(game.seed * 7919 + 13, SEEDS);
  let phase: Phase = 'day';
  let raiders: Raider[] = [];
  let raidClock = 0;
  let lastArena: World | null = null;
  let lastBest: Elite | null = null;
  let stashAtDusk = 0;
  let cancelDream = false;
  let pool: Pool | null = null;
  const listeners: ((p: Phase) => void)[] = [];

  // ----------------------------------------------------------------- HUD
  const label = h('span.phase', {}, 'Day 1');
  const endDay = h('button.primary', { title: 'Night falls: the burrow dreams about your base, then raids it' }, 'End day') as HTMLButtonElement;
  ui.topSlot.append(label, endDay);

  // dream inset
  const insetCanvas = h('canvas', { width: 640, height: 360 }) as HTMLCanvasElement;
  const insetTitle = h('div.insettitle', {}, 'The dream');
  const insetInfo = h('div.stat');
  const bar = h('div.bar', {}, h('div.fill'));
  const skip = h('button', {}, 'Wake up') as HTMLButtonElement;
  const inset = h('div.panel#inset', { hidden: true }, insetTitle, insetCanvas, bar, h('div.row', {}, insetInfo, h('span.spacer'), skip));
  const report = h('div.panel#report', { hidden: true });
  document.getElementById('ui')!.append(inset, report);
  const insetRenderer = new Renderer(insetCanvas);
  let show: LiveTrial | null = null;
  let showQueue: Genome[] = [];
  let showLabel = '';
  let replaying = false;

  const drawInset = (time: number) => {
    if (inset.hidden || !show) return;
    for (let k = 0; k < (replaying ? 2 : 4) && !show.done; k++) show.step();
    const w = show.world;
    const hrt = w.bodyHeart[show.body];
    const viewH = 330, scale = insetCanvas.height / viewH, viewW = insetCanvas.width / scale;
    let fx = LAYOUT.burrow.x - 60;
    if (hrt >= 0) fx = w.x[hrt];
    else for (let i = 0; i < w.n; i++) if (w.alive[i] && w.body[i] === show.body) { fx = w.x[i]; break; }
    insetRenderer.draw(w, { x: fx - viewW * 0.45, y: LAYOUT.groundY - 250, scale, viewW, viewH }, { time, night: 0.6 });
  };

  const nextShow = () => {
    if (!lastArena) return;
    const g = showQueue.shift() ?? evolver.best(1)[0]?.genome;
    if (!g) return;
    show = startTrial(lastArena, g);
  };

  // --------------------------------------------------------------- phases
  const setPhase = (p: Phase) => {
    phase = p;
    for (const f of listeners) f(p);
    endDay.hidden = p !== 'day';
    label.textContent = p === 'day' ? `Day ${player.day}` : p === 'dream' ? `Night ${player.day}: dreaming` : p === 'raid' ? `Night ${player.day}: raid` : `Dawn`;
  };

  const makePool = (): Pool => {
    try {
      const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
      return new WorkerPool(() => new EvoWorker(), n);
    } catch {
      return new LocalPool(() => new Promise((r) => setTimeout(r, 0)));
    }
  };

  async function startNight() {
    if (phase !== 'day') return;
    sfx('dusk');
    game.world.release();
    game.ghost = null;
    game.frozen = true;
    stashAtDusk = countStash(game.world);
    setPhase('dream');
    cancelDream = false;
    replaying = false;
    lastArena = makeArena(game.world);
    showQueue = [];
    show = null;
    inset.hidden = false;
    report.hidden = true;
    insetTitle.textContent = 'The dream: the burrow tries bodies against your base';
    skip.hidden = false;
    pool ??= makePool();
    const t0 = performance.now();
    let elites: Elite[] = [];
    try {
      elites = await runNight(evolver, lastArena, pool, {
        cancelled: () => cancelDream,
        onProgress: (p) => {
          (bar.firstChild as HTMLElement).style.width = `${Math.min(100, (p.stepsUsed / p.budget) * 100).toFixed(1)}%`;
          insetInfo.textContent = `${p.trials} bodies tried · best ate ${evolver.best(1)[0]?.result.eaten ?? 0} · ${evolver.archive.size} kinds alive`;
          for (const e of p.improved) showQueue.push(e.genome);
          if (showQueue.length > 3) showQueue = showQueue.slice(-3);
        },
      });
    } catch (e) {
      // a worker failed (some sandboxes forbid them): finish the night on this thread
      pool?.dispose();
      pool = new LocalPool(() => new Promise((r) => setTimeout(r, 0)));
      insetTitle.textContent = 'The dream (running on one thread here, so a shorter night)';
      elites = await runNight(evolver, lastArena, pool, {
        cancelled: () => cancelDream, budgetSteps: EVO_CONFIG.nightBudgetSteps / 4, batch: 2,
        onProgress: (p) => {
          (bar.firstChild as HTMLElement).style.width = `${Math.min(100, (p.stepsUsed / p.budget) * 100).toFixed(1)}%`;
          insetInfo.textContent = `${p.trials} bodies tried · ${evolver.archive.size} kinds alive`;
          for (const el of p.improved) showQueue.push(el.genome);
        },
      });
    }
    void t0;
    lastBest = elites[0] ?? null;
    startRaid(elites);
  }

  function startRaid(elites: Elite[]) {
    inset.hidden = true;
    game.frozen = false;
    game.night = 1;
    setPhase('raid');
    sfx('raid');
    raidClock = 0;
    raiders = elites.map((elite, i) => ({ elite, body: -1, spawnAt: i * 4, spawned: false, eaten: 0, dead: false }));
    if (!raiders.length) endRaid();
    else game.centerOn(LAYOUT.burrow.x - 250);
  }

  function endRaid() {
    const w = game.world;
    // survivors leave; corpses stay as salvage
    let survivors = 0, killed = 0;
    for (const r of raiders) {
      if (!r.spawned) continue;
      r.eaten = w.bodyEaten[r.body] ?? 0;
      const heart = w.bodyHeart[r.body];
      if (heart >= 0) { survivors++; for (const i of w.component(heart, true).filter((i) => w.body[i] === r.body)) w.removeNode(i); for (let i = 0; i < w.n; i++) if (w.alive[i] && w.body[i] === r.body) w.removeNode(i); }
      else { killed++; r.dead = true; }
    }
    const left = countStash(w);
    player.bushStock = BUSH_STOCK;
    player.heartStock = HEARTS_PER_DAY;
    setPhase('dawn');
    sfx('dawn');
    showReport(survivors, killed, stashAtDusk - left, left);
  }

  function showReport(survivors: number, killed: number, lost: number, left: number) {
    const rows = raiders.filter((r) => r.spawned).map((r) => h('div.entry', {},
      h('div.thumb', {}, gridThumb(r.elite.genome.grid, 5)),
      h('div.meta', {}, h('div.name', {}, r.elite.niche), h('div.stat', {}, `ate ${r.eaten} · ${r.dead ? 'killed' : 'went home'}`)),
      h('button', { title: 'Keep its body plan in your recipe book (the heart becomes wood)', onclick: () => {
        player.keep({ name: `${r.elite.niche} raider`, grid: r.elite.genome.grid.map((row) => row.replace(/H/g, 'W')), note: `Body of a night-${player.day} raider.` });
        ui.toast('Saved to the recipe book');
      } }, 'Keep body'),
    ));
    report.replaceChildren(
      h('h2', {}, `Dawn after night ${player.day}`),
      h('div.big', {}, lost > 0 ? `${lost} berr${lost === 1 ? 'y' : 'ies'} taken. ${left} left.` : `Nothing taken. ${left} berries safe.`),
      h('div.stat', {}, `${raiders.length} raiders came; ${killed} died at your base, ${survivors} went home. Corpses are yours to break down: they are the only source of sinew. The bush has regrown.`),
      h('div.book', {}, ...rows),
      evolver.history.length > 1 ? h('div', {}, h('div.stat', {}, 'How well the burrow has done, night by night (its best body\'s score):'),
        h('div.spark', {}, ...evolver.history.map((v) => { const el = h('i', { title: v.toFixed(0) }); el.style.height = `${Math.max(3, Math.min(34, (Math.max(0, v) / Math.max(100, ...evolver.history)) * 34))}px`; return el; }))) : '',
      h('div.row', {},
        lastBest ? h('button', { onclick: replay }, lost > 0 ? 'Watch how the best one got in' : 'Watch the best attempt') : '',
        h('span.spacer'),
        h('button.primary', { onclick: beginDay }, `Begin day ${player.day + 1}`)),
    );
    report.hidden = false;
  }

  function replay() {
    if (!lastArena || !lastBest) return;
    replaying = true;
    inset.hidden = false;
    skip.hidden = true;
    insetTitle.textContent = `Replay: the ${lastBest.niche} raider, as dreamed`;
    insetInfo.textContent = `ate ${lastBest.result.eaten}, got ${lastBest.result.approach.toFixed(0)} cells closer, took ${lastBest.result.damage.toFixed(0)} damage`;
    (bar.firstChild as HTMLElement).style.width = '100%';
    show = startTrial(lastArena, lastBest.genome);
  }

  function beginDay() {
    report.hidden = true;
    inset.hidden = true;
    replaying = false;
    show = null;
    player.day++;
    game.night = 0;
    setPhase('day');
    for (const f of onDawn) f();
  }
  const onDawn: (() => void)[] = [];

  endDay.addEventListener('click', startNight);
  skip.addEventListener('click', () => { cancelDream = true; });

  game.onStep.push((g) => {
    if (phase !== 'raid') return;
    raidClock += 1 / 60;
    const w = g.world;
    for (const r of raiders) {
      if (!r.spawned && raidClock >= r.spawnAt) {
        r.body = spawnCreature(w, r.elite.genome, LAYOUT.burrow.x - 60).body;
        r.spawned = true;
      }
    }
    const allOut = raiders.every((r) => r.spawned);
    const anyAlive = raiders.some((r) => r.spawned && w.bodyHeart[r.body] >= 0);
    const lastSpawn = raiders[raiders.length - 1]?.spawnAt ?? 0;
    if (raidClock > lastSpawn + EVO_CONFIG.raidSeconds || (allOut && !anyAlive) || (allOut && w.count(Mat.Berry) === 0)) endRaid();
  });

  let ramp = 0;
  game.onFrame.push((g) => {
    // dusk and dawn fade
    const target = phase === 'dream' || phase === 'raid' ? 1 : 0;
    ramp += (target - ramp) * 0.04;
    g.night = ramp;
    if (phase === 'raid') label.textContent = `Night ${player.day}: raid · ${Math.max(0, Math.ceil((raiders[raiders.length - 1]?.spawnAt ?? 0) + EVO_CONFIG.raidSeconds - raidClock))}s`;
    if (!inset.hidden) {
      if (!show || show.done) { if (replaying && show?.done) show = startTrial(lastArena!, lastBest!.genome); else nextShow(); }
      drawInset(g.clock);
    }
    void showLabel;
  });

  return {
    get phase() { return phase; },
    get evolver() { return evolver; },
    startNight, beginDay, onDawn,
    /** forget the population (new world) or restore one (loaded save) */
    reset(state?: import('../evo').EvolverState) {
      evolver = new Evolver(game.seed * 7919 + 13, SEEDS);
      if (state) evolver.load(state);
      raiders = []; lastArena = null; lastBest = null;
      report.hidden = true; inset.hidden = true; game.frozen = false;
      setPhase('day');
    },
    onPhase: (f: (p: Phase) => void) => listeners.push(f),
    get raiders() { return raiders; },
  };
}
