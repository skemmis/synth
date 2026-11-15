// node viewer/shot.cjs <html> <outprefix> <presetIds comma> [waitMs] [scale]
const { chromium } = require('playwright');
(async () => {
  const [html, out, ids, wait, scale] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: +scale || 1, colorScheme: 'dark' });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(html));
  for (const id of ids.split(',')) { await p.click('#pick-' + id); await p.waitForTimeout(+wait || 4000); await p.locator('#dish').screenshot({ path: `${out}-${id}.png` }); }
  if (errs.length) console.log('ERRORS', errs.slice(0, 5));
  await b.close();
})();
