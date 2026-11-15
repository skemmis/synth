const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1100}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/08-sprout.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r={};for(const k in t.PRESETS){t.load(k);const a=[];for(let i=0;i<7200;i++){t.step();if(i%1800==1799)a.push(t.stats())}r[k]=a.map(s=>s.cells+'c/'+s.perMin+'pm/'+s.bonds+'b')}t.load('Tadpole');for(let i=0;i<2500;i++)t.step();return r});
console.log(out,errs);await p.screenshot({path:path.resolve(__dirname,'08-sprout.png'),fullPage:true});await b.close()})();
