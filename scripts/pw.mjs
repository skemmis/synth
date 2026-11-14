// Tiny Playwright helper for scripted playtests.
import { createRequire } from 'module'; import path from 'path'; import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
export async function open(name, { width = 1280, height = 720 } = {}) {
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.resolve(import.meta.dirname, '..', 'play', name + '.html'));
  await page.waitForTimeout(600);
  // world coords -> screen coords for the stage canvas
  const toScreen = async (wx, wy) => page.evaluate(([x, y]) => { const g = window.game, r = g.fg.getBoundingClientRect(); return [r.left + (x - g.cam.x) * g.cam.zoom / g.dpr, r.top + (y - g.cam.y) * g.cam.zoom / g.dpr]; }, [wx, wy]);
  const dragWorld = async (pts, stepsPer = 30, hold = 0) => {
    let [sx, sy] = await toScreen(...pts[0]); await page.mouse.move(sx, sy); await page.mouse.down();
    for (const p of pts.slice(1)) { [sx, sy] = await toScreen(...p); await page.mouse.move(sx, sy, { steps: stepsPer }); await page.waitForTimeout(120); }
    if (hold) await page.waitForTimeout(hold);
  };
  return { browser, page, errors, toScreen, dragWorld, shot: (f) => page.screenshot({ path: path.resolve(import.meta.dirname, '..', 'shots', f) }) };
}
