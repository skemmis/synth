import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { SCRIPTED, judge } from '../src/purpose.ts';
import { stubProvider } from '../src/stub.ts';
import { parseBlueprint } from '../src/validate.ts';
import { buildPrompt } from '../src/prompt.ts';
import { modelProvider } from '../src/provider.ts';

async function score(get: (key: string, request: string) => Promise<unknown>) {
  let valid = 0, pass = 0;
  for (const s of SCRIPTED) { const p = parseBlueprint(await get(s.key, s.request)); if (!p.ok) continue; valid++; if (judge(s.key, p.recipe!).pass) pass++; }
  return { valid, pass };
}
describe('milestone 2 gate: ten scripted requests', () => {
  it('offline helper: at least 9 valid grids and at least 6 pass their physical test', async () => {
    const r = await score((_k, request) => stubProvider({ message: request, history: [], draft: null, inventory: {} }));
    expect(r.valid).toBeGreaterThanOrEqual(9); expect(r.pass).toBeGreaterThanOrEqual(6);
  }, 120000);
  it('recorded live model answers: at least 9 valid grids and at least 6 pass', async () => {
    const fx = JSON.parse(fs.readFileSync(new URL('../fixtures/live-sonnet-2026-11-14.json', import.meta.url), 'utf8'));
    const r = await score(async (k) => fx[k]);
    expect(r.valid).toBeGreaterThanOrEqual(9); expect(r.pass).toBeGreaterThanOrEqual(6);
  }, 120000);
});
describe('synthesizer plumbing', () => {
  it('the prompt carries the materials table, the draft and the bench report', () => {
    const p = buildPrompt({ message: 'make it float', history: [{ role: 'player', text: 'a box' }], draft: { name: 'box', grid: ['SS', 'SS'] }, inventory: { W: 3 }, report: 'In deep water it sinks.' });
    expect(p).toContain('W = wood'); expect(p).toContain('SS\nSS'); expect(p).toContain('In deep water it sinks.'); expect(p).not.toContain('N = sinew');
  });
  it('rejects bad grids, re-asks once, then gives a plain error', async () => {
    let calls = 0; const bad = modelProvider(async () => { calls++; return '{"name":"x","grid":["W.W"],"note":"two pieces"}'; });
    await expect(bad({ message: 'x', history: [], draft: null, inventory: {} })).rejects.toThrow(/could not draw/); expect(calls).toBe(2);
    let n = 0; const fixes = modelProvider(async (prompt) => (n++ === 0 ? 'no json here' : (expect(prompt).toContain('rejected'), '```json\n{"name":"ok","grid":["WWW"],"note":"fine"}\n```')));
    expect((await fixes({ message: 'x', history: [], draft: null, inventory: {} })).grid).toEqual(['WWW']);
  });
  it('refuses hearts, water and unknown letters', () => {
    for (const g of [['WHW'], ['W~W'], ['WXW']]) expect(parseBlueprint({ name: 'x', grid: g, note: '' }).ok).toBe(false);
  });
});
