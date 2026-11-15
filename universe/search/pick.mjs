// Assemble the gallery's presets from validated search results.
import fs from 'node:fs';
import { World } from '../sim.js';
// speed as the viewer will show it: periodic 80x80 world at the universe's own temperature, 30 s to 120 s
function viewerSpeed(R, atoms) {
  let tot = 0;
  for (let seed = 1; seed <= 3; seed++) {
    const w = new World(R, { cap: 200, boundary: 'periodic', W: 80, H: 80, seed }); for (const a of atoms) w.add(a.t, a.x + 40, a.y + 40);
    const cen = () => { let x = 0, y = 0; for (let i = 0; i < w.n; i++) { x += w.x[i]; y += w.y[i]; } return [x / w.n, y / w.n]; };
    for (let s = 0; s < 1500; s++) w.step(); const a = cen(); for (let s = 0; s < 4500; s++) w.step(); const b = cen();
    tot += Math.hypot(b[0] - a[0], b[1] - a[1]) / 90 / 3;
  }
  return tot;
}
const sw = JSON.parse(fs.readFileSync('results/swimmers3.json')), cells = JSON.parse(fs.readFileSync('results/cells3.json')).filter(r => r.voidArea > 8);
const soups = JSON.parse(fs.readFileSync('results/soup-top.json'));
const eff = [...sw].filter(r => r.robust > 0.3).sort((a, b) => b.robust / b.power - a.robust / a.power);
const by = (f) => sw.filter(f)[0];
const P = [];
const stat = (r) => `${r.n} atoms · ${r.beatHz.toFixed(1)} beats/s · ${(r.vs = viewerSpeed(r.R, r.atoms)).toFixed(1)} widths/s`;
const add = (id, group, name, r, blurb, world = {}) => P.push({ id, group, name, tag: stat(r), blurb, rules: r.R, atoms: r.atoms, world, stats: { viewer: r.vs, robust: r.robust, base: r.base, half: r.half, long: r.long, noisy: r.noisy, own: r.own, linear: r.linear, beats: r.beatHz, power: r.power, stroke: r.stroke, water: r.water, voidArea: r.voidArea } });
const slow = by(r => r.key.endsWith('|0')), tiny = eff[0], fast = sw[0], slip = by(r => r.water === 'slipstream'), splash = by(r => r.water === 'splash' && r.beatHz < 8), big = by(r => r.n >= 15 && r.stroke === 'kick');
add('slow-kicker', 'Swimmers', 'Slow kicker', slow, 'A lump with one odd atom. The odd atom grabs a neighbour, the bond stores a kick, and when the bond lets go the kick shoves the body one way and the light atom the other. The water stops the light atom faster than the heavy body, so the body gains ground on every beat. You can count the beats.');
add('four-atom', 'Swimmers', 'Four-atom swimmer', tiny, 'The smallest and thriftiest swimmer found: three of one type and one of another. It goes furthest per unit of energy of anything in the search.');
add('buzzer', 'Swimmers', 'Buzzer', fast, 'The fastest body found. It beats too quickly to see, and burns energy about ten times faster than the slow kicker to go twice as fast. The search finds this first if speed is all you ask for.');
add('slipstream', 'Swimmers', 'Slipstream swimmer', slip, 'This water has no splash at all: drag does not grow with speed. The only thing this body can use is that atoms in a row shield each other from the water. That is how real cilia work, and here it is weak but real.');
if (splash) add('splash', 'Swimmers', 'Splash swimmer', splash, 'This water has splash and no slipstream. A fast stroke meets much more resistance than a slow return, and that difference is the whole engine.');
if (big) add('raft', 'Swimmers', 'Raft', big, 'A larger body with several kickers firing along it. Try pulling atoms off to see how much of it the motor needs.');
const ctl = JSON.parse(fs.readFileSync('results/controls.json')).filter(r => r.controlSpeed < 0.01).sort((a, b) => b.robust - a.robust)[0];
add('darter', 'Swimmers', 'Darter', ctl, 'A quick four-atom swimmer. It is here mainly as the partner of the control below: same atoms, same rules, different water.');
const stillR = JSON.parse(JSON.stringify(ctl.R)); stillR.g2 = 0; stillR.shadow = 0;
P.push({ id: 'control', group: 'Swimmers', name: 'Control: plain water', tag: `same body · ${viewerSpeed(stillR, ctl.atoms).toFixed(2)} widths/s`, blurb: 'The darter again, in water with plain drag only. It beats just as hard and goes nowhere. With plain drag the pushes and pulls inside a body always cancel, so nothing can ever swim. Every universe worth playing in needs splash or slipstream.', rules: stillR, atoms: ctl.atoms, world: {} });
const c0 = cells[0], c1 = cells.find(r => r !== c0 && r.water !== c0.water) || cells[1];
// membrane on its own: the cell's ring without its motor, with loose atoms inside and outside
{
  const R = c0.R, cnt = {}; for (const a of c0.atoms) cnt[a.t] = (cnt[a.t] || 0) + 1;
  const M = +Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  const ringAtoms = c0.atoms.filter(a => a.t === M); let cx = 0, cy = 0; for (const a of ringAtoms) { cx += a.x; cy += a.y; } cx /= ringAtoms.length; cy /= ringAtoms.length;
  const other = [...Array(R.K).keys()].filter(t => t !== M && cnt[t]);
  const extra = [];
  for (let k = 0; k < 3; k++) extra.push({ t: other[k % other.length], x: cx + (k - 1) * 1.2, y: cy + (k % 2) * 1.1 - 0.5 });
  for (let k = 0; k < 16; k++) { const ang = k * 0.3927, d = 8 + (k % 3) * 2.5; extra.push({ t: other[k % other.length], x: cx + d * Math.cos(ang), y: cy + d * Math.sin(ang) }); }
  P.push({ id: 'membrane', group: 'Cells', name: 'Membrane ring', tag: `${ringAtoms.length} atoms · ring placed by hand`, blurb: 'A closed ring of one atom type that links only to its own kind, twice. Three loose atoms start inside and sixteen outside. Watch whether the insiders stay in and the outsiders stay out as everything jiggles. Try dragging an outsider through the wall, or dropping atoms inside.', rules: R, atoms: ringAtoms, world: { extra, zoom: 17, follow: false } });
}
add('cell', 'Cells', 'Bag with a motor', c0, 'The same kind of ring with a motor attached. The ring was placed by hand; the search found a motor that can push it and rules under which the ring stays closed while it is dragged along.', { zoom: 15 });
if (c1) add('cell-2', 'Cells', 'Second cell', c1, 'Another cell from a different run of the search. The membrane is a floppy chain with no stiffness of its own, so it trails like a bag. Something inside pushing outward would round it out.', { zoom: 15 });
const soup = (id, name, o, blurb, n = 260) => P.push({ id, group: 'Soups', name, tag: `${o.R.K} type${o.R.K > 1 ? 's' : ''} · left alone`, blurb, rules: o.R, world: { soup: n, W: 34, H: 34, follow: false, zoom: 22, seed: 11, stepsPerFrame: 6 } });
const foam = soups.find(o => o.m.voids >= 10 && o.cls !== 'one frozen lump' && o.m.temp > 0.02) || soups.find(o => o.m.voids >= 10);
const living = soups.find(o => o.cls === 'living clusters' && o.opts.bonds !== false && o.R.K >= 3);
const glide = soups.find(o => o.opts.nonrecip && o.m.movers >= 5);
if (foam) soup('foam', 'Foam', foam, 'Nothing placed by hand: 260 atoms scattered at random. These rules knit them into a net of closed compartments on their own. About one random universe in twenty does this, almost always with one or two atom types.');
if (living) soup('living', 'Restless clusters', living, 'Random atoms that clump into clusters which keep making and breaking bonds without ever settling or blowing up. This is the most common kind of universe with bonds: about four in ten.');
if (glide) soup('gliders', 'Gliders (one-sided forces)', glide, 'No bonds here. Instead forces are one-sided: A chases B while B ignores A. Clusters glide around at once, with no beating and no energy bill. It is lively, but motion is free, so there is nothing for a player to earn.');
fs.writeFileSync('gallery/presets.json', JSON.stringify(P));
for (const p of P) console.log(p.id.padEnd(12), p.tag, p.stats ? JSON.stringify({ own: +p.stats.own.toFixed(2), lin: +p.stats.linear.toFixed(3), stroke: p.stats.stroke, water: p.stats.water, T: p.rules.T }) : '');
