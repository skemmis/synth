// Offline synthesizer: canned recipes picked by keyword, plus a handful of
// mechanical edits to the current draft. Used for tests, for play without a
// key, and wherever the API cannot be reached. It is deliberately dumb.
import type { Blueprint, ChatMessage, Provider, SynthContext } from './types';

const g = (s: string) => s.trim().split('\n').map((l) => l.trim());

const CANNED: { keys: RegExp; bp: Blueprint }[] = [
  { keys: /bucket|pail|carry water|scoop|container|cup|bowl|pot/, bp: { name: 'Bucket', note: 'A wooden U. Hold it by the bottom, tip the mouth forward to scoop.', grid: g(`
    W.....W
    W.....W
    W.....W
    W.....W
    WWWWWWW`) } },
  { keys: /rope|cord|string|tether|leash|chain/, bp: { name: 'Rope', note: 'A chain of fiber. It only resists being stretched.', grid: g('FFFFFFFFFFFFFF') } },
  { keys: /spike|caltrop|strip|thorn (floor|mat|carpet)|barb/, bp: { name: 'Spike strip', note: 'Thorns up, stone underneath so it stays put. Lay it where something will walk.', grid: g(`
    TTTTTTTTTT
    SSSSSSSSSS`) } },
  { keys: /wall|barrier|barricade|fence|palisade/, bp: { name: 'Wall', note: 'Three thick with a stone foot so it stands and is hard to push over.', grid: g(`
    WWW
    WWW
    WWW
    WWW
    WWW
    WWW
    WWW
    SSSSS`) } },
  { keys: /cage|pen|enclos|coop|jail|berry box|strongbox|safe/, bp: { name: 'Cage', note: 'A closed stone-footed box. Drop it over what you want to protect.', grid: g(`
    WWWWWWWW
    W......W
    W......W
    W......W
    S......S
    S......S`) } },
  { keys: /raft|boat|float|barge|pontoon/, bp: { name: 'Raft', note: 'Wood is lighter than water. The raised ends keep cargo aboard.', grid: g(`
    W.........W
    WWWWWWWWWWW
    WWWWWWWWWWW`) } },
  { keys: /ramp|slope|wedge|incline|slide/, bp: { name: 'Ramp', note: 'A wooden wedge. Things roll down the long side.', grid: g(`
    W.......
    WWW.....
    WWWWW...
    WWWWWWW.
    WWWWWWWW`) } },
  { keys: /hammer|mallet|maul|sledge|club|mace|bat/, bp: { name: 'Hammer', note: 'Stone head on a wood handle. Hold the far end and swing; the weight does the damage.', grid: g(`
    ......SS
    WWWWWWSS
    ......SS`) } },
  { keys: /net|mesh|web|sling|hammock/, bp: { name: 'Net', note: 'A fiber grid between two wood rails. Slack until something lands in it.', grid: g(`
    WFFFFFFFFW
    WFFFFFFFFW
    WFFFFFFFFW`) } },
  { keys: /lid|cover|cap|roof|hatch|plate/, bp: { name: 'Lid', note: 'A flat wood plate with lips at each end so it does not slide off.', grid: g(`
    WWWWWWWWW
    W.......W`) } },
  { keys: /sword|blade|knife|dagger|spear|lance|pike/, bp: { name: 'Sword', note: 'A wood grip with a thorn edge. Hold the plain end.', grid: g(`
    ...TTTTTT
    WWWWWWWWW`) } },
  { keys: /bridge|plank|beam|board|stick|pole|lever/, bp: { name: 'Plank', note: 'A stiff wooden beam.', grid: g('WWWWWWWWWWWW') } },
  { keys: /ladder|stairs|steps/, bp: { name: 'Steps', note: 'A wooden staircase.', grid: g(`
    W...
    WW..
    WWW.
    WWWW`) } },
  { keys: /weight|anchor|boulder|block|ballast|crush/, bp: { name: 'Stone block', note: 'Heavy. Sinks, and crushes what it lands on.', grid: g(`
    SSS
    SSS`) } },
  { keys: /hook|grapple|crook/, bp: { name: 'Hook', note: 'A wood hook on a fiber line.', grid: g(`
    FFFFFFW..
    ......W.W
    ......WWW`) } },
  { keys: /flail|whip|morning star/, bp: { name: 'Flail', note: 'A rope hinge between handle and a thorn-and-stone head.', grid: g('WWWWFFFST') } },
  { keys: /trap|snare|glue|sticky/, bp: { name: 'Glue trap', note: 'Pitch on top of stone. Whatever walks over it sticks.', grid: g(`
    PPPPPP
    SSSSSS`) } },
  { keys: /shield|guard/, bp: { name: 'Shield', note: 'A wood plate with a grip behind it.', grid: g(`
    .W
    .W
    WW
    .W
    .W`) } },
  { keys: /bait|lure|decoy/, bp: { name: 'Bait', note: 'Berries on a stone so they stay where you put them.', grid: g(`
    BB
    SS`) } },
  { keys: /wiggl|motor|engine|crawler|walker|twitch|kick/, bp: { name: 'Twitcher', note: 'Sinew between two wood bars. It flexes on its own.', grid: g(`
    WWWW
    NNNN
    WWWW`) } },
];

