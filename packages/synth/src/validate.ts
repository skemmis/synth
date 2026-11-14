import { validateRecipe, type Recipe } from '../../sim/src/grid.ts';
import type { Blueprint } from './types.ts';

export interface Parsed { ok: boolean; blueprint?: Blueprint; recipe?: Recipe; errors: string[]; }
/** Pull the JSON object out of a model reply and check the grid against the game's rules. */
export function parseBlueprint(text: string | unknown, opts: { allowSinew?: boolean } = {}): Parsed {
  let obj: any = text;
  if (typeof text === 'string') {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return { ok: false, errors: ['The reply was not a JSON object.'] };
    try { obj = JSON.parse(text.slice(a, b + 1)); } catch { return { ok: false, errors: ['The reply was not valid JSON.'] }; }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['The reply was not a JSON object.'] };
  let grid: unknown = obj.grid;
  if (typeof grid === 'string') grid = grid.split('\n');
  if (!Array.isArray(grid) || !grid.every((r) => typeof r === 'string')) return { ok: false, errors: ['"grid" must be a list of text rows.'] };
  let rows = (grid as string[]).map((r) => r.replace(/ /g, '.').toUpperCase().replace(/\s+$/, ''));
  while (rows.length && /^\.*$/.test(rows[0])) rows.shift();
  while (rows.length && /^\.*$/.test(rows[rows.length - 1])) rows.pop();
  const w = Math.max(0, ...rows.map((r) => r.length)); rows = rows.map((r) => r.padEnd(w, '.'));
  // trim empty columns
  while (rows.length && rows[0].length && rows.every((r) => r[0] === '.')) rows = rows.map((r) => r.slice(1));
  while (rows.length && rows[0].length && rows.every((r) => r[r.length - 1] === '.')) rows = rows.map((r) => r.slice(0, -1));
  const recipe: Recipe = { name: String(obj.name ?? 'thing').slice(0, 40) || 'thing', grid: rows, note: typeof obj.note === 'string' ? obj.note : '' };
  const v = validateRecipe(recipe);
  const errors = [...v.errors];
  if (!opts.allowSinew && rows.some((r) => r.includes('N'))) errors.push('Sinew is not available yet.');
  const blueprint: Blueprint = { name: recipe.name, grid: rows, note: recipe.note ?? '', question: typeof obj.question === 'string' && obj.question.trim() ? obj.question : undefined };
  return { ok: errors.length === 0, blueprint, recipe, errors };
}
