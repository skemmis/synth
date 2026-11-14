// Offline stand-in for the model: keyword rules and a few parametric shapes. For tests and for play without
// a model. It is deliberately dumb and says so; it exists so the loop can be played, not to be clever.
import type { Blueprint, Provider, SynthContext } from './types.ts';

type G = string[];
const row = (ch: string, n: number) => ch.repeat(n);
const pad = (g: G): G => { const w = Math.max(...g.map((r) => r.length)); return g.map((r) => r.padEnd(w, '.')); };
const num = (s: string, d: number, lo: number, hi: number) => { const m = /(\d+)/.exec(s); return Math.max(lo, Math.min(hi, m ? +m[1] : d)); };
const set = (g: G, r: number, c: number, ch: string): G => g.map((line, i) => (i === r ? line.slice(0, c) + ch + line.slice(c + 1) : line));
const at = (g: G, r: number, c: number) => (r >= 0 && r < g.length && c >= 0 && c < g[r].length ? g[r][c] : '.');
const grow = (g: G, top: number, right: number, bottom: number, left: number): G => { const w = g[0].length + left + right; return [...Array(top).fill(row('.', w)), ...g.map((r) => row('.', left) + r + row('.', right)), ...Array(bottom).fill(row('.', w))]; };
const trim = (g: G): G => { let o = g.slice(); while (o.length && /^\.*$/.test(o[0])) o.shift(); while (o.length && /^\.*$/.test(o[o.length - 1])) o.pop(); while (o.length && o.every((r) => r[0] === '.')) o = o.map((r) => r.slice(1)); while (o.length && o[0].length && o.every((r) => r[r.length - 1] === '.')) o = o.map((r) => r.slice(0, -1)); return o; };

