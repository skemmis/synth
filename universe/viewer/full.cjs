const { chromium } = require('playwright');
(async () => { const b = await chromium.launch();
  for (const [w, h, name] of [[1400, 900, 'desk'], [400, 800, 'phone']]) { const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: name === 'desk' ? 'light' : 'dark' });
    await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(2500); await p.screenshot({ path: `results/full-${name}.png`, fullPage: true });
    console.log(name, 'scrollW', await p.evaluate(() => document.documentElement.scrollWidth), w); }
  await b.close(); })();
