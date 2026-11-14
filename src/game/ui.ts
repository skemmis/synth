import { BLUEPRINT_GLYPHS, CONFIG, LAYOUT, MATERIALS, gridCost } from '../sim';
import { h } from './dom';
import { Game } from './game';
import { PRESETS } from './presets';

/** Top bar, minimap, hint line and the workbench where grids are pasted. */
export function buildUi(game: Game, root: HTMLElement) {
  const stat = h('span.stat');
  const pauseBtn = h('button', { onclick: () => { game.paused = !game.paused; } }, 'Pause');
  const top = h('div.panel#topbar', {},
    h('span.title', {}, 'SYNTH'),
    h('span.stat', {}, 'physics toy'),
    h('span.spacer'),
    stat,
    pauseBtn,
    h('button', { onclick: () => game.reset(game.seed) }, 'Reset world'),
  );

  // workbench
  const area = h('textarea#grid', { spellcheck: 'false', rows: 7 }) as HTMLTextAreaElement;
  const msg = h('div.msg');
  const make = h('button.primary', {}, 'Make') as HTMLButtonElement;
  const refresh = () => {
    const r = Game.readGrid(area.value);
    if (!area.value.trim()) { msg.textContent = 'Type a grid of letters, or pick a recipe.'; msg.className = 'msg'; make.disabled = true; return null; }
    if (!r.grid) { msg.textContent = r.errors.join('; '); msg.className = 'msg bad'; make.disabled = true; return null; }
    const cost = gridCost(r.grid);
    msg.textContent = Object.entries(cost).map(([g, n]) => `${n} ${MATERIALS.find((m) => m.glyph === g)!.name.toLowerCase()}`).join(', ');
    msg.className = 'msg';
    make.disabled = false;
    return r.grid;
  };
  area.addEventListener('input', refresh);
  make.addEventListener('click', () => { const g = refresh(); if (g) game.hold(g); });
  const chips = h('div.chips', {}, ...PRESETS.map((p) => h('span.chip', {
    title: p.note ?? '',
    onclick: () => { area.value = p.grid.join('\n'); const g = refresh(); if (g) game.hold(g); },
  }, p.name)));
  const legend = h('div.legend', {}, ...MATERIALS.filter((m) => BLUEPRINT_GLYPHS.includes(m.glyph)).flatMap((m) => [
    h('b', {}, h('span.dot', { style: { background: m.color } }), m.glyph),
    h('span', {}, `${m.name}: ${m.useful}`),
  ]));
  const bench = h('div.panel#bench', {},
    h('div.head', { onclick: () => bench.classList.toggle('collapsed') }, h('h2', {}, 'Workbench'), h('span.stat', {}, 'hide')),
    h('div', { style: { height: '8px' } }),
    area,
    msg,
    h('div.row', {}, make, h('span.stat', {}, 'then click in the world to drop it')),
    h('h2', { style: { marginTop: '12px' } }, 'Recipes'),
    chips,
    h('details', {}, h('summary', {}, 'Materials'), legend),
  );
  area.value = PRESETS[0].grid.join('\n');
  refresh();

  // minimap
  const mm = h('canvas', { width: 600, height: 68 }) as HTMLCanvasElement;
  const mini = h('div.panel#minimap', {
    onpointerdown: (e: PointerEvent) => {
      const r = mini.getBoundingClientRect();
      game.centerOn(((e.clientX - r.left) / r.width) * CONFIG.world.width);
    },
  }, mm);
  const drawMini = () => {
    const c = mm.getContext('2d')!;
    const W = mm.width, H = mm.height, sx = W / CONFIG.world.width;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#f3dfc0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#4f9fdc';
    c.fillRect((LAYOUT.pond.x - LAYOUT.pond.halfWidth) * sx, H * 0.55, LAYOUT.pond.halfWidth * 2 * sx, H * 0.3);
    c.fillStyle = '#5d4a3c';
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= CONFIG.world.width; x += 40) c.lineTo(x * sx, H * 0.5 + (game.world.terrain.heightAt(x) - LAYOUT.groundY) * 0.3);
    c.lineTo(W, H); c.fill();
    c.fillStyle = '#d9603b'; c.fillRect(LAYOUT.home.stashX * sx - 2, H * 0.2, 4, H * 0.3);
    c.fillStyle = '#1c1512'; c.beginPath(); c.arc(LAYOUT.burrow.x * sx, H * 0.5, 6, 0, 7); c.fill();
    c.strokeStyle = '#2c2420'; c.lineWidth = 3;
    c.strokeRect(game.cam.x * sx, 2, game.cam.viewW * sx, H - 4);
  };

  const hint = h('div.panel#hint');
  hint.innerHTML = 'Drag things with the hand &nbsp;·&nbsp; <kbd>Q</kbd> <kbd>E</kbd> rotate &nbsp;·&nbsp; <kbd>A</kbd> <kbd>D</kbd> or drag the sky to look around &nbsp;·&nbsp; <kbd>Space</kbd> pause';

  root.append(top, bench, mini, hint);
  let n = 0;
  game.onFrame.push(() => {
    if (n++ % 15) return;
    drawMini();
    pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
    stat.textContent = `${game.world.liveNodes} nodes · ${Math.round(game.fps)} fps · ${game.stepMs.toFixed(1)} ms/step`;
  });
  return { top, bench, hint, area, refresh };
}
