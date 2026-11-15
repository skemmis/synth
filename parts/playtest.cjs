// Scripted playtest: load each starter, watch it, then build a worm by hand with clicks and check it moves.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: process.argv[3] || 'light' });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'play/sandbox.html'));
  const cen = () => p.evaluate(() => { let x = 0, y = 0, n = 0; for (let i = 0; i < w.n; i++) if (w.kind[i] !== 3) { x += w.x[i]; y += w.y[i]; n++; } return [x / n, y / n, n, w.nb, w.stat.eaten, w.stat.snapped, w.stat.glued]; });
  for (const id of ['worm', 'tadpole', 'ladder', 'whip', 'eel', 'dart', 'paper']) { await p.click('#s-' + id); const a = await cen(); await p.waitForTimeout(6000); const c = await cen(); console.log(id, 'moved', Math.hypot(c[0] - a[0], c[1] - a[1]).toFixed(1), 'in 6 s; eaten', c[4], 'snapped', c[5], 'glued', c[6]); await p.locator('#pond').screenshot({ path: `results/pt-${id}.png` }); }
  // bomb: grab and yank
  await p.click('#s-bomb'); await p.click('#tGrab'); const box = await p.locator('#cv').boundingBox();
  const sx = (x) => box.x + x / 48 * box.width, sy = (y) => box.y + y / 30 * box.height;
  await p.mouse.move(sx(25.05), sy(15)); await p.mouse.down(); await p.mouse.move(sx(34), sy(15), { steps: 4 }); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(1000);
  const bm = await cen(); console.log('bomb: links left', bm[3], 'snapped', bm[5]); await p.locator('#pond').screenshot({ path: 'results/pt-bomb.png' });
  // build by hand: bead, jitter, jitter, bead in a row with springs
  await p.click('#bClear'); await p.click('#l1');
  const place = async (btn, x, y) => { await p.click(btn); await p.mouse.click(sx(x), sy(y)); };
  await place('#a0', 10, 15); await place('#a1', 11.3, 15); await place('#a1', 12.6, 15); await place('#a0', 13.9, 15);
  const built = await cen(); console.log('hand build: atoms', built[2], 'links', built[3]);
  await p.click('#bFeed'); await p.click('#bRun'); await p.waitForTimeout(8000); const after = await cen();
  console.log('hand build moved', Math.hypot(after[0] - built[0], after[1] - built[1]).toFixed(1), 'in 8 s; eaten', after[4]);
  await p.screenshot({ path: 'results/pt-page.png', fullPage: true });
  console.log(errs.length ? 'ERRORS ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
