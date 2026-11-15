// node wild/gallery.mjs : writes frag/00-gallery.html (publishable) and play/index.html from the list below plus thumbs/
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const css=fs.readFileSync(dir+'/shared.css','utf8');
const G=JSON.parse(fs.readFileSync(dir+'/gallery.json','utf8'));
const img=k=>'data:image/jpeg;base64,'+fs.readFileSync(dir+'/thumbs/'+k+'.jpg').toString('base64');
const card=(g,local)=>`<article class="card"><a href="${local?g.file+'.html':g.url}" target="_blank" rel="noopener"><img src="${img(g.file)}" alt="${g.name} in play" width="700" height="436"></a>
<div class="body"><h2><a href="${local?g.file+'.html':g.url}" target="_blank" rel="noopener">${g.name}</a><span>${g.axis}</span></h2>
<p><b>Cribbed from</b> ${g.from}</p><p><b>Your hands do</b> ${g.hands}</p><p><b>Try first</b> ${g.first}</p><p class="note"><b>Playtest</b> ${g.note}</p></div></article>`;
const page=local=>`<title>Synth Menagerie</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
${css}
.wrap{max-width:1100px;gap:22px}
.lede{color:var(--dim);max-width:70ch;margin:6px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px 24px}
.card{display:flex;flex-direction:column;gap:10px;min-width:0}
.card img{display:block;width:100%;height:auto;border-radius:6px;border:1px solid var(--line)}
.card h2{font:600 1.2rem var(--display);margin:0;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.card h2 span{font:500 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--pellet)}
.card p{margin:4px 0;color:var(--dim)}
.card b{color:var(--fg);font-weight:600}
.card .note{border-top:1px solid var(--line);padding-top:8px;margin-top:8px}
a{color:var(--a)}
h2.sec{font:600 1.2rem var(--display);margin:8px 0 0}
.next{margin:0;padding-left:22px;color:var(--dim);max-width:78ch}
.next li{margin:8px 0}
.next b{color:var(--fg)}
.next code{font:500 12.5px ui-monospace,Menlo,monospace;color:var(--e)}
</style>
<main class="wrap">
<header><h1>Synth Menagerie</h1>
<p class="lede">Eleven small playable toys, each lifting one mechanism from an existing simulation and asking what a cell game built on it would feel like. They share nothing but the amber <span class="pel">pellet</span>. The point is to find out which of these your hands like, so the notes say what to do in the first minute.</p></header>
<section class="grid">
${G.items.map(g=>card(g,local)).join('\n')}
</section>
<h2 class="sec">Tests proposed next, for a yes or no</h2>
<ol class="next">
${G.next.map(n=>`<li><b>${n.name}.</b> ${n.what} <code>${n.params}</code></li>`).join('\n')}
</ol>
<h2 class="sec">Not built yet</h2>
<p class="lede">${G.notBuilt}</p>
</main>`;
fs.writeFileSync(dir+'/frag/00-gallery.html',page(false));
fs.writeFileSync(dir+'/play/index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-size:14px}</style></head><body>\n'+page(true)+'\n</body></html>');
console.log('gallery',(page(false).length/1024).toFixed(0)+' KB');
