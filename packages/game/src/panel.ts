// Panel widgets shared by prototypes.
import { MATERIALS, parseRecipe, validateRecipe, type Recipe, type Validation } from '../../sim/src/index.ts';
import { el } from './app.ts';

export function section(parent: HTMLElement, title: string, blurb = ''): HTMLElement {
  const s = el('section'); s.append(el('h2', '', title)); if (blurb) s.append(el('p', '', blurb)); parent.append(s); return s;
}
export function costChips(cost: Record<string, number>, have?: Record<string, number>): HTMLElement {
  const row = el('div', 'row');
  for (const [g, n] of Object.entries(cost)) {
    const m = MATERIALS.find((t) => t.glyph === g)!; const c = el('span', 'chip');
    const d = el('span', 'dot'); d.style.background = m.color; c.append(d, document.createTextNode(`${n} ${m.name}`));
    if (have && (have[g] ?? 0) < n) { c.style.borderColor = 'var(--bad)'; c.append(document.createTextNode(` (have ${have[g] ?? 0})`)); }
    row.append(c);
  }
  return row;
}
export function legend(parent: HTMLElement, filter: (g: string) => boolean = () => true) {
  const l = el('div', 'legend');
  for (const m of MATERIALS) {
    if (!filter(m.glyph)) continue;
    const k = el('span'); const d = el('span', 'dot'); d.style.background = m.color; const b = el('b', '', ' ' + m.glyph); k.append(d, b);
    l.append(k, el('span', '', `${m.name}: ${m.blurb.charAt(0).toLowerCase() + m.blurb.slice(1)}`));
  }
  parent.append(l);
}
export interface Editor { root: HTMLElement; get(): Recipe; set(r: Recipe): void; validation(): Validation; onChange: (r: Recipe, v: Validation) => void; }
/** The grid text editor: letters in, live validation and cost out. */
export function gridEditor(id: string, initial: Recipe, opts: { allowCreature?: boolean } = {}): Editor {
  const root = el('div'); root.style.display = 'grid'; root.style.gap = '6px';
  const name = el('input'); name.type = 'text'; name.id = id + '-name'; name.setAttribute('aria-label', 'Recipe name');
  const ta = el('textarea'); ta.id = id + '-grid'; ta.rows = 8; ta.spellcheck = false; ta.setAttribute('aria-label', 'Recipe grid');
  const msg = el('div', 'msg'); const chips = el('div');
  root.append(name, ta, chips, msg);
  const ed: Editor = {
    root, onChange: () => {},
    get: () => ({ ...parseRecipe(ta.value), name: name.value.trim() || 'untitled' }),
    set: (r) => { name.value = r.name; ta.value = r.grid.join('\n'); ta.rows = Math.max(6, r.grid.length + 1); refresh(); },
    validation: () => validateRecipe(ed.get(), opts),
  };
  const refresh = () => {
    const v = ed.validation(); chips.replaceChildren(costChips(v.cost));
    msg.textContent = v.ok ? `${v.cells} nodes` : v.errors[0]; msg.className = 'msg ' + (v.ok ? '' : 'bad');
    ed.onChange(ed.get(), v);
  };
  ta.addEventListener('input', refresh); name.addEventListener('input', refresh);
  ed.set(initial);
  return ed;
}
