import type { Recipe } from '../sim';
import { buildMessages, buildSystemPrompt, type PromptOptions } from './prompt';
import type { Proposal, Provider, SynthContext } from './types';
import { parseBlueprint, wantsPieces } from './validate';

/**
 * proposeBlueprint(context) -> Blueprint.
 * Builds the prompt, asks the provider, validates the grid, re-asks once
 * with the error, and caches by request text and draft.
 */
export class Synthesizer {
  private cache = new Map<string, Proposal>();
  options: PromptOptions;

  constructor(public provider: Provider, examples: Recipe[], literal: PromptOptions['literal'] = 'balanced') {
    this.options = { literal, examples };
  }

  get systemPrompt(): string { return buildSystemPrompt(this.options); }

  static cacheKey(ctx: SynthContext): string {
    return JSON.stringify([ctx.message.trim().toLowerCase(), ctx.draft?.grid ?? null, ctx.testReport ?? null]);
  }

  async proposeBlueprint(ctx: SynthContext): Promise<Proposal> {
    const key = `${this.provider.name}|${this.options.literal}|${Synthesizer.cacheKey(ctx)}`;
    const hit = this.cache.get(key);
    if (hit) return { ...hit, cached: true };

    const system = this.systemPrompt;
    const messages = buildMessages(ctx);
    const allowDisconnected = wantsPieces(ctx.message);
    let lastErrors: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      let raw: string;
      try {
        raw = await this.provider.complete(system, messages, ctx);
      } catch (e) {
        return { ok: false, error: (e as Error).message, attempts: attempt, cached: false, provider: this.provider.name };
      }
      const parsed = parseBlueprint(raw, { allowDisconnected });
      if (parsed.blueprint) {
        const out: Proposal = { ok: true, blueprint: parsed.blueprint, attempts: attempt, cached: false, provider: this.provider.name };
        this.cache.set(key, out);
        return out;
      }
      lastErrors = parsed.errors;
      messages.push({ role: 'assistant', content: raw });
      messages.push({ role: 'user', content: `That blueprint cannot be built: ${parsed.errors.join('; ')}. Send a corrected JSON blueprint.` });
    }
    return {
      ok: false,
      error: `The synthesizer could not produce a buildable grid (${lastErrors.join('; ')}). Try describing it another way.`,
      attempts: 2, cached: false, provider: this.provider.name,
    };
  }
}
