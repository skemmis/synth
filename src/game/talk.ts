import { benchReport } from '../sim/bench';
import { Mat, World, flatTerrain, gridCost, spawnGrid, validateGrid } from '../sim';
import { StubProvider, Synthesizer, type Blueprint, type Provider, type Turn } from '../synth';
import { h } from './dom';
import type { Game } from './game';
import { PRESETS } from './presets';
import { describeCost, type Player } from './state';
import { sfx } from './sound';
import { gridThumb, type Ui } from './ui';

const SETTINGS_KEY = 'synth.settings.v1';
interface Settings { apiKey: string; model: string; literal: 'literal' | 'balanced' | 'inventive' }

function loadSettings(): Settings {
  const base: Settings = { apiKey: '', model: 'claude-opus-5-5', literal: 'balanced' };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return base; }
}
// The key lives only in this browser's local settings. It is never put in saves or exports.
function saveSettings(s: Settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* no storage */ } }

const EXAMPLES = PRESETS.filter((p) => ['Pail with handle', 'Thorn club', 'Flail', 'Sticky foot'].includes(p.name));

/** The conversation with the synthesizer: describe a need, get a draft, refine it, build it. */
export interface BenchView { showWorld(title: string, info: string, world: World, focus: () => { x: number; y: number }, tick: () => boolean): () => void }

