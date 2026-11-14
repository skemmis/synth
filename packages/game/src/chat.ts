// The synthesizer conversation panel: talk, see a draft, test it, synthesize it.
import { MATERIALS, GLYPH, bench, validateRecipe, type Recipe } from '../../sim/src/index.ts';
import { cacheKey, modelProvider, stubProvider, type Blueprint, type Provider, type SynthContext, type Turn } from '../../synth/src/index.ts';
import { el } from './app.ts';
import { costChips } from './panel.ts';
import type { Inventory } from './gather.ts';

export const CHAT_CSS = `
.chat{display:flex;flex-direction:column;gap:8px;min-height:0}
.log{display:flex;flex-direction:column;gap:6px;max-height:30vh;overflow-y:auto;padding-right:2px}
.say{padding:6px 10px;border-radius:12px;font-size:13px;max-width:92%;white-space:pre-wrap;overflow-wrap:anywhere}
.say.player{align-self:flex-end;background:#40506a}
.say.synth{align-self:flex-start;background:var(--panel2);border:1px solid var(--line)}
.say.bench{align-self:stretch;max-width:none;background:#23302a;border:1px dashed #4d6a57;color:#cfe6d5;font-size:12.5px}
.say.err{align-self:stretch;max-width:none;background:#3a2626;color:#ffc9c7}
.say small{display:block;color:var(--muted);font-size:11px;margin-top:2px}
.draft{border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px;background:#22262d}
.draft h3{margin:0;font-family:var(--display);font-size:15px}
.mini{display:grid;gap:1px;justify-content:start;overflow-x:auto}
.mini i{width:15px;height:15px;border-radius:50%;display:block;font:700 9px/15px var(--mono);text-align:center;color:#0009;font-style:normal}
.ask{display:flex;gap:6px}.ask textarea{letter-spacing:0;font-family:var(--body);resize:none}
.sugg{display:flex;flex-wrap:wrap;gap:5px}.sugg button{font-weight:400;font-size:12px;padding:3px 8px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}.seg button{border:0;border-radius:0;background:transparent;font-weight:700;font-size:12px}.seg button[aria-pressed=true]{background:var(--accent);color:#2a2000}
`;
export function miniGrid(grid: string[]): HTMLElement {
  const w = Math.max(1, ...grid.map((r) => r.length)); const m = el('div', 'mini'); m.style.gridTemplateColumns = `repeat(${w}, 15px)`;
  for (const r of grid) for (let c = 0; c < w; c++) { const ch = r[c] ?? '.'; const d = el('i'); if (ch !== '.') { const mat = MATERIALS[GLYPH[ch]]; if (mat) { d.style.background = mat.color; d.textContent = ch; } } m.append(d); }
  return m;
}
export interface Library { [request: string]: Blueprint; }
export interface ChatOpts {
  inv: () => Inventory;
  onSynthesize: (r: Recipe) => void;
  onSave: (r: Recipe, talk: Turn[]) => void;
  onEdit?: (r: Recipe) => void;
  library?: Library;
  suggestions?: string[];
}
const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

