// Milestone 2 gate. Ten scripted requests go through the synthesizer; at
// least 9 must come back as valid grids and at least 6 must pass a headless
// physical test of their purpose with no hand fixes.
//
// Three sources of answers:
//   offline  - the stub provider (always run; checks the pipeline and the tests)
//   recorded - tests/fixtures/m2-responses.json, raw model replies to the generated prompt
//   live     - the Anthropic API, when ANTHROPIC_API_KEY is set (SYNTH_LIVE=1 npm test)
import { existsSync, readFileSync } from 'fs';
import { describe, expect, test } from 'vitest';
import { PURPOSE_TESTS, benchReport } from '../src/sim/bench';
import { BUCKET } from '../src/sim/scenarios';
import { PRESETS } from '../src/game/presets';
import { StubProvider, Synthesizer, type Provider, type SynthContext } from '../src/synth';

export const REQUESTS: { purpose: string; message: string; draft?: boolean }[] = [
  { purpose: 'bucket', message: 'I need a bucket to move water from the pond.' },
  { purpose: 'rope', message: 'I need a rope, long enough to tie things together.' },
  { purpose: 'wall', message: 'I need a wall to keep things out of my base. It should not fall over when something hits it.' },
  { purpose: 'spike strip', message: 'I need a spike strip to lay on the ground that hurts anything walking over it.' },
  { purpose: 'cage', message: 'I need a cage I can put over my berries so nothing can reach in and take them.' },
  { purpose: 'raft', message: 'I need a raft that can carry a couple of stones across the pond.' },
  { purpose: 'ramp', message: 'I need a ramp that things will roll down.' },
  { purpose: 'hammer', message: 'I need a hammer I can swing to crush things.' },
  { purpose: 'net', message: 'I need a net I can string between two posts to catch falling rocks.' },
  { purpose: 'lid', message: 'I need a lid for this bucket.', draft: true },
];

const INVENTORY = { W: 60, S: 30, F: 40, T: 20, P: 10, N: 0, B: 4 };
export const EXAMPLES = PRESETS.filter((p) => ['Pail with handle', 'Thorn club', 'Flail', 'Sticky foot'].includes(p.name));

function context(r: (typeof REQUESTS)[number]): SynthContext {
  return {
    message: r.message, history: [], inventory: INVENTORY,
    draft: r.draft ? { name: 'Bucket', grid: BUCKET, note: '' } : null,
  };
}

async function runGate(label: string, provider: Provider) {
  const synth = new Synthesizer(provider, EXAMPLES);
  let valid = 0, passed = 0;
  const lines: string[] = [];
  for (const r of REQUESTS) {
    const p = await synth.proposeBlueprint(context(r));
    if (!p.ok || !p.blueprint) { lines.push(`  ${r.purpose.padEnd(12)} INVALID  ${p.error}`); continue; }
    valid++;
    const res = PURPOSE_TESTS[r.purpose](p.blueprint.grid);
    if (res.pass) passed++;
    lines.push(`  ${r.purpose.padEnd(12)} ${res.pass ? 'pass' : 'FAIL'}  ${res.report}${p.attempts > 1 ? ' (needed a re-ask)' : ''}`);
  }
  console.log(`GATE synthesizer [${label}]: ${valid}/10 valid grids, ${passed}/10 pass their physical test\n${lines.join('\n')}`);
  return { valid, passed };
}

describe('milestone 2 gate', () => {
  test('offline synthesizer', async () => {
    const r = await runGate('offline stub', new StubProvider());
    expect(r.valid).toBeGreaterThanOrEqual(9);
    expect(r.passed).toBeGreaterThanOrEqual(6);
  });

  const fixture = 'tests/fixtures/m2-responses.json';
  test.skipIf(!existsSync(fixture))('recorded model replies to the generated prompt', async () => {
    const replies: Record<string, string> = JSON.parse(readFileSync(fixture, 'utf8'));
    const provider: Provider = {
      name: 'recorded',
      complete: async (_s, _m, ctx) => replies[REQUESTS.find((q) => q.message === ctx.message)!.purpose] ?? '',
    };
    const r = await runGate('recorded model replies', provider);
    expect(r.valid).toBeGreaterThanOrEqual(9);
    expect(r.passed).toBeGreaterThanOrEqual(6);
  });

  test.skipIf(!process.env.SYNTH_LIVE || !process.env.ANTHROPIC_API_KEY)('live model', async () => {
    const { AnthropicProvider } = await import('../src/synth/anthropic');
    const r = await runGate('live model', new AnthropicProvider(process.env.ANTHROPIC_API_KEY!));
    expect(r.valid).toBeGreaterThanOrEqual(9);
    expect(r.passed).toBeGreaterThanOrEqual(6);
  }, 600000);

  test('the test bench describes a draft in plain text', () => {
    const report = benchReport(BUCKET);
    console.log('REPORT bench for the bucket:\n' + report);
    expect(report).toMatch(/held \d+ of 40 water/);
    expect(report).toMatch(/floats/);
  });
});
