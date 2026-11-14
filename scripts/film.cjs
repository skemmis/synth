// usage: node scripts/film.cjs frames.json out.png   (frames.json = array of svg strings; laid out in a grid)
const { chromium } = require('playwright');
const { readFileSync } = require('fs');
(async () => {
  const frames = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const cols = Number(process.argv[4] || 3);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  await p.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},max-content);gap:4px;background:#333">${frames.join('')}</body>`);
  await p.screenshot({ path: process.argv[3], fullPage: true });
  await b.close();
})();
