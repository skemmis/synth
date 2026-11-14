import { parseGrid, validateGrid } from '../sim';
import type { Blueprint } from './types';

export interface Parsed { blueprint?: Blueprint; errors: string[] }

/** Pull a blueprint out of model text and check it against the grid rules. */
export function parseBlueprint(raw: string, opts: { allowDisconnected?: boolean } = {}): Parsed {
  let obj: any;
  try {
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('no JSON object found');
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    return { errors: [`the reply was not valid JSON (${(e as Error).message})`] };
  }
  const errors: string[] = [];
  if (typeof obj.name !== 'string' || !obj.name.trim()) errors.push('"name" is missing');
  if (!Array.isArray(obj.grid) || obj.grid.some((r: unknown) => typeof r !== 'string')) {
    return { errors: [...errors, '"grid" must be an array of strings'] };
  }
  const rawRows: string[] = obj.grid;
  const widths = new Set(rawRows.map((r) => r.length));
  const grid = parseGrid(rawRows.map((r) => r.replace(/ /g, '.')));
  const check = validateGrid(grid, { allowDisconnected: opts.allowDisconnected });
  errors.push(...check.errors);
  if (widths.size > 1 && check.ok) {
    // tolerated (rows are padded), but worth telling the model on a retry
  }
  if (errors.length) return { errors };
  const question = typeof obj.question === 'string' && obj.question.trim() ? obj.question.trim() : undefined;
  return {
    errors: [],
    blueprint: { name: obj.name.trim().slice(0, 40), grid, note: typeof obj.note === 'string' ? obj.note.trim() : '', question },
  };
}

/** did the player ask for something in several pieces? */
export function wantsPieces(message: string): boolean {
  return /\b(separate|pieces|two parts|pair of|set of|loose)\b/i.test(message);
}