const rows = (grid: string[]) => grid.map((r) => [...r]);
const join = (m: string[][]) => m.map((r) => r.join(''));

function pad(m: string[][], top: number, right: number, bottom: number, left: number): string[][] {
  const w = m[0].length + left + right;
  const blank = () => Array<string>(w).fill('.');
  return [
    ...Array.from({ length: top }, blank),
    ...m.map((r) => [...Array<string>(left).fill('.'), ...r, ...Array<string>(right).fill('.')]),
    ...Array.from({ length: bottom }, blank),
  ];
}

/** mechanical edits to an existing draft */
function refine(msg: string, draft: Blueprint): Blueprint | null {
  const m = rows(draft.grid);
  const h = m.length, w = m[0].length;
  if (/hold|handle|grip|grab|carry/.test(msg)) {
    if (/hang|bail|swing|level/.test(msg) || draft.grid[0].split('.').length - 1 > w / 2) {
      // a fiber bail across an open top
      const top = Array<string>(w).fill('.');
      const top2 = Array<string>(w).fill('.');
      for (let c = 2; c < w - 2; c++) top[c] = 'F';
      top2[1] = 'F'; top2[w - 2] = 'F';
      return { ...draft, grid: join([top, top2, ...m]), note: 'Added a fiber bail so it hangs level from the hand.' };
    }
    // a wooden handle off the left end of the busiest row
    const row = m.map((r) => r.filter((x) => x !== '.').length).reduce((b, n, i, a) => (n > a[b] ? i : b), 0);
    const out = pad(m, 0, 0, 0, 3);
    for (let c = 0; c < 3; c++) out[row][c] = 'W';
    return { ...draft, grid: join(out), note: 'Added a plain wooden grip at the left end, clear of anything sharp.' };
  }
  if (/thorn|sharp|spik|kill|hurt|edge|lined|line the|barb|teeth/.test(msg)) {
    // put thorns on every empty cell directly above or to the right of the body, away from column 0-2 (the grip)
    const out = pad(m, 1, 1, 0, 0);
    const H = out.length, W = out[0].length;
    const solid = (r: number, c: number) => r >= 0 && r < H && c >= 0 && c < W && out[r][c] !== '.' && out[r][c] !== 'T';
    const add: [number, number][] = [];
    for (let r = 0; r < H; r++) for (let c = 3; c < W; c++) {
      if (out[r][c] === '.' && (solid(r + 1, c) || solid(r, c - 1))) add.push([r, c]);
    }
    for (const [r, c] of add) out[r][c] = 'T';
    return { ...draft, grid: join(out).slice(0, 16), note: 'Lined the top and far edge with thorns; the near end stays plain so it can be held.' };
  }
  if (/bigger|larger|taller|deeper|wider|longer|more room/.test(msg)) {
    const tall = /taller|deeper|bigger|larger/.test(msg), wide = /wider|longer|bigger|larger|more room/.test(msg);
    let out = m;
    if (tall && h < 15) { const mid = Math.floor(h / 2) - 1 < 0 ? 0 : Math.floor(h / 2) - 1; out = [...out.slice(0, mid + 1), out[mid].slice(), ...out.slice(mid + 1)]; }
    if (wide && w < 15) { const mid = Math.floor(w / 2); out = out.map((r) => [...r.slice(0, mid + 1), r[mid], ...r.slice(mid + 1)]); }
    return { ...draft, grid: join(out), note: 'Stretched it through the middle.' };
  }
  if (/smaller|shorter|narrower|less/.test(msg) && (h > 2 || w > 3)) {
    let out = m;
    if (h > 2 && /smaller|shorter/.test(msg)) { const mid = Math.floor(h / 2) - 1; out = out.filter((_, i) => i !== Math.max(0, mid)); }
    if (w > 3) { const mid = Math.floor(w / 2); out = out.map((r) => r.filter((_, i) => i !== mid)); }
    return { ...draft, grid: join(out), note: 'Trimmed it through the middle.' };
  }
  if (/heav|stone|stronger|tougher|sturd/.test(msg)) {
    const out = m.map((r, i) => r.map((x) => (x === 'W' && (i === h - 1 || /all|whole|entire|stone/.test(msg)) ? 'S' : x)));
    return { ...draft, grid: join(out), note: 'Swapped wood for stone where it adds weight low down.' };
  }
  if (/light|wood(en)?|float/.test(msg)) {
    return { ...draft, grid: join(m.map((r) => r.map((x) => (x === 'S' ? 'W' : x)))), note: 'Swapped stone for wood to make it lighter.' };
  }
  if (/stick|glue|pitch|stay put|anchor/.test(msg)) {
    const out = m.map((r, i) => (i === h - 1 ? r.map((x) => (x === '.' ? '.' : 'P')) : r));
    return { ...draft, grid: join(out), note: 'The bottom row is now pitch, so it bonds to the ground where it lands.' };
  }
  if (/bait|berr/.test(msg)) {
    const out = pad(m, 1, 0, 0, 0);
    out[0][Math.floor(w / 2)] = 'B';
    return { ...draft, grid: join(out), note: 'Added a berry on top as bait.' };
  }
  return null;
}

