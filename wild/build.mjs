// node wild/build.mjs : src/NN-name.html -> frag/NN-name.html (publishable fragment) and play/NN-name.html (open in a browser)
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const css=fs.readFileSync(dir+'/shared.css','utf8'),js=fs.readFileSync(dir+'/shared.js','utf8');
const font='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">';
for(const f of fs.readdirSync(dir+'/src').filter(f=>f.endsWith('.html'))){
  let s=fs.readFileSync(dir+'/src/'+f,'utf8').replace('/*SHARED_CSS*/',()=>css).replace('/*SHARED_JS*/',()=>js).replace('<!--FONT-->',font);
  fs.writeFileSync(dir+'/frag/'+f,s);
  fs.writeFileSync(dir+'/play/'+f,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font-size:14px}[hidden]{display:none!important}</style></head><body>\n'+s+'\n</body></html>');
  console.log(f,(s.length/1024).toFixed(1)+' KB');
}
