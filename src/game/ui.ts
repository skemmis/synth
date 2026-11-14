import { BLUEPRINT_GLYPHS, CONFIG, LAYOUT, MATERIALS, formatRecipes, gridCost, parseRecipes, validateGrid, type Recipe } from '../sim';
import { h } from './dom';
import { Game } from './game';
import { PRESETS } from './presets';
import { Player, countStash, describeCost, spawnStash } from './state';

/** a small picture of a recipe: one dot per cell */
export function gridThumb(grid: string[], cell = 5): HTMLCanvasElement {
  const w = grid[0]?.length ?? 1, hgt = grid.length || 1;
  const c = h('canvas', { width: w * cell * 2, height: hgt * cell * 2 }) as HTMLCanvasElement;
  c.style.width = `${w * cell}px`; c.style.height = `${hgt * cell}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  grid.forEach((row, r) => [...row].forEach((g, col) => {
    const m = MATERIALS.find((mm) => mm.glyph === g);
    if (!m) return;
    ctx.beginPath();
    ctx.arc(col * cell + cell / 2, r * cell + cell / 2, cell / 2, 0, 7);
    ctx.fillStyle = m.color;
    ctx.fill();
  }));
  return c;
}

export interface Ui {
  /** load a recipe into the draft editor */
  setDraft(r: Recipe, opts?: { hold?: boolean }): void;
  getDraft(): Recipe | null;
  addTab(id: string, label: string, body: HTMLElement, first?: boolean): void;
  showTab(id: string): void;
  topSlot: HTMLElement;
  menu: HTMLElement;
  onNewWorld: (() => void)[];
  redraw(): void;
  panel: HTMLElement;
  toast(text: string): void;
}

export function buildUi(game: Game, player: Player, root: HTMLElement): Ui {
  const onNewWorld: (() => void)[] = [];
  // ------------------------------------------------------------- top bar
  const stat = h('span.stat');
  const inv = h('div.inv');
  const berries = h('span.berries', { title: 'Berries in your stash' });
  const topSlot = h('span.slot');
  const pauseBtn = h('button', { onclick: () => { game.paused = !game.paused; } }, 'Pause');
  const free = h('input#free', { type: 'checkbox' }) as HTMLInputElement;
  free.addEventListener('change', () => { player.freeBuild = free.checked; drawInv(); refresh(); });
  const menuBody = h('div.panel#menu', { hidden: true },
    h('label.stat', { for: 'free', title: 'Build without spending materials' }, free, ' Free build (no material costs)'),
    pauseBtn,
    h('button', { onclick: () => {
      game.reset(game.seed + 1, false);
      spawnStash(game.world);
      for (const k of Object.keys(player.inventory)) player.inventory[k] = 0;
      drawInv();
      for (const f of onNewWorld) f();
      menuBody.hidden = true;
    } }, 'New world'),
    stat,
  );
  const menuBtn = h('button', { onclick: () => { menuBody.hidden = !menuBody.hidden; } }, 'Menu');
  const top = h('div.panel#topbar', {},
    h('span.title', {}, 'SYNTH'),
    inv, berries,
    h('span.spacer'),
    topSlot,
    menuBtn,
  );
  const drawInv = () => {
    inv.replaceChildren(...MATERIALS.filter((m) => BLUEPRINT_GLYPHS.includes(m.glyph)).map((m) =>
      h('span.item', { title: `${m.name} (${m.glyph}): ${m.useful}. From: ${m.source}.` },
        h('span.dot', { style: { background: m.color } }),
        player.freeBuild ? '∞' : String(player.inventory[m.glyph] ?? 0))));
  };

  // -------------------------------------------------------- draft editor
  const nameIn = h('input#rname', { type: 'text', placeholder: 'name', spellcheck: 'false' }) as HTMLInputElement;
  const area = h('textarea#grid', { spellcheck: 'false', rows: 7 }) as HTMLTextAreaElement;
  const msg = h('div.msg');
  const make = h('button.primary', {}, 'Synthesize') as HTMLButtonElement;
  const save = h('button', {}, 'Save to book') as HTMLButtonElement;
  let parent: string | undefined;
  let note: string | undefined;

  const readDraft = (): { recipe?: Recipe; errors: string[] } => {
    const r = Game.readGrid(area.value);
    if (!r.grid) return { errors: r.errors };
    return { recipe: { name: nameIn.value.trim() || 'Untitled', grid: r.grid, note, parent }, errors: [] };
  };
  const refresh = () => {
    if (!area.value.trim()) { msg.textContent = 'Type a grid of letters, or pick a recipe from the book.'; msg.className = 'msg'; make.disabled = save.disabled = true; return; }
    const d = readDraft();
    if (!d.recipe) { msg.textContent = d.errors.join('; '); msg.className = 'msg bad'; make.disabled = save.disabled = true; return; }
    const miss = player.missing(d.recipe.grid);
    const pieces = validateGrid(d.recipe.grid).ok ? '' : ' (separate pieces)';
    msg.replaceChildren(`Costs ${describeCost(gridCost(d.recipe.grid))}${pieces}.`,
      Object.keys(miss).length ? h('span.bad', {}, ` Missing ${describeCost(miss)}.`) : '');
    msg.className = 'msg';
    make.disabled = save.disabled = false;
  };
  area.addEventListener('input', refresh);
  make.addEventListener('click', () => { const d = readDraft(); if (d.recipe) game.hold(d.recipe.grid); });
  save.addEventListener('click', () => {
    const d = readDraft();
    if (!d.recipe) return;
    player.keep(d.recipe);
    drawBook();
    toast(`Saved "${d.recipe.name}" to the book`);
  });
  const legend = h('div.legend', {}, ...MATERIALS.filter((m) => BLUEPRINT_GLYPHS.includes(m.glyph)).flatMap((m) => [
    h('b', {}, h('span.dot', { style: { background: m.color } }), m.glyph),
    h('span', {}, `${m.name}: ${m.useful}`),
  ]));
  const editor = h('div.tabbody', {},
    nameIn, area, msg,
    h('div.row', {}, make, save),
    h('div.stat', { style: { marginTop: '6px' } }, 'Synthesize puts it on the hand; click in the world to drop it. Right-click an object to break it back into materials.'),
    h('details', {}, h('summary', {}, 'What the letters mean'), legend),
  );

  // --------------------------------------------------------- recipe book
  const list = h('div.book');
  const io = h('textarea#io', { spellcheck: 'false', rows: 5, placeholder: 'Paste recipe text here to import' }) as HTMLTextAreaElement;
  const drawBook = () => {
    list.replaceChildren(...player.book.map((r) => {
      const miss = Object.keys(player.missing(r.grid)).length > 0;
      return h('div.entry', { title: r.note ?? '' },
        h('div.thumb', {}, gridThumb(r.grid)),
        h('div.meta', {},
          h('div.name', {}, r.name),
          h('div.stat' + (miss ? '.bad' : ''), {}, describeCost(gridCost(r.grid)) + (r.parent ? ` · from ${r.parent}` : ''))),
        h('button', { title: 'Open in the editor', onclick: () => ui.setDraft(r) }, 'Edit'),
        h('button.primary', { title: 'Put one on the hand', onclick: () => ui.setDraft(r, { hold: true }) }, 'Make'),
        h('button.x', { title: 'Remove from the book', onclick: () => { player.forget(r.name); drawBook(); } }, '×'),
      );
    }));
    if (!player.book.length) list.append(h('div.stat', {}, 'The book is empty. Save a draft to keep it.'));
  };
  const book = h('div.tabbody', {},
    list,
    h('div.row', {},
      h('button', { onclick: async () => {
        io.value = formatRecipes(player.book);
        io.select();
        try { await navigator.clipboard.writeText(io.value); toast('Book copied as text'); } catch { toast('Book text is selected below: copy it'); }
      } }, 'Export as text'),
      h('button', { onclick: () => {
        const rs = parseRecipes(io.value);
        const good = rs.filter((r) => validateGrid(r.grid, { allowDisconnected: true }).ok);
        good.forEach((r) => player.keep(r));
        drawBook();
        toast(good.length ? `Imported ${good.length} recipe${good.length > 1 ? 's' : ''}` : 'No valid recipes found in that text');
      } }, 'Import'),
      h('button', { onclick: () => { PRESETS.forEach((p) => { if (!player.book.some((b) => b.name === p.name)) player.book.push({ ...p }); }); player.saveBook(); drawBook(); } }, 'Add examples'),
    ),
    io,
  );

  // ---------------------------------------------------------------- tabs
  const tabs = h('div.tabs');
  const bodies = h('div');
  const tabMap = new Map<string, { btn: HTMLElement; body: HTMLElement }>();
  const panel = h('div.panel#bench', {}, tabs, bodies);
  const showTab = (id: string) => {
    for (const [k, t] of tabMap) { t.btn.classList.toggle('on', k === id); t.body.hidden = k !== id; }
    if (id === 'book') drawBook();
  };
  const addTab = (id: string, label: string, body: HTMLElement, first = false) => {
    const btn = h('button.tab', { onclick: () => showTab(id) }, label);
    tabMap.set(id, { btn, body });
    const fold = tabs.querySelector('.spacer');
    if (first) { tabs.prepend(btn); bodies.prepend(body); } else { tabs.insertBefore(btn, fold); bodies.append(body); }
    body.hidden = true;
  };
  tabs.append(h('span.spacer'), h('button.tab.fold', { title: 'Hide or show this panel', onclick: () => panel.classList.toggle('collapsed') }, '▾'));
  addTab('grid', 'Grid', editor);
  addTab('book', 'Book', book);
  showTab('grid');

  // ------------------------------------------------------------- minimap
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
    c.fillStyle = '#7fa860';
    for (const x of Object.values(LAYOUT.sources)) c.fillRect(x * sx - 2, H * 0.3, 4, H * 0.2);
    c.fillStyle = '#d6336c'; c.beginPath(); c.arc(LAYOUT.home.stashX * sx, H * 0.4, 6, 0, 7); c.fill();
    c.fillStyle = '#1c1512'; c.beginPath(); c.arc(LAYOUT.burrow.x * sx, H * 0.5, 7, 0, 7); c.fill();
    // living hearts show as red dots, so a raid can be followed from anywhere
    const w = game.world;
    c.fillStyle = '#ff3b3b';
    for (let b = 0; b < w.nextBody; b++) {
      const hrt = w.bodyHeart[b];
      if (hrt >= 0 && w.alive[hrt]) { c.beginPath(); c.arc(w.x[hrt] * sx, H * 0.42, 5, 0, 7); c.fill(); }
    }
    c.strokeStyle = '#2c2420'; c.lineWidth = 3;
    c.strokeRect(game.cam.x * sx, 2, game.cam.viewW * sx, H - 4);
  };

  const hint = h('div.panel#hint');
  hint.innerHTML = 'Drag with the hand &nbsp;·&nbsp; <kbd>Q</kbd> <kbd>E</kbd> rotate &nbsp;·&nbsp; <kbd>A</kbd> <kbd>D</kbd> look around &nbsp;·&nbsp; right-click breaks down &nbsp;·&nbsp; <kbd>Space</kbd> pause';
  const toastEl = h('div.panel#toast', { hidden: true });
  let toastT = 0;
  const toast = (text: string) => {
    toastEl.textContent = text; toastEl.hidden = false;
    clearTimeout(toastT); toastT = window.setTimeout(() => { toastEl.hidden = true; }, 2600);
  };

  root.append(top, panel, mini, hint, toastEl, menuBody);
  let n = 0, lastInv = '';
  game.onFrame.push(() => {
    if (n++ % 10) return;
    drawMini();
    pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
    stat.textContent = `${Math.round(game.fps)} fps`;
    berries.replaceChildren(h('span.dot', { style: { background: '#d6336c' } }), `${countStash(game.world)} in stash`);
    const key = JSON.stringify(player.inventory) + player.freeBuild;
    if (key !== lastInv) { lastInv = key; drawInv(); refresh(); if (!tabMap.get('book')!.body.hidden) drawBook(); }
  });

  const ui: Ui = {
    setDraft(r, opts) {
      nameIn.value = r.name;
      area.value = r.grid.join('\n');
      note = r.note; parent = r.parent;
      refresh();
      if (opts?.hold) game.hold(r.grid); else showTab('grid');
    },
    getDraft: () => readDraft().recipe ?? null,
    addTab, showTab, topSlot, menu: menuBody, panel, toast, onNewWorld,
    redraw() { drawInv(); refresh(); drawBook(); },
  };
  ui.setDraft(PRESETS[0]);
  drawInv();
  return ui;
}