export function installTalk(game: Game, player: Player, ui: Ui, view?: BenchView) {
  const settings = loadSettings();
  const stub = new StubProvider();
  let synth = new Synthesizer(stub, EXAMPLES, settings.literal);
  let history: Turn[] = [];
  let draft: Blueprint | null = null;
  let report: string | undefined;
  let busy = false;

  const log = h('div.log');
  const input = h('textarea#say', { rows: 2, placeholder: 'Describe what you need…  e.g. "I need a bucket to move this water"', spellcheck: 'true' }) as HTMLTextAreaElement;
  const send = h('button.primary', {}, 'Ask') as HTMLButtonElement;
  const status = h('div.stat');
  const draftBox = h('div.draft', { hidden: true });

  const say = (who: 'you' | 'synth' | 'note', ...kids: (Node | string)[]) => {
    const el = h(`div.bubble.${who}`, {}, ...kids);
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  async function makeProvider(): Promise<Provider> {
    if (!settings.apiKey.trim()) return stub;
    const { AnthropicProvider } = await import('../synth/anthropic');
    return new AnthropicProvider(settings.apiKey.trim(), settings.model.trim() || undefined);
  }
  async function refreshProvider() {
    synth = new Synthesizer(await makeProvider(), EXAMPLES, settings.literal);
    status.textContent = settings.apiKey.trim()
      ? `Using ${settings.model} with your key.`
      : 'Offline synthesizer: knows a few shapes and simple changes. Add an API key in Settings for free-form requests.';
  }

  const drawDraft = () => {
    if (!draft) { draftBox.hidden = true; return; }
    const miss = player.missing(draft.grid);
    const missing = Object.keys(miss).length > 0;
    draftBox.hidden = false;
    draftBox.replaceChildren(
      h('div.drafthead', {}, h('b', {}, draft.name), h('span.stat', {}, `${draft.grid[0].length}×${draft.grid.length}`)),
      h('div.ghost', {}, gridThumb(draft.grid, Math.max(5, Math.min(12, Math.floor(200 / Math.max(draft.grid[0].length, draft.grid.length)))))),
      h('div.msg', {}, `Costs ${describeCost(gridCost(draft.grid))}.`, missing ? h('span.bad', {}, ` Missing ${describeCost(miss)}: go and gather it.`) : ''),
      h('div.row', {},
        h('button.primary', { onclick: () => {
          if (!draft) return;
          const kept = player.keep({ name: draft.name, grid: draft.grid, note: draft.note });
          (kept as any).talk = history.filter((t) => t.role === 'player').map((t) => t.text);
          player.saveBook();
          game.hold(draft.grid);
          ui.toast(missing ? 'Not enough materials yet: the ghost shows where it would go' : 'Click in the world to place it');
        } }, 'Synthesize'),
        h('button', { title: 'Try it in a sandbox before spending materials', onclick: runBench }, 'Test'),
        h('button', { title: 'Open the letters in the grid editor', onclick: () => draft && ui.setDraft({ name: draft.name, grid: draft.grid, note: draft.note }) }, 'Edit grid'),
        h('button', { onclick: () => { draft = null; report = undefined; history = []; log.replaceChildren(); drawDraft(); } }, 'Start over'),
      ),
    );
  };

  function runBench() {
    if (!draft) return;
    const el = say('note', 'Testing in the sandbox…');
    // a live look at the same kind of test: drop it, then pour water on it
    if (view) {
      const w = new World(flatTerrain(900, 600), undefined, 256, 1024);
      const sp = spawnGrid(w, draft.grid, 450, 600 - draft.grid.length * 6 - 40);
      let steps = 0;
      view.showWorld(`Test bench: ${draft.name}`, 'dropped on flat ground, then 40 water particles poured on it', w,
        () => { let x = 0, n = 0; for (const i of sp.nodes) if (w.alive[i]) { x += w.x[i]; n++; } return { x: n ? x / n : 450, y: 600 }; },
        () => {
          for (let k = 0; k < 2; k++) {
            w.step(); steps++;
            if (steps > 100 && steps <= 180 && steps % 2 === 0) {
              let top = 600, cx = 0, n = 0;
              for (const i of sp.nodes) if (w.alive[i]) { top = Math.min(top, w.y[i]); cx += w.x[i]; n++; }
              w.addNode(Mat.Water, (n ? cx / n : 450) + ((steps * 7) % 21) - 10, top - 60);
            }
          }
          return steps < 600;
        });
    }
    setTimeout(() => {
      if (!draft) return;
      try { report = benchReport(draft.grid); } catch (e) { report = `The test could not run: ${(e as Error).message}`; }
      el.replaceChildren(h('b', {}, 'Test bench'), h('pre', {}, report));
      el.append(h('div.stat', {}, 'This report goes to the synthesizer with your next message.'));
      log.scrollTop = log.scrollHeight;
    }, 30);
  }

  async function ask() {
    const message = input.value.trim();
    if (!message || busy) return;
    busy = true; send.disabled = true;
    input.value = '';
    say('you', message);
    sfx('ask');
    const thinking = say('synth', 'Thinking…');
    let p = await synth.proposeBlueprint({ message, history, draft, inventory: { ...player.inventory }, testReport: report });
    if (!p.ok && synth.provider !== stub && /reach|key was rejected/i.test(p.error ?? '')) {
      // the page may not be allowed to call out (for example inside a sandboxed preview)
      say('note', `${p.error} Falling back to the offline synthesizer.`);
      synth = new Synthesizer(stub, EXAMPLES, settings.literal);
      p = await synth.proposeBlueprint({ message, history, draft, inventory: { ...player.inventory }, testReport: report });
    }
    history.push({ role: 'player', text: message });
    if (p.ok && p.blueprint) {
      draft = p.blueprint;
      report = undefined;
      history.push({ role: 'synth', text: draft.note, blueprint: draft });
      thinking.replaceChildren(
        h('b', {}, draft.name), ' ', h('span.stat', {}, p.cached ? 'from cache' : p.attempts > 1 ? 'second try' : ''),
        h('div', {}, draft.note),
        draft.question ? h('div.q', {}, draft.question) : '',
      );
    } else {
      thinking.className = 'bubble note';
      thinking.textContent = p.error ?? 'Something went wrong.';
    }
    drawDraft();
    sfx('answer');
    busy = false; send.disabled = false;
    log.scrollTop = log.scrollHeight;
  }
  send.addEventListener('click', ask);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });

  // settings
  const keyIn = h('input#apikey', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off' }) as HTMLInputElement;
  keyIn.value = settings.apiKey;
  const modelIn = h('input#model', { type: 'text', spellcheck: 'false' }) as HTMLInputElement;
  modelIn.value = settings.model;
  const lit = h('select#literal', {},
    h('option', { value: 'literal' }, 'Literal: build exactly what I say'),
    h('option', { value: 'balanced' }, 'Balanced'),
    h('option', { value: 'inventive' }, 'Inventive: surprise me')) as HTMLSelectElement;
  lit.value = settings.literal;
  const apply = () => {
    settings.apiKey = keyIn.value; settings.model = modelIn.value || 'claude-opus-5-5'; settings.literal = lit.value as Settings['literal'];
    saveSettings(settings);
    refreshProvider();
  };
  for (const el of [keyIn, modelIn, lit]) el.addEventListener('change', apply);
  const settingsBox = h('details', {}, h('summary', {}, 'Settings'),
    h('div.form', {},
      h('label', { for: 'apikey' }, 'Anthropic API key (stays in this browser)'), keyIn,
      h('label', { for: 'model' }, 'Model'), modelIn,
      h('label', { for: 'literal' }, 'How literal should it be?'), lit));

  const body = h('div.tabbody', {},
    log,
    draftBox,
    h('div.sayrow', {}, input, send),
    status,
    settingsBox,
  );
  ui.addTab('talk', 'Talk', body, true);
  ui.showTab('talk');
  say('synth', 'Tell me what you need and I will draw up a blueprint from the materials that exist here. The world decides whether it works.');
  say('note', h('b', {}, 'First steps'), h('div', {}, '1. Hold the mouse on the tree, rocks, vines or bramble to gather.'),
    h('div', {}, '2. Ask for something: a wall, a cage, a spike strip, a bucket.'),
    h('div', {}, '3. Press Synthesize, then click in the world to place it.'),
    h('div', {}, '4. Your berries are at the flag. Press End day when the base is ready: the burrow to the right dreams up bodies to get at them, then sends the best three.'));
  refreshProvider();
  let last = '';
  game.onFrame.push(() => {
    const key = JSON.stringify(player.inventory) + player.freeBuild;
    if (key !== last) { last = key; drawDraft(); }
  });
  void validateGrid;
  return { ask: (text: string) => { input.value = text; return ask(); }, get draft() { return draft; }, runBench };
}
