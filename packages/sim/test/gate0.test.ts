import { describe, it, expect } from 'vitest';
import { bucketCarry, ropeSwing, clubHit, pitchStick, stripWorld, run } from '../src/scenarios.ts';
import { RECIPES } from '../src/recipes.ts';
import { World } from '../src/world.ts';
import { spawnRecipe, parseRecipe, recipeToText, validateRecipe } from '../src/grid.ts';

describe('milestone 0 gate', () => {
  it('a wood bucket carried from pond to ditch keeps at least 70% of its water', () => {
    const r = bucketCarry();
    expect(r.scooped).toBeGreaterThanOrEqual(15);
    expect(r.kept).toBeGreaterThanOrEqual(0.7);
    expect(r.inDitch).toBeGreaterThanOrEqual(r.scooped * 0.6); // and it can be poured out
  }, 60000);
  it('a fiber chain hangs and swings as rope', () => {
    const r = ropeSwing();
    expect(r.intact).toBe(11);
    expect(r.crossings).toBeGreaterThanOrEqual(2); // swings through the vertical more than once
    expect(r.swingLeft).toBeLessThan(-r.len * 0.4);
    expect(r.maxLen).toBeLessThan(r.len * 1.08); // does not stretch like rubber
    expect(r.hangDy).toBeGreaterThan(r.len * 0.95); // ends up hanging straight down
    expect(r.hangDx).toBeLessThan(r.len * 0.2);
  });
  it('a thorn club damages a dummy and a wood club does not', () => {
    expect(clubHit(RECIPES.thornClub).damage).toBeGreaterThan(20);
    expect(clubHit(RECIPES.woodClub).damage).toBe(0);
  });
  it('pitch sticks a block to the ground', () => {
    const stuck = pitchStick(RECIPES.pitchBlock), loose = pitchStick(RECIPES.woodBlock);
    expect(stuck.anchors).toBeGreaterThan(0);
    expect(stuck.moved).toBeLessThan(4);
    expect(loose.moved).toBeGreaterThan(40);
  });
});

describe('determinism', () => {
  it('the same inputs give the same state hash', () => {
    const go = () => { const w = stripWorld(); spawnRecipe(w, RECIPES.bucket, 450, 480); spawnRecipe(w, RECIPES.thornClub, 900, 400); spawnRecipe(w, RECIPES.pitchBlock, 1000, 300); run(w, 4); return w.hash(); };
    expect(go()).toBe(go());
  }, 30000);
  it('a cloned world stays in step with the original', () => {
    const w = stripWorld(); spawnRecipe(w, RECIPES.bucket, 450, 480); run(w, 1);
    const c = w.clone(); run(w, 2); run(c, 2);
    expect(c.hash()).toBe(w.hash());
  }, 30000);
  it('a world saved to JSON and loaded again carries on exactly as the renumbered original would', () => {
    const w = stripWorld(); spawnRecipe(w, RECIPES.bucket, 450, 480); spawnRecipe(w, RECIPES.wall, 3000, 520); run(w, 1);
    w.removeNode(w.nearestNode(3000, 520, 60)); run(w, 0.5);
    const text = JSON.stringify(w.save()); const back = World.load(w.terrain, JSON.parse(text));
    const twin = w.clone(); twin.compact(); run(twin, 2); run(back, 2);
    expect(back.hash()).toBe(twin.hash()); expect(text.length).toBeLessThan(1_000_000);
  }, 30000);
});

describe('recipes', () => {
  it('round-trips through text', () => {
    const t = recipeToText(RECIPES.bucket); const r = parseRecipe(t);
    expect(r.grid).toEqual(RECIPES.bucket.grid); expect(r.name).toBe('bucket');
  });
  it('validates glyphs, size and connectivity', () => {
    expect(validateRecipe(RECIPES.bucket).ok).toBe(true);
    expect(validateRecipe(parseRecipe('W.W')).ok).toBe(false);
    expect(validateRecipe(parseRecipe('WXW')).ok).toBe(false);
    expect(validateRecipe(parseRecipe('WHW')).ok).toBe(false);
    expect(validateRecipe(parseRecipe('W~W')).ok).toBe(false);
    expect(validateRecipe(RECIPES.bucket).cost).toEqual({ W: 18 });
  });
});
