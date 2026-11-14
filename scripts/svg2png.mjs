import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright'); import fs from 'fs';
const b = await chromium.launch(); const p = await b.newPage();
for (const f of process.argv.slice(2)) { const svg = fs.readFileSync(f, 'utf8'); await p.setContent(`<body style="margin:0">${svg}</body>`); const el = await p.$('svg'); await el.screenshot({ path: f.replace(/\.svg$/, '.png') }); }
await b.close();
