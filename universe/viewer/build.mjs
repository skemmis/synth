// Build a self-contained viewer page from a presets JSON file.
// Usage: node viewer/build.mjs <presets.json> <out.html> [--page] "<title>" "<heading>" "<lede>"
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2), page = args.includes('--page');
const [pf, out, title, heading, lede] = args.filter(a => a !== '--page');
const sim = fs.readFileSync(path.join(here, '../sim.js'), 'utf8').replace(/^export /gm, '');
let html = fs.readFileSync(path.join(here, 'template.html'), 'utf8')
  .replace('/*SIM*/', () => sim).replace('/*PRESETS*/[]', () => fs.readFileSync(pf, 'utf8'))
  .replace('__TITLE__', title).replace('__HEADING__', heading || title).replace('__LEDE__', lede || '');
// --page wraps the fragment so the file opens directly from disk; without it the output is an Artifact fragment
if (page) html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>';
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
