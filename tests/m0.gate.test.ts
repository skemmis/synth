// Milestone 0 gate: the physics toy. Each test is a headless scenario.
import { describe, expect, test } from 'vitest';
import { parseGrid } from '../src/sim/grid';
import { benchmark, bucketCarry, clubHit, floatTest, ropeSwing, tugBlock } from '../src/sim/scenarios';

describe('milestone 0 gate', () => {
  test('a wood bucket carried from pond to ditch keeps at least 70% of its water', () => {
    const r = bucketCarry();
    console.log(`GATE bucket: scooped ${r.scooped}, arrived with ${r.arrived} (${(r.kept * 100).toFixed(0)}%) after ${r.carrySeconds.toFixed(1)}s carry`);
    expect(r.scooped).toBeGreaterThanOrEqual(15);
    expect(r.kept).toBeGreaterThanOrEqual(0.7);
  });

  test('a fiber chain hangs and swings as rope', () => {
    const r = ropeSwing();
    console.log(`GATE rope: swung ${r.swingLeft.toFixed(0)}..${r.swingRight.toFixed(0)}, ${r.crossings} crossings, max stretch ${((r.maxLen / r.restLen - 1) * 100).toFixed(0)}%, hangs dx=${r.hangDx.toFixed(1)} dy=${r.hangDy.toFixed(0)}, pile ${r.pileWidth.toFixed(0)}x${r.pileHeight.toFixed(0)}`);
    expect(r.intact).toBe(true);
    expect(r.crossings).toBeGreaterThanOrEqual(3);          // it swings back and forth
    expect(r.swingLeft).toBeLessThan(-r.restLen * 0.4);     // well past the bottom
    expect(r.maxLen).toBeLessThan(r.restLen * 1.2);         // it does not stretch like rubber
    expect(r.hangDx).toBeLessThan(15);                      // comes to rest below the hand
    expect(r.hangDy).toBeGreaterThan(r.restLen * 0.95);
    expect(r.pileHeight).toBeLessThan(r.restLen * 0.4);     // let go, it piles up
  });

  test('a thorn club damages a dummy and a wood club does not', () => {
    const thorn = clubHit(parseGrid('WWWWWT\n.....T'));
    const wood = clubHit(parseGrid('WWWWWW\n.....W'));
    console.log(`GATE clubs: thorn club dealt ${thorn.damage.toFixed(1)}, wood club dealt ${wood.damage.toFixed(1)}`);
    expect(thorn.damage).toBeGreaterThan(20);
    expect(wood.damage).toBe(0);
  });

  test('pitch sticks a block to the ground', () => {
    const wood = tugBlock(parseGrid('WWW\nWWW'));
    const pitch = tugBlock(parseGrid('WWW\nPPP'));
    const yank = tugBlock(parseGrid('WWW\nWPW'), 260, 1.5);
    console.log(`GATE pitch: same tug moved wood block ${wood.moved.toFixed(1)}, pitch block ${pitch.moved.toFixed(2)} (${pitch.anchored} anchors); a block with one pitch foot pulled free and moved ${yank.moved.toFixed(1)}`);
    expect(wood.moved).toBeGreaterThan(40);
    expect(pitch.moved).toBeLessThan(3);
    expect(pitch.anchored).toBeGreaterThan(0);
    expect(yank.moved).toBeGreaterThan(40); // sticky, not welded
  });

  test('wood floats and stone sinks', () => {
    const w = floatTest('W'), s = floatTest('S');
    console.log(`GATE float: surface y=${w.surface.toFixed(0)}, wood top y=${w.top.toFixed(0)}, stone bottom y=${s.bottom.toFixed(0)} (floor ${s.floor})`);
    expect(w.top).toBeLessThan(w.surface + 4);     // breaks the surface
    expect(s.bottom).toBeGreaterThan(s.floor - 20); // on the bottom
  });

  test('headless speed report', () => {
    const r = benchmark();
    console.log(`REPORT speed: ${r.nodes} nodes at ${r.stepsPerSecond.toFixed(0)} steps/s (${r.realtimeFactor.toFixed(1)}x real time)`);
    expect(r.realtimeFactor).toBeGreaterThan(5);
  });
});