interface Shape { keys: RegExp; name: string; make: (s: string) => G; note: string; }
const SHAPES: Shape[] = [
  { keys: /bucket|pail|cup|bowl|scoop|container|carry (the |some )?water|hold (the |some )?water|move (this |the |some )?water/, name: 'bucket', note: 'Wood floor and walls hold water; the centre post is a rigid handle so you can push it under.',
    make: (s) => { const w = /big|large/.test(s) ? 9 : /small|tiny/.test(s) ? 5 : 7, h = /deep|tall/.test(s) ? 4 : 3, m = (w - 1) / 2; const g: G = []; for (let i = 0; i < 2; i++) g.push(row('.', m) + 'W' + row('.', m)); for (let i = 0; i < h; i++) g.push('W' + row('.', m - 1) + 'W' + row('.', m - 1) + 'W'); g.push(row('W', w)); return g; } },
  { keys: /rope|chain|string|tether|cord|leash|line\b/, name: 'rope', note: 'A chain of fiber only resists stretch, so it hangs and swings.', make: (s) => [row('F', num(s, 12, 3, 16))] },
  { keys: /wall|barrier|fence|palisade|barricade|block (the|their) (way|path)/, name: 'wall', note: 'Two nodes thick so it stands; pitch along the foot glues it to the ground.',
    make: (s) => { const h = /tall|high|big/.test(s) ? 8 : /low|short|small/.test(s) ? 3 : num(s, 5, 2, 14); return [...Array(h).fill('WW'), 'PP']; } },
  { keys: /spike|caltrop|thorn strip|strip|bed of/, name: 'spike strip', note: 'Thorns point up from a wood base; pitch underneath holds it where it lands.',
    make: (s) => { const w = num(s, 9, 3, 15) | 1; let t = ''; for (let i = 0; i < w; i++) t += i % 2 ? '.' : 'T'; return [t, row('W', w), row('P', w)]; } },
  { keys: /cage|pen\b|box|crate|chest|enclos|locker|safe\b/, name: 'cage', note: 'A closed wooden frame. Whatever is inside when it is built stays inside until a bond breaks.',
    make: (s) => { const w = /big|large/.test(s) ? 8 : 6, h = /big|large|tall/.test(s) ? 6 : 5; return [row('W', w), ...Array(h - 2).fill('W' + row('.', w - 2) + 'W'), row('W', w)]; } },
  { keys: /raft|boat|float|barge|ferry|canoe/, name: 'raft', note: 'Wood is lighter than water. Low sides keep cargo from rolling off.', make: (s) => { const w = /big|large|long/.test(s) ? 12 : 9; return ['W' + row('.', w - 2) + 'W', row('W', w)]; } },
  { keys: /ramp|slope|wedge|incline|stairs|steps/, name: 'ramp', note: 'A solid wooden wedge. Things roll or climb up the long side.',
    make: (s) => { const n = num(s, 5, 3, 8); const g: G = []; for (let i = 1; i <= n; i++) g.push(row('.', n - i) + row('W', i)); return g; } },
  { keys: /hammer|mallet|maul|sledge|club|mace/, name: 'hammer', note: 'A heavy stone head on a wood shaft. Hold the bottom of the shaft and spin it; weight does the damage.',
    make: () => ['SSS', 'SSS', '.W.', '.W.', '.W.', '.W.', '.W.'] },
  { keys: /net|mesh|web|hammock|sling/, name: 'net', note: 'A zigzag of fiber sags between its wood ends and catches what falls in. Hang it by the two ends.',
    make: (s) => { const n = /big|large|wide/.test(s) ? 6 : 4; return ['WF' + '.F'.repeat(n) + 'W', '..' + 'F.'.repeat(n) + '.']; } },
  { keys: /lid|cover|roof|cap\b|hatch|ceiling/, name: 'lid', note: 'A flat wood plate with a lip at each end so it does not slide off what it covers.', make: (s) => { const w = num(s, 9, 5, 16); return [row('W', w), 'W' + row('.', w - 2) + 'W']; } },
  { keys: /sword|blade|knife|dagger|spear|lance|weapon/, name: 'sword', note: 'A long wood blade with a crossguard. On its own it is just a stick; ask for something sharp on it.',
    make: (s) => /spear|lance/.test(s) ? [...Array(10).fill('W')] : ['.W.', '.W.', '.W.', '.W.', '.W.', '.W.', 'WWW', '.W.', '.W.'] },
  { keys: /bridge|plank|beam|board|pole|stick|lever|bar\b/, name: 'plank', note: 'A straight run of wood stays straight, so it spans gaps and works as a lever.', make: (s) => [row('W', num(s, 12, 3, 16))] },
  { keys: /ladder/, name: 'ladder', note: 'Two rails and rungs.', make: () => ['W.W', 'WWW', 'W.W', 'WWW', 'W.W', 'WWW', 'W.W'] },
  { keys: /flail|whip|ball and chain|wrecking/, name: 'flail', note: 'A stone weight on a fiber chain on a wood handle. Swing the handle and the weight follows late and hard.', make: () => ['W', 'W', 'W', 'F', 'F', 'F', 'F', 'S'].map((c) => c === 'S' ? 'SS' : c + '.').concat(['SS']) },
  { keys: /anchor|weight|ballast|boulder|rock\b/, name: 'weight', note: 'A block of stone. It sinks, and it is hard to shove.', make: () => ['SSS', 'SSS'] },
  { keys: /hook|grapple/, name: 'hook', note: 'A wood hook on a fiber line.', make: () => ['F..', 'F..', 'F..', 'F..', 'W..', 'W.W', 'WWW'] },
  { keys: /trap|snare|bait/, name: 'bait trap', note: 'A berry sits in a ring of thorns stuck to the ground. Anything that pushes in for the berry meets the thorns first.', make: () => ['T.B.T', 'TW.WT', 'PPPPP'] },
  { keys: /door|gate|flap/, name: 'gate', note: 'A wood panel hanging from one fiber hinge on a post.', make: () => ['WF', 'W.', 'W.', 'W.', 'P.'].map((r, i) => i === 0 ? 'WFWW' : i < 4 ? 'W.WW' : 'P...') },
];

