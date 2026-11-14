import Anthropic from '@anthropic-ai/sdk';
import { BLUEPRINT_SCHEMA } from './prompt';
import type { ChatMessage, Provider } from './types';

export const DEFAULT_MODEL = 'claude-opus-5-5';

/**
 * Calls the Anthropic API with the player's own key. The key is handed in by
 * the caller (local settings or an environment variable); this module never
 * stores, logs or exports it.
 */
export class AnthropicProvider implements Provider {
  readonly name: string;
  private client: Anthropic;

  constructor(apiKey: string, private model = DEFAULT_MODEL, private effort: 'low' | 'medium' | 'high' = 'medium') {
    this.name = `anthropic:${model}`;
    // The game is a local desktop app and the key belongs to the person
    // playing, so calling from the page is the intended setup.
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async complete(system: string, messages: ChatMessage[]): Promise<string> {
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // the system prompt is identical on every turn, so cache it
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
        output_config: { effort: this.effort, format: { type: 'json_schema', schema: BLUEPRINT_SCHEMA } },
        // if a safety classifier declines, let the API retry on its default fallback model
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      if (response.stop_reason === 'refusal') throw new Error('The model declined that request.');
      if (response.stop_reason === 'max_tokens') throw new Error('The model ran out of room before finishing the blueprint.');
      let text = '';
      for (const block of response.content) if (block.type === 'text') text += block.text;
      return text;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new Error('The API key was rejected. Check it in Settings.');
      if (error instanceof Anthropic.PermissionDeniedError) throw new Error('This API key is not allowed to use that model.');
      if (error instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the API. Wait a moment and try again.');
      if (error instanceof Anthropic.BadRequestError) throw new Error(`The API rejected the request: ${error.message}`);
      if (error instanceof Anthropic.APIConnectionError) throw new Error('Could not reach the Anthropic API from here.');
      if (error instanceof Anthropic.APIError) throw new Error(`API error ${error.status}: ${error.message}`);
      throw error;
    }
  }
}