export class SynthPanel {
  root = el('div', 'chat'); log = el('div', 'log'); draftEl = el('div'); input = el('textarea'); send = el('button', 'primary', 'Send');
  turns: Turn[] = []; draft: Recipe | null = null; report: string | undefined; busy = false;
  mode: 'offline' | 'claude' = 'offline'; style: 'literal' | 'inventive' = 'literal';
  live: Provider | null = null; calls = 0; libraryHits = 0; cacheHits = 0;
  private modeSeg = el('div', 'seg'); private styleSeg = el('div', 'seg'); private status = el('p');
  constructor(public opts: ChatOpts) {
    this.input.id = 'synth-input'; this.input.rows = 2; this.input.placeholder = 'Describe what you need…'; this.input.setAttribute('aria-label', 'Message to the synthesizer');
    const ask = el('div', 'ask'); ask.append(this.input, this.send);
    const sugg = el('div', 'sugg'); for (const s of opts.suggestions ?? []) { const b = el('button', '', s); b.onclick = () => { this.input.value = s; this.submit(); }; sugg.append(b); }
    const top = el('div', 'row'); top.style.alignItems = 'center';
    const mk = (seg: HTMLElement, items: [string, string][], get: () => string, set: (v: string) => void) => { for (const [v, label] of items) { const b = el('button', '', label); b.dataset.v = v; b.onclick = () => { if (!b.disabled) { set(v); paint(); } }; seg.append(b); } const paint = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === get()))); paint(); return paint; };
    this.paintMode = mk(this.modeSeg, [['offline', 'Offline helper'], ['claude', 'Claude']], () => this.mode, (v) => { this.mode = v as any; this.describeMode(); });
    mk(this.styleSeg, [['literal', 'Literal'], ['inventive', 'Inventive']], () => this.style, (v) => { this.style = v as any; });
    top.append(this.modeSeg, this.styleSeg);
    this.status.style.fontSize = '12px';
    this.root.append(top, this.status, this.log, sugg, ask, this.draftEl);
    this.send.onclick = () => this.submit();
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.submit(); } });
    (this.modeSeg.children[1] as HTMLButtonElement).disabled = true; this.describeMode();
    this.connect();
    this.renderDraft();
  }
  private paintMode: () => void = () => {};
  /** Claude is reachable only when the page is opened on claude.ai; the page asks on the viewer's own account. */
  private async connect() {
    try {
      const sample = await (window as any).claude?.use?.('sample'); if (!sample) { this.describeMode(); return; }
      this.live = modelProvider(async (prompt) => (await sample(prompt, { modelTier: 'default' })).text);
      (this.modeSeg.children[1] as HTMLButtonElement).disabled = false; this.mode = 'claude'; this.paintMode(); this.describeMode();
    } catch { this.describeMode(); }
  }
  private describeMode() {
    this.status.textContent = this.mode === 'claude' ? 'Claude draws the blueprints. Common requests come from a saved library first, so most turns cost nothing.'
      : this.live ? 'Offline helper: keyword rules and a few stock shapes. No model is called.' : 'Offline helper: keyword rules and a few stock shapes. Open this page on claude.ai to talk to Claude instead.';
  }
  add(kind: string, text: string, small = '') { const d = el('div', 'say ' + kind, text); if (small) d.append(el('small', '', small)); this.log.append(d); this.log.scrollTop = this.log.scrollHeight; return d; }
  setDraft(r: Recipe | null) { this.draft = r; this.report = undefined; this.renderDraft(); }
  renderDraft() {
    const d = this.draftEl; d.replaceChildren(); if (!this.draft) return;
    const r = this.draft, v = validateRecipe(r, { allowCreature: false }), inv = this.opts.inv();
    const card = el('div', 'draft'); const top = el('div', 'row'); top.style.alignItems = 'flex-start'; top.style.gap = '12px'; const info = el('div'); info.style.cssText = 'display:grid;gap:6px;flex:1;min-width:120px'; info.append(el('h3', '', 'Draft: ' + r.name), costChips(v.cost, inv)); top.append(miniGrid(r.grid), info); card.append(top);
    const btns = el('div', 'row');
    const make = el('button', 'primary', 'Synthesize'); const lack = Object.entries(v.cost).some(([g, n]) => (inv[g] ?? 0) < n); make.disabled = !v.ok || lack; make.onclick = () => this.opts.onSynthesize(r);
    const test = el('button', '', 'Test it'); test.disabled = !v.ok; test.onclick = () => this.test();
    const save = el('button', '', 'Save'); save.disabled = !v.ok; save.onclick = () => { this.opts.onSave(r, this.turns.slice()); this.add('synth', `Saved "${r.name}" to the recipe book.`); };
    btns.append(make, test, save);
    if (this.opts.onEdit) { const e = el('button', '', 'Edit letters'); e.onclick = () => this.opts.onEdit!(r); btns.append(e); }
    card.append(btns); if (!v.ok) card.append(el('div', 'msg bad', v.errors[0])); else if (lack) card.append(el('div', 'msg', 'Gather what is marked in red, then synthesize.'));
    d.append(card);
  }
  test() {
    if (!this.draft) return; const r = this.draft; const m = this.add('bench', 'Test bench: running…');
    setTimeout(() => { const b = bench(r); this.report = b.text; m.textContent = 'Test bench: ' + b.text; m.append(el('small', '', 'The synthesizer will see this report on your next message.')); this.log.scrollTop = this.log.scrollHeight; }, 30);
  }
  async submit() {
    const text = this.input.value.trim(); if (!text || this.busy) return;
    this.input.value = ''; this.add('player', text); this.busy = true; this.send.disabled = true;
    const ctx: SynthContext = { message: text, history: this.turns.slice(), draft: this.draft, inventory: this.opts.inv(), report: this.report, style: this.style };
    const wait = this.add('synth', this.mode === 'claude' ? 'Thinking…' : '…');
    try {
      let bp: Blueprint, from = '';
      const lib = !this.draft && this.mode === 'claude' && this.style === 'literal' ? this.opts.library?.[norm(text)] : undefined;
      if (lib) { bp = lib; from = 'From the saved library. No model call.'; this.libraryHits++; }
      else if (this.mode === 'claude' && this.live) {
        const key = 'synth-cache:' + cacheKey(ctx); let hit: string | null = null; try { hit = localStorage.getItem(key); } catch { /* no storage */ }
        if (hit) { bp = JSON.parse(hit); from = 'From your cache. No model call.'; this.cacheHits++; }
        else { bp = await this.live(ctx); this.calls++; from = `Claude drew this (model call ${this.calls} this session).`; try { localStorage.setItem(key, JSON.stringify(bp)); } catch { /* fine */ } }
      } else { bp = await stubProvider(ctx); from = 'Offline helper.'; }
      wait.remove();
      this.turns.push({ role: 'player', text }, { role: 'synth', text: bp.note + (bp.question ? ' ' + bp.question : '') });
      this.add('synth', bp.note + (bp.question ? '\n' + bp.question : ''), from);
      this.setDraft({ name: bp.name, grid: bp.grid, note: bp.note, parent: this.draft?.name });
    } catch (e: any) {
      wait.remove();
      const code = e?.code; const msg = code === 'not_granted' ? 'Claude was not allowed for this page, so I switched to the offline helper.' : code === 'rate_limited' ? 'Claude is busy. Wait a moment and send again.' : (e?.message || 'Something went wrong.');
      if (code === 'not_granted') { this.mode = 'offline'; this.paintMode(); this.describeMode(); }
      this.add('err', msg);
    } finally { this.busy = false; this.send.disabled = false; }
  }
}
