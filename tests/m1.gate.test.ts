// Milestone 1 gate: a recipe exported as text and imported into a fresh
// world produces an identical object.
import { describe, expect, test } from 'vitest';
import { flatTerrain, formatRecipes, gridCost, parseGrid, parseRecipes, spawnGrid, validateGrid, World, type Recipe } from '../src/sim';
import { PRESETS } from '../src/game/presets';
import { run } from '../src/sim/scenarios';

function build(r: Recipe) {
  const w = new World(flatTerrain(600, 500));
  spawnGrid(w, r.grid, 300, 300, { angle: 0.3 });
  run(w, 2);
  return w;
}

describe('milestone 1 gate', () => {
  test('export then import reproduces every starter recipe exactly', () => {
    const text = formatRecipes(PRESETS);
    const back = parseRecipes(text);
    expect(back.length).toBe(PRESETS.length);
    let identical = 0;
    for (let i = 0; i < PRESETS.length; i++) {
      expect(back[i].name).toBe(PRESETS[i].name);
      expect(back[i].grid).toEqual(PRESETS[i].grid);
      const a = build(PRESETS[i]), b = build(back[i]);
      expect(b.stateHash()).toBe(a.stateHash());
      expect(b.liveNodes).toBe(a.liveNodes);
      identical++;
    }
    console.log(`GATE export/import: ${identical} of ${PRESETS.length} recipes rebuilt with identical state hashes after 2 s of simulation`);
  });

  test('note and parent survive the round trip', () => {
    const r: Recipe = { name: 'Deep pail', grid: parseGrid('W.W\nWWW'), note: 'for the moat', parent: 'Bucket' };
    expect(parseRecipes(formatRecipes([r]))[0]).toEqual(r);
  });

  test('messy pasted text is tolerated', () => {
    const [r] = parseRecipes('\n\n  w . w \n  www\n\n');
    expect(r.grid).toEqual(['W.W', 'WWW']);
    expect(gridCost(r.grid)).toEqual({ W: 5 });
  });

  test('validation catches what cannot be built', () => {
    expect(validateGrid(parseGrid('W~W')).errors.join()).toMatch(/water/);
    expect(validateGrid(parseGrid('WHW')).errors.join()).toMatch(/creature-only/);
    expect(validateGrid(parseGrid('WXW')).errors.join()).toMatch(/unknown glyph/);
    expect(validateGrid(parseGrid('W.W')).errors.join()).toMatch(/more than one piece/);
    expect(validateGrid(parseGrid('W'.repeat(17))).errors.join()).toMatch(/limit/);
  });
});