export class StubProvider implements Provider {
  readonly name = 'offline';

  async complete(_system: string, _messages: ChatMessage[], ctx: SynthContext): Promise<string> {
    return JSON.stringify(StubProvider.answer(ctx));
  }

  static answer(ctx: SynthContext): Blueprint {
    const msg = ctx.message.toLowerCase();
    // a fresh noun wins over an edit; otherwise try to edit the draft
    // the noun mentioned first wins ("a lid for this bucket" is a lid)
    let fresh: (typeof CANNED)[number] | undefined;
    let at = Infinity;
    for (const c of CANNED) { const m = c.keys.exec(msg); if (m && m.index < at) { at = m.index; fresh = c; } }
    if (ctx.draft) {
      const edited = refine(msg, ctx.draft);
      if (edited && !(fresh && /\b(need|make|build|want|give me)\b.*\b(a|an)\b/.test(msg) && !/\bit\b|\bthis\b/.test(msg))) return { ...edited, question: '' };
    }
    if (fresh) return { ...fresh.bp, question: '' };
    if (ctx.draft) return { ...ctx.draft, note: 'Left as it was.', question: 'The offline synthesizer only understands a few changes (handle, thorns, bigger, smaller, heavier, lighter, sticky). Which did you mean?' };
    return {
      name: 'Plank', grid: ['WWWWWWWW'], note: 'A plain wooden beam, as a starting point.',
      question: 'The offline synthesizer knows only a few shapes (bucket, rope, wall, cage, raft, ramp, hammer, net, lid, sword, spike strip, hook, trap). Add an API key in Settings for free-form requests. Which would you like?',
    };
  }
}
