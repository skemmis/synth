export interface Blueprint {
  name: string;
  grid: string[];
  /** one or two sentences on how it is meant to work */
  note: string;
  /** set when the request was ambiguous */
  question?: string;
}

export interface Turn {
  role: 'player' | 'synth';
  text: string;
  blueprint?: Blueprint;
}

export interface SynthContext {
  message: string;
  history: Turn[];
  draft?: Blueprint | null;
  inventory: Record<string, number>;
  /** plain-text report from a test-bench run of the last draft */
  testReport?: string;
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

/** A provider turns a prepared prompt into raw model text (expected to be JSON). */
export interface Provider {
  readonly name: string;
  complete(system: string, messages: ChatMessage[], ctx: SynthContext): Promise<string>;
}

export interface Proposal {
  ok: boolean;
  blueprint?: Blueprint;
  /** plain message for the player when ok is false */
  error?: string;
  attempts: number;
  cached: boolean;
  provider: string;
}
