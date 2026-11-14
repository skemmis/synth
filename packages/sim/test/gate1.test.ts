import { describe, it, expect } from 'vitest';
import { flatWorld, run } from '../src/scenarios.ts';
import { RECIPES } from '../src/recipes.ts';
import { spawnRecipe, parseRecipe, recipeToText } from '../src/grid.ts';

describe('milestone 1 gate', () => {
  it('a recipe exported as text and imported into a fresh world produces an identical object', () => {
    for (const key of Object.keys(RECIPES)) {
      const a = flatWorld(), b = flatWorld();
      spawnRecipe(a, RECIPES[key], 800, 400);
      spawnRecipe(b, parseRecipe(recipeToText(RECIPES[key])), 800, 400);
      expect(b.n).toBe(a.n); expect(b.nb).toBe(a.nb);
      run(a, 1.5); run(b, 1.5);
      expect(b.hash(), key).toBe(a.hash());
    }
  });
});