// ---- edits applied to an existing draft ----
function lineWithThorns(g: G): G {
  let o = grow(pad(g), 1, 1, 0, 1); const H = o.length, src = o.slice();
  const solidRows = src.map((r, i) => (/[^.]/.test(r) ? i : -1)).filter((i) => i >= 0); const cut = solidRows[Math.floor(solidRows.length * 0.6)] ?? H;
  for (let r = 0; r < H; r++) for (let c = 0; c < src[r].length; c++) {
    if (src[r][c] !== '.' || r > cut) continue;
    const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => /[WS]/.test(at(src, r + dr, c + dc)));
    if (near) o = set(o, r, c, 'T');
  }
  return trim(o);
}
function addGrip(g: G): G {
  let o = pad(g); const last = o.length - 1; const cols: number[] = []; for (let c = 0; c < o[last].length; c++) if (o[last][c] !== '.') cols.push(c);
  const c = cols[cols.length >> 1] ?? 0; const w = o[0].length;
  // a bare shaft below, and no thorns right beside it
  for (let i = 0; i < 3; i++) o.push(row('.', c) + 'W' + row('.', w - c - 1));
  for (let r = Math.max(0, last - 1); r <= last; r++) for (const dc of [-1, 1]) if (at(o, r, c + dc) === 'T') o = set(o, r, c + dc, '.');
  if (at(o, last, c) === 'T') o = set(o, last, c, 'W');
  return trim(o);
}
const addPitchFoot = (g: G): G => { const o = pad(g); const last = o[o.length - 1]; return [...o, last.replace(/[^.]/g, 'P')]; };
const swap = (g: G, from: RegExp, to: string): G => g.map((r) => r.replace(from, to));
const taller = (g: G): G => { const o = pad(g); const m = o.length >> 1; return [...o.slice(0, m), o[m], ...o.slice(m)]; };
const wider = (g: G): G => pad(g).map((r) => { const m = r.length >> 1; return r.slice(0, m) + r[m] + r.slice(m); });
const smaller = (g: G): G => { const o = pad(g); const m = o.length >> 1, c = o[0].length >> 1; const out = o.length > 3 ? [...o.slice(0, m), ...o.slice(m + 1)] : o; return out[0].length > 3 ? out.map((r) => r.slice(0, c) + r.slice(c + 1)) : out; };

const EDITS: { keys: RegExp; apply: (g: G) => G; say: string }[] = [
  { keys: /thorn|sharp|spik|kill|hurt|stab|cut|prick|barb|deadly|damage/, apply: lineWithThorns, say: 'Lined the working edges with thorns.' },
  { keys: /hold|handle|grip|grab|carry it|pick it up/, apply: addGrip, say: 'Added a bare wood shaft at the bottom to grab, clear of anything sharp.' },
  { keys: /stick|sticky|glue|stay put|anchor|pitch|fixed|tip over|fall over|knock/, apply: addPitchFoot, say: 'Added pitch along the bottom so it glues to what it lands on.' },
  { keys: /heav|stone|stronger|tougher|solid|harder/, apply: (g) => swap(g, /W/g, 'S'), say: 'Swapped the wood for stone: much heavier and harder.' },
  { keys: /light|float|wood(en)?\b/, apply: (g) => swap(g, /S/g, 'W'), say: 'Swapped the stone for wood: lighter, and it floats.' },
  { keys: /taller|higher|longer|deeper/, apply: taller, say: 'Made it one row taller.' },
  { keys: /wider|broader|fatter/, apply: wider, say: 'Made it one column wider.' },
  { keys: /bigger|larger/, apply: (g) => wider(taller(g)), say: 'Made it a little bigger each way.' },
  { keys: /smaller|shorter|cheaper|less/, apply: smaller, say: 'Trimmed a row and a column.' },
];

export const stubProvider: Provider = async (ctx: SynthContext): Promise<Blueprint> => {
  const s = ctx.message.toLowerCase();
  const shape = SHAPES.find((sh) => sh.keys.test(s));
  let g: G | null = null, name = ctx.draft?.name ?? 'thing'; const notes: string[] = [];
  if (shape && !(ctx.draft && /\b(it|its|this|that|the (edge|edges|bottom|top|side|sides))\b/.test(s) && !new RegExp(`\\b(a|an|new|another)\\b`).test(s))) { g = pad(shape.make(s)); name = shape.name; notes.push(shape.note); }
  else if (ctx.draft) g = ctx.draft.grid.slice();
  if (!g) return { name: 'stick', grid: ['WWWWWW'], note: 'I only know simple shapes offline, so here is a stick to start from.', question: 'Is it closest to a container, a wall, a tool, a rope or a float?' };
  const rest = shape && notes.length ? s.replace(shape.keys, ' ') : s;
  let edits = 0;
  for (const e of EDITS) if (e.keys.test(rest)) { g = e.apply(g); notes.push(e.say); edits++; }
  if (!notes.length) return { name, grid: g, note: 'I did not catch a change I know how to make offline.', question: 'Try words like: thorns, handle, sticky, heavier, lighter, taller, wider, smaller.' };
  const need = cost(g), lack = Object.entries(need).filter(([k, n]) => (ctx.inventory[k] ?? 0) < n).map(([k, n]) => `${n - (ctx.inventory[k] ?? 0)} more ${k}`);
  void lack;
  if (edits && shape) name = shape.name;
  return { name, grid: g.slice(0, 16).map((r) => r.slice(0, 16)), note: notes.join(' ') };
};
const cost = (g: G) => { const c: Record<string, number> = {}; for (const r of g) for (const ch of r) if (ch !== '.') c[ch] = (c[ch] ?? 0) + 1; return c; };
