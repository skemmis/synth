import { buildPrompt } from './prompt.ts';
import { parseBlueprint } from './validate.ts';
import type { AskModel, Blueprint, Provider, SynthContext } from './types.ts';

/**
 * Wrap any text model as a Provider. Validates the grid; on failure re-asks once with the error (PRD),
 * then throws a plain message for the player.
 */
export function modelProvider(ask: AskModel): Provider {
  return async (ctx: SynthContext): Promise<Blueprint> => {
    const prompt = buildPrompt(ctx);
    const allowSinew = (ctx.inventory.N ?? 0) > 0;
    let p = parseBlueprint(await ask(prompt), { allowSinew });
    if (!p.ok) {
      const retry = `${prompt}\n\nYour previous answer was rejected by the game: ${p.errors.join(' ')}\nAnswer again with a corrected JSON object.`;
      p = parseBlueprint(await ask(retry), { allowSinew });
    }
    if (!p.ok || !p.blueprint) throw new Error(`The synthesizer could not draw that (${p.errors[0] ?? 'no grid'}). Try saying it another way.`);
    return p.blueprint;
  };
}
/** Cache by request text, draft and inventory-independent context. Groundwork for a shared recipe library. */
export function cached(inner: Provider, store: { get(k: string): string | null; set(k: string, v: string): void }): Provider & { hits: number; misses: number } {
  const fn = (async (ctx: SynthContext) => {
    const key = cacheKey(ctx); const hit = store.get(key);
    if (hit) { try { fn.hits++; return JSON.parse(hit) as Blueprint; } catch { /* fall through */ } }
    fn.misses++; const bp = await inner(ctx); store.set(key, JSON.stringify(bp)); return bp;
  }) as Provider & { hits: number; misses: number };
  fn.hits = 0; fn.misses = 0; return fn;
}
export const cacheKey = (ctx: SynthContext) => 'bp:' + [ctx.style ?? 'literal', ctx.message.trim().toLowerCase().replace(/\s+/g, ' '), ctx.draft ? ctx.draft.grid.join('/') : '-', ctx.report ? 'r' + hash(ctx.report) : ''].join('|');
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
