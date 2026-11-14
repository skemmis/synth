// usage: node scripts/svg2png.cjs a.svg [b.svg ...]  -> a.png
const { chromium } = require('playwright');
const { readFileSync } = require('fs');
(async () => {
  const b = await chromium.launch();
  for (const f of process.argv.slice(2)) {
    const p = await b.newPage();
    await p.setContent(`<body style="margin:0">${readFileSync(f, 'utf8')}</body>`);
    const el = await p.$('svg');
    await el.screenshot({ path: f.replace(/\.svg$/, '.png') });
    await p.close();
  }
  await b.close();
})();
