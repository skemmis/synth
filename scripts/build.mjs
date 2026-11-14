// Bundle each prototype into one self-contained HTML file.
//   play/<name>.html      full document, opens with a double click
//   .artifact/<name>.html fragment for publishing as a page (not committed)
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path';
const root = path.resolve(import.meta.dirname, '..'); const only = process.argv[2];
fs.mkdirSync(path.join(root, 'play'), { recursive: true }); fs.mkdirSync(path.join(root, '.artifact'), { recursive: true });
for (const name of fs.readdirSync(path.join(root, 'prototypes')).sort()) {
  const dir = path.join(root, 'prototypes', name);
  if (only && !name.startsWith(only)) continue;
  if (!fs.existsSync(path.join(dir, 'main.ts'))) continue;
  const workers = {};
  // optional worker entry: bundled first and embedded as a string the page turns into a blob URL
  if (fs.existsSync(path.join(dir, 'worker.ts'))) {
    const w = await build({ entryPoints: [path.join(dir, 'worker.ts')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022' });
    workers.__WORKER_SRC__ = JSON.stringify(w.outputFiles[0].text);
  }
  const r = await build({ entryPoints: [path.join(dir, 'main.ts')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', define: { __WORKER_SRC__: '""', ...workers } });
  const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const page = fs.readFileSync(path.join(dir, 'page.html'), 'utf8');
  const frag = `${page}\n<script>${js}</script>\n`;
  fs.writeFileSync(path.join(root, '.artifact', name + '.html'), frag);
  const split = page.indexOf('<div id="app">');
  fs.writeFileSync(path.join(root, 'play', name + '.html'), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n${page.slice(0, split)}</head><body>\n${page.slice(split)}<script>${js}</script>\n</body></html>\n`);
  console.log(name, (frag.length / 1024).toFixed(0) + ' KB');
}
